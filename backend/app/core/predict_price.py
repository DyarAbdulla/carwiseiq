"""
Backend-specific prediction module for production model (91.1% accuracy)
Loads production_model.pkl and uses DataFrame for CatBoost prediction.
Falls back to dataset-based estimate when model file is not found.
"""

import pickle
import json
import logging
from pathlib import Path
from typing import Tuple, Optional, Any
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Global cache for model and info
_cached_model = None
_cached_model_info = None
_cached_encoders = None
_using_fallback = False


def _model_paths() -> list:
    """Return list of paths to check for production_model.pkl (first existing wins)."""
    current_file = Path(__file__)
    backend_dir = current_file.parent.parent.parent
    root_dir = backend_dir.parent
    return [
        backend_dir / "models" / "production_model.pkl",
        Path("/app/models/production_model.pkl"),
        root_dir / "models" / "production_model.pkl",
    ]


def _find_model_path() -> Optional[Path]:
    for p in _model_paths():
        if p.exists():
            return p
    return None


def load_model() -> Tuple[Any, dict, dict]:
    """Load the production model (91.1% accurate) or return None for fallback."""
    global _cached_model, _cached_model_info, _cached_encoders, _using_fallback

    if _cached_model is not None:
        return _cached_model, _cached_model_info, _cached_encoders

    model_path = _find_model_path()
    if not model_path:
        logger.warning("Model not found in any of: %s; using dataset fallback", [str(p) for p in _model_paths()])
        _using_fallback = True
        _cached_model = None
        _cached_model_info = {}
        _cached_encoders = {}
        return None, {}, {}

    models_dir = model_path.parent
    logger.info(f"Loading model from: {model_path}")

    try:
        with open(model_path, 'rb') as f:
            model_data = pickle.load(f)

        # Extract model from model_data dict
        if isinstance(model_data, dict):
            model = model_data.get('model')
            if model is None:
                raise ValueError("Model not found in model_data dict")
        else:
            model = model_data

        logger.info(f"✅ Model loaded successfully!")
        logger.info(f"   Model type: {type(model).__name__}")

    except Exception as e:
        logger.error(f"Failed to load model: {e}", exc_info=True)
        _using_fallback = True
        _cached_model = None
        _cached_model_info = {}
        _cached_encoders = {}
        return None, {}, {}

    # Load model info JSON
    model_info_path = models_dir / "model_info.json"
    model_info = {}
    if model_info_path.exists():
        try:
            with open(model_info_path, 'r') as f:
                model_info = json.load(f)
            logger.info(f"✅ Model info loaded")
            logger.info(
                f"   Accuracy (R²): {model_info.get('metrics', {}).get('test', {}).get('r2', 'N/A')}")
        except Exception as e:
            logger.warning(f"Could not load model_info.json: {e}")
    else:
        logger.warning(f"model_info.json not found at {model_info_path}")

    # Load encoders if available
    encoders_path = models_dir / "encoders.pkl"
    encoders = {}
    if encoders_path.exists():
        try:
            with open(encoders_path, 'rb') as f:
                encoders = pickle.load(f)
            logger.info(f"✅ Encoders loaded")
        except Exception as e:
            logger.warning(f"Could not load encoders.pkl: {e}")

    # Also check if encoders are in model_data
    if isinstance(model_data, dict) and 'encoders' in model_data:
        if not encoders:
            encoders = model_data['encoders']
        else:
            # Merge, preferring separate file
            encoders.update(model_data.get('encoders', {}))

    _cached_model = model
    _cached_model_info = model_info
    _cached_encoders = encoders

    return model, model_info, encoders


def _predict_from_dataset(car_data: dict) -> float:
    """Estimate price from dataset (mean price for make/model/year when model file missing)."""
    try:
        from app.services.dataset_loader import DatasetLoader
        loader = DatasetLoader.get_instance()
        df = loader.dataset
        if df is None or len(df) == 0:
            logger.warning("Dataset not loaded; using default estimate")
            return 25000.0
        price_col = loader.get_price_column() or "price"
        if price_col not in df.columns:
            return 25000.0
        make = str(car_data.get("make", "")).strip()
        model_name = str(car_data.get("model", "")).strip()
        year = int(car_data.get("year", 2020))
        mileage = car_data.get("mileage")
        if mileage is None or (isinstance(mileage, float) and np.isnan(mileage)):
            mileage = 50000
        mileage = float(mileage)
        mask = pd.Series(True, index=df.index)
        if make:
            mask &= df["make"].astype(str).str.strip().str.lower() == make.lower()
        if model_name:
            mask &= df["model"].astype(str).str.strip().str.lower() == model_name.lower()
        mask &= df["year"].astype(int) == year
        subset = df.loc[mask]
        if len(subset) == 0:
            subset = df[(df["make"].astype(str).str.strip().str.lower() == make.lower()) & (df["model"].astype(str).str.strip().str.lower() == model_name.lower())]
        if len(subset) == 0:
            subset = df[df["make"].astype(str).str.strip().str.lower() == make.lower()]
        if len(subset) == 0:
            subset = df
        prices = subset[price_col].dropna()
        if len(prices) == 0:
            return 25000.0
        # Simple adjustment by mileage vs subset mean
        mean_price = float(prices.mean())
        mean_mileage = subset["mileage"].mean() if "mileage" in subset.columns else 50000
        if pd.notna(mean_mileage) and mean_mileage > 0:
            # Lower mileage -> higher price (rough factor)
            ratio = mean_mileage / max(mileage, 1000)
            ratio = min(2.0, max(0.5, ratio))
            estimate = mean_price * ratio
        else:
            estimate = mean_price
        return float(max(500, min(1000000, estimate)))
    except Exception as e:
        logger.warning("Dataset fallback failed: %s", e)
        return 25000.0


def predict_price(car_data: dict, return_confidence: bool = False):
    """
    Predict price using CatBoost model or dataset fallback when model file is missing.

    Args:
        car_data: Dictionary containing car features
        return_confidence: Whether to return confidence intervals (not implemented yet)

    Returns:
        Predicted price as float
    """
    try:
        # Load model (may return None when file not found)
        model, model_info, encoders = load_model()

        if model is None:
            return _predict_from_dataset(car_data)

        # Get feature columns from model_info (try both keys)
        feature_columns = model_info.get(
            'feature_columns') or model_info.get('features', [])

        if not feature_columns:
            logger.warning("feature_columns not found in model_info; using dataset fallback")
            return _predict_from_dataset(car_data)

        logger.info(
            f"Using {len(feature_columns)} features: {feature_columns[:5]}...")

        logger.info(
            f"Using {len(feature_columns)} features from model_info.json")

        # Prepare input data dictionary
        input_data = {}
        current_year = 2026  # Match training

        for col in feature_columns:
            if col == 'age_of_car':
                # Calculate age from year
                year = int(car_data.get('year', 2020))
                input_data[col] = max(0, current_year - year)
            elif col == 'make_encoded':
                # Encode make
                make = str(car_data.get('make', '')).strip()
                if encoders and 'make' in encoders:
                    try:
                        encoder = encoders['make']
                        # Check if it's a LabelEncoder
                        if hasattr(encoder, 'classes_'):
                            # Handle unseen values - use 0 as default
                            try:
                                input_data[col] = encoder.transform([make])[0]
                            except ValueError:
                                # Unseen value - use 0
                                input_data[col] = 0
                                logger.warning(
                                    f"Unseen make '{make}', using default encoding 0")
                        else:
                            input_data[col] = 0
                    except Exception as e:
                        logger.warning(
                            f"Error encoding make '{make}': {e}, using 0")
                        input_data[col] = 0
                else:
                    # Fallback: hash-based encoding
                    input_data[col] = abs(hash(make)) % 1000
            elif col == 'model_encoded':
                # Encode model
                model_name = str(car_data.get('model', '')).strip()
                if encoders and 'model' in encoders:
                    try:
                        encoder = encoders['model']
                        if hasattr(encoder, 'classes_'):
                            try:
                                input_data[col] = encoder.transform([model_name])[
                                    0]
                            except ValueError:
                                # Unseen value - use 0
                                input_data[col] = 0
                                logger.warning(
                                    f"Unseen model '{model_name}', using default encoding 0")
                        else:
                            input_data[col] = 0
                    except Exception as e:
                        logger.warning(
                            f"Error encoding model '{model_name}': {e}, using 0")
                        input_data[col] = 0
                else:
                    input_data[col] = abs(hash(model_name)) % 1000
            elif col == 'condition_encoded':
                # Map condition to encoded value
                condition = str(car_data.get('condition', 'Good')).strip()
                condition_map = {
                    'Excellent': 0,
                    'Very Good': 1,
                    'Good': 2,
                    'Fair': 3,
                    'Poor': 4
                }
                input_data[col] = condition_map.get(
                    condition, 2)  # Default to 'Good'
            elif col == 'fuel_type_encoded':
                # Map fuel type to encoded value
                fuel_type = str(car_data.get('fuel_type', 'Gasoline')).strip()
                fuel_map = {
                    'Gasoline': 0,
                    'Diesel': 1,
                    'Hybrid': 2,
                    'Electric': 3,
                    'Other': 4
                }
                input_data[col] = fuel_map.get(
                    fuel_type, 0)  # Default to 'Gasoline'
            elif col == 'location_encoded':
                # Hash-based encoding for location
                location = str(car_data.get('location', 'Unknown')).strip()
                input_data[col] = abs(hash(location)) % 1000
            elif col in car_data:
                # Direct mapping for numeric columns
                val = car_data[col]
                if pd.isna(val) or val is None:
                    # Use default values
                    defaults = {
                        'year': 2020,
                        'mileage': 50000,
                        'engine_size': 2.0,
                        'cylinders': 4
                    }
                    input_data[col] = defaults.get(col, 0)
                else:
                    input_data[col] = float(val)
            else:
                # Missing feature - use default
                defaults = {
                    'year': 2020,
                    'mileage': 50000,
                    'engine_size': 2.0,
                    'cylinders': 4
                }
                input_data[col] = defaults.get(col, 0)
                logger.warning(
                    f"Missing feature '{col}', using default value: {input_data[col]}")

        # Create DataFrame with EXACT feature order (CatBoost requires DataFrame!)
        df = pd.DataFrame([input_data])

        # Ensure column order matches training exactly
        df = df[feature_columns]

        logger.info(f"Predicting with features: {list(df.columns)}")
        logger.info(f"Feature values: {df.iloc[0].to_dict()}")

        # Predict (CatBoost handles categorical features automatically in DataFrame)
        try:
            prediction = model.predict(df)

            # Handle different return types
            if isinstance(prediction, np.ndarray):
                prediction = float(prediction[0])
            elif isinstance(prediction, (list, tuple)):
                prediction = float(prediction[0])
            else:
                prediction = float(prediction)

        except Exception as e:
            logger.error(f"Prediction failed: {e}", exc_info=True)
            raise RuntimeError(f"Model prediction failed: {e}")

        # Validate prediction (increased max for luxury vehicles)
        if not np.isfinite(prediction) or prediction < 500:
            logger.warning(
                f"⚠️ Invalid prediction: {prediction}, using fallback")
            prediction = 15000  # Fallback
        elif prediction > 1000000:  # Cap at 1M for safety, but allow luxury cars
            logger.warning(
                f"⚠️ Very high prediction: ${prediction:,.2f}, capping at 1M")
            prediction = 1000000

        logger.info(f"✅ Predicted price: ${prediction:,.2f}")

        return float(prediction)

    except FileNotFoundError as e:
        logger.warning(f"Model file not found: {e}; using dataset fallback")
        return _predict_from_dataset(car_data)
    except Exception as e:
        logger.error(f"❌ Prediction error: {e}", exc_info=True)
        import traceback
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        # Return fallback price instead of crashing
        logger.warning("Returning fallback price due to error")
        return 15000.0
