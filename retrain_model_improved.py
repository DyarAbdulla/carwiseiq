"""
Improved Model Retraining Script
- Proper data cleaning and outlier removal
- Better feature encoding
- Train/test split with validation
- Comprehensive model evaluation
- Saves encoders for reuse
"""

import pandas as pd
import numpy as np
import pickle
import os
import sys
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import warnings
warnings.filterwarnings('ignore')

# Add paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

print("=" * 80)
print("IMPROVED MODEL RETRAINING")
print("=" * 80)

# ============================================================================
# STEP 1: Load and Clean Data
# ============================================================================
print("\n[STEP 1] Loading and cleaning data...")

data_path = os.path.join(BASE_DIR, 'data', 'cleaned_car_data.csv')
if not os.path.exists(data_path):
    data_path = os.path.join(BASE_DIR, 'cleaned_car_data.csv')

if not os.path.exists(data_path):
    print(f"ERROR: Data file not found at {data_path}")
    sys.exit(1)

df = pd.read_csv(data_path)
print(f"  Loaded: {len(df):,} rows, {len(df.columns)} columns")

# Ensure price column exists
if 'price' not in df.columns:
    print("ERROR: 'price' column not found!")
    sys.exit(1)

# Remove rows with invalid prices
df = df[df['price'] > 0].copy()
df = df[df['price'].notna()].copy()
print(f"  After removing invalid prices: {len(df):,} rows")

# ============================================================================
# STEP 2: Remove Outliers Using IQR Method
# ============================================================================
print("\n[STEP 2] Removing outliers...")

def remove_outliers_iqr(df, column):
    """Remove outliers using IQR method"""
    Q1 = df[column].quantile(0.25)
    Q3 = df[column].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR

    before = len(df)
    df_clean = df[(df[column] >= lower_bound) & (df[column] <= upper_bound)].copy()
    after = len(df_clean)

    return df_clean, before - after

df_before = len(df)
df, outliers_removed = remove_outliers_iqr(df, 'price')
print(f"  Removed {outliers_removed:,} price outliers ({outliers_removed/df_before*100:.1f}%)")
print(f"  Remaining: {len(df):,} rows")

# Additional outlier removal for key features
for col in ['mileage', 'year', 'engine_size']:
    if col in df.columns:
        df, removed = remove_outliers_iqr(df, col)
        if removed > 0:
            print(f"  Removed {removed:,} outliers from {col}")

print(f"  Final dataset: {len(df):,} rows")

# ============================================================================
# STEP 3: Feature Engineering
# ============================================================================
print("\n[STEP 3] Feature engineering...")

# Car age
if 'age_of_car' not in df.columns:
    df['age_of_car'] = 2025 - df['year']

# Brand popularity
if 'make' in df.columns:
    make_counts = df['make'].value_counts()
    make_popularity = make_counts / make_counts.max()
    make_popularity_map = make_popularity.to_dict()
    df['brand_popularity'] = df['make'].map(make_popularity).fillna(0)
    print(f"  Created brand_popularity feature")

# Interaction features
df['year_mileage_interaction'] = df['year'] * df['mileage']
if 'engine_size' in df.columns and 'cylinders' in df.columns:
    df['engine_cylinders_interaction'] = df['engine_size'] * df['cylinders']
    print(f"  Created interaction features")

# ============================================================================
# STEP 4: Encode Categorical Variables
# ============================================================================
print("\n[STEP 4] Encoding categorical variables...")

# Condition encoding
condition_map = {
    'New': 0, 'Like New': 1, 'Excellent': 2, 'Good': 3,
    'Fair': 4, 'Poor': 5, 'Salvage': 6
}
if 'condition' in df.columns:
    df['condition_encoded'] = df['condition'].map(condition_map).fillna(3)

# Fuel type encoding
fuel_type_map = {
    'Gasoline': 0, 'Diesel': 1, 'Electric': 2, 'Hybrid': 3,
    'Plug-in Hybrid': 4, 'Other': 5
}
if 'fuel_type' in df.columns:
    df['fuel_type_encoded'] = df['fuel_type'].map(fuel_type_map).fillna(0)

# Location encoding
le_location = LabelEncoder()
if 'location' in df.columns:
    df['location_encoded'] = le_location.fit_transform(df['location'].astype(str))
    print(f"  Encoded {len(le_location.classes_)} locations")

# Make encoding
le_make = LabelEncoder()
if 'make' in df.columns:
    df['make_encoded'] = le_make.fit_transform(df['make'].astype(str))
    print(f"  Encoded {len(le_make.classes_)} makes")

# Model encoding
le_model = LabelEncoder()
if 'model' in df.columns:
    df['model_encoded'] = le_model.fit_transform(df['model'].astype(str))
    print(f"  Encoded {len(le_model.classes_)} models")

# ============================================================================
# STEP 5: Prepare Features and Target
# ============================================================================
print("\n[STEP 5] Preparing features...")

feature_cols = [
    'year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
    'condition_encoded', 'fuel_type_encoded', 'location_encoded',
    'make_encoded', 'model_encoded', 'brand_popularity',
    'year_mileage_interaction', 'engine_cylinders_interaction'
]

# Only use features that exist
available_features = [col for col in feature_cols if col in df.columns]
print(f"  Using {len(available_features)} features")

X = df[available_features].copy()
y = df['price'].copy()

# Remove any remaining NaN or infinite values
X = X.replace([np.inf, -np.inf], np.nan)
X = X.fillna(X.median())
y = y.replace([np.inf, -np.inf], np.nan)
y = y.fillna(y.median())

# Final validation
valid_mask = ~(y.isna() | X.isna().any(axis=1))
X = X[valid_mask]
y = y[valid_mask]

print(f"  Final dataset: {len(X):,} samples")

# ============================================================================
# STEP 6: Train/Test Split
# ============================================================================
print("\n[STEP 6] Splitting data...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, shuffle=True
)
print(f"  Train set: {len(X_train):,} samples")
print(f"  Test set: {len(X_test):,} samples")

# ============================================================================
# STEP 7: Train Models
# ============================================================================
print("\n[STEP 7] Training models...")

models = {}
results = {}

# Random Forest
print("  Training Random Forest...")
rf = RandomForestRegressor(
    n_estimators=200,
    max_depth=20,
    min_samples_split=5,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1
)
rf.fit(X_train, y_train)
models['Random Forest'] = rf

# Gradient Boosting
print("  Training Gradient Boosting...")
gb = GradientBoostingRegressor(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.1,
    random_state=42
)
gb.fit(X_train, y_train)
models['Gradient Boosting'] = gb

# ============================================================================
# STEP 8: Evaluate Models
# ============================================================================
print("\n[STEP 8] Evaluating models...")

for name, model in models.items():
    # Train predictions
    y_train_pred = model.predict(X_train)
    train_r2 = r2_score(y_train, y_train_pred)
    train_mae = mean_absolute_error(y_train, y_train_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))

    # Test predictions
    y_test_pred = model.predict(X_test)
    test_r2 = r2_score(y_test, y_test_pred)
    test_mae = mean_absolute_error(y_test, y_test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))

    results[name] = {
        'train_r2': train_r2,
        'train_mae': train_mae,
        'train_rmse': train_rmse,
        'test_r2': test_r2,
        'test_mae': test_mae,
        'test_rmse': test_rmse
    }

    print(f"\n  {name}:")
    print(f"    Train R²: {train_r2:.4f} | MAE: ${train_mae:,.0f} | RMSE: ${train_rmse:,.0f}")
    print(f"    Test R²:  {test_r2:.4f} | MAE: ${test_mae:,.0f} | RMSE: ${test_rmse:,.0f}")

# Select best model (highest test R²)
best_model_name = max(results.keys(), key=lambda k: results[k]['test_r2'])
best_model = models[best_model_name]
best_results = results[best_model_name]

print(f"\n  Best Model: {best_model_name}")
print(f"    Test R²: {best_results['test_r2']:.4f}")
print(f"    Test MAE: ${best_results['test_mae']:,.0f}")
print(f"    Test RMSE: ${best_results['test_rmse']:,.0f}")

# ============================================================================
# STEP 9: Save Model and Encoders
# ============================================================================
print("\n[STEP 9] Saving model and encoders...")

os.makedirs('models', exist_ok=True)

# Save model
model_data = {
    'model': best_model,
    'model_name': best_model_name,
    'features': available_features,
    'target_transform': None,  # No log transform for now
    'transform_offset': 1.0,
    'make_encoder': le_make,
    'model_encoder': le_model,
    'location_encoder': le_location,
    'make_popularity_map': make_popularity_map,
    'condition_map': condition_map,
    'fuel_type_map': fuel_type_map,
    'training_results': best_results
}

model_path = os.path.join(BASE_DIR, 'models', 'best_model_v2.pkl')
with open(model_path, 'wb') as f:
    pickle.dump(model_data, f)
print(f"  Saved model to: {model_path}")

# Save encoders separately
with open(os.path.join(BASE_DIR, 'models', 'make_encoder.pkl'), 'wb') as f:
    pickle.dump(le_make, f)
with open(os.path.join(BASE_DIR, 'models', 'model_encoder.pkl'), 'wb') as f:
    pickle.dump(le_model, f)
print(f"  Saved encoders")

# ============================================================================
# STEP 10: Test Prediction on Sample
# ============================================================================
print("\n[STEP 10] Testing prediction on sample car...")

# Test with Chery Tiggo 7 Pro
test_car = {
    'year': 2024,
    'mileage': 20000,
    'engine_size': 2.0,
    'cylinders': 4,
    'make': 'Chery',
    'model': 'Tiggo 7 Pro',
    'condition': 'Good',
    'fuel_type': 'Gasoline',
    'location': 'Baghdad'
}

# Prepare test features
test_df = pd.DataFrame([test_car])
test_df['age_of_car'] = 2025 - test_df['year']
test_df['brand_popularity'] = test_df['make'].map(make_popularity_map).fillna(0)
test_df['year_mileage_interaction'] = test_df['year'] * test_df['mileage']
test_df['engine_cylinders_interaction'] = test_df['engine_size'] * test_df['cylinders']
test_df['condition_encoded'] = test_df['condition'].map(condition_map).fillna(3)
test_df['fuel_type_encoded'] = test_df['fuel_type'].map(fuel_type_map).fillna(0)
test_df['location_encoded'] = le_location.transform(test_df['location'].astype(str))
test_df['make_encoded'] = le_make.transform(test_df['make'].astype(str))
test_df['model_encoded'] = le_model.transform(test_df['model'].astype(str))

test_X = test_df[available_features]
prediction = best_model.predict(test_X)[0]

print(f"  Test car: 2024 Chery Tiggo 7 Pro, 20,000 km")
print(f"  Predicted price: ${prediction:,.0f}")
print(f"  Expected range: $13,000 - $15,500")
print(f"  Difference: ${abs(prediction - 14000):,.0f} ({abs((prediction/14000 - 1)*100):.1f}%)")

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 80)
print("RETRAINING COMPLETE")
print("=" * 80)
print(f"\nBest Model: {best_model_name}")
print(f"Test R² Score: {best_results['test_r2']:.4f}")
print(f"Test MAE: ${best_results['test_mae']:,.0f}")
print(f"Test RMSE: ${best_results['test_rmse']:,.0f}")
print(f"\nModel saved to: models/best_model_v2.pkl")
print("\nNext steps:")
print("  1. Restart the ML backend to load the new model")
print("  2. Test predictions with the API")
print("  3. Verify predictions are within ±20-30% of market data")
