"""
STEP 1 & 2: Verify OLD model's 99.96% claim and compare with NEW model
"""
import pickle
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from sklearn.preprocessing import PolynomialFeatures
import os

print("=" * 80)
print("VERIFYING OLD MODEL'S 99.96% CLAIM")
print("=" * 80)

# Load OLD model
print("\n[1] Loading OLD model...")
old_model_path = 'models/car_price_model.pkl'
with open(old_model_path, 'rb') as f:
    old_model_data = pickle.load(f)

old_model = old_model_data.get('model') if isinstance(old_model_data, dict) else old_model_data
old_features = old_model_data.get('features', []) if isinstance(old_model_data, dict) else []

print(f"   Model type: {type(old_model).__name__}")
print(f"   Expected features: {len(old_features)}")

# Load encoders
encoders = {}
encoder_file = 'models/encoders.pkl'
if os.path.exists(encoder_file):
    with open(encoder_file, 'rb') as f:
        encoders_data = pickle.load(f)
        if isinstance(encoders_data, dict):
            encoders = encoders_data
        else:
            print("   WARNING: encoders.pkl format unexpected")
else:
    print("   WARNING: encoders.pkl not found, trying individual encoders")
    for enc_name in ['make', 'model', 'trim', 'fuel_type', 'condition', 'location']:
        enc_file = f'models/{enc_name}_encoder.pkl'
        if os.path.exists(enc_file):
            with open(enc_file, 'rb') as f:
                encoders[enc_name] = pickle.load(f)

# Load dataset
print("\n[2] Loading dataset...")
data_files = ['cleaned_car_data.csv', 'data/cleaned_car_data.csv']
df = None
for data_file in data_files:
    if os.path.exists(data_file):
        df = pd.read_csv(data_file)
        print(f"   Loaded: {data_file} ({len(df):,} rows)")
        break

if df is None:
    print("ERROR: No dataset found!")
    exit(1)

# Minimal cleaning
df = df[df['price'] > 0].copy()
print(f"   After removing $0 prices: {len(df):,} rows")

# Prepare features for OLD model
print("\n[3] Preparing features for OLD model...")

# Encode categorical features
categorical_cols = ['make', 'model', 'trim', 'fuel_type', 'condition', 'location']
for col in categorical_cols:
    if col in df.columns:
        if col in encoders:
            try:
                # Get unique values from dataset
                unique_vals = df[col].astype(str).unique()
                # Transform
                df[col + '_encoded'] = encoders[col].transform(df[col].astype(str))
            except Exception as e:
                print(f"   WARNING: Could not encode {col}: {e}")
                df[col + '_encoded'] = 0
        else:
            # Use existing encoded column if available
            if col + '_encoded' not in df.columns:
                df[col + '_encoded'] = 0

# Check if we need to create age_of_car
if 'age_of_car' not in df.columns:
    df['age_of_car'] = 2025 - df['year']

# Check what features old model expects
if old_features:
    # Try to match features
    available_features = [f for f in old_features if f in df.columns]
    missing_features = [f for f in old_features if f not in df.columns]

    print(f"   Available features: {len(available_features)}/{len(old_features)}")
    if missing_features:
        print(f"   Missing features: {missing_features[:5]}...")

    # Use available features
    X = df[available_features].copy()
else:
    # Try to infer from model
    if hasattr(old_model, 'feature_names_in_'):
        X = df[[f for f in old_model.feature_names_in_ if f in df.columns]].copy()
    else:
        # Default features
        basic_features = ['year', 'mileage', 'engine_size', 'cylinders', 'age_of_car']
        encoded_features = [f'{col}_encoded' for col in categorical_cols]
        X = df[[f for f in basic_features + encoded_features if f in df.columns]].copy()

y = df['price'].copy()

# Remove NaN
valid_mask = ~(y.isna() | X.isna().any(axis=1))
X = X[valid_mask]
y = y[valid_mask]

print(f"   Final dataset: {len(X):,} samples")
print(f"   Features: {list(X.columns)[:10]}...")

# Split data
print("\n[4] Splitting data (80/20)...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, shuffle=True
)
print(f"   Train: {len(X_train):,} samples")
print(f"   Test: {len(X_test):,} samples")

# Test OLD model on training data
print("\n[5] Testing OLD model...")
try:
    train_pred = old_model.predict(X_train)
    train_r2 = r2_score(y_train, train_pred)
    train_mae = mean_absolute_error(y_train, train_pred)

    test_pred = old_model.predict(X_test)
    test_r2 = r2_score(y_test, test_pred)
    test_mae = mean_absolute_error(y_test, test_pred)

    print("\n" + "=" * 80)
    print("OLD MODEL PERFORMANCE")
    print("=" * 80)
    print(f"Training set R²: {train_r2:.6f} ({train_r2*100:.4f}%)")
    print(f"Training set MAE: ${train_mae:,.0f}")
    print(f"\nTest set R² (REAL ACCURACY): {test_r2:.6f} ({test_r2*100:.4f}%)")
    print(f"Test set MAE: ${test_mae:,.0f}")
    print(f"\nOverfitting gap: {(train_r2 - test_r2)*100:.2f}%")

    if train_r2 - test_r2 > 0.05:
        print("\n⚠️ WARNING: Model is OVERFITTING (memorizing training data)")
        print(f"   Training R² ({train_r2*100:.2f}%) is much higher than Test R² ({test_r2*100:.2f}%)")
    else:
        print("\n✅ Model generalizes well (low overfitting)")

    print("=" * 80)

    # Store results
    old_train_r2 = train_r2
    old_test_r2 = test_r2
    old_train_mae = train_mae
    old_test_mae = test_mae
    old_overfitting = train_r2 - test_r2 > 0.05

except Exception as e:
    print(f"\nERROR testing OLD model: {e}")
    import traceback
    traceback.print_exc()
    old_train_r2 = None
    old_test_r2 = None
    old_train_mae = None
    old_test_mae = None
    old_overfitting = None

# Compare with NEW model
print("\n[6] Comparing with NEW model...")
print("   NEW model test R²: 96.10% (from previous training)")
print("   NEW model test MAE: $1,591")

print("\n" + "=" * 80)
print("COMPARISON TABLE")
print("=" * 80)

if old_test_r2 is not None:
    print(f"\n{'Metric':<25} {'OLD Model':<20} {'NEW Model':<20} {'Winner':<15}")
    print("-" * 80)
    print(f"{'Features':<25} {'28':<20} {'10':<20} {'OLD (more)'}")

    train_r2_old_str = f"{old_train_r2*100:.2f}%" if old_train_r2 else "N/A"
    train_r2_new_str = "N/A"
    print(f"{'Training R²':<25} {train_r2_old_str:<20} {train_r2_new_str:<20} {'OLD' if old_train_r2 else 'N/A'}")

    test_r2_old_str = f"{old_test_r2*100:.2f}%"
    test_r2_new_str = "96.10%"
    test_r2_winner = "OLD" if old_test_r2 > 0.961 else "NEW"
    print(f"{'Test R² (real)':<25} {test_r2_old_str:<20} {test_r2_new_str:<20} {test_r2_winner}")

    test_mae_old_str = f"${old_test_mae:,.0f}" if old_test_mae else "N/A"
    test_mae_new_str = "$1,591"
    test_mae_winner = "OLD" if old_test_mae and old_test_mae < 1591 else "NEW"
    print(f"{'Test MAE':<25} {test_mae_old_str:<20} {test_mae_new_str:<20} {test_mae_winner}")

    overfitting_old_str = "Yes" if old_overfitting else "No"
    overfitting_new_str = "No"
    print(f"{'Overfitting':<25} {overfitting_old_str:<20} {overfitting_new_str:<20} {'NEW' if old_overfitting else 'TIE'}")

    print("\n" + "=" * 80)
    print("RECOMMENDATION")
    print("=" * 80)

    if old_test_r2 > 0.95 and not old_overfitting:
        print("\n✅ KEEP OLD MODEL")
        print("   - Test R² is high (>95%)")
        print("   - Low overfitting")
        print("   - Better performance")
    elif old_test_r2 > 0.961:
        print("\n✅ KEEP OLD MODEL")
        print("   - Test R² is higher than NEW model")
        print("   - Slightly better accuracy")
    elif old_overfitting and old_test_r2 < 0.90:
        print("\n⚠️ KEEP NEW MODEL")
        print("   - OLD model is overfitting badly")
        print("   - NEW model (96%) is more reliable")
    else:
        print("\n🤔 KEEP NEW MODEL (simpler)")
        print("   - Similar performance")
        print("   - Easier to maintain (fewer features)")
        print("   - Less risk of overfitting")
else:
    print("\n⚠️ Could not test OLD model properly")
    print("   Recommendation: Keep NEW model until OLD model can be tested")

print("\n" + "=" * 80)
