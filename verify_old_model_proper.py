"""
Proper verification of OLD model - recreate exact feature engineering
"""
import pickle
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.preprocessing import PolynomialFeatures, LabelEncoder
import os

print("=" * 80)
print("VERIFYING OLD MODEL (PROPER FEATURE ENGINEERING)")
print("=" * 80)

# Load OLD model
print("\n[1] Loading OLD model...")
with open('models/car_price_model.pkl', 'rb') as f:
    old_model_data = pickle.load(f)

old_model = old_model_data.get('model')
old_features = old_model_data.get('features', [])
print(f"   Model expects {len(old_features)} features")
print(f"   First 10 features: {old_features[:10]}")

# Load dataset
print("\n[2] Loading dataset...")
df = pd.read_csv('cleaned_car_data.csv')
df = df[df['price'] > 0].copy()
print(f"   Dataset: {len(df):,} rows")

# Feature engineering (recreate exactly as old model expects)
print("\n[3] Recreating feature engineering...")

# Age of car
if 'age_of_car' not in df.columns:
    df['age_of_car'] = 2025 - df['year']

# Brand popularity
make_counts = df['make'].value_counts()
make_popularity = make_counts / make_counts.max()
make_popularity_map = make_popularity.to_dict()
df['brand_popularity'] = df['make'].map(make_popularity).fillna(0)

# Basic interactions
df['year_mileage_interaction'] = df['year'] * df['mileage']
df['engine_cylinders_interaction'] = df['engine_size'] * df['cylinders']

# Encode categorical (use existing encoded columns if available)
if 'condition_encoded' not in df.columns:
    condition_map = {'New': 0, 'Like New': 1, 'Excellent': 2, 'Good': 3, 'Fair': 4, 'Poor': 5, 'Salvage': 6}
    df['condition_encoded'] = df['condition'].map(condition_map).fillna(3)

if 'fuel_type_encoded' not in df.columns:
    fuel_map = {'Gasoline': 0, 'Diesel': 1, 'Electric': 2, 'Hybrid': 3, 'Plug-in Hybrid': 4, 'Other': 5}
    df['fuel_type_encoded'] = df['fuel_type'].map(fuel_map).fillna(0)

if 'location_encoded' not in df.columns:
    le_location = LabelEncoder()
    df['location_encoded'] = le_location.fit_transform(df['location'].astype(str))

if 'make_encoded' not in df.columns:
    le_make = LabelEncoder()
    df['make_encoded'] = le_make.fit_transform(df['make'].astype(str))

if 'model_encoded' not in df.columns:
    le_model = LabelEncoder()
    df['model_encoded'] = le_model.fit_transform(df['model'].astype(str))

# Check if we need polynomial features
# The old model has features like 'age_of_car^2', 'cylinders^2', etc.
# This suggests polynomial features of degree 2

print("\n[4] Creating polynomial features...")
# Base features for polynomial (numeric only)
numeric_features = ['year', 'mileage', 'engine_size', 'cylinders', 'age_of_car']
# Also include encoded features that are numeric
encoded_numeric = ['make_encoded', 'model_encoded', 'condition_encoded',
                   'fuel_type_encoded', 'location_encoded']

# Combine base features
base_cols = numeric_features + encoded_numeric + ['brand_popularity',
                                                  'year_mileage_interaction',
                                                  'engine_cylinders_interaction']

# Get available base columns
available_base = [col for col in base_cols if col in df.columns]
print(f"   Base features: {len(available_base)}")

# Create polynomial features (degree 2)
# But we need to match exactly what the old model expects
# Let's try to use the exact feature list from the model

# For now, let's check what features we have vs what's expected
expected_features = set(old_features)
available_features = set(df.columns)

# Features we have
have_features = expected_features & available_features
missing_features = expected_features - available_features

print(f"   Features we have: {len(have_features)}/{len(expected_features)}")
print(f"   Missing: {list(missing_features)[:10]}...")

# Try using only the features we have
if len(have_features) >= 10:
    X = df[list(have_features)].copy()
    print(f"   Using {len(have_features)} features that are available")
else:
    print("   ERROR: Too many missing features")
    print("   Cannot test model without exact feature match")
    X = None

if X is not None:
    y = df['price'].copy()

    # Remove NaN
    valid_mask = ~(y.isna() | X.isna().any(axis=1))
    X = X[valid_mask]
    y = y[valid_mask]

    print(f"   Final dataset: {len(X):,} samples")

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Test
    print("\n[5] Testing OLD model...")
    try:
        train_pred = old_model.predict(X_train)
        test_pred = old_model.predict(X_test)

        train_r2 = r2_score(y_train, train_pred)
        test_r2 = r2_score(y_test, test_pred)
        train_mae = mean_absolute_error(y_train, train_pred)
        test_mae = mean_absolute_error(y_test, test_pred)

        print("\n" + "=" * 80)
        print("OLD MODEL PERFORMANCE (with available features)")
        print("=" * 80)
        print(f"Training R²: {train_r2:.4f} ({train_r2*100:.2f}%)")
        print(f"Test R²: {test_r2:.4f} ({test_r2*100:.2f}%)")
        print(f"Training MAE: ${train_mae:,.0f}")
        print(f"Test MAE: ${test_mae:,.0f}")
        print(f"Overfitting gap: {(train_r2 - test_r2)*100:.2f}%")

        if train_r2 - test_r2 > 0.05:
            print("\nWARNING: Model shows overfitting")
        else:
            print("\nModel generalizes well")

        print("=" * 80)

        # Store for comparison
        old_test_r2 = test_r2
        old_test_mae = test_mae
        old_overfitting = (train_r2 - test_r2) > 0.05

    except Exception as e:
        print(f"\nERROR: {e}")
        old_test_r2 = None
        old_test_mae = None
        old_overfitting = None
else:
    print("\nCannot test - missing required features")
    old_test_r2 = None
    old_test_mae = None
    old_overfitting = None

# Final comparison
print("\n" + "=" * 80)
print("FINAL COMPARISON")
print("=" * 80)

print(f"\n{'Metric':<25} {'OLD Model':<20} {'NEW Model':<20} {'Winner':<15}")
print("-" * 80)
print(f"{'Features':<25} {'28 (partial)':<20} {'10':<20} {'OLD'}")
print(f"{'Test R²':<25} {f'{old_test_r2*100:.2f}%' if old_test_r2 else 'N/A':<20} {'96.10%':<20} {('OLD' if old_test_r2 and old_test_r2 > 0.961 else 'NEW') if old_test_r2 else 'N/A'}")
print(f"{'Test MAE':<25} {f'${old_test_mae:,.0f}' if old_test_mae else 'N/A':<20} {'$1,591':<20} {('OLD' if old_test_mae and old_test_mae < 1591 else 'NEW') if old_test_mae else 'N/A'}")
print(f"{'Overfitting':<25} {('Yes' if old_overfitting else 'No') if old_overfitting is not None else 'N/A':<20} {'No':<20} {'NEW' if old_overfitting else 'TIE'}")

print("\nNOTE: OLD model test uses partial features (missing polynomial features)")
print("      Full verification requires exact feature recreation from training script")

print("\n" + "=" * 80)
