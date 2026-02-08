"""
Car Price Prediction Script
Loads the trained model and predicts prices for new car data
"""

import pandas as pd
import numpy as np
import pickle
import os
import sys
from datetime import datetime
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings('ignore')
import config
from utils import validate_car_data

# ============================================================================
# Load Model and Encoders
# ============================================================================
def load_model():
    """Load the trained model with proper error handling - tries best_model_v2.pkl first"""
    
    # Try new model first (PRIORITY)
    model_paths = [
        'models/best_model_v2.pkl',
        'models/car_price_model.pkl',
        'models/best_model.pkl'
    ]
    
    model_data = None
    model_path_used = None
    
    # Get base directory (same as config.py uses)
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    for model_path in model_paths:
        # Handle both relative and absolute paths
        if os.path.isabs(model_path):
            full_path = model_path
        else:
            # If path contains 'models/', use as-is relative to BASE_DIR
            full_path = os.path.join(BASE_DIR, model_path)
        
        if os.path.exists(full_path):
            # Show file info
            mod_time = datetime.fromtimestamp(os.path.getmtime(full_path))
            file_size = os.path.getsize(full_path) / (1024*1024)  # MB
            
            print(f"\n{'='*50}", file=sys.stderr)
            print(f"LOADING MODEL: {model_path}", file=sys.stderr)
            print(f"Full path: {full_path}", file=sys.stderr)
            print(f"File size: {file_size:.2f} MB", file=sys.stderr)
            print(f"Modified: {mod_time}", file=sys.stderr)
            print(f"{'='*50}\n", file=sys.stderr)
            
            try:
                with open(full_path, 'rb') as f:
                    model_data = pickle.load(f)
                
                print(f"[OK] Model loaded successfully from {model_path}!", file=sys.stderr)
                print(f"[OK] Model type: {model_data.get('model_name', 'Unknown')}", file=sys.stderr)
                model_path_used = model_path
                break
                
            except Exception as e:
                print(f"[ERROR] Failed to load {model_path}: {e}", file=sys.stderr)
                import traceback
                traceback.print_exc(file=sys.stderr)
                continue
    
    if model_data is None:
        error_msg = f"ERROR: No valid model file found! Tried: {', '.join(model_paths)}"
        print(error_msg, file=sys.stderr)
        print("Please run model_training.py first to train the model.", file=sys.stderr)
        sys.exit(1)
    
    model = model_data['model']
    features = model_data['features']
    model_name = model_data.get('model_name', 'Unknown')
    
    # Load transformation info (for log transformation)
    target_transform = model_data.get('target_transform', None)  # 'log1p' or None
    transform_offset = model_data.get('transform_offset', 1.0)
    
    # Load polynomial transformer if available
    poly_transformer = model_data.get('poly_transformer', None)
    numeric_cols_for_poly = model_data.get('numeric_cols_for_poly', [])
    original_features = model_data.get('original_features', [])
    make_popularity_map = model_data.get('make_popularity_map', None)
    
    # Debug output
    print(f"[DEBUG] Model loaded: {model_name}", file=sys.stderr)
    print(f"[DEBUG] Target transform: {target_transform}", file=sys.stderr)
    print(f"[DEBUG] Features count: {len(features)}", file=sys.stderr)
    print(f"[DEBUG] Has poly_transformer: {poly_transformer is not None}", file=sys.stderr)
    print(f"[DEBUG] Has make_popularity_map: {make_popularity_map is not None}", file=sys.stderr)
    print(f"[DEBUG] Original features count: {len(original_features) if original_features else 0}", file=sys.stderr)
    
    # Load encoders if they exist
    make_encoder = None
    model_encoder = None
    
    if os.path.exists(config.MAKE_ENCODER_FILE):
        with open(config.MAKE_ENCODER_FILE, 'rb') as f:
            make_encoder = pickle.load(f)
        print(f"[OK] Make encoder loaded", file=sys.stderr)
    
    if os.path.exists(config.MODEL_ENCODER_FILE):
        with open(config.MODEL_ENCODER_FILE, 'rb') as f:
            model_encoder = pickle.load(f)
        print(f"[OK] Model encoder loaded", file=sys.stderr)
    
    return model, features, model_name, make_encoder, model_encoder, target_transform, transform_offset, poly_transformer, numeric_cols_for_poly, original_features, make_popularity_map

# ============================================================================
# Prepare Input Data
# ============================================================================
def prepare_features(car_data, features, make_encoder=None, model_encoder=None, 
                     poly_transformer=None, numeric_cols_for_poly=None, original_features=None,
                     make_popularity_map=None):
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
        df['age_of_car'] = current_year - df['year']
    
    # Encode categorical variables
    if 'condition' in df.columns:
        # Map condition to encoded value
        df['condition_encoded'] = df['condition'].map(config.CONDITION_MAP).fillna(3)
    
    if 'fuel_type' in df.columns:
        df['fuel_type_encoded'] = df['fuel_type'].map(config.FUEL_TYPE_MAP).fillna(0)
    
    if 'location' in df.columns:
        # Use a simple hash-based encoding if encoder not available
        if 'location_encoded' not in df.columns:
            df['location_encoded'] = df['location'].astype(str).apply(hash) % 1000
    
    # Encode make and model
    if 'make' in df.columns and make_encoder is not None:
        try:
            df['make_encoded'] = make_encoder.transform(df['make'].astype(str))
        except:
            # If make not in encoder, use a default value
            df['make_encoded'] = 0
    
    if 'model' in df.columns and model_encoder is not None:
        try:
            df['model_encoded'] = model_encoder.transform(df['model'].astype(str))
        except:
            # If model not in encoder, use a default value
            df['model_encoded'] = 0
    
    # Create engineered features (matching model_training.py)
    # 1. Interaction features
    if 'year' in df.columns and 'mileage' in df.columns:
        df['year_mileage_interaction'] = df['year'] * df['mileage']
    
    if 'engine_size' in df.columns and 'cylinders' in df.columns:
        df['engine_cylinders_interaction'] = df['engine_size'] * df['cylinders']
    
    # 2. Price per km - REMOVED: Causes data leakage (uses target variable 'price')
    # During prediction, we don't have the price, so we can't calculate this feature.
    # df['price_per_km'] = 0.0  # Placeholder - actual price not available during prediction
    
    # 2. Brand popularity (use map from training if available)
    if make_popularity_map is not None and 'make' in df.columns:
        # Use actual popularity values from training
        df['brand_popularity'] = df['make'].map(make_popularity_map).fillna(0.5)
    else:
        # Fallback to 0.5 if map not available
        df['brand_popularity'] = 0.5
    
    # Build base feature list (before polynomial transformation)
    base_feature_cols = ['year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
                         'condition_encoded', 'fuel_type_encoded', 'location_encoded',
                         'make_encoded', 'model_encoded']
    
    engineered_features = ['brand_popularity', 
                           'year_mileage_interaction', 'engine_cylinders_interaction']
    
    # Combine all base features
    all_base_features = base_feature_cols + [f for f in engineered_features if f in df.columns]
    
    # Select base features that exist
    available_base_features = [col for col in all_base_features if col in df.columns]
    
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
        numeric_cols_for_poly_available = [col for col in numeric_cols_for_poly if col in X_base.columns]
        
        if numeric_cols_for_poly_available:
            # Apply polynomial transformation
            X_poly = poly_transformer.transform(X_base[numeric_cols_for_poly_available])
            poly_feature_names = poly_transformer.get_feature_names_out(numeric_cols_for_poly_available)
            
            # Create DataFrame with polynomial features
            X_poly_df = pd.DataFrame(X_poly, columns=poly_feature_names, index=X_base.index)
            
            # Remove original numeric columns and combine with polynomial features
            X_final = X_base.drop(columns=numeric_cols_for_poly_available)
            X = pd.concat([X_final, X_poly_df], axis=1)
        else:
            X = X_base
    else:
        # No polynomial transformation
        X = X_base
    
    # Ensure we have all features the model expects (fill missing with 0)
    for feature in features:
        if feature not in X.columns:
            X[feature] = 0
    
    # Select only the features needed by the model (in correct order)
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

def _get_cached_model():
    """Get cached model or load if not cached"""
    global _model_cache, _features_cache, _model_name_cache, _make_encoder_cache, _model_encoder_cache
    global _target_transform_cache, _transform_offset_cache, _poly_transformer_cache, _numeric_cols_for_poly_cache, _original_features_cache, _make_popularity_map_cache
    if _model_cache is None:
        _model_cache, _features_cache, _model_name_cache, _make_encoder_cache, _model_encoder_cache, _target_transform_cache, _transform_offset_cache, _poly_transformer_cache, _numeric_cols_for_poly_cache, _original_features_cache, _make_popularity_map_cache = load_model()
    return _model_cache, _features_cache, _model_name_cache, _make_encoder_cache, _model_encoder_cache, _target_transform_cache, _transform_offset_cache, _poly_transformer_cache, _numeric_cols_for_poly_cache, _original_features_cache, _make_popularity_map_cache

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
            error_msg = "Invalid car data:\n" + "\n".join(f"  - {error}" for error in errors)
            raise ValueError(error_msg)
    
    # Load model (cached for performance)
    model, features, model_name, make_encoder, model_encoder, target_transform, transform_offset, poly_transformer, numeric_cols_for_poly, original_features, make_popularity_map = _get_cached_model()
    
    # DEBUG: Print model info (only if DEBUG_PREDICTIONS is enabled)
    import sys
    if config.DEBUG_PREDICTIONS:
        print(f"[DEBUG] Model type: {model_name}", file=sys.stderr)
        print(f"[DEBUG] Target transform: {target_transform}", file=sys.stderr)
        print(f"[DEBUG] Model class: {type(model).__name__}", file=sys.stderr)
    
    # Prepare features
    try:
        X = prepare_features(car_data, features, make_encoder, model_encoder, 
                             poly_transformer, numeric_cols_for_poly, original_features, make_popularity_map)
        if config.DEBUG_PREDICTIONS:
            print(f"[DEBUG] Input features shape: {X.shape}", file=sys.stderr)
            print(f"[DEBUG] Expected features count: {len(features)}", file=sys.stderr)
            print(f"[DEBUG] Actual features count: {X.shape[1] if hasattr(X, 'shape') else 'N/A'}", file=sys.stderr)
            print(f"[DEBUG] Feature columns: {list(X.columns)[:10] if hasattr(X, 'columns') else 'N/A'}..." if hasattr(X, 'columns') and len(X.columns) > 10 else f"[DEBUG] Feature columns: {list(X.columns) if hasattr(X, 'columns') else 'N/A'}", file=sys.stderr)
            # Check for price_per_km (should NOT exist)
            if hasattr(X, 'columns') and 'price_per_km' in X.columns:
                print(f"[ERROR] price_per_km found in features! This should not happen.", file=sys.stderr)
            else:
                print(f"[OK] price_per_km NOT in features (correct)", file=sys.stderr)
            if hasattr(X, 'iloc'):
                print(f"[DEBUG] First row sample (first 5 values): {dict(list(X.iloc[0].to_dict().items())[:5]) if len(X) > 0 else 'Empty'}", file=sys.stderr)
    except Exception as e:
        raise ValueError(f"Error preparing features: {str(e)}") from e
    
    # Make predictions (in log space if transformation was used)
    try:
        predictions_log = model.predict(X)
        if config.DEBUG_PREDICTIONS:
            print(f"[DEBUG] Raw prediction (log space): {predictions_log}", file=sys.stderr)
        
        # Apply inverse transformation if model was trained with log transform
        if target_transform == 'log1p':
            # Inverse of log1p is expm1: exp(x) - 1
            predictions = np.expm1(predictions_log)
            if config.DEBUG_PREDICTIONS:
                print(f"[DEBUG] After expm1 transform: {predictions}", file=sys.stderr)
            # With log transform, predictions should always be non-negative
            # Check for unrealistic predictions (likely model issue)
            if np.any(predictions < 0):
                print(f"[WARNING] Negative predictions after transform: {predictions}", file=sys.stderr)
                print(f"[ERROR] Model may be corrupted or needs retraining. Log predictions: {predictions_log}", file=sys.stderr)
                # Don't clip to 0.01 - this masks the problem. Instead, raise an error or use a reasonable minimum
                predictions = np.maximum(predictions, 100.0)  # Use $100 minimum instead of $0.01
            elif np.any(predictions < 100):
                # Predictions < $100 are suspicious - likely model issue
                print(f"[WARNING] Very low predictions detected: {predictions}", file=sys.stderr)
                print(f"[WARNING] Log predictions were: {predictions_log}", file=sys.stderr)
                print(f"[WARNING] Model may need retraining or features may be missing", file=sys.stderr)
        else:
            # No transformation flag - check if predictions are in log space (smart detection)
            # If predictions are in range 0-15, they're likely in log space
            if np.all((predictions_log > 0) & (predictions_log < 15)):
                if config.DEBUG_PREDICTIONS:
                    print(f"[DEBUG] Predictions appear to be in log space (range 0-15): {predictions_log}", file=sys.stderr)
                print(f"[INFO] Applying expm1 transform (model likely trained with log transform but flag missing)", file=sys.stderr)
                predictions = np.expm1(predictions_log)
                if config.DEBUG_PREDICTIONS:
                    print(f"[DEBUG] After expm1 transform: {predictions}", file=sys.stderr)
            else:
                # No transformation - use original predictions (old model compatibility)
                predictions = predictions_log
                if config.DEBUG_PREDICTIONS:
                    print(f"[DEBUG] No transform applied (old model): {predictions}", file=sys.stderr)
                # Only clip to minimum if prediction is negative or extremely low
                if np.any(predictions < 0):
                    predictions = np.maximum(predictions, 1.0)
        
        if config.DEBUG_PREDICTIONS:
            print(f"[DEBUG] Final predictions: {predictions}", file=sys.stderr)
        
        # Validate predictions are realistic (should be in 1000-80000 range typically)
        if np.any(predictions < 1000):
            print(f"[WARNING] Predictions seem too low: {predictions}", file=sys.stderr)
        if np.any(predictions > 200000):
            print(f"[WARNING] Predictions seem very high: {predictions}", file=sys.stderr)
        
    except Exception as e:
        print(f"[ERROR] Prediction error: {str(e)}", file=sys.stderr)
        raise ValueError(f"Error making prediction: {str(e)}") from e
    
    if return_confidence:
        # Calculate confidence intervals
        if target_transform == 'log1p':
            # For log-transformed models, calculate intervals in log space then transform
            if hasattr(model, 'estimators_'):
                # Random Forest - use tree variance
                tree_predictions_log = np.array([tree.predict(X) for tree in model.estimators_])
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
                            pred_std_log = base_preds_log.std(axis=0) if len(base_preds_log) > 1 else np.full_like(predictions_log, predictions_log * 0.1)
                            
                            # Transform to original space
                            pred_mean_original = np.expm1(pred_mean_log)
                            pred_std_original = np.exp(pred_mean_log) * pred_std_log
                            
                            confidence_intervals = {
                                'lower_95': np.maximum(0, pred_mean_original - 1.96 * pred_std_original),
                                'upper_95': pred_mean_original + 1.96 * pred_std_original,
                                'std': pred_std_original
                            }
                        else:
                            # Fallback: use percentage-based estimate
                            pred_std_original = predictions * 0.15  # 15% of prediction
                            confidence_intervals = {
                                'lower_95': np.maximum(0, predictions - 1.96 * pred_std_original),
                                'upper_95': predictions + 1.96 * pred_std_original,
                                'std': pred_std_original
                            }
                    else:
                        # Fallback: use percentage-based estimate
                        pred_std_original = predictions * 0.15
                        confidence_intervals = {
                            'lower_95': np.maximum(0, predictions - 1.96 * pred_std_original),
                            'upper_95': predictions + 1.96 * pred_std_original,
                            'std': pred_std_original
                        }
                except:
                    # Fallback: use percentage-based estimate
                    pred_std_original = predictions * 0.15
                    confidence_intervals = {
                        'lower_95': np.maximum(0, predictions - 1.96 * pred_std_original),
                        'upper_95': predictions + 1.96 * pred_std_original,
                        'std': pred_std_original
                    }
            else:
                # For other models, use percentage-based estimate
                pred_std_original = predictions * 0.15
                confidence_intervals = {
                    'lower_95': np.maximum(0, predictions - 1.96 * pred_std_original),
                    'upper_95': predictions + 1.96 * pred_std_original,
                    'std': pred_std_original
                }
        else:
            # Old model without transformation - use old logic with clipping
            # Don't use $100 minimum - only clip if truly negative
            if hasattr(model, 'estimators_'):
                tree_predictions = np.array([tree.predict(X) for tree in model.estimators_])
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
                typical_rmse = predictions * 0.15
                confidence_intervals = {
                    'lower_95': np.maximum(predictions - 1.96 * typical_rmse, 0),
                    'upper_95': predictions + 1.96 * typical_rmse,
                    'std': typical_rmse
                }
        
        return predictions, confidence_intervals
    
    return predictions

# ============================================================================
# Main Function for Command Line Use
# ============================================================================
def main():
    """Main function for command-line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Predict car price from car features')
    parser.add_argument('--year', type=int, help='Year of the car')
    parser.add_argument('--mileage', type=float, help='Mileage in km')
    parser.add_argument('--engine_size', type=float, help='Engine size in liters')
    parser.add_argument('--cylinders', type=int, help='Number of cylinders')
    parser.add_argument('--make', type=str, help='Car make/brand')
    parser.add_argument('--model', type=str, help='Car model')
    parser.add_argument('--condition', type=str, help='Condition (New, Like New, Excellent, Good, Fair, Poor)')
    parser.add_argument('--fuel_type', type=str, help='Fuel type (Gasoline, Diesel, Electric, Hybrid, etc.)')
    parser.add_argument('--location', type=str, help='Location')
    parser.add_argument('--file', type=str, help='CSV file with car data (columns: year, mileage, etc.)')
    parser.add_argument('--confidence', action='store_true', help='Show confidence intervals')
    
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
            print(f"  year,mileage,engine_size,cylinders,make,model,condition,fuel_type,location")
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
        predictions, confidence = predict_price(car_data, return_confidence=True)
        
        if isinstance(car_data, dict):
            pred = predictions[0] if isinstance(predictions, np.ndarray) else predictions
            lower = confidence['lower_95'][0] if isinstance(confidence['lower_95'], np.ndarray) else confidence['lower_95']
            upper = confidence['upper_95'][0] if isinstance(confidence['upper_95'], np.ndarray) else confidence['upper_95']
            
            print("=" * 80)
            print("PREDICTION RESULT")
            print("=" * 80)
            print(f"Predicted Price: ${pred:,.2f}")
            print(f"95% Confidence Interval: ${lower:,.2f} - ${upper:,.2f}")
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
            output_file = args.file.replace('.csv', '_predictions.csv') if args.file else 'predictions.csv'
            results_df.to_csv(output_file, index=False)
            print(f"\nResults saved to: {output_file}")
    else:
        predictions = predict_price(car_data)
        
        if isinstance(car_data, dict):
            pred = predictions[0] if isinstance(predictions, np.ndarray) else predictions
            print("=" * 80)
            print("PREDICTION RESULT")
            print("=" * 80)
            print(f"Predicted Price: ${pred:,.2f}")
            print("=" * 80)
        else:
            results_df = pd.DataFrame({'Predicted_Price': predictions})
            print("=" * 80)
            print("PREDICTION RESULTS")
            print("=" * 80)
            print(results_df.to_string(index=False))
            print("=" * 80)
            
            # Save results
            output_file = args.file.replace('.csv', '_predictions.csv') if args.file else 'predictions.csv'
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
            print(f"  Predicted Price: ${pred[0] if isinstance(pred, np.ndarray) else pred:,.2f}")
        except Exception as e:
            print(f"Error: {e}")
            print("Make sure you've run model_training.py first!")
    else:
        main()

