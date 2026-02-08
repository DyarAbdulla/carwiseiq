"""
Fast Model Retraining Script
Trains a simple, effective model without log transformation for quick fixes
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import pickle
import os

print("=" * 80)
print("FAST MODEL RETRAINING")
print("=" * 80)

print("\n[1/5] Loading data...")
df = pd.read_csv('cleaned_car_data.csv')
print(f"   Loaded {len(df)} rows, {len(df.columns)} columns")

# Basic feature engineering (matching existing structure)
print("\n[2/5] Feature engineering...")
df['age_of_car'] = 2025 - df['year']

# Encode categorical variables (matching predict_price.py structure)
print("   Encoding categorical variables...")
le_make = LabelEncoder()
df['make_encoded'] = le_make.fit_transform(df['make'].astype(str))

le_model = LabelEncoder()
df['model_encoded'] = le_model.fit_transform(df['model'].astype(str))

# Condition encoding (matching config.py)
condition_map = {
    'New': 0, 'Like New': 1, 'Excellent': 2, 'Good': 3,
    'Fair': 4, 'Poor': 5, 'Salvage': 6
}
df['condition_encoded'] = df['condition'].map(condition_map).fillna(3)

# Fuel type encoding (matching config.py)
fuel_type_map = {
    'Gasoline': 0, 'Diesel': 1, 'Electric': 2, 'Hybrid': 3,
    'Plug-in Hybrid': 4, 'Other': 5
}
df['fuel_type_encoded'] = df['fuel_type'].map(fuel_type_map).fillna(0)

# Location encoding (simple hash-based like predict_price.py)
df['location_encoded'] = df['location'].astype(str).apply(hash) % 1000

# Select features (simple, no polynomial, no complex interactions)
base_features = [
    'year', 'mileage', 'age_of_car', 'engine_size', 'cylinders',
    'condition_encoded', 'fuel_type_encoded', 'location_encoded',
    'make_encoded', 'model_encoded'
]

X = df[base_features].copy()
y = df['price'].copy()  # NO LOG TRANSFORMATION

print(f"   Features: {len(base_features)}")
print(f"   Target range: ${y.min():,.0f} - ${y.max():,.0f}")
print(f"   Target mean: ${y.mean():,.0f}")
print(f"   Target median: ${y.median():,.0f}")

# Remove outliers (keep reasonable range)
print("\n[3/5] Removing extreme outliers...")
before = len(X)
X = X[(y >= 100) & (y <= 200000)]  # Keep prices between $100 and $200k
y = y[(y >= 100) & (y <= 200000)]
after = len(X)
print(f"   Removed {before - after} outliers ({((before-after)/before*100):.1f}%)")
print(f"   Final dataset: {after} samples")

# Split
print("\n[4/5] Splitting data...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
print(f"   Training: {len(X_train)} samples")
print(f"   Testing: {len(X_test)} samples")

# Train simple but effective model
print("\n[5/5] Training Random Forest model...")
model = RandomForestRegressor(
    n_estimators=200,
    max_depth=20,
    min_samples_split=5,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)
print("   Training complete!")

# Evaluate
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

y_pred = model.predict(X_test)
r2 = r2_score(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))

print("\n" + "=" * 80)
print("MODEL PERFORMANCE")
print("=" * 80)
print(f"R² Score: {r2:.4f}")
print(f"RMSE: ${rmse:,.2f}")
print(f"MAE: ${mae:,.2f}")

# Test prediction on a new car
print("\n" + "=" * 80)
print("TEST PREDICTION")
print("=" * 80)
test_car = pd.DataFrame([{
    'year': 2025,
    'mileage': 0,
    'age_of_car': 0,
    'engine_size': 2.5,
    'cylinders': 4,
    'condition_encoded': 0,  # New
    'fuel_type_encoded': 0,  # Gasoline
    'location_encoded': hash('Sulaymaniyah') % 1000,
    'make_encoded': le_make.transform(['Toyota'])[0] if 'Toyota' in le_make.classes_ else 0,
    'model_encoded': le_model.transform(['Camry'])[0] if 'Camry' in le_model.classes_ else 0
}], columns=base_features)

test_pred = model.predict(test_car)
print(f"Test car: 2025 Toyota Camry, 0 km, New")
print(f"Predicted price: ${test_pred[0]:,.2f}")

if test_pred[0] < 1000:
    print(f"[WARNING] Prediction seems too low!")
elif test_pred[0] > 50000:
    print(f"[WARNING] Prediction seems too high!")
else:
    print(f"[OK] Prediction is in reasonable range!")

# Save model with metadata (matching existing structure)
print("\n" + "=" * 80)
print("SAVING MODEL")
print("=" * 80)

# Ensure models directory exists
os.makedirs('models', exist_ok=True)

model_data = {
    'model': model,
    'features': base_features,  # Simple list, no polynomial
    'model_name': 'Random Forest (Simple - No Log Transform)',
    'target_transform': None,  # NO transformation
    'transform_offset': 1.0,
    'poly_transformer': None,  # No polynomial features
    'numeric_cols_for_poly': [],
    'original_features': base_features,  # Same as features for simple model
    'make_popularity_map': None,  # Not used in simple model
    'metrics': {
        'r2': r2,
        'rmse': rmse,
        'mae': mae
    },
    'version': 'v2_simple'
}

with open('models/best_model_v2.pkl', 'wb') as f:
    pickle.dump(model_data, f)

print(f"[OK] Model saved to models/best_model_v2.pkl")
print(f"[OK] Features: {len(base_features)}")
print(f"[OK] NO log transformation")
print(f"[OK] NO polynomial features")
print(f"[OK] Simple and fast")

# Save encoders
with open('models/make_encoder.pkl', 'wb') as f:
    pickle.dump(le_make, f)
with open('models/model_encoder.pkl', 'wb') as f:
    pickle.dump(le_model, f)

print(f"[OK] Encoders saved")

print("\n" + "=" * 80)
print("TRAINING COMPLETE!")
print("=" * 80)
print(f"\nNext steps:")
print(f"1. Restart Streamlit: streamlit run app.py")
print(f"2. Test prediction: 2025 Toyota Camry, 0 km, New")
print(f"3. Expected: ${test_pred[0]:,.0f} - $30,000 range")
print("=" * 80)


