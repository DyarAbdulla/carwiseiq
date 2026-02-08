"""
============================================================================
SIMPLE MODEL TEST SCRIPT (TABULAR FEATURES ONLY)
============================================================================

Tests the trained car price prediction model with user input.
Uses tabular features only (NO images - model doesn't use image recognition).

Usage:
    python test_model.py

Note: This model does NOT use image recognition.
It only uses car details: make, model, year, mileage, condition, etc.
"""

import os
import sys
import pickle
from pathlib import Path
import numpy as np
import pandas as pd
from datetime import datetime

# Paths
MODELS_DIR = Path("models")
MODEL_FILE = MODELS_DIR / "best_model.pkl"
ENCODERS_FILE = MODELS_DIR / "encoders.pkl"
SCALER_FILE = MODELS_DIR / "scaler.pkl"

# ============================================================================
# LOAD MODELS
# ============================================================================

def load_models():
    """Load all trained models and components."""
    print("\n" + "="*60)
    print("Loading models...")
    print("="*60)

    # Check if files exist and are not empty
    model_file_to_use = MODEL_FILE
    if not MODEL_FILE.exists() or MODEL_FILE.stat().st_size == 0:
        print(f"WARNING: Model file not found or empty: {MODEL_FILE}")
        print("Trying alternative model files...")
        # Try alternative model files
        alt_models = [
            MODELS_DIR / "production_model_v1.0.pkl",
            MODELS_DIR / "best_model_v2.pkl",
        ]
        model_found = False
        for alt_model in alt_models:
            if alt_model.exists() and alt_model.stat().st_size > 0:
                print(f"Found alternative model: {alt_model}")
                model_file_to_use = alt_model
                model_found = True
                break
        if not model_found:
            print("ERROR: No valid model file found!")
            print("Please run model training first.")
            sys.exit(1)

    if not ENCODERS_FILE.exists() or ENCODERS_FILE.stat().st_size == 0:
        print(f"ERROR: Encoders file not found or empty: {ENCODERS_FILE}")
        sys.exit(1)

    if not SCALER_FILE.exists() or SCALER_FILE.stat().st_size == 0:
        print(f"ERROR: Scaler file not found or empty: {SCALER_FILE}")
        sys.exit(1)

    # Load ensemble model (handle both formats)
    print(f"Loading model from {model_file_to_use}...")
    with open(model_file_to_use, 'rb') as f:
        model_data = pickle.load(f)

    # Store model metadata for later use
    model_metadata = {}

    # Check if it's a dictionary format (best_model_v2.pkl) or direct model
    if isinstance(model_data, dict):
        ensemble_model = model_data['model']
        model_name = model_data.get('model_name', 'Unknown')
        model_metadata = model_data  # Store full metadata
        print(f"[OK] Model loaded: {model_name}")
        print(f"  Version: {model_data.get('version', 'N/A')}")
        print(f"  Features: {len(model_data.get('features', []))}")
    else:
        ensemble_model = model_data
        model_name = type(ensemble_model).__name__
        print(f"[OK] Ensemble model loaded: {model_name}")

    # Load encoders
    print(f"Loading encoders from {ENCODERS_FILE}...")
    with open(ENCODERS_FILE, 'rb') as f:
        encoders = pickle.load(f)
    print(f"[OK] Encoders loaded: {list(encoders.keys())}")

    # Load scaler
    print(f"Loading scaler from {SCALER_FILE}...")
    with open(SCALER_FILE, 'rb') as f:
        scaler = pickle.load(f)
    expected_features = scaler.n_features_in_ if hasattr(scaler, 'n_features_in_') else None
    print(f"[OK] Scaler loaded (expects {expected_features} features)")

    print("="*60)
    print("All models loaded successfully!")
    print("="*60 + "\n")

    # Extract expected features from model metadata
    expected_features = None
    if isinstance(model_metadata, dict) and 'features' in model_metadata:
        expected_features = model_metadata['features']
        print(f"[OK] Model expects {len(expected_features)} features: {', '.join(expected_features[:5])}...")

    return ensemble_model, encoders, scaler, model_metadata, expected_features


# ============================================================================
# FEATURE ENGINEERING
# ============================================================================

def create_tabular_features(car_data, encoders, expected_features=None):
    """
    Create tabular features based on what the model expects.
    If expected_features is provided, creates only those features in that order.
    Otherwise, creates a standard set of features.
    """
    current_year = datetime.now().year
    age_of_car = current_year - car_data['year']

    # Encode categorical features (handle missing values)
    def safe_encode(encoder, value, default=0):
        """Safely encode a value, using default if not found."""
        try:
            if value in encoder.classes_:
                return encoder.transform([value])[0]
            else:
                return default
        except:
            return default

    # Calculate all possible features
    make_encoded = safe_encode(encoders['make'], car_data['make'])
    model_encoded = safe_encode(encoders['model'], car_data['model'])
    condition_encoded = safe_encode(encoders['condition'], car_data['condition'])
    fuel_type_encoded = safe_encode(encoders['fuel_type'], car_data['fuel_type'])
    trim_encoded = safe_encode(encoders['trim'], car_data.get('trim', 'Unknown'))
    location_encoded = safe_encode(encoders['location'], car_data.get('location', 'Unknown'))

    # Engineered features
    mileage_per_year = car_data['mileage'] / (age_of_car + 1) if age_of_car > 0 else car_data['mileage']
    year_mileage_interaction = car_data['year'] * car_data['mileage']
    engine_cylinders_interaction = car_data['engine_size'] * car_data['cylinders']
    engine_power = car_data['engine_size'] * car_data['cylinders']  # Same as engine_cylinders_interaction

    # Popularity features (simplified - using defaults)
    brand_popularity = 0.5  # Default value
    model_popularity = 0.5  # Default value

    # Luxury brands
    luxury_brands = {'BMW', 'Mercedes-Benz', 'Audi', 'Lexus', 'Porsche',
                     'Jaguar', 'Land Rover', 'Tesla', 'Cadillac', 'Lincoln',
                     'Infiniti', 'Acura', 'Genesis', 'Maserati', 'Bentley'}
    is_luxury = 1 if car_data['make'] in luxury_brands else 0

    # Feature dictionary - maps feature names to values
    feature_dict = {
        'year': car_data['year'],
        'mileage': car_data['mileage'],
        'engine_size': car_data['engine_size'],
        'cylinders': car_data['cylinders'],
        'age_of_car': age_of_car,
        'make_encoded': make_encoded,
        'model_encoded': model_encoded,
        'condition_encoded': condition_encoded,
        'fuel_type_encoded': fuel_type_encoded,
        'trim_encoded': trim_encoded,
        'location_encoded': location_encoded,
        'mileage_per_year': mileage_per_year,
        'year_mileage': year_mileage_interaction,
        'year_mileage_interaction': year_mileage_interaction,
        'engine_power': engine_power,
        'engine_cylinders_interaction': engine_cylinders_interaction,
        'brand_popularity': brand_popularity,
        'model_popularity': model_popularity,
        'is_luxury': is_luxury
    }

    # If expected_features is provided, use that order
    if expected_features:
        features = np.array([feature_dict.get(feat, 0.0) for feat in expected_features], dtype=np.float32)
    else:
        # Default: use the 10 features from production_model_v1.0.pkl
        default_features = ['year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
                           'make_encoded', 'model_encoded', 'brand_popularity',
                           'year_mileage_interaction', 'engine_cylinders_interaction']
        features = np.array([feature_dict.get(feat, 0.0) for feat in default_features], dtype=np.float32)

    return features


# ============================================================================
# PREDICTION
# ============================================================================

def predict_price(car_data, ensemble_model, encoders, scaler, model_metadata=None, expected_features=None):
    """Predict car price from car data."""
    print("\n" + "="*60)
    print("Processing input...")
    print("="*60)

    # Create tabular features using expected feature list
    print("Creating tabular features...")
    features = create_tabular_features(car_data, encoders, expected_features)
    print(f"[OK] Tabular features created: {len(features)} dimensions")
    if expected_features:
        print(f"  Features: {', '.join(expected_features[:5])}...")

    # Store original feature count (what model expects)
    model_feature_count = len(features)

    # Verify feature count matches scaler expectation
    scaler_expected = scaler.n_features_in_ if hasattr(scaler, 'n_features_in_') else None

    # Handle scaler/model mismatch
    if scaler_expected and model_feature_count != scaler_expected:
        print(f"[WARNING] Feature count mismatch!")
        print(f"  Model expects: {model_feature_count} features")
        print(f"  Scaler expects: {scaler_expected} features")

        # Pad or truncate features to match scaler for scaling
        if model_feature_count < scaler_expected:
            # Pad with zeros to match scaler
            padding = scaler_expected - model_feature_count
            features_for_scaler = np.pad(features, (0, padding), 'constant')
            print(f"  Padded to {len(features_for_scaler)} features for scaler")
        else:
            # Truncate to match scaler
            features_for_scaler = features[:scaler_expected]
            print(f"  Truncated to {len(features_for_scaler)} features for scaler")
    else:
        features_for_scaler = features

    # Scale features
    print("Scaling features...")
    try:
        features_scaled = scaler.transform(features_for_scaler.reshape(1, -1))
        print("[OK] Features scaled")

        # CRITICAL: After scaling, truncate back to model's expected count
        if scaler_expected and model_feature_count != scaler_expected:
            features_scaled = features_scaled[:, :model_feature_count]
            print(f"[OK] Truncated scaled features back to {model_feature_count} for model")
    except Exception as e:
        print(f"[ERROR] Scaling features failed: {e}")
        print(f"  Model expects {model_feature_count} features, scaler expects {scaler_expected}")
        raise ValueError(f"Feature mismatch: Model expects {model_feature_count} features but scaler expects {scaler_expected}")

    # Make prediction
    print("\nMaking prediction...")
    prediction = ensemble_model.predict(features_scaled)[0]

    # Handle log transformation if model uses it
    if model_metadata and model_metadata.get('target_transform') == 'log1p':
        transform_offset = model_metadata.get('transform_offset', 1.0)
        prediction = np.expm1(prediction) - transform_offset
        print(f"[OK] Applied log transformation (log1p)")

    # Calculate confidence (simple std from ensemble)
    if hasattr(ensemble_model, 'models') and ensemble_model.models:
        # If ensemble, get predictions from all models
        predictions = []
        for model, _ in ensemble_model.models:
            pred = model.predict(features_scaled)[0]
            if model_metadata and model_metadata.get('target_transform') == 'log1p':
                transform_offset = model_metadata.get('transform_offset', 1.0)
                pred = np.expm1(pred) - transform_offset
            predictions.append(pred)
        confidence_std = np.std(predictions)
        confidence_range = (max(0, prediction - confidence_std), prediction + confidence_std)
    else:
        # Single model - estimate confidence as ±10%
        confidence_range = (max(0, prediction * 0.9), prediction * 1.1)

    print("[OK] Prediction complete!")

    return prediction, confidence_range


# ============================================================================
# USER INPUT
# ============================================================================

def get_user_input():
    """Get car information from user."""
    print("\n" + "="*60)
    print("CAR PRICE PREDICTION TEST")
    print("="*60)
    print("\nPlease enter car information:\n")

    car_data = {}

    car_data['make'] = input("Make (e.g., Toyota): ").strip()
    car_data['model'] = input("Model (e.g., Camry): ").strip()
    car_data['year'] = int(input("Year (e.g., 2020): ").strip())
    car_data['mileage'] = float(input("Mileage (e.g., 50000): ").strip())
    car_data['condition'] = input("Condition (e.g., Used, New, Excellent, Good, Fair): ").strip()
    car_data['fuel_type'] = input("Fuel type (e.g., Gasoline, Diesel, Electric, Hybrid): ").strip()
    car_data['engine_size'] = float(input("Engine size in liters (e.g., 2.5): ").strip())
    car_data['cylinders'] = int(input("Cylinders (e.g., 4): ").strip())

    # Optional fields
    trim_input = input("Trim (press Enter to skip): ").strip()
    car_data['trim'] = trim_input if trim_input else 'Unknown'

    location_input = input("Location (press Enter to skip): ").strip()
    car_data['location'] = location_input if location_input else 'Unknown'

    return car_data


# ============================================================================
# DISPLAY RESULTS
# ============================================================================

def display_results(car_data, prediction, confidence_range):
    """Display prediction results."""
    print("\n" + "="*60)
    print("PREDICTION RESULTS")
    print("="*60)

    print("\nCar Information:")
    print(f"  Make: {car_data['make']}")
    print(f"  Model: {car_data['model']}")
    print(f"  Year: {car_data['year']}")
    print(f"  Mileage: {car_data['mileage']:,} miles")
    print(f"  Condition: {car_data['condition']}")
    print(f"  Fuel Type: {car_data['fuel_type']}")
    print(f"  Engine Size: {car_data['engine_size']}L")
    print(f"  Cylinders: {car_data['cylinders']}")
    if car_data.get('trim') and car_data['trim'] != 'Unknown':
        print(f"  Trim: {car_data['trim']}")
    if car_data.get('location') and car_data['location'] != 'Unknown':
        print(f"  Location: {car_data['location']}")

    print("\n" + "-"*60)
    print("PREDICTED PRICE:")
    print(f"  ${prediction:,.2f}")
    print("\nConfidence Range:")
    print(f"  ${confidence_range[0]:,.2f} - ${confidence_range[1]:,.2f}")
    print("-"*60)

    print("\n" + "="*60)


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Main function."""
    try:
        # Load models
        ensemble_model, encoders, scaler, model_metadata, expected_features = load_models()

        # Get user input
        car_data = get_user_input()

        # Make prediction
        prediction, confidence_range = predict_price(
            car_data, ensemble_model, encoders, scaler, model_metadata, expected_features
        )

        # Display results
        display_results(car_data, prediction, confidence_range)

        print("\nTest complete!")

    except KeyboardInterrupt:
        print("\n\nTest cancelled by user.")
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
