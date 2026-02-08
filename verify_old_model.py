"""
STEP 2: Verify the old model's actual performance
"""
import pickle
import pandas as pd
import numpy as np
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import os

print("=" * 80)
print("STEP 2: VERIFYING OLD MODEL PERFORMANCE")
print("=" * 80)

# Load the OLD model
print("\n[1] Loading OLD model...")
old_model_path = 'models/car_price_model.pkl'
if not os.path.exists(old_model_path):
    print(f"ERROR: {old_model_path} not found!")
    exit(1)

with open(old_model_path, 'rb') as f:
    old_model_data = pickle.load(f)

# Check if it's a dict or direct model
if isinstance(old_model_data, dict):
    old_model = old_model_data.get('model')
    print(f"   Model type: {old_model_data.get('model_name', 'Unknown')}")
    if 'features' in old_model_data:
        print(f"   Features: {len(old_model_data['features'])}")
else:
    old_model = old_model_data
    print(f"   Model type: {type(old_model).__name__}")

# Try to load encoders
encoders = {}
encoder_files = ['models/encoders.pkl', 'models/make_encoder.pkl', 'models/model_encoder.pkl']
for enc_file in encoder_files:
    if os.path.exists(enc_file):
        with open(enc_file, 'rb') as f:
            encoders[enc_file] = pickle.load(f)
        print(f"   Found encoder: {enc_file}")

# Load ORIGINAL dataset
print("\n[2] Loading original dataset...")
data_files = ['car_data.csv', 'data/car_data.csv', 'cleaned_car_data.csv', 'data/cleaned_car_data.csv']
df = None
for data_file in data_files:
    if os.path.exists(data_file):
        df = pd.read_csv(data_file)
        print(f"   Loaded: {data_file} ({len(df):,} rows)")
        break

if df is None:
    print("ERROR: No dataset file found!")
    exit(1)

# Show first 10 rows
print("\n[3] First 10 rows of dataset:")
print(df.head(10).to_string())

# Minimal cleaning
print("\n[4] Minimal cleaning (only remove $0 prices)...")
df_clean = df[df['price'] > 0].copy()
print(f"   After removing $0 prices: {len(df_clean):,} rows")
print(f"   Price range: ${df_clean['price'].min():,.0f} - ${df_clean['price'].max():,.0f}")
print(f"   Price mean: ${df_clean['price'].mean():,.0f}")

# Check what features the model expects
print("\n[5] Model feature requirements...")
if hasattr(old_model, 'feature_names_in_'):
    expected_features = old_model.feature_names_in_
    print(f"   Model expects {len(expected_features)} features:")
    print(f"   {list(expected_features)[:10]}...")
else:
    print("   Model doesn't have feature_names_in_ attribute")
    print("   Will try to infer from model_data...")
    if isinstance(old_model_data, dict) and 'features' in old_model_data:
        expected_features = old_model_data['features']
        print(f"   Features from model_data: {len(expected_features)}")
    else:
        print("   Cannot determine expected features")
        expected_features = None

# Try to prepare features and test
if expected_features is not None:
    print("\n[6] Attempting to prepare features...")
    try:
        # This is complex - the old model might use different feature engineering
        # For now, let's just show what we know
        print(f"   Expected features: {expected_features}")
        print("   Note: Full feature preparation requires original encoding logic")
    except Exception as e:
        print(f"   Error preparing features: {e}")

print("\n" + "=" * 80)
print("OLD MODEL INFORMATION")
print("=" * 80)
print(f"Model file: {old_model_path}")
print(f"Model type: {type(old_model).__name__}")
if hasattr(old_model, 'get_params'):
    params = old_model.get_params()
    print(f"Key parameters: {dict(list(params.items())[:5])}")
print("=" * 80)

print("\nNOTE: To get exact R² score, we need to:")
print("  1. Know the exact feature preparation logic used by old model")
print("  2. Prepare features exactly as the old model expects")
print("  3. Make predictions on the same dataset it was trained on")
print("\nThis requires the original training script or model metadata.")
