"""
FIX MODEL - Proper Retraining Script
Fixes the broken model by retraining correctly from scratch
"""
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
import pickle
import os
import sys

print("=" * 80)
print("FIXING MODEL - PROPER RETRAINING")
print("=" * 80)

# Load data
print("\n[1] Loading data...")
data_file = 'cleaned_car_data.csv'
if not os.path.exists(data_file):
    data_file = 'data/cleaned_car_data.csv'

df = pd.read_csv(data_file)
print(f"   Original dataset: {len(df):,} rows")

# CRITICAL: Remove invalid prices
print("\n[2] Cleaning data...")
df_clean = df[df['price'] > 0].copy()  # Remove zero/negative prices
print(f"   After removing invalid prices: {len(df_clean):,} rows")

# Remove extreme outliers (keep reasonable range)
df_clean = df_clean[(df_clean['price'] >= 5000) & (df_clean['price'] <= 80000)].copy()
print(f"   After price filtering (5k-80k): {len(df_clean):,} rows")

# Filter reasonable years
df_clean = df_clean[(df_clean['year'] >= 2015) & (df_clean['year'] <= 2026)].copy()
print(f"   After year filtering (2015-2026): {len(df_clean):,} rows")

# Filter reasonable mileage
df_clean = df_clean[df_clean['mileage'] <= 300000].copy()
print(f"   After mileage filtering (<300k): {len(df_clean):,} rows")

# Remove rows with missing critical features
required_cols = ['year', 'mileage', 'engine_size', 'cylinders', 'make', 'model', 'price']
df_clean = df_clean[required_cols].dropna()
print(f"   After removing missing values: {len(df_clean):,} rows")

print(f"\n   Final clean dataset: {len(df_clean):,} rows")
print(f"   Price range: ${df_clean['price'].min():,.0f} - ${df_clean['price'].max():,.0f}")
print(f"   Price mean: ${df_clean['price'].mean():,.0f}")
print(f"   Price median: ${df_clean['price'].median():,.0f}")

# Encode categorical features
print("\n[3] Encoding categorical features...")
encoders = {}

# Condition encoding (use existing if available, else create)
if 'condition_encoded' in df_clean.columns:
    print("   Using existing condition_encoded")
else:
    condition_map = {
        'New': 0, 'Like New': 1, 'Excellent': 2, 'Good': 3,
        'Fair': 4, 'Poor': 5, 'Salvage': 6
    }
    if 'condition' in df_clean.columns:
        df_clean['condition_encoded'] = df_clean['condition'].map(condition_map).fillna(3)
        encoders['condition_map'] = condition_map

# Fuel type encoding
if 'fuel_type_encoded' in df_clean.columns:
    print("   Using existing fuel_type_encoded")
else:
    fuel_type_map = {
        'Gasoline': 0, 'Diesel': 1, 'Electric': 2, 'Hybrid': 3,
        'Plug-in Hybrid': 4, 'Other': 5
    }
    if 'fuel_type' in df_clean.columns:
        df_clean['fuel_type_encoded'] = df_clean['fuel_type'].map(fuel_type_map).fillna(0)
        encoders['fuel_type_map'] = fuel_type_map

# Location encoding
if 'location_encoded' in df_clean.columns:
    print("   Using existing location_encoded")
else:
    if 'location' in df_clean.columns:
        le_location = LabelEncoder()
        df_clean['location_encoded'] = le_location.fit_transform(df_clean['location'].astype(str))
        encoders['location'] = le_location
        print(f"   Encoded {len(le_location.classes_)} locations")

# Make encoding
le_make = LabelEncoder()
df_clean['make_encoded'] = le_make.fit_transform(df_clean['make'].astype(str))
encoders['make'] = le_make
print(f"   Encoded {len(le_make.classes_)} makes")

# Model encoding
le_model = LabelEncoder()
df_clean['model_encoded'] = le_model.fit_transform(df_clean['model'].astype(str))
encoders['model'] = le_model
print(f"   Encoded {len(le_model.classes_)} models")

# Feature engineering
print("\n[4] Feature engineering...")
df_clean['age_of_car'] = 2025 - df_clean['year']

# Brand popularity
make_counts = df_clean['make'].value_counts()
make_popularity = make_counts / make_counts.max()
make_popularity_map = make_popularity.to_dict()
df_clean['brand_popularity'] = df_clean['make'].map(make_popularity).fillna(0)
encoders['make_popularity_map'] = make_popularity_map

# Interaction features
df_clean['year_mileage_interaction'] = df_clean['year'] * df_clean['mileage']
df_clean['engine_cylinders_interaction'] = df_clean['engine_size'] * df_clean['cylinders']

# Select features
feature_cols = [
    'year', 'mileage', 'engine_size', 'cylinders', 'age_of_car'
]

# Add encoded features
if 'condition_encoded' in df_clean.columns:
    feature_cols.append('condition_encoded')
if 'fuel_type_encoded' in df_clean.columns:
    feature_cols.append('fuel_type_encoded')
if 'location_encoded' in df_clean.columns:
    feature_cols.append('location_encoded')

feature_cols.extend(['make_encoded', 'model_encoded', 'brand_popularity',
                     'year_mileage_interaction', 'engine_cylinders_interaction'])

# Only use features that exist
available_features = [col for col in feature_cols if col in df_clean.columns]
print(f"   Using {len(available_features)} features: {', '.join(available_features[:10])}...")

X = df_clean[available_features].copy()
y = df_clean['price'].copy()

# Remove any NaN or infinite values
X = X.replace([np.inf, -np.inf], np.nan)
X = X.fillna(X.median())
y = y.replace([np.inf, -np.inf], np.nan)
y = y.fillna(y.median())

# Final validation
valid_mask = ~(y.isna() | X.isna().any(axis=1))
X = X[valid_mask]
y = y[valid_mask]

print(f"   Final feature matrix: {X.shape}")

# Split data
print("\n[5] Splitting data...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, shuffle=True
)
print(f"   Train set: {len(X_train):,} samples")
print(f"   Test set: {len(X_test):,} samples")

# Train models
print("\n[6] Training models...")
models = {}
results = {}

# Random Forest
print("   Training Random Forest...")
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
print("   Training Gradient Boosting...")
gb = GradientBoostingRegressor(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.1,
    random_state=42
)
gb.fit(X_train, y_train)
models['Gradient Boosting'] = gb

# Evaluate models
print("\n[7] Evaluating models...")
for name, model in models.items():
    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)

    train_r2 = r2_score(y_train, train_pred)
    test_r2 = r2_score(y_test, test_pred)
    test_mae = mean_absolute_error(y_test, test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, test_pred))

    results[name] = {
        'train_r2': train_r2,
        'test_r2': test_r2,
        'test_mae': test_mae,
        'test_rmse': test_rmse
    }

    print(f"\n   {name}:")
    print(f"     Train R²: {train_r2:.4f}")
    print(f"     Test R²:  {test_r2:.4f}")
    print(f"     Test MAE: ${test_mae:,.0f}")
    print(f"     Test RMSE: ${test_rmse:,.0f}")

# Select best model
best_model_name = max(results.keys(), key=lambda k: results[k]['test_r2'])
best_model = models[best_model_name]
best_results = results[best_model_name]

print(f"\n   BEST MODEL: {best_model_name}")
print(f"     Test R²: {best_results['test_r2']:.4f}")
print(f"     Test MAE: ${best_results['test_mae']:,.0f}")
print(f"     Test RMSE: ${best_results['test_rmse']:,.0f}")

# Test on specific cars
print("\n[8] Testing on specific cars...")

# Helper function to prepare test car
def prepare_test_car(car_data, df_ref, encoders):
    """Prepare a test car for prediction"""
    car_df = pd.DataFrame([car_data])
    car_df['age_of_car'] = 2025 - car_df['year']

    # Brand popularity
    if 'make_popularity_map' in encoders:
        car_df['brand_popularity'] = car_df['make'].map(encoders['make_popularity_map']).fillna(0)

    # Interaction features
    car_df['year_mileage_interaction'] = car_df['year'] * car_df['mileage']
    car_df['engine_cylinders_interaction'] = car_df['engine_size'] * car_df['cylinders']

    # Encode categorical
    if 'condition_map' in encoders and 'condition' in car_df.columns:
        car_df['condition_encoded'] = car_df['condition'].map(encoders['condition_map']).fillna(3)
    elif 'condition' not in car_df.columns:
        car_df['condition_encoded'] = 3  # Default to 'Good'

    if 'fuel_type_map' in encoders and 'fuel_type' in car_df.columns:
        car_df['fuel_type_encoded'] = car_df['fuel_type'].map(encoders['fuel_type_map']).fillna(0)
    elif 'fuel_type' not in car_df.columns:
        car_df['fuel_type_encoded'] = 0  # Default to 'Gasoline'

    if 'location' in encoders and 'location' in car_df.columns:
        try:
            car_df['location_encoded'] = encoders['location'].transform(car_df['location'].astype(str))
        except ValueError:
            # If location not in encoder, use most common
            car_df['location_encoded'] = 0

    # Encode make and model
    if 'make' in encoders:
        try:
            car_df['make_encoded'] = encoders['make'].transform(car_df['make'].astype(str))
        except ValueError:
            car_df['make_encoded'] = 0

    if 'model' in encoders:
        try:
            car_df['model_encoded'] = encoders['model'].transform(car_df['model'].astype(str))
        except ValueError:
            car_df['model_encoded'] = 0

    # Select features
    test_X = car_df[[col for col in available_features if col in car_df.columns]]

    # Fill missing columns with median from training
    for col in available_features:
        if col not in test_X.columns:
            test_X[col] = X_train[col].median()

    # Reorder columns to match training
    test_X = test_X[available_features]

    return test_X

# Test cases
test_cases = [
    {'make': 'Toyota', 'model': 'Camry', 'year': 2025, 'mileage': 0, 'engine_size': 2.5, 'cylinders': 4, 'condition': 'New', 'fuel_type': 'Hybrid', 'location': 'Baghdad'},
    {'make': 'Chery', 'model': 'Tiggo 7 Pro', 'year': 2024, 'mileage': 20000, 'engine_size': 2.0, 'cylinders': 4, 'condition': 'Good', 'fuel_type': 'Gasoline', 'location': 'Baghdad'},
]

print("\n   Test Predictions:")
for test_car in test_cases:
    # Find similar cars in dataset
    similar = df_clean[
        (df_clean['make'] == test_car['make']) &
        (df_clean['model'] == test_car['model']) &
        (df_clean['year'] == test_car['year'])
    ]

    if len(similar) > 0:
        dataset_median = similar['price'].median()
        dataset_mean = similar['price'].mean()

        # Prepare and predict
        try:
            test_X = prepare_test_car(test_car, df_clean, encoders)
            prediction = best_model.predict(test_X)[0]

            diff_percent = ((prediction - dataset_median) / dataset_median * 100) if dataset_median > 0 else 0

            print(f"\n   {test_car['year']} {test_car['make']} {test_car['model']} ({test_car['mileage']:,} km):")
            print(f"     Dataset median: ${dataset_median:,.0f}")
            print(f"     Dataset mean: ${dataset_mean:,.0f}")
            print(f"     Model prediction: ${prediction:,.0f}")
            print(f"     Difference: {diff_percent:+.1f}%")

            if abs(diff_percent) <= 30:
                print(f"     STATUS: OK (within 30%)")
            else:
                print(f"     STATUS: WARNING (outside 30%)")
        except Exception as e:
            print(f"\n   {test_car['year']} {test_car['make']} {test_car['model']}:")
            print(f"     ERROR preparing prediction: {e}")

# Save model
print("\n[9] Saving model...")
os.makedirs('models', exist_ok=True)

model_data = {
    'model': best_model,
    'model_name': best_model_name,
    'features': available_features,
    'target_transform': None,
    'transform_offset': 1.0,
    'make_encoder': encoders['make'],
    'model_encoder': encoders['model'],
    'location_encoder': encoders.get('location'),
    'make_popularity_map': make_popularity_map,
    'condition_map': encoders.get('condition_map'),
    'fuel_type_map': encoders.get('fuel_type_map'),
    'training_results': best_results,
    'encoders': encoders
}

# Backup old model
old_model_path = 'models/best_model_v2.pkl'
if os.path.exists(old_model_path):
    backup_path = 'models/best_model_v2_broken_backup.pkl'
    import shutil
    shutil.copy2(old_model_path, backup_path)
    print(f"   Backed up old model to: {backup_path}")

# Save new model
with open(old_model_path, 'wb') as f:
    pickle.dump(model_data, f)
print(f"   Saved new model to: {old_model_path}")

# Save encoders separately
with open('models/make_encoder.pkl', 'wb') as f:
    pickle.dump(encoders['make'], f)
with open('models/model_encoder.pkl', 'wb') as f:
    pickle.dump(encoders['model'], f)
print(f"   Saved encoders")

print("\n" + "=" * 80)
print("MODEL FIXED AND SAVED!")
print("=" * 80)
print(f"\nBest Model: {best_model_name}")
print(f"Test R²: {best_results['test_r2']:.4f}")
print(f"Test MAE: ${best_results['test_mae']:,.0f}")
print(f"Test RMSE: ${best_results['test_rmse']:,.0f}")
print("\nNext: Restart the backend to load the fixed model")
