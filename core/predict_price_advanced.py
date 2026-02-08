"""
Advanced Car Price Prediction Script
Handles both old and new advanced model architectures
"""

import pandas as pd
import numpy as np
import pickle
import os
import sys
from datetime import datetime
from sklearn.preprocessing import LabelEncoder
import warnings
import logging
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent directory to path for imports
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

try:
    from app import config
except ImportError:
    try:
        import config
    except ImportError:
        # Fallback config
        class config:
            CURRENT_YEAR = 2025
            CONDITION_MAP = {'New': 0, 'Like New': 1, 'Excellent': 2, 'Good': 3, 'Fair': 4, 'Poor': 5}
            FUEL_TYPE_MAP = {'Gasoline': 0, 'Diesel': 1, 'Electric': 2, 'Hybrid': 3, 'Plug-in Hybrid': 4}
            DEBUG_PREDICTIONS = False
            MAKE_ENCODER_FILE = 'models/make_encoder.pkl'
            MODEL_ENCODER_FILE = 'models/model_encoder.pkl'

try:
    from utils import validate_car_data
except ImportError:
    def validate_car_data(data):
        return True, []

# ============================================================================
# Model Loading with Advanced Support
# ============================================================================
_model_cache = None
_model_info_cache = None

def load_model():
    """Load the trained model with support for both old and advanced architectures"""

    global _model_cache, _model_info_cache

    if _model_cache is not None:
        return _model_cache, _model_info_cache

    # Try model paths in priority order
    model_paths = [
        'models/advanced_car_price_model.pkl',
        'models/best_model_v2.pkl',
        'models/car_price_model.pkl',
        'models/best_model.pkl'
    ]

    model_data = None
    model_path_used = None

    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    for model_path in model_paths:
        full_path = os.path.join(BASE_DIR, model_path) if not os.path.isabs(model_path) else model_path

        if os.path.exists(full_path):
            try:
                file_size_mb = os.path.getsize(full_path) / (1024 * 1024)
                mod_time = datetime.fromtimestamp(os.path.getmtime(full_path))

                logger.info(f"Loading model from: {model_path}")
                logger.info(f"File size: {file_size_mb:.2f} MB")
                logger.info(f"Modified: {mod_time}")

                with open(full_path, 'rb') as f:
                    model_data = pickle.load(f)

                model_path_used = model_path
                logger.info(f"Model loaded successfully from {model_path}")
                break

            except Exception as e:
                logger.error(f"Failed to load {model_path}: {e}", exc_info=True)
                continue

    if model_data is None:
        error_msg = f"No valid model file found! Tried: {', '.join(model_paths)}"
        logger.error(error_msg)
        raise FileNotFoundError(error_msg)

    # Extract model and metadata
    model = model_data.get('model')
    if model is None:
        raise ValueError("Model data does not contain 'model' key")

    # Build model info dictionary
    model_info = {
        'model': model,
        'model_name': model_data.get('model_name', 'Unknown'),
        'version': model_data.get('version', 'unknown'),
        'features': model_data.get('features', []),
        'original_features': model_data.get('original_features', model_data.get('features', [])),
        'encoders': model_data.get('encoders', {}),
        'target_transform': model_data.get('target_transform', None),
        'transform_offset': model_data.get('transform_offset', 1.0),
        'poly_transformer': model_data.get('poly_transformer', None),
        'numeric_cols_for_poly': model_data.get('numeric_cols_for_poly', []),
        'make_popularity_map': model_data.get('make_popularity_map', None),
        'scaler': model_data.get('scaler', None),  # For Neural Network
        'price_range_models': model_data.get('price_range_models', {}),
        'brand_reliability': model_data.get('brand_reliability', {}),
        'luxury_brands': set(model_data.get('luxury_brands', [])),
        'premium_brands': set(model_data.get('premium_brands', [])),
        'metrics': model_data.get('metrics', {}),
        'model_path': model_path_used
    }

    logger.info(f"Model: {model_info['model_name']}")
    logger.info(f"Version: {model_info['version']}")
    logger.info(f"Features: {len(model_info['features'])}")
    logger.info(f"Has encoders: {len(model_info['encoders']) > 0}")

    _model_cache = model
    _model_info_cache = model_info

    return model, model_info

# ============================================================================
# Advanced Feature Engineering
# ============================================================================
def prepare_features_advanced(car_data, model_info):
    """
    Prepare features for advanced model with all engineered features
    """
    # Convert dict to DataFrame if needed
    if isinstance(car_data, dict):
        car_data = pd.DataFrame([car_data])

    df = car_data.copy()

    # Get feature requirements
    features = model_info['features']
    encoders = model_info['encoders']
    luxury_brands = model_info.get('luxury_brands', set())
    premium_brands = model_info.get('premium_brands', set())
    brand_reliability = model_info.get('brand_reliability', {})

    # Basic features
    if 'year' in df.columns:
        current_year = config.CURRENT_YEAR if hasattr(config, 'CURRENT_YEAR') else 2025
        df['age_of_car'] = current_year - df['year']

    # Encode categorical variables
    if 'condition' in df.columns:
        condition_map = config.CONDITION_MAP if hasattr(config, 'CONDITION_MAP') else {
            'New': 0, 'Like New': 1, 'Excellent': 2, 'Good': 3, 'Fair': 4, 'Poor': 5
        }
        df['condition_encoded'] = df['condition'].map(condition_map).fillna(3)

    if 'fuel_type' in df.columns:
        fuel_type_map = config.FUEL_TYPE_MAP if hasattr(config, 'FUEL_TYPE_MAP') else {
            'Gasoline': 0, 'Diesel': 1, 'Electric': 2, 'Hybrid': 3, 'Plug-in Hybrid': 4
        }
        df['fuel_type_encoded'] = df['fuel_type'].map(fuel_type_map).fillna(0)

    # Encode make and model using encoders from model
    if 'make' in df.columns:
        if 'make' in encoders:
            try:
                df['make_encoded'] = encoders['make'].transform(df['make'].astype(str))
            except:
                df['make_encoded'] = 0
        else:
            # Fallback hash encoding
            df['make_encoded'] = df['make'].astype(str).apply(hash) % 1000

    if 'model' in df.columns:
        if 'model' in encoders:
            try:
                df['model_encoded'] = encoders['model'].transform(df['model'].astype(str))
            except:
                df['model_encoded'] = 0
        else:
            df['model_encoded'] = df['model'].astype(str).apply(hash) % 1000

    if 'location' in df.columns:
        if 'location' in encoders:
            try:
                df['location_encoded'] = encoders['location'].transform(df['location'].astype(str))
            except:
                df['location_encoded'] = df['location'].astype(str).apply(hash) % 1000
        else:
            df['location_encoded'] = df['location'].astype(str).apply(hash) % 1000

    # Advanced features
    # 1. Luxury/Premium brand indicators
    if 'make' in df.columns:
        df['is_luxury_brand'] = df['make'].isin(luxury_brands).astype(int)
        df['is_premium_brand'] = df['make'].isin(premium_brands).astype(int)

    # 2. Age tiers
    if 'age_of_car' in df.columns:
        df['age_tier_0_3'] = ((df['age_of_car'] >= 0) & (df['age_of_car'] <= 3)).astype(int)
        df['age_tier_3_5'] = ((df['age_of_car'] > 3) & (df['age_of_car'] <= 5)).astype(int)
        df['age_tier_5_10'] = ((df['age_of_car'] > 5) & (df['age_of_car'] <= 10)).astype(int)
        df['age_tier_10_plus'] = (df['age_of_car'] > 10).astype(int)

    # 3. Mileage categories
    if 'mileage' in df.columns:
        df['mileage_low'] = (df['mileage'] < 30000).astype(int)
        df['mileage_medium'] = ((df['mileage'] >= 30000) & (df['mileage'] < 60000)).astype(int)
        df['mileage_high'] = (df['mileage'] >= 60000).astype(int)

    # 4. Brand depreciation (simplified - use average)
    if 'make' in df.columns and 'age_of_car' in df.columns:
        df['brand_depreciation_rate'] = df['make'].map({}).fillna(0)  # Would need actual map
        df['estimated_depreciation'] = df['age_of_car'] * df['brand_depreciation_rate']

    # 5. Market demand (simplified)
    df['model_demand_score'] = 0.5  # Default

    # 6. Location premium (simplified)
    df['is_premium_location'] = 0  # Default

    # 7. Brand reliability
    if 'make' in df.columns:
        df['brand_reliability'] = df['make'].map(brand_reliability).fillna(7.0)

    # 8. Fuel efficiency (estimated)
    if 'fuel_type' in df.columns and 'engine_size' in df.columns:
        df['fuel_efficiency'] = np.where(
            df['fuel_type'] == 'Electric', 100,
            np.where(
                df['fuel_type'] == 'Hybrid', 50 - df['engine_size'] * 5,
                np.where(
                    df['fuel_type'] == 'Plug-in Hybrid', 60 - df['engine_size'] * 5,
                    np.maximum(10, 35 - df['engine_size'] * 3)
                )
            )
        )

    # 9. Safety rating (year-based)
    if 'year' in df.columns:
        df['safety_rating'] = np.where(
            df['year'] >= 2020, 9.0,
            np.where(df['year'] >= 2015, 8.0,
            np.where(df['year'] >= 2010, 7.0, 6.0))
        )
        df['safety_rating'] = np.where(df['is_luxury_brand'] == 1, df['safety_rating'] + 0.5, df['safety_rating'])

    # 10. Market segment (simplified)
    if 'model' in df.columns:
        def get_segment(model_name):
            model_lower = str(model_name).lower()
            if any(x in model_lower for x in ['truck', 'pickup', 'f-150', 'silverado', 'tundra', 'ram']):
                return 'Truck'
            elif any(x in model_lower for x in ['suv', 'x5', 'q5', 'cr-v', 'rav4', 'highlander', 'pilot']):
                return 'SUV'
            elif any(x in model_lower for x in ['coupe', 'camaro', 'mustang', 'corvette', 'challenger']):
                return 'Sports'
            elif any(x in model_lower for x in ['sedan', 'camry', 'accord', 'altima', 'sonata']):
                return 'Sedan'
            return 'Other'

        df['market_segment'] = df['model'].apply(get_segment)
        if 'segment' in encoders:
            try:
                df['market_segment_encoded'] = encoders['segment'].transform(df['market_segment'])
            except:
                df['market_segment_encoded'] = 0
        else:
            df['market_segment_encoded'] = df['market_segment'].astype(str).apply(hash) % 10

    # 11. Seasonal factors (defaults)
    df['month'] = 6  # Default June
    df['quarter'] = 2  # Default Q2
    df['seasonal_premium'] = 0

    # 12. Interaction features
    if 'year' in df.columns and 'mileage' in df.columns:
        df['year_mileage_interaction'] = df['year'] * df['mileage'] / 1000

    if 'engine_size' in df.columns and 'cylinders' in df.columns:
        df['engine_cylinders_interaction'] = df['engine_size'] * df['cylinders']

    if 'is_luxury_brand' in df.columns and 'age_of_car' in df.columns:
        df['luxury_age_interaction'] = df['is_luxury_brand'] * df['age_of_car']

    if 'mileage' in df.columns and 'age_of_car' in df.columns:
        df['mileage_age_interaction'] = df['mileage'] * df['age_of_car'] / 1000

    # Ensure all required features exist
    for feature in features:
        if feature not in df.columns:
            # Fill with defaults
            if 'tier' in feature or 'low' in feature or 'medium' in feature or 'high' in feature or 'premium' in feature or 'luxury' in feature:
                df[feature] = 0
            elif 'interaction' in feature:
                df[feature] = 0
            elif 'encoded' in feature:
                df[feature] = 0
            elif feature in ['month', 'quarter', 'seasonal_premium']:
                df[feature] = 0
            elif feature == 'brand_reliability':
                df[feature] = 7.0
            elif feature == 'fuel_efficiency':
                df[feature] = 30.0
            elif feature == 'safety_rating':
                df[feature] = 7.0
            elif feature == 'model_demand_score':
                df[feature] = 0.5
            elif feature == 'brand_depreciation_rate' or feature == 'estimated_depreciation':
                df[feature] = 0
            else:
                df[feature] = 0

    # Select features in correct order
    X = df[features].copy()

    # Convert to numeric
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors='coerce')
        X[col] = X[col].fillna(X[col].median() if X[col].notna().any() else 0)

    return X

# ============================================================================
# Predict Price with Advanced Model Support
# ============================================================================
def predict_price(car_data, return_confidence=False):
    """
    Predict car price - supports both old and advanced models
    """
    try:
        # Validate input
        if isinstance(car_data, dict):
            is_valid, errors = validate_car_data(car_data)
            if not is_valid:
                raise ValueError("Invalid car data:\n" + "\n".join(f"  - {error}" for error in errors))

        # Load model
        model, model_info = load_model()

        logger.info(f"Making prediction with model: {model_info['model_name']}")

        # Prepare features
        X = prepare_features_advanced(car_data, model_info)

        # Scale if needed (for Neural Network)
        scaler = model_info.get('scaler')
        if scaler is not None:
            X_scaled = scaler.transform(X)
            predictions = model.predict(X_scaled)
        else:
            predictions = model.predict(X)

        # Handle log transformation
        target_transform = model_info.get('target_transform')
        if target_transform == 'log1p':
            predictions = np.expm1(predictions)

        # Ensure non-negative
        predictions = np.maximum(predictions, 100.0)

        # Handle return format
        if isinstance(predictions, np.ndarray):
            if predictions.size == 1:
                predictions = float(predictions.item())
            else:
                predictions = predictions.tolist()

        logger.info(f"Prediction successful: ${predictions:,.2f}" if isinstance(predictions, (int, float)) else "Predictions successful")

        if return_confidence:
            # Calculate confidence intervals
            std = predictions * 0.15 if isinstance(predictions, (int, float)) else np.array(predictions) * 0.15
            if isinstance(predictions, (int, float)):
                confidence_intervals = {
                    'lower_95': max(0, predictions - 1.96 * std),
                    'upper_95': predictions + 1.96 * std,
                    'std': std
                }
            else:
                confidence_intervals = {
                    'lower_95': np.maximum(0, np.array(predictions) - 1.96 * std),
                    'upper_95': np.array(predictions) + 1.96 * std,
                    'std': std
                }
            return predictions, confidence_intervals

        return predictions

    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise

# ============================================================================
# Model Info Function
# ============================================================================
def get_model_info():
    """Get information about the loaded model"""
    try:
        _, model_info = load_model()
        return {
            'model_name': model_info['model_name'],
            'version': model_info['version'],
            'features_count': len(model_info['features']),
            'metrics': model_info.get('metrics', {}),
            'model_path': model_info.get('model_path', 'Unknown'),
            'has_encoders': len(model_info.get('encoders', {})) > 0,
            'has_price_range_models': len(model_info.get('price_range_models', {})) > 0
        }
    except Exception as e:
        logger.error(f"Error getting model info: {e}", exc_info=True)
        return {'error': str(e)}
