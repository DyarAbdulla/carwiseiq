"""
Car Price Prediction Script
Loads the trained model and predicts prices for new car data
"""

from utils import validate_car_data
import pandas as pd
import numpy as np
import pickle
import os
import sys
from datetime import datetime
from pathlib import Path
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings('ignore')

# Add parent directory to path for imports
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

try:
    from app import config
except ImportError:
    # Fallback: try importing config from root
    import config


# ============================================================================
# Load Model and Encoders
# ============================================================================

def safe_float(value, default=None):
    """Safely convert value to float, handling strings and None"""
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def load_model():
    """Load the trained model with proper error handling - tries v4 model first (83.76% accuracy)"""

    # Try production model first (PRIORITY - trained on IQCars dataset)
    model_paths = [
        'models/production_model.pkl',  # Production model: trained on IQCars
        'models/production_model_v2.pkl',  # Alternative production model name
        'models/best_model_v4.pkl',  # Fallback: Latest model: 83.76% accuracy, GPU optimized
        'models/best_model_v3.pkl',  # Fallback: Previous model: 83% accuracy
        'models/xgboost_model_v3.pkl',  # Fallback: XGBoost v3
        'models/ensemble_model_v3.pkl',  # Fallback: Ensemble v3
        'models/advanced_car_price_model.pkl',  # Fallback: Advanced model
        'models/best_model_v2.pkl',  # Fallback: Old model: 53% accuracy
        'models/car_price_model.pkl',
        'models/best_model.pkl'
    ]

    model_data = None
    model_path_used = None

    # Get base directory (same as config.py uses - project root)
    BASE_DIR = Path(__file__).parent.parent.resolve()

    for model_path in model_paths:
        # Handle both relative and absolute paths
        if Path(model_path).is_absolute():
            full_path = Path(model_path)
        else:
            # If path contains 'models/', use as-is relative to BASE_DIR
            full_path = BASE_DIR / model_path

        # Normalize path for Windows compatibility
        try:
            full_path = full_path.resolve()
        except (OSError, ValueError) as e:
            # Skip invalid paths
            print(f"[WARNING] Invalid path {model_path}: {e}", file=sys.stderr)
            continue

        if full_path.exists() and full_path.is_file():
            # Show file info (with error handling for Windows path issues)
            try:
                mod_time = datetime.fromtimestamp(full_path.stat().st_mtime)
                file_size = full_path.stat().st_size / (1024*1024)  # MB
            except (OSError, ValueError) as e:
                print(f"[WARNING] Could not get file info for {full_path}: {e}", file=sys.stderr)
                mod_time = datetime.now()
                file_size = 0

            print(f"\n{'='*50}", file=sys.stderr)
            print(f"LOADING MODEL: {model_path}", file=sys.stderr)
            print(f"Full path: {str(full_path)}", file=sys.stderr)
            # Safe file size formatting
            try:
                file_size_str = f"{file_size:.2f} MB"
            except (ValueError, TypeError):
                file_size_str = f"{file_size} MB" if file_size else "0 MB"
            print(f"File size: {file_size_str}", file=sys.stderr)
            print(f"Modified: {mod_time}", file=sys.stderr)
            print(f"{'='*50}\n", file=sys.stderr)

            try:
                with open(str(full_path), 'rb') as f:
                    model_data = pickle.load(f)

                print(
                    f"[OK] Model loaded successfully from {model_path}!", file=sys.stderr)
                print(
                    f"[OK] Model type: {model_data.get('model_name', 'Unknown')}", file=sys.stderr)
                model_path_used = model_path
                break

            except Exception as e:
                print(
                    f"[ERROR] Failed to load {model_path}: {e}", file=sys.stderr)
                import traceback
                traceback.print_exc(file=sys.stderr)
                continue

    if model_data is None:
        error_msg = f"ERROR: No valid model file found! Tried: {', '.join(model_paths)}"
        print(error_msg, file=sys.stderr)
        print("Please run core/retrain_iqcars.py first to train the production model.", file=sys.stderr)
        raise FileNotFoundError("No model file found")

    model = model_data['model']
    # v4 uses 'feature_names', v3 uses 'features' - handle both
    features = model_data.get('feature_names', model_data.get('features', []))
    model_name = model_data.get('model_name', 'Unknown')
    model_version = model_data.get('version', 'unknown')
    
    # Try to load model_info.json for feature ordering (production model)
    model_info_json_path = BASE_DIR / 'models' / 'model_info.json'
    model_info_json = {}
    if model_info_json_path.exists():
        try:
            import json
            with open(model_info_json_path, 'r') as f:
                model_info_json = json.load(f)
            # Use feature_columns from JSON if available (more reliable)
            if 'features' in model_info_json and isinstance(model_info_json['features'], list):
                features = model_info_json['features']
                print(f"[OK] Using feature order from model_info.json: {len(features)} features", file=sys.stderr)
        except Exception as e:
            print(f"[WARNING] Could not load model_info.json: {e}", file=sys.stderr)

    # Load v4/v3 model specific settings (image features)
    # v4 stores: n_image_features, v3 stores: image_feature_dim
    n_image_features = model_data.get('n_image_features', 0)
    image_feature_dim = model_data.get('image_feature_dim', n_image_features)
    image_features_enabled = (image_feature_dim > 0) or (n_image_features > 0)

    # Load transformation info (for log transformation)
    target_transform = model_data.get(
        'target_transform', None)  # 'log1p' or None
    transform_offset = model_data.get('transform_offset', 1.0)

    # Load polynomial transformer if available
    poly_transformer = model_data.get('poly_transformer', None)
    numeric_cols_for_poly = model_data.get('numeric_cols_for_poly', [])
    original_features = model_data.get('original_features', features)
    make_popularity_map = model_data.get('make_popularity_map', None)

    # Advanced model support - load encoders from 'encoders' dict
    encoders = model_data.get('encoders', {})

    # Backward compatibility - load individual encoders if 'encoders' dict not present
    if not encoders:
        if 'make_encoder' in model_data:
            encoders['make'] = model_data['make_encoder']
        if 'model_encoder' in model_data:
            encoders['model'] = model_data['model_encoder']
        if 'location_encoder' in model_data:
            encoders['location'] = model_data['location_encoder']
        if 'condition_encoder' in model_data:
            encoders['condition'] = model_data['condition_encoder']
        if 'fuel_type_encoder' in model_data:
            encoders['fuel_type'] = model_data['fuel_type_encoder']
        if 'segment_encoder' in model_data or 'segment' in model_data.get('encoders', {}):
            encoders['segment'] = model_data.get(
                'segment_encoder') or model_data.get('encoders', {}).get('segment')

    # Load scaler (REQUIRED for v3/v4 models)
    scaler = model_data.get('scaler', None)

    # Try loading from separate file if not in model (production model or v4 saves separately)
    if scaler is None:
        scaler_paths = [
            'models/scaler.pkl',  # Production model scaler (if exists)
            f'models/scaler_{model_version}.pkl',
            'models/scaler_v4.pkl',
            'models/scaler_v3.pkl'
        ]
        for scaler_path in scaler_paths:
            full_scaler_path = BASE_DIR / scaler_path
            try:
                full_scaler_path = full_scaler_path.resolve()
            except (OSError, ValueError):
                continue
            if full_scaler_path.exists() and full_scaler_path.is_file():
                try:
                    with open(str(full_scaler_path), 'rb') as f:
                        scaler = pickle.load(f)
                    print(
                        f"[OK] Scaler loaded from {scaler_path}", file=sys.stderr)
                    break
                except Exception as e:
                    print(
                        f"[WARNING] Failed to load scaler from {scaler_path}: {e}", file=sys.stderr)
                    continue

        if scaler is None:
            print(
                f"[WARNING] Scaler not found for {model_version} model! This may cause prediction errors.", file=sys.stderr)

    # Try loading encoders from separate file if not in model (production model or v3/v4 saves separately)
    if not encoders or (model_version == '2.0' and not encoders):
        encoder_paths = [
            'models/encoders.pkl',  # Production model encoders
            f'models/encoders_{model_version}.pkl',
            'models/encoders_v4.pkl',
            'models/encoders_v3.pkl'
        ]
        for encoder_path in encoder_paths:
            full_encoder_path = BASE_DIR / encoder_path
            try:
                full_encoder_path = full_encoder_path.resolve()
            except (OSError, ValueError):
                continue
            if full_encoder_path.exists() and full_encoder_path.is_file():
                try:
                    with open(str(full_encoder_path), 'rb') as f:
                        encoders = pickle.load(f)
                    print(
                        f"[OK] Encoders loaded from {encoder_path}", file=sys.stderr)
                    break
                except Exception as e:
                    print(
                        f"[WARNING] Failed to load encoders from {encoder_path}: {e}", file=sys.stderr)
                    continue

    # Load advanced model metadata
    luxury_brands = set(model_data.get('luxury_brands', []))
    premium_brands = set(model_data.get('premium_brands', []))
    brand_reliability = model_data.get('brand_reliability', {})
    price_range_models = model_data.get('price_range_models', {})

    # Load model metrics for confidence intervals (safe type conversion)
    # Metrics may be missing or malformed - don't crash
    model_metrics = {}
    try:
        model_metrics = model_data.get('metrics', {})
        if not isinstance(model_metrics, dict):
            model_metrics = {}
    except Exception as e:
        print(f"[WARNING] Could not load metrics from model: {e}", file=sys.stderr)
        model_metrics = {}
    
    # Default to old RMSE if not found
    model_rmse = safe_float(model_metrics.get('rmse'), 6883.0)

    # Debug output
    print(
        f"[DEBUG] Model loaded: {model_name} (v{model_version})", file=sys.stderr)
    print(f"[DEBUG] Target transform: {target_transform}", file=sys.stderr)
    print(f"[DEBUG] Features count: {len(features)}", file=sys.stderr)
    print(
        f"[DEBUG] Image features enabled: {image_features_enabled}", file=sys.stderr)
    if image_features_enabled:
        print(
            f"[DEBUG] Image feature dimension: {image_feature_dim}", file=sys.stderr)
    print(f"[DEBUG] Has scaler: {scaler is not None}", file=sys.stderr)
    print(
        f"[DEBUG] Has poly_transformer: {poly_transformer is not None}", file=sys.stderr)
    print(
        f"[DEBUG] Has make_popularity_map: {make_popularity_map is not None}", file=sys.stderr)
    print(
        f"[DEBUG] Original features count: {len(original_features) if original_features else 0}", file=sys.stderr)
    if model_metrics:
        r2_val = safe_float(model_metrics.get('r2_score'))
        if r2_val is not None:
            print(f"[DEBUG] Model R²: {r2_val:.4f}", file=sys.stderr)
        else:
            print(f"[DEBUG] Model R²: N/A", file=sys.stderr)
        
        if model_rmse is not None:
            print(f"[DEBUG] Model RMSE: ${model_rmse:,.2f}", file=sys.stderr)
        else:
            print(f"[DEBUG] Model RMSE: N/A", file=sys.stderr)

    # Load encoders from model data or separate files (backward compatibility)
    make_encoder = encoders.get('make')
    model_encoder = encoders.get('model')

    # Fallback to separate encoder files if not in model data
    if make_encoder is None:
        try:
            # config.MAKE_ENCODER_FILE is already a Path object
            make_encoder_path = Path(config.MAKE_ENCODER_FILE) if not isinstance(config.MAKE_ENCODER_FILE, Path) else config.MAKE_ENCODER_FILE
            make_encoder_path = make_encoder_path.resolve()
            if make_encoder_path.exists() and make_encoder_path.is_file():
                with open(str(make_encoder_path), 'rb') as f:
                    make_encoder = pickle.load(f)
                print(f"[OK] Make encoder loaded from file", file=sys.stderr)
        except (OSError, ValueError, Exception, AttributeError):
            pass

    if model_encoder is None:
        try:
            # config.MODEL_ENCODER_FILE is already a Path object
            model_encoder_path = Path(config.MODEL_ENCODER_FILE) if not isinstance(config.MODEL_ENCODER_FILE, Path) else config.MODEL_ENCODER_FILE
            model_encoder_path = model_encoder_path.resolve()
            if model_encoder_path.exists() and model_encoder_path.is_file():
                with open(str(model_encoder_path), 'rb') as f:
                    model_encoder = pickle.load(f)
                print(f"[OK] Model encoder loaded from file", file=sys.stderr)
        except (OSError, ValueError, Exception, AttributeError):
            pass

    # Return tuple with all necessary data (added image_features_enabled, image_feature_dim, model_version, model_rmse)
    return (model, features, model_name, make_encoder, model_encoder, target_transform,
            transform_offset, poly_transformer, numeric_cols_for_poly, original_features,
            make_popularity_map, scaler, encoders, luxury_brands, premium_brands,
            brand_reliability, price_range_models, image_features_enabled, image_feature_dim,
            model_version, model_rmse)

# ============================================================================
# Image Feature Extraction
# ============================================================================


def extract_image_features(car_data, feature_dim=2048, image_path=None):
    """
    Extract image features from car image if available.
    If no image provided, returns zero vector (mean features).

    Parameters:
    -----------
    car_data : dict or pd.DataFrame
        Car data that may contain 'image_path' or 'image_url'
    feature_dim : int
        Dimension of image features (default: 2048 for ResNet50, 512 after PCA)
    image_path : str or Path, optional
        Explicit image path to use

    Returns:
    --------
    image_features : np.ndarray
        Image features array of shape (n_samples, feature_dim)
    """
    if isinstance(car_data, dict):
        n_samples = 1
    else:
        n_samples = len(car_data)

    # Try to get image path
    if image_path is None:
        if isinstance(car_data, dict):
            image_path = car_data.get('image_path') or car_data.get(
                'image_url') or car_data.get('image_filename')
        else:
            # DataFrame - try to get from first row
            for col in ['image_path', 'image_url', 'image_filename']:
                if col in car_data.columns:
                    image_path = car_data[col].iloc[0] if len(
                        car_data) > 0 else None
                    break

    # If image path provided, try to extract features
    if image_path:
        try:
            # Check if optimized features cache exists
            features_cache_file = Path("cache/image_features_cache.pkl")
            if features_cache_file.exists():
                # Try to load from cache (would need index mapping)
                # For now, return zero vector and log
                if config.DEBUG_PREDICTIONS:
                    print(
                        f"[DEBUG] Image path provided but using cached features", file=sys.stderr)

            # TODO: Implement on-demand feature extraction for user-uploaded images
            # For now, return zero vector (mean features)
            return np.zeros((n_samples, feature_dim), dtype=np.float32)
        except Exception as e:
            if config.DEBUG_PREDICTIONS:
                print(
                    f"[WARNING] Failed to extract image features: {e}", file=sys.stderr)

    # Return zero vector (represents mean image features)
    # This allows models to work without images
    return np.zeros((n_samples, feature_dim), dtype=np.float32)

# ============================================================================
# Prepare Input Data
# ============================================================================


def prepare_features(car_data, features, make_encoder=None, model_encoder=None,
                     poly_transformer=None, numeric_cols_for_poly=None, original_features=None,
                     make_popularity_map=None, encoders=None, luxury_brands=None, premium_brands=None,
                     brand_reliability=None):
    """
    Prepare car data for prediction with all engineered features

    Parameters:
    -----------
    car_data : dict or pd.DataFrame
        Car information with keys: year, mileage, engine_size, cylinders,
        condition, fuel_type, location, make, model
    features : list
        List of feature names expected by the model (after polynomial transformation)
    make_encoder : LabelEncoder, optional
        Encoder for make column
    model_encoder : LabelEncoder, optional
        Encoder for model column
    poly_transformer : PolynomialFeatures, optional
        Polynomial transformer if model uses polynomial features
    numeric_cols_for_poly : list, optional
        List of numeric columns used for polynomial features
    original_features : list, optional
        Original features before polynomial transformation

    Returns:
    --------
    X : pd.DataFrame
        Prepared features ready for prediction
    """
    # Convert dict to DataFrame if needed
    if isinstance(car_data, dict):
        car_data = pd.DataFrame([car_data])

    # Create a copy
    df = car_data.copy()

    # Calculate age_of_car if year is provided
    if 'year' in df.columns:
        current_year = config.CURRENT_YEAR
        # Ensure age is never negative (for future years)
        df['age_of_car'] = np.maximum(0, current_year - df['year'])

    # Encode categorical variables
    if 'condition' in df.columns:
        # Map condition to encoded value
        df['condition_encoded'] = df['condition'].map(
            config.CONDITION_MAP).fillna(3)

    if 'fuel_type' in df.columns:
        df['fuel_type_encoded'] = df['fuel_type'].map(
            config.FUEL_TYPE_MAP).fillna(0)

    if 'location' in df.columns:
        # Use a simple hash-based encoding if encoder not available
        if 'location_encoded' not in df.columns:
            df['location_encoded'] = df['location'].astype(
                str).apply(hash) % 1000

    # Encode make and model (use encoders dict if available, fallback to individual encoders)
    if 'make' in df.columns:
        if encoders and 'make' in encoders:
            try:
                df['make_encoded'] = encoders['make'].transform(
                    df['make'].astype(str))
            except:
                df['make_encoded'] = 0
        elif make_encoder is not None:
            try:
                df['make_encoded'] = make_encoder.transform(
                    df['make'].astype(str))
            except:
                df['make_encoded'] = 0
        else:
            df['make_encoded'] = df['make'].astype(str).apply(hash) % 1000

    if 'model' in df.columns:
        if encoders and 'model' in encoders:
            try:
                df['model_encoded'] = encoders['model'].transform(
                    df['model'].astype(str))
            except:
                df['model_encoded'] = 0
        elif model_encoder is not None:
            try:
                df['model_encoded'] = model_encoder.transform(
                    df['model'].astype(str))
            except:
                df['model_encoded'] = 0
        else:
            df['model_encoded'] = df['model'].astype(str).apply(hash) % 1000

    # Encode location if encoder available
    if 'location' in df.columns:
        if encoders and 'location' in encoders:
            try:
                df['location_encoded'] = encoders['location'].transform(
                    df['location'].astype(str))
            except:
                df['location_encoded'] = df['location'].astype(
                    str).apply(hash) % 1000
        elif 'location_encoded' not in df.columns:
            df['location_encoded'] = df['location'].astype(
                str).apply(hash) % 1000

    # Advanced feature engineering (v4 compatible)
    # 1. Age-based depreciation curves (v4 feature)
    if 'age_of_car' in df.columns:
        df['new_car_penalty'] = np.where(df['age_of_car'] <= 1, 0.85,
                                         np.where(df['age_of_car'] <= 3, 0.75,
                                                  np.where(df['age_of_car'] <= 5, 0.65,
                                                           np.where(df['age_of_car'] <= 10, 0.50, 0.35))))
    else:
        df['new_car_penalty'] = 0.65

    # 2. Mileage per year (v4 feature)
    if 'mileage' in df.columns and 'age_of_car' in df.columns:
        df['mileage_per_year'] = df['mileage'] / (df['age_of_car'] + 1)
        df['high_mileage_flag'] = (df['mileage_per_year'] > 15000).astype(int)
    else:
        df['mileage_per_year'] = 0
        df['high_mileage_flag'] = 0

    # 3. Luxury/Premium brand indicators
    if luxury_brands and 'make' in df.columns:
        df['is_luxury_brand'] = df['make'].isin(luxury_brands).astype(int)
    else:
        # Default luxury brands if not provided
        default_luxury = {'Mercedes', 'BMW', 'Audi', 'Porsche', 'Lexus', 'Land Rover', 'Tesla',
                          'Jaguar', 'Maserati', 'Bentley', 'Rolls-Royce', 'Lamborghini', 'Ferrari'}
        if 'make' in df.columns:
            df['is_luxury_brand'] = df['make'].isin(default_luxury).astype(int)
        else:
            df['is_luxury_brand'] = 0

    if premium_brands and 'make' in df.columns:
        df['is_premium_brand'] = df['make'].isin(premium_brands).astype(int)
    else:
        # Default premium brands if not provided
        default_premium = {'Acura', 'Infiniti', 'Volvo', 'Cadillac', 'Lincoln'}
        if 'make' in df.columns:
            df['is_premium_brand'] = df['make'].isin(
                default_premium).astype(int)
        else:
            df['is_premium_brand'] = 0

    # 2. Age tiers
    if 'age_of_car' in df.columns:
        df['age_tier_0_3'] = ((df['age_of_car'] >= 0) & (
            df['age_of_car'] <= 3)).astype(int)
        df['age_tier_3_5'] = ((df['age_of_car'] > 3) & (
            df['age_of_car'] <= 5)).astype(int)
        df['age_tier_5_10'] = ((df['age_of_car'] > 5) & (
            df['age_of_car'] <= 10)).astype(int)
        df['age_tier_10_plus'] = (df['age_of_car'] > 10).astype(int)

    # 3. Mileage categories
    if 'mileage' in df.columns:
        df['mileage_low'] = (df['mileage'] < 30000).astype(int)
        df['mileage_medium'] = ((df['mileage'] >= 30000) & (
            df['mileage'] < 60000)).astype(int)
        df['mileage_high'] = (df['mileage'] >= 60000).astype(int)

    # 4. Brand depreciation (simplified)
    if 'age_of_car' in df.columns:
        # Would need actual map from training
        df['brand_depreciation_rate'] = 0
        df['estimated_depreciation'] = df['age_of_car'] * \
            df['brand_depreciation_rate']

    # 5. Market demand (simplified)
    df['model_demand_score'] = 0.5

    # 6. Location premium (simplified)
    df['is_premium_location'] = 0

    # 7. Brand reliability
    if brand_reliability and 'make' in df.columns:
        df['brand_reliability'] = df['make'].map(brand_reliability).fillna(7.0)
    else:
        df['brand_reliability'] = 7.0

    # 8. Fuel efficiency (estimated)
    if 'fuel_type' in df.columns and 'engine_size' in df.columns:
        df['fuel_efficiency'] = np.where(
            df['fuel_type'] == 'Electric', 100,
            np.where(
                df['fuel_type'] == 'Hybrid', 50 - df['engine_size'] * 5,
                np.where(
                    df['fuel_type'] == 'Plug-in Hybrid', 60 -
                    df['engine_size'] * 5,
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
        if 'is_luxury_brand' in df.columns:
            df['safety_rating'] = np.where(
                df['is_luxury_brand'] == 1, df['safety_rating'] + 0.5, df['safety_rating'])

    # 4. Condition numeric encoding (v4 feature)
    if 'condition' in df.columns:
        condition_map = {
            'New': 6, 'Like New': 5, 'Excellent': 4, 'Good': 3,
            'Fair': 2, 'Poor': 1, 'Salvage': 0, 'Used': 3
        }
        df['condition_numeric'] = df['condition'].map(condition_map).fillna(3)
    else:
        df['condition_numeric'] = 3

    # 5. Popular model flag (v4 feature - simplified, would need training data for accurate)
    # Default to 0, would need model counts from training
    df['is_popular_model'] = 0

    # 10. Market segment (v4 compatible)
    if 'model' in df.columns:
        def get_segment(row):
            make = str(row.get('make', '')).lower(
            ) if isinstance(row, dict) else ''
            model = str(row.get('model', '')).lower() if isinstance(
                row, dict) else str(row).lower()

            # Luxury
            if any(x in make for x in ['mercedes', 'bmw', 'audi', 'porsche', 'lexus', 'tesla']):
                return 'luxury'
            # Sports
            if any(x in model for x in ['mustang', 'camaro', 'corvette', 'challenger', 'charger', 'gt', 'sport']):
                return 'sports'
            # Truck
            if any(x in model for x in ['f-150', 'silverado', 'ram', 'tundra', 'tacoma', 'ranger', 'truck']):
                return 'truck'
            # SUV
            if any(x in model for x in ['suv', 'crossover', 'cr-v', 'rav4', 'pilot', 'explorer', 'tahoe', 'suburban']):
                return 'suv'
            # Economy
            if any(x in make for x in ['kia', 'hyundai', 'mitsubishi', 'nissan']):
                return 'economy'
            # Default to mid-range
            return 'mid-range'

        if isinstance(df['model'].iloc[0] if len(df) > 0 else None, pd.Series):
            df['market_segment'] = df.apply(get_segment, axis=1)
        else:
            df['market_segment'] = df['model'].apply(
                lambda x: get_segment({'model': x}))

        if encoders and 'segment' in encoders:
            try:
                df['market_segment_encoded'] = encoders['segment'].transform(
                    df['market_segment'])
            except:
                df['market_segment_encoded'] = 0
        else:
            df['market_segment_encoded'] = df['market_segment'].astype(
                str).apply(hash) % 10
    else:
        df['market_segment'] = 'mid-range'
        df['market_segment_encoded'] = 0

    # 11. Seasonal factors (defaults)
    df['month'] = 6
    df['quarter'] = 2
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

    # v4 interaction features
    if 'condition_numeric' in df.columns and 'age_of_car' in df.columns:
        df['condition_age_interaction'] = df['condition_numeric'] * df['age_of_car']

    # 13. Brand popularity (use map from training if available)
    if make_popularity_map is not None and 'make' in df.columns:
        df['brand_popularity'] = df['make'].map(
            make_popularity_map).fillna(0.5)
    else:
        df['brand_popularity'] = 0.5

    # Build base feature list (before polynomial transformation)
    base_feature_cols = ['year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
                         'condition_encoded', 'fuel_type_encoded', 'location_encoded',
                         'make_encoded', 'model_encoded']

    engineered_features = ['brand_popularity',
                           'year_mileage_interaction', 'engine_cylinders_interaction']

    # Combine all base features
    all_base_features = base_feature_cols + \
        [f for f in engineered_features if f in df.columns]

    # Select base features that exist
    available_base_features = [
        col for col in all_base_features if col in df.columns]

    # Fill missing base features with defaults
    for feature in all_base_features:
        if feature not in df.columns:
            if feature == 'year':
                df[feature] = 2020
            elif feature == 'mileage':
                df[feature] = 50000
            elif feature == 'engine_size':
                df[feature] = 2.0
            elif feature == 'cylinders':
                df[feature] = 4
            elif feature == 'age_of_car':
                df[feature] = 5
            elif 'encoded' in feature or feature in engineered_features:
                df[feature] = 0
            else:
                df[feature] = 0

    # Ensure all base features exist
    for feature in all_base_features:
        if feature not in df.columns:
            df[feature] = 0

    # Use original_features if provided (from model training), otherwise use available_base_features
    # original_features is the list of features used before polynomial transformation
    if original_features:
        # Ensure all original_features exist in df, fill missing with defaults
        for feature in original_features:
            if feature not in df.columns:
                if feature == 'year':
                    df[feature] = 2020
                elif feature == 'mileage':
                    df[feature] = 50000
                elif feature == 'engine_size':
                    df[feature] = 2.0
                elif feature == 'cylinders':
                    df[feature] = 4
                elif feature == 'age_of_car':
                    df[feature] = 5
                else:
                    df[feature] = 0
        features_to_use = [f for f in original_features if f in df.columns]
    else:
        features_to_use = available_base_features

    X_base = df[features_to_use].copy()

    # Apply polynomial transformation if available
    if poly_transformer is not None and numeric_cols_for_poly:
        # Separate numeric columns for polynomial features
        numeric_cols_for_poly_available = [
            col for col in numeric_cols_for_poly if col in X_base.columns]

        if numeric_cols_for_poly_available:
            # Apply polynomial transformation
            X_poly = poly_transformer.transform(
                X_base[numeric_cols_for_poly_available])
            poly_feature_names = poly_transformer.get_feature_names_out(
                numeric_cols_for_poly_available)

            # Create DataFrame with polynomial features
            X_poly_df = pd.DataFrame(
                X_poly, columns=poly_feature_names, index=X_base.index)

            # Remove original numeric columns and combine with polynomial features
            X_final = X_base.drop(columns=numeric_cols_for_poly_available)
            X = pd.concat([X_final, X_poly_df], axis=1)
        else:
            X = X_base
    else:
        # No polynomial transformation
        X = X_base

    # CRITICAL: Ensure features match model_info.json order exactly
    # Load model_info.json if available to get exact feature order
    BASE_DIR = Path(__file__).parent.parent.resolve()
    model_info_path = BASE_DIR / 'models' / 'model_info.json'
    if model_info_path.exists():
        try:
            import json
            with open(model_info_path, 'r') as f:
                model_info = json.load(f)
            # Use feature_columns from JSON if available (exact order)
            json_features = model_info.get('feature_columns') or model_info.get('features', [])
            if json_features and len(json_features) > 0:
                features = json_features
                print(f"[INFO] Using feature order from model_info.json: {len(features)} features", file=sys.stderr)
        except Exception as e:
            print(f"[WARNING] Could not load model_info.json for feature order: {e}", file=sys.stderr)
    
    # Ensure we have all features the model expects (fill missing with 0)
    for feature in features:
        if feature not in X.columns:
            X[feature] = 0

    # Select only the features needed by the model (in correct order)
    # CRITICAL: Use exact order from features list
    X = X[features].copy()
    
    # Verify feature count matches
    if len(X.columns) != len(features):
        print(f"⚠️ [WARNING] Feature count mismatch: expected {len(features)}, got {len(X.columns)}", file=sys.stderr)
        # Try to reorder
        missing_features = [f for f in features if f not in X.columns]
        if missing_features:
            for f in missing_features:
                X[f] = 0
        X = X[features].copy()

    # Convert to numeric and handle any issues
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors='coerce')
        X[col] = X[col].fillna(X[col].median() if X[col].notna().any() else 0)

    return X


# ============================================================================
# Model Caching for Performance
# ============================================================================
_model_cache = None
_features_cache = None
_model_name_cache = None
_make_encoder_cache = None
_model_encoder_cache = None
_target_transform_cache = None
_transform_offset_cache = None
_poly_transformer_cache = None
_numeric_cols_for_poly_cache = None
_original_features_cache = None
_make_popularity_map_cache = None

# Cache variables
_model_cache = None
_features_cache = None
_model_name_cache = None
_make_encoder_cache = None
_model_encoder_cache = None
_target_transform_cache = None
_transform_offset_cache = None
_poly_transformer_cache = None
_numeric_cols_for_poly_cache = None
_original_features_cache = None
_make_popularity_map_cache = None
_scaler_cache = None
_encoders_cache = None
_luxury_brands_cache = None
_premium_brands_cache = None
_brand_reliability_cache = None
_price_range_models_cache = None
_image_features_enabled_cache = None
_image_feature_dim_cache = None
_model_version_cache = None
_model_rmse_cache = None


def _get_cached_model():
    """Get cached model or load if not cached"""
    global _model_cache, _features_cache, _model_name_cache, _make_encoder_cache, _model_encoder_cache
    global _target_transform_cache, _transform_offset_cache, _poly_transformer_cache, _numeric_cols_for_poly_cache
    global _original_features_cache, _make_popularity_map_cache, _scaler_cache, _encoders_cache
    global _luxury_brands_cache, _premium_brands_cache, _brand_reliability_cache, _price_range_models_cache
    global _image_features_enabled_cache, _image_feature_dim_cache, _model_version_cache, _model_rmse_cache

    if _model_cache is None:
        (_model_cache, _features_cache, _model_name_cache, _make_encoder_cache, _model_encoder_cache,
         _target_transform_cache, _transform_offset_cache, _poly_transformer_cache, _numeric_cols_for_poly_cache,
         _original_features_cache, _make_popularity_map_cache, _scaler_cache, _encoders_cache,
         _luxury_brands_cache, _premium_brands_cache, _brand_reliability_cache, _price_range_models_cache,
         _image_features_enabled_cache, _image_feature_dim_cache, _model_version_cache, _model_rmse_cache) = load_model()

    return (_model_cache, _features_cache, _model_name_cache, _make_encoder_cache, _model_encoder_cache,
            _target_transform_cache, _transform_offset_cache, _poly_transformer_cache, _numeric_cols_for_poly_cache,
            _original_features_cache, _make_popularity_map_cache, _scaler_cache, _encoders_cache,
            _luxury_brands_cache, _premium_brands_cache, _brand_reliability_cache, _price_range_models_cache,
            _image_features_enabled_cache, _image_feature_dim_cache, _model_version_cache, _model_rmse_cache)

# ============================================================================
# Predict Price
# ============================================================================


def predict_price(car_data, return_confidence=False):
    """
    Predict car price for given car data

    Parameters:
    -----------
    car_data : dict or pd.DataFrame
        Car information dictionary or DataFrame
    return_confidence : bool
        Whether to return confidence intervals (if available)

    Returns:
    --------
    predictions : float or array
        Predicted price(s)
    confidence_intervals : dict, optional
        Confidence intervals if return_confidence=True

    Raises:
    -------
    ValueError: If car_data is invalid
    """
    # Validate input data if it's a dictionary
    if isinstance(car_data, dict):
        is_valid, errors = validate_car_data(car_data)
        if not is_valid:
            error_msg = "Invalid car data:\n" + \
                "\n".join(f"  - {error}" for error in errors)
            raise ValueError(error_msg)

    # Load model (cached for performance)
    (model, features, model_name, make_encoder, model_encoder, target_transform, transform_offset,
     poly_transformer, numeric_cols_for_poly, original_features, make_popularity_map, scaler,
     encoders, luxury_brands, premium_brands, brand_reliability, price_range_models,
     image_features_enabled, image_feature_dim, model_version, model_rmse) = _get_cached_model()

    # ========================================================================
    # CRITICAL DEBUG LOGGING - MODEL LOADING VERIFICATION
    # ========================================================================
    import sys
    print("\n" + "=" * 80, file=sys.stderr)
    print("🔍 PREDICTION DEBUG - MODEL LOADING VERIFICATION", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print(f"✅ Model loaded successfully", file=sys.stderr)
    print(f"📦 Model Name: {model_name}", file=sys.stderr)
    print(f"📦 Model Version: {model_version}", file=sys.stderr)
    print(f"📦 Model Type: {type(model).__name__}", file=sys.stderr)
    print(f"📦 Target Transform: {target_transform}", file=sys.stderr)
    print(f"📦 Transform Offset: {transform_offset}", file=sys.stderr)
    # Safe RMSE formatting
    try:
        rmse_float = float(model_rmse) if model_rmse is not None else None
        if rmse_float is not None:
            print(f"📦 Model RMSE: ${rmse_float:,.2f}", file=sys.stderr)
        else:
            print("📦 Model RMSE: N/A", file=sys.stderr)
    except (ValueError, TypeError):
        print("📦 Model RMSE: N/A", file=sys.stderr)
    print(f"📦 Features Count: {len(features)}", file=sys.stderr)
    print(f"📦 Has Scaler: {scaler is not None}", file=sys.stderr)
    print(f"📦 Has Poly Transformer: {poly_transformer is not None}", file=sys.stderr)
    print(f"📦 Image Features Enabled: {image_features_enabled}", file=sys.stderr)
    if image_features_enabled:
        print(f"📦 Image Feature Dimension: {image_feature_dim}", file=sys.stderr)
    print("=" * 80, file=sys.stderr)

    # ========================================================================
    # CRITICAL DEBUG LOGGING - INPUT FEATURES VERIFICATION
    # ========================================================================
    print("\n" + "=" * 80, file=sys.stderr)
    print("🔍 PREDICTION DEBUG - INPUT FEATURES VERIFICATION", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print(f"📋 Input car_data:", file=sys.stderr)
    if isinstance(car_data, dict):
        for key, value in car_data.items():
            print(f"   {key}: {value} (type: {type(value).__name__})", file=sys.stderr)
    else:
        print(f"   Type: {type(car_data)}", file=sys.stderr)
    print(f"📋 Expected features (from model): {len(features)} features", file=sys.stderr)
    print(f"   First 10: {features[:10] if len(features) > 10 else features}", file=sys.stderr)
    print(f"📋 Original features (before poly): {len(original_features) if original_features else 'N/A'}", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    
    # Prepare features
    try:
        X_tabular = prepare_features(car_data, features, make_encoder, model_encoder,
                                     poly_transformer, numeric_cols_for_poly, original_features, make_popularity_map,
                                     encoders, luxury_brands, premium_brands, brand_reliability)
        
        print(f"\n✅ Features prepared successfully", file=sys.stderr)
        print(f"📊 Tabular features shape: {X_tabular.shape}", file=sys.stderr)
        print(f"📊 Tabular features columns: {list(X_tabular.columns)[:10]}..." if len(X_tabular.columns) > 10 else f"📊 Tabular features columns: {list(X_tabular.columns)}", file=sys.stderr)

        # Add image features if model uses them (v3/v4 models)
        if image_features_enabled and image_feature_dim > 0:
            # Extract image features if image path provided, otherwise use zeros
            image_features = extract_image_features(
                car_data, image_feature_dim)

            # Convert tabular features to numpy array if DataFrame
            if hasattr(X_tabular, 'values'):
                X_tabular_array = X_tabular.values
            else:
                X_tabular_array = np.array(X_tabular)

            # For v4 models: scale only tabular features, keep image features unscaled
            if model_version == 'v4' and scaler is not None:
                # CRITICAL: Check scaler feature count matches tabular features
                scaler_n_features = getattr(scaler, 'n_features_in_', None)
                if scaler_n_features is None and hasattr(scaler, 'feature_names_in_'):
                    scaler_n_features = len(scaler.feature_names_in_)
                
                if scaler_n_features is not None and scaler_n_features != X_tabular_array.shape[1]:
                    print(f"⚠️ [WARNING] Scaler feature mismatch for v4 model: scaler expects {scaler_n_features}, tabular has {X_tabular_array.shape[1]}", file=sys.stderr)
                    print(f"⚠️ [WARNING] Skipping scaling. Combining unscaled features.", file=sys.stderr)
                    X = np.hstack([X_tabular_array, image_features])
                else:
                    try:
                        # Scale only tabular features
                        X_tabular_scaled = scaler.transform(X_tabular_array)
                        # Combine scaled tabular + unscaled image features
                        X = np.hstack([X_tabular_scaled, image_features])
                    except ValueError as e:
                        print(f"⚠️ [ERROR] Scaler transform failed: {e}", file=sys.stderr)
                        print(f"⚠️ [WARNING] Continuing without scaling.", file=sys.stderr)
                        X = np.hstack([X_tabular_array, image_features])
            else:
                # For v3 or older: combine first, then scale everything together
                X_combined = np.hstack([X_tabular_array, image_features])
                if scaler is not None:
                    # CRITICAL: Check feature count match
                    scaler_n_features = getattr(scaler, 'n_features_in_', None)
                    if scaler_n_features is None and hasattr(scaler, 'feature_names_in_'):
                        scaler_n_features = len(scaler.feature_names_in_)
                    
                    if scaler_n_features is not None and scaler_n_features != X_combined.shape[1]:
                        print(f"⚠️ [WARNING] Scaler feature mismatch: scaler expects {scaler_n_features}, got {X_combined.shape[1]}", file=sys.stderr)
                        print(f"⚠️ [WARNING] Skipping scaling.", file=sys.stderr)
                        X = X_combined
                    else:
                        try:
                            X = scaler.transform(X_combined)
                        except ValueError as e:
                            print(f"⚠️ [ERROR] Scaler transform failed: {e}", file=sys.stderr)
                            print(f"⚠️ [WARNING] Continuing without scaling.", file=sys.stderr)
                            X = X_combined
                else:
                    X = X_combined

            if config.DEBUG_PREDICTIONS:
                print(
                    f"[DEBUG] Tabular features: {X_tabular_array.shape[1]}, Image features: {image_feature_dim}, Total: {X.shape[1]}", file=sys.stderr)
                if model_version == 'v4':
                    print(
                        f"[DEBUG] v4 model: Scaled only tabular features, kept image features unscaled", file=sys.stderr)
        else:
            # No image features - use tabular only
            if hasattr(X_tabular, 'values'):
                X = X_tabular.values
            else:
                X = np.array(X_tabular)

        if config.DEBUG_PREDICTIONS:
            print(f"[DEBUG] Input features shape: {X.shape}", file=sys.stderr)
            print(
                f"[DEBUG] Expected features count: {len(features) + (image_feature_dim if image_features_enabled else 0)}", file=sys.stderr)
            print(
                f"[DEBUG] Actual features count: {X.shape[1] if hasattr(X, 'shape') else 'N/A'}", file=sys.stderr)
            print(f"[DEBUG] Feature columns: {list(X.columns)[:10] if hasattr(X, 'columns') else 'N/A'}..." if hasattr(X, 'columns') and len(
                X.columns) > 10 else f"[DEBUG] Feature columns: {list(X.columns) if hasattr(X, 'columns') else 'N/A'}", file=sys.stderr)
            # Check for price_per_km (should NOT exist)
            if hasattr(X, 'columns') and 'price_per_km' in X.columns:
                print(
                    f"[ERROR] price_per_km found in features! This should not happen.", file=sys.stderr)
            else:
                print(f"[OK] price_per_km NOT in features (correct)",
                      file=sys.stderr)
            if hasattr(X, 'iloc'):
                print(
                    f"[DEBUG] First row sample (first 5 values): {dict(list(X.iloc[0].to_dict().items())[:5]) if len(X) > 0 else 'Empty'}", file=sys.stderr)
    except Exception as e:
        raise ValueError(f"Error preparing features: {str(e)}") from e

    # Make predictions (in log space if transformation was used)
    try:
        # ========================================================================
        # CRITICAL DEBUG LOGGING - RAW MODEL OUTPUT
        # ========================================================================
        print("\n" + "=" * 80, file=sys.stderr)
        print("🔍 PREDICTION DEBUG - RAW MODEL OUTPUT", file=sys.stderr)
        print("=" * 80, file=sys.stderr)
        print(f"📦 Model Name: {model_name}", file=sys.stderr)
        print(f"📦 Model Version: {model_version}", file=sys.stderr)
        print(f"📦 Target Transform: {target_transform}", file=sys.stderr)
        print(f"📦 Model Type: {type(model).__name__}", file=sys.stderr)
        print(f"📦 Input Features Shape: {X.shape}", file=sys.stderr)
        print(f"📦 Expected Features Count: {len(features) + (image_feature_dim if image_features_enabled else 0)}", file=sys.stderr)
        print(f"📦 Has Scaler: {scaler is not None}", file=sys.stderr)
        print(f"📦 Image Features Enabled: {image_features_enabled}", file=sys.stderr)
        
        # Scale if needed - CRITICAL: Check feature count match first
        # Note: For v4 models with image features, scaling is already done above
        should_scale = scaler is not None and not (image_features_enabled and model_version == 'v4')
        
        if should_scale:
            # CRITICAL: Verify scaler expects same number of features
            scaler_n_features = getattr(scaler, 'n_features_in_', None)
            if scaler_n_features is None:
                # Try to get from feature_names_in_ if available
                if hasattr(scaler, 'feature_names_in_'):
                    scaler_n_features = len(scaler.feature_names_in_)
                else:
                    scaler_n_features = None
            
            actual_n_features = X.shape[1] if hasattr(X, 'shape') else len(X[0]) if isinstance(X, (list, np.ndarray)) else None
            
            if scaler_n_features is not None and actual_n_features is not None:
                if scaler_n_features != actual_n_features:
                    print(f"⚠️ [WARNING] Scaler feature mismatch: scaler expects {scaler_n_features}, got {actual_n_features}", file=sys.stderr)
                    print(f"⚠️ [WARNING] Skipping scaling to prevent crash. Model may produce different results.", file=sys.stderr)
                    should_scale = False
                else:
                    print(f"✅ Scaler feature count matches: {scaler_n_features} features", file=sys.stderr)
        
        if should_scale:
            try:
                X_scaled = scaler.transform(X)
                print(f"✅ Features scaled using RobustScaler before prediction", file=sys.stderr)
                print(f"📊 Scaled features shape: {X_scaled.shape}", file=sys.stderr)
                print(f"📊 Scaled features sample (first 5): {X_scaled[0][:5] if hasattr(X_scaled, '__getitem__') else 'N/A'}", file=sys.stderr)
                predictions_log = model.predict(X_scaled)
            except ValueError as e:
                print(f"⚠️ [ERROR] Scaler transform failed: {e}", file=sys.stderr)
                print(f"⚠️ [WARNING] Continuing without scaling. Model may produce different results.", file=sys.stderr)
                predictions_log = model.predict(X)
        else:
            # Already scaled (v4 with images) or no scaler needed
            if image_features_enabled and model_version == 'v4':
                print(f"✅ Features already scaled (v4: tabular only)", file=sys.stderr)
            else:
                print(f"⚠️ No scaling applied (scaler is None or feature mismatch)", file=sys.stderr)
            predictions_log = model.predict(X)
        
        # ========================================================================
        # CRITICAL: Log RAW model output BEFORE any transformations
        # ========================================================================
        print("\n" + "-" * 80, file=sys.stderr)
        print("🔍 RAW MODEL OUTPUT (BEFORE TRANSFORMATIONS)", file=sys.stderr)
        print("-" * 80, file=sys.stderr)
        print(f"📊 Raw prediction_log (from model.predict): {predictions_log}", file=sys.stderr)
        print(f"📊 Type: {type(predictions_log)}", file=sys.stderr)
        if isinstance(predictions_log, np.ndarray):
            print(f"📊 Shape: {predictions_log.shape}, dtype: {predictions_log.dtype}", file=sys.stderr)
            print(f"📊 First value: {predictions_log[0] if len(predictions_log) > 0 else 'N/A'}", file=sys.stderr)
        print(f"📊 Repr: {repr(predictions_log)}", file=sys.stderr)
        print("-" * 80, file=sys.stderr)

        # Apply inverse transformation if model was trained with log transform
        if target_transform == 'log1p':
            # Inverse of log1p is expm1: exp(x) - 1
            print(f"\n🔄 Applying inverse transformation: expm1 (inverse of log1p)", file=sys.stderr)
            print(f"   Formula: exp(x) - 1", file=sys.stderr)
            print(f"   Input (log space): {predictions_log}", file=sys.stderr)
            predictions = np.expm1(predictions_log)
            print(f"   Output (price space): {predictions}", file=sys.stderr)
            print(f"✅ Transformation complete", file=sys.stderr)
            # With log transform, predictions should always be non-negative
            # Check for unrealistic predictions (likely model issue)
            if np.any(predictions < 0):
                print(
                    f"[WARNING] Negative predictions after transform: {predictions}", file=sys.stderr)
                print(
                    f"[ERROR] Model may be corrupted or needs retraining. Log predictions: {predictions_log}", file=sys.stderr)
                # Don't clip to 0.01 - this masks the problem. Instead, raise an error or use a reasonable minimum
                # Use $100 minimum instead of $0.01
                predictions = np.maximum(predictions, 100.0)
            elif np.any(predictions < 100):
                # Predictions < $100 are suspicious - likely model issue
                print(
                    f"[WARNING] Very low predictions detected: {predictions}", file=sys.stderr)
                print(
                    f"[WARNING] Log predictions were: {predictions_log}", file=sys.stderr)
                print(
                    f"[WARNING] Model may need retraining or features may be missing", file=sys.stderr)
        else:
            # No transformation flag - check if predictions are in log space (smart detection)
            # If predictions are in range 0-15, they're likely in log space
            if np.all((predictions_log > 0) & (predictions_log < 15)):
                if config.DEBUG_PREDICTIONS:
                    print(
                        f"[DEBUG] Predictions appear to be in log space (range 0-15): {predictions_log}", file=sys.stderr)
                print(
                    f"[INFO] Applying expm1 transform (model likely trained with log transform but flag missing)", file=sys.stderr)
                predictions = np.expm1(predictions_log)
                if config.DEBUG_PREDICTIONS:
                    print(
                        f"[DEBUG] After expm1 transform: {predictions}", file=sys.stderr)
            else:
                # No transformation - use original predictions (old model compatibility)
                predictions = predictions_log
                if config.DEBUG_PREDICTIONS:
                    print(
                        f"[DEBUG] No transform applied (old model): {predictions}", file=sys.stderr)
                # Only clip to minimum if prediction is negative or extremely low
                if np.any(predictions < 0):
                    predictions = np.maximum(predictions, 1.0)

        if config.DEBUG_PREDICTIONS:
            print(f"[DEBUG] Final predictions: {predictions}", file=sys.stderr)

        # ========================================================================
        # FINAL PREDICTION VALUE (BEFORE VALIDATION/CAPPING)
        # ========================================================================
        print("\n" + "-" * 80, file=sys.stderr)
        print("🔍 FINAL PREDICTION VALUE (AFTER TRANSFORMATIONS)", file=sys.stderr)
        print("-" * 80, file=sys.stderr)
        # CRITICAL: Ensure prediction is always a valid number
        try:
            if isinstance(predictions, np.ndarray):
                if len(predictions) > 0:
                    final_pred = float(predictions[0])
                elif predictions.size == 1:
                    final_pred = float(predictions.item())
                else:
                    final_pred = float(predictions.flatten()[0])
            else:
                final_pred = float(predictions)
            
            # Validate prediction is a number
            if not np.isfinite(final_pred) or np.isnan(final_pred):
                print(f"⚠️ [WARNING] Invalid prediction (NaN/Inf), using fallback", file=sys.stderr)
                final_pred = 15000.0  # Fallback to reasonable default
        except (ValueError, TypeError, IndexError) as e:
            print(f"⚠️ [WARNING] Failed to extract prediction: {e}, using fallback", file=sys.stderr)
            final_pred = 15000.0  # Fallback to reasonable default
        
        # Safe formatting
        try:
            print(f"📊 Final prediction (before validation): ${final_pred:,.2f}", file=sys.stderr)
        except (ValueError, TypeError):
            print(f"📊 Final prediction (before validation): ${final_pred}", file=sys.stderr)
        print(f"📊 Type: {type(predictions)}", file=sys.stderr)
        print("-" * 80, file=sys.stderr)
        
        # CRITICAL: Ensure predictions are always valid numbers and in reasonable range
        # Convert to numpy array for easier handling
        if not isinstance(predictions, np.ndarray):
            predictions = np.array([predictions])
        
        # Replace NaN/Inf with fallback
        invalid_mask = ~np.isfinite(predictions)
        if np.any(invalid_mask):
            print(f"⚠️ [WARNING] Found {invalid_mask.sum()} invalid predictions (NaN/Inf), replacing with fallback", file=sys.stderr)
            predictions[invalid_mask] = 15000.0
        
        # Validate predictions are realistic (should be in 500-300000 range)
        predictions_before_cap = predictions.copy()
        
        # Cap to reasonable range
        predictions = np.maximum(predictions, 500.0)  # Minimum $500
        predictions = np.minimum(predictions, 300000.0)  # Maximum $300,000
        
        if not np.array_equal(predictions_before_cap, predictions):
            print(f"⚠️ [INFO] Predictions capped to $500 - $300,000 range", file=sys.stderr)
        
        # Log if capping occurred
        if isinstance(predictions_before_cap, np.ndarray) and isinstance(predictions, np.ndarray):
            if not np.array_equal(predictions_before_cap, predictions):
                print(f"⚠️ [INFO] Prediction was capped/validated", file=sys.stderr)
                try:
                    before_val = float(predictions_before_cap[0] if len(predictions_before_cap) > 0 else predictions_before_cap.item())
                    after_val = float(predictions[0] if len(predictions) > 0 else predictions.item())
                    print(f"   Before: ${before_val:,.2f}", file=sys.stderr)
                    print(f"   After:  ${after_val:,.2f}", file=sys.stderr)
                except (ValueError, TypeError, IndexError):
                    print(f"   Before: {predictions_before_cap}", file=sys.stderr)
                    print(f"   After:  {predictions}", file=sys.stderr)
        
        # ========================================================================
        # VERIFICATION: No extra multipliers or currency conversions
        # ========================================================================
        print("\n" + "-" * 80, file=sys.stderr)
        print("🔍 VERIFICATION - NO MULTIPLIERS OR CURRENCY CONVERSIONS", file=sys.stderr)
        print("-" * 80, file=sys.stderr)
        print(f"✅ No multipliers applied (raw model output → expm1 → final)", file=sys.stderr)
        print(f"✅ No currency conversions applied (USD assumed)", file=sys.stderr)
        print(f"✅ Transformation chain:", file=sys.stderr)
        print(f"   1. Raw model output (log space): {predictions_log}", file=sys.stderr)
        if target_transform == 'log1p':
            print(f"   2. Applied expm1: exp({predictions_log}) - 1 = {predictions}", file=sys.stderr)
        else:
            print(f"   2. No transformation (old model): {predictions}", file=sys.stderr)
        # Safe formatting
        try:
            final_pred_float = float(final_pred)
            print(f"   3. Final prediction: ${final_pred_float:,.2f}", file=sys.stderr)
        except (ValueError, TypeError):
            print(f"   3. Final prediction: ${final_pred}", file=sys.stderr)
        print("-" * 80, file=sys.stderr)
        
        print("\n" + "=" * 80, file=sys.stderr)
        print("✅ PREDICTION DEBUG COMPLETE", file=sys.stderr)
        print("=" * 80 + "\n", file=sys.stderr)

    except Exception as e:
        print(f"[ERROR] Prediction error: {str(e)}", file=sys.stderr)
        raise ValueError(f"Error making prediction: {str(e)}") from e

    # CRITICAL: Ensure return value is always a valid number
    try:
        if isinstance(predictions, np.ndarray):
            if len(predictions) == 1:
                final_prediction = float(predictions[0])
            else:
                final_prediction = float(predictions.flatten()[0])
        else:
            final_prediction = float(predictions)
        
        # Final validation - ensure it's finite and in range
        if not np.isfinite(final_prediction):
            print(f"⚠️ [WARNING] Final prediction invalid (NaN/Inf): {final_prediction}, using fallback", file=sys.stderr)
            final_prediction = 15000.0
        elif final_prediction < 500:
            print(f"⚠️ [WARNING] Final prediction too low: ${final_prediction:,.2f}, capping to $500", file=sys.stderr)
            final_prediction = 500.0
        elif final_prediction > 300000:
            print(f"⚠️ [WARNING] Final prediction too high: ${final_prediction:,.2f}, capping to $300,000", file=sys.stderr)
            final_prediction = 300000.0
        
        return final_prediction
    except Exception as e:
        print(f"⚠️ [ERROR] Failed to convert prediction to number: {e}, using fallback", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return 15000.0  # Always return a valid number
    
    if return_confidence:
        # Calculate confidence intervals
        if target_transform == 'log1p':
            # For log-transformed models, calculate intervals in log space then transform
            if hasattr(model, 'estimators_'):
                # Random Forest - use tree variance
                tree_predictions_log = np.array(
                    [tree.predict(X) for tree in model.estimators_])
                pred_mean_log = tree_predictions_log.mean(axis=0)
                pred_std_log = tree_predictions_log.std(axis=0)

                # Transform to original space
                pred_mean_original = np.expm1(pred_mean_log)
                # Approximate std in original space using delta method: std_original ≈ exp(mean_log) * std_log
                pred_std_original = np.exp(pred_mean_log) * pred_std_log

                confidence_intervals = {
                    'lower_95': np.maximum(0, pred_mean_original - 1.96 * pred_std_original),
                    'upper_95': pred_mean_original + 1.96 * pred_std_original,
                    'std': pred_std_original
                }
            elif hasattr(model, 'final_estimator_'):
                # Stacking ensemble - estimate variance from base models
                try:
                    if hasattr(model, 'estimators_'):
                        base_preds_log = []
                        for est_name, est_model in model.estimators_:
                            if hasattr(est_model, 'predict'):
                                base_preds_log.append(est_model.predict(X))

                        if base_preds_log:
                            base_preds_log = np.array(base_preds_log)
                            pred_mean_log = predictions_log
                            pred_std_log = base_preds_log.std(axis=0) if len(
                                base_preds_log) > 1 else np.full_like(predictions_log, predictions_log * 0.1)

                            # Transform to original space
                            pred_mean_original = np.expm1(pred_mean_log)
                            pred_std_original = np.exp(
                                pred_mean_log) * pred_std_log

                            confidence_intervals = {
                                'lower_95': np.maximum(0, pred_mean_original - 1.96 * pred_std_original),
                                'upper_95': pred_mean_original + 1.96 * pred_std_original,
                                'std': pred_std_original
                            }
                        else:
                            # Fallback: use model's RMSE if available
                            rmse_val = safe_float(model_rmse)
                            if rmse_val is not None and rmse_val > 0:
                                pred_std_original = rmse_val
                            else:
                                pred_std_original = predictions * 0.15  # 15% of prediction
                            confidence_intervals = {
                                'lower_95': np.maximum(0, predictions - 1.96 * pred_std_original),
                                'upper_95': predictions + 1.96 * pred_std_original,
                                'std': pred_std_original
                            }
                    else:
                        # Fallback: use model's RMSE if available
                        rmse_val = safe_float(model_rmse)
                        if rmse_val is not None and rmse_val > 0:
                            pred_std_original = rmse_val
                        else:
                            pred_std_original = predictions * 0.15
                        confidence_intervals = {
                            'lower_95': np.maximum(0, predictions - 1.96 * pred_std_original),
                            'upper_95': predictions + 1.96 * pred_std_original,
                            'std': pred_std_original
                        }
                except:
                    # Fallback: use model's RMSE if available
                    rmse_val = safe_float(model_rmse)
                    if rmse_val is not None and rmse_val > 0:
                        pred_std_original = rmse_val
                    else:
                        pred_std_original = predictions * 0.15
                    confidence_intervals = {
                        'lower_95': np.maximum(0, predictions - 1.96 * pred_std_original),
                        'upper_95': predictions + 1.96 * pred_std_original,
                        'std': pred_std_original
                    }
            else:
                # For other models, use model's RMSE if available
                rmse_val = safe_float(model_rmse)
                if rmse_val is not None and rmse_val > 0:
                    pred_std_original = rmse_val
                else:
                    pred_std_original = predictions * 0.15  # Fallback: percentage-based estimate
                confidence_intervals = {
                    'lower_95': np.maximum(0, predictions - 1.96 * pred_std_original),
                    'upper_95': predictions + 1.96 * pred_std_original,
                    'std': pred_std_original
                }
        else:
            # Old model without transformation - use old logic with clipping
            # Don't use $100 minimum - only clip if truly negative
            if hasattr(model, 'estimators_'):
                tree_predictions = np.array([tree.predict(
                    X_scaled if scaler is not None else X) for tree in model.estimators_])
                pred_mean = tree_predictions.mean(axis=0)
                pred_std = tree_predictions.std(axis=0)
                # Only clip if negative
                if np.any(pred_mean < 0):
                    pred_mean = np.maximum(pred_mean, 1.0)

                confidence_intervals = {
                    'lower_95': np.maximum(pred_mean - 1.96 * pred_std, 0),
                    'upper_95': pred_mean + 1.96 * pred_std,
                    'std': pred_std
                }
            else:
                # Use model's RMSE if available (v3 models)
                rmse_val = safe_float(model_rmse)
                if rmse_val is not None and rmse_val > 0:
                    typical_rmse = rmse_val
                else:
                    typical_rmse = predictions * 0.15  # Fallback: percentage-based estimate
                confidence_intervals = {
                    'lower_95': np.maximum(predictions - 1.96 * typical_rmse, 0),
                    'upper_95': predictions + 1.96 * typical_rmse,
                    'std': typical_rmse
                }

        # Ensure both return values are valid numbers
        try:
            if isinstance(predictions, np.ndarray):
                final_pred = float(predictions[0] if len(predictions) > 0 else predictions.item())
            else:
                final_pred = float(predictions)
            
            if not np.isfinite(final_pred):
                final_pred = 15000.0
            final_pred = max(500.0, min(300000.0, final_pred))
            
            return final_pred, confidence_intervals
        except Exception as e:
            print(f"⚠️ [ERROR] Failed to convert prediction with confidence: {e}", file=sys.stderr)
            return 15000.0, {'lower_95': 10000.0, 'upper_95': 20000.0, 'std': 5000.0}

    # Normal return - already validated above
    return final_prediction

# ============================================================================
# Main Function for Command Line Use
# ============================================================================


def main():
    """Main function for command-line usage"""
    import argparse

    parser = argparse.ArgumentParser(
        description='Predict car price from car features')
    parser.add_argument('--year', type=int, help='Year of the car')
    parser.add_argument('--mileage', type=float, help='Mileage in km')
    parser.add_argument('--engine_size', type=float,
                        help='Engine size in liters')
    parser.add_argument('--cylinders', type=int, help='Number of cylinders')
    parser.add_argument('--make', type=str, help='Car make/brand')
    parser.add_argument('--model', type=str, help='Car model')
    parser.add_argument('--condition', type=str,
                        help='Condition (New, Like New, Excellent, Good, Fair, Poor)')
    parser.add_argument('--fuel_type', type=str,
                        help='Fuel type (Gasoline, Diesel, Electric, Hybrid, etc.)')
    parser.add_argument('--location', type=str, help='Location')
    parser.add_argument(
        '--file', type=str, help='CSV file with car data (columns: year, mileage, etc.)')
    parser.add_argument('--confidence', action='store_true',
                        help='Show confidence intervals')

    args = parser.parse_args()

    # Load model info
    model, features, model_name, _, _, _, _, _, _, _, _ = load_model()
    print(f"Loaded model: {model_name}")
    print(f"Required features: {', '.join(features)}\n")

    # Prepare car data
    if args.file:
        # Load from file
        if not os.path.exists(args.file):
            print(f"ERROR: File '{args.file}' not found!")
            print(f"\nPlease create a CSV file with the following columns:")
            print(f"  Required: year, mileage, engine_size, cylinders, make, model, condition, fuel_type, location")
            print(f"\nExample CSV format:")
            print(
                f"  year,mileage,engine_size,cylinders,make,model,condition,fuel_type,location")
            print(f"  2020,30000,2.5,4,Toyota,Camry,Good,Gasoline,California")
            print(f"  2018,45000,3.5,6,Honda,Accord,Excellent,Gasoline,New York")
            sys.exit(1)

        try:
            df = pd.read_csv(args.file)
            print(f"Loaded {len(df)} cars from {args.file}\n")
            car_data = df
        except Exception as e:
            print(f"ERROR: Could not read file '{args.file}': {e}")
            sys.exit(1)
    else:
        # Use command-line arguments
        car_data = {
            'year': args.year or 2020,
            'mileage': args.mileage or 50000,
            'engine_size': args.engine_size or 2.0,
            'cylinders': args.cylinders or 4,
            'make': args.make or 'Unknown',
            'model': args.model or 'Unknown',
            'condition': args.condition or 'Good',
            'fuel_type': args.fuel_type or 'Gasoline',
            'location': args.location or 'Unknown'
        }
        print("Car Information:")
        for key, value in car_data.items():
            print(f"  {key}: {value}")
        print()

    # Make predictions
    if args.confidence:
        predictions, confidence = predict_price(
            car_data, return_confidence=True)

        if isinstance(car_data, dict):
            pred = predictions[0] if isinstance(
                predictions, np.ndarray) else predictions
            lower = confidence['lower_95'][0] if isinstance(
                confidence['lower_95'], np.ndarray) else confidence['lower_95']
            upper = confidence['upper_95'][0] if isinstance(
                confidence['upper_95'], np.ndarray) else confidence['upper_95']

            print("=" * 80)
            print("PREDICTION RESULT")
            print("=" * 80)
            # Safe formatting
            try:
                pred_float = float(pred)
                lower_float = float(lower)
                upper_float = float(upper)
                print(f"Predicted Price: ${pred_float:,.2f}")
                print(f"95% Confidence Interval: ${lower_float:,.2f} - ${upper_float:,.2f}")
            except (ValueError, TypeError):
                print(f"Predicted Price: ${pred}")
                print(f"95% Confidence Interval: ${lower} - ${upper}")
            print("=" * 80)
        else:
            results_df = pd.DataFrame({
                'Predicted_Price': predictions,
                'Lower_95_CI': confidence['lower_95'],
                'Upper_95_CI': confidence['upper_95']
            })
            print("=" * 80)
            print("PREDICTION RESULTS")
            print("=" * 80)
            print(results_df.to_string(index=False))
            print("=" * 80)

            # Save results
            output_file = args.file.replace(
                '.csv', '_predictions.csv') if args.file else 'predictions.csv'
            results_df.to_csv(output_file, index=False)
            print(f"\nResults saved to: {output_file}")
    else:
        predictions = predict_price(car_data)

        if isinstance(car_data, dict):
            pred = predictions[0] if isinstance(
                predictions, np.ndarray) else predictions
            print("=" * 80)
            print("PREDICTION RESULT")
            print("=" * 80)
            # Safe formatting
            try:
                pred_float = float(pred)
                print(f"Predicted Price: ${pred_float:,.2f}")
            except (ValueError, TypeError):
                print(f"Predicted Price: ${pred}")
            print("=" * 80)
        else:
            results_df = pd.DataFrame({'Predicted_Price': predictions})
            print("=" * 80)
            print("PREDICTION RESULTS")
            print("=" * 80)
            print(results_df.to_string(index=False))
            print("=" * 80)

            # Save results
            output_file = args.file.replace(
                '.csv', '_predictions.csv') if args.file else 'predictions.csv'
            results_df.to_csv(output_file, index=False)
            print(f"\nResults saved to: {output_file}")


# ============================================================================
# Example Usage
# ============================================================================
if __name__ == "__main__":
    # Example: Predict price for a single car
    if len(sys.argv) == 1:
        print("Car Price Prediction Tool")
        print("=" * 80)
        print("\nExample usage:")
        print("  python predict_price.py --year 2020 --mileage 30000 --engine_size 2.5 --cylinders 4 --make Toyota --model Camry --condition Good --fuel_type Gasoline")
        print("\nOr use a CSV file:")
        print("  python predict_price.py --file cars_to_predict.csv --confidence")
        print("\nFor help:")
        print("  python predict_price.py --help")
        print("\n" + "=" * 80)

        # Interactive example
        print("\nRunning example prediction...")
        example_car = {
            'year': 2020,
            'mileage': 30000,
            'engine_size': 2.5,
            'cylinders': 4,
            'make': 'Toyota',
            'model': 'Camry',
            'condition': 'Good',
            'fuel_type': 'Gasoline',
            'location': 'California'
        }

        try:
            pred = predict_price(example_car)
            print(f"\nExample Prediction:")
            print(f"  Car: 2020 Toyota Camry, 30,000 km, Good condition")
            # Safe formatting
            try:
                pred_val = pred[0] if isinstance(pred, np.ndarray) else pred
                pred_float = float(pred_val)
                print(f"  Predicted Price: ${pred_float:,.2f}")
            except (ValueError, TypeError, IndexError):
                print(f"  Predicted Price: ${pred}")
        except Exception as e:
            print(f"Error: {e}")
            print("Make sure you've run model_training.py first!")
    else:
        main()
