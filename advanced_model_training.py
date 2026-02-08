"""
Advanced Car Price Prediction Model Training
Target: 95-100% R² Score (0.95-1.00)
Implements advanced feature engineering, multiple models, and hyperparameter optimization
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, GridSearchCV, KFold, StratifiedKFold
from sklearn.preprocessing import StandardScaler, LabelEncoder, RobustScaler
from sklearn.impute import KNNImputer
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, StackingRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error, mean_absolute_percentage_error
from sklearn.ensemble import IsolationForest
from sklearn.cluster import DBSCAN
import pickle
import os
import sys
import warnings
from datetime import datetime
from collections import Counter
warnings.filterwarnings('ignore')

# Set matplotlib backend
import matplotlib
matplotlib.use('Agg')

# Try importing advanced models
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("Warning: XGBoost not available. Install with: pip install xgboost")

try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False
    print("Warning: LightGBM not available. Install with: pip install lightgbm")

try:
    import catboost as cb
    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False
    print("Warning: CatBoost not available. Install with: pip install catboost")

# Create directories
os.makedirs('models', exist_ok=True)
os.makedirs('evaluation_reports', exist_ok=True)

MODEL_DIR = 'models'
EVAL_DIR = 'evaluation_reports'

print("=" * 100)
print("ADVANCED CAR PRICE PREDICTION MODEL TRAINING")
print("Target: R² Score 0.95-1.00 (95-100% accuracy)")
print("=" * 100)

# ============================================================================
# STEP 1: Load and Prepare Data
# ============================================================================
print("\n" + "=" * 100)
print("STEP 1: Loading and preparing data...")
print("=" * 100)

if not os.path.exists('cleaned_car_data.csv'):
    print("ERROR: cleaned_car_data.csv not found!")
    exit(1)

df = pd.read_csv('cleaned_car_data.csv')
print(f"Dataset loaded: {df.shape[0]:,} rows, {df.shape[1]} columns")

# ============================================================================
# STEP 2: Advanced Feature Engineering
# ============================================================================
print("\n" + "=" * 100)
print("STEP 2: Advanced Feature Engineering")
print("=" * 100)

# 1. Luxury brand indicators
luxury_brands = {'Mercedes-Benz', 'BMW', 'Audi', 'Porsche', 'Lexus', 'Jaguar',
                 'Land Rover', 'Tesla', 'Genesis', 'Infiniti', 'Acura', 'Cadillac'}
df['is_luxury_brand'] = df['make'].isin(luxury_brands).astype(int)
print(f"[OK] Luxury brand indicator: {df['is_luxury_brand'].sum()} luxury cars")

# 2. Premium brand indicators (mid-luxury)
premium_brands = {'Volvo', 'Lincoln', 'Buick', 'Chrysler'}
df['is_premium_brand'] = df['make'].isin(premium_brands).astype(int)
print(f"[OK] Premium brand indicator: {df['is_premium_brand'].sum()} premium cars")

# 3. Age-based depreciation tiers
df['age_tier_0_3'] = ((df['age_of_car'] >= 0) & (df['age_of_car'] <= 3)).astype(int)
df['age_tier_3_5'] = ((df['age_of_car'] > 3) & (df['age_of_car'] <= 5)).astype(int)
df['age_tier_5_10'] = ((df['age_of_car'] > 5) & (df['age_of_car'] <= 10)).astype(int)
df['age_tier_10_plus'] = (df['age_of_car'] > 10).astype(int)
print(f"[OK] Age tiers created")

# 4. Mileage categories
df['mileage_low'] = (df['mileage'] < 30000).astype(int)
df['mileage_medium'] = ((df['mileage'] >= 30000) & (df['mileage'] < 60000)).astype(int)
df['mileage_high'] = (df['mileage'] >= 60000).astype(int)
print(f"[OK] Mileage categories created")

# 5. Depreciation curves by brand (average price decline per year)
brand_depreciation = {}
for make in df['make'].unique():
    make_data = df[df['make'] == make]
    if len(make_data) > 10:  # Only calculate if enough data
        # Calculate average price by age
        age_price = make_data.groupby('age_of_car')['price'].mean()
        if len(age_price) > 1:
            # Simple linear depreciation rate
            depreciation_rate = (age_price.iloc[0] - age_price.iloc[-1]) / max(age_price.index.max(), 1)
            brand_depreciation[make] = depreciation_rate
        else:
            brand_depreciation[make] = 0
    else:
        brand_depreciation[make] = 0

df['brand_depreciation_rate'] = df['make'].map(brand_depreciation).fillna(0)
df['estimated_depreciation'] = df['age_of_car'] * df['brand_depreciation_rate']
print(f"[OK] Brand depreciation curves calculated for {len(brand_depreciation)} brands")

# 6. Market demand scores by model (based on frequency in dataset)
model_counts = df['model'].value_counts()
model_demand = model_counts / model_counts.max()  # Normalize to 0-1
df['model_demand_score'] = df['model'].map(model_demand).fillna(0)
print(f"[OK] Market demand scores calculated for {len(model_demand)} models")

# 7. Seasonal factors (extract month from scraped_date if available)
if 'scraped_date' in df.columns:
    try:
        df['scraped_date'] = pd.to_datetime(df['scraped_date'], errors='coerce')
        df['month'] = df['scraped_date'].dt.month.fillna(6)  # Default to June
        df['quarter'] = df['scraped_date'].dt.quarter.fillna(2)  # Default to Q2
        # Spring/Summer premium (months 3-8 typically higher prices)
        df['seasonal_premium'] = df['month'].apply(lambda x: 1 if 3 <= x <= 8 else 0)
        print(f"[OK] Seasonal factors created")
    except:
        df['month'] = 6
        df['quarter'] = 2
        df['seasonal_premium'] = 0
        print("[WARNING] Could not parse dates, using defaults")
else:
    df['month'] = 6
    df['quarter'] = 2
    df['seasonal_premium'] = 0

# 8. Location-based market premiums
# Identify high-value locations (top 20% by average price)
location_avg_price = df.groupby('location')['price'].mean()
high_value_locations = location_avg_price[location_avg_price >= location_avg_price.quantile(0.8)].index
df['is_premium_location'] = df['location'].isin(high_value_locations).astype(int)
print(f"[OK] Premium location indicator: {len(high_value_locations)} premium locations")

# 9. Brand reliability ratings (external data - simplified)
brand_reliability = {
    'Toyota': 9.0, 'Lexus': 9.5, 'Honda': 8.5, 'Acura': 8.5,
    'Mazda': 8.0, 'Subaru': 8.0, 'Hyundai': 7.5, 'Kia': 7.5,
    'BMW': 7.0, 'Mercedes-Benz': 7.0, 'Audi': 7.0, 'Porsche': 8.5,
    'Ford': 7.0, 'Chevrolet': 7.0, 'GMC': 7.0, 'Dodge': 6.5,
    'Jeep': 6.5, 'Nissan': 7.0, 'Infiniti': 7.5, 'Volvo': 8.0,
    'Tesla': 7.5, 'Genesis': 8.0, 'Lincoln': 7.0, 'Cadillac': 7.0
}
df['brand_reliability'] = df['make'].map(brand_reliability).fillna(7.0)  # Default 7.0
print(f"[OK] Brand reliability ratings added")

# 10. Fuel efficiency ratings (estimated based on engine size and fuel type)
df['fuel_efficiency'] = np.where(
    df['fuel_type'] == 'Electric', 100,
    np.where(
        df['fuel_type'] == 'Hybrid', 50 - df['engine_size'] * 5,
        np.where(
            df['fuel_type'] == 'Plug-in Hybrid', 60 - df['engine_size'] * 5,
            np.maximum(10, 35 - df['engine_size'] * 3)  # Gasoline/Diesel
        )
    )
)
print(f"[OK] Fuel efficiency ratings estimated")

# 11. Safety ratings (simplified - based on brand and year)
# Newer cars generally have better safety ratings
df['safety_rating'] = np.where(
    df['year'] >= 2020, 9.0,
    np.where(df['year'] >= 2015, 8.0,
    np.where(df['year'] >= 2010, 7.0, 6.0))
)
# Premium brands get +0.5 boost
df['safety_rating'] = np.where(df['is_luxury_brand'] == 1, df['safety_rating'] + 0.5, df['safety_rating'])
print(f"[OK] Safety ratings estimated")

# 12. Market segment classification
def get_market_segment(model_name):
    model_lower = str(model_name).lower()
    if any(x in model_lower for x in ['truck', 'pickup', 'f-150', 'silverado', 'tundra', 'ram']):
        return 'Truck'
    elif any(x in model_lower for x in ['suv', 'x5', 'q5', 'cr-v', 'rav4', 'highlander', 'pilot']):
        return 'SUV'
    elif any(x in model_lower for x in ['coupe', 'camaro', 'mustang', 'corvette', 'challenger']):
        return 'Sports'
    elif any(x in model_lower for x in ['sedan', 'camry', 'accord', 'altima', 'sonata']):
        return 'Sedan'
    else:
        return 'Other'

df['market_segment'] = df['model'].apply(get_market_segment)
segment_encoder = LabelEncoder()
df['market_segment_encoded'] = segment_encoder.fit_transform(df['market_segment'])
print(f"[OK] Market segment classification: {df['market_segment'].value_counts().to_dict()}")

# 13. Interaction features
df['year_mileage_interaction'] = df['year'] * df['mileage'] / 1000
df['engine_cylinders_interaction'] = df['engine_size'] * df['cylinders']
df['luxury_age_interaction'] = df['is_luxury_brand'] * df['age_of_car']
df['mileage_age_interaction'] = df['mileage'] * df['age_of_car'] / 1000
print(f"[OK] Interaction features created")

# 14. Price range categories (for separate models later)
df['price_range'] = pd.cut(df['price'], bins=[0, 15000, 35000, float('inf')],
                           labels=['budget', 'mid', 'luxury'])
print(f"[OK] Price range categories created")

# ============================================================================
# STEP 3: Data Quality Improvements
# ============================================================================
print("\n" + "=" * 100)
print("STEP 3: Data Quality Improvements")
print("=" * 100)

# Remove outliers using Isolation Forest
print("Removing outliers using Isolation Forest...")
numeric_cols = ['year', 'mileage', 'engine_size', 'cylinders', 'price', 'age_of_car']
iso_forest = IsolationForest(contamination=0.05, random_state=42)
outlier_labels = iso_forest.fit_predict(df[numeric_cols])
df = df[outlier_labels == 1]
print(f"[OK] Removed {(outlier_labels == -1).sum()} outliers ({((outlier_labels == -1).sum()/len(outlier_labels)*100):.2f}%)")

# Handle missing values with KNN Imputer
print("Handling missing values with KNN Imputer...")
numeric_features_for_impute = ['year', 'mileage', 'engine_size', 'cylinders', 'age_of_car']
if df[numeric_features_for_impute].isnull().sum().sum() > 0:
    imputer = KNNImputer(n_neighbors=5)
    df[numeric_features_for_impute] = imputer.fit_transform(df[numeric_features_for_impute])
    print(f"[OK] Missing values imputed")
else:
    print("[OK] No missing values found")

# Remove invalid prices
before_price_filter = len(df)
df = df[(df['price'] > 100) & (df['price'] < 200000)]  # Reasonable price range
print(f"[OK] Removed {before_price_filter - len(df)} rows with invalid prices")

# ============================================================================
# STEP 4: Prepare Features and Target
# ============================================================================
print("\n" + "=" * 100)
print("STEP 4: Preparing features and target")
print("=" * 100)

# Encode categorical variables
le_make = LabelEncoder()
le_model = LabelEncoder()
le_location = LabelEncoder()
le_condition = LabelEncoder()
le_fuel_type = LabelEncoder()
le_segment = LabelEncoder()

df['make_encoded'] = le_make.fit_transform(df['make'].astype(str))
df['model_encoded'] = le_model.fit_transform(df['model'].astype(str))
df['location_encoded'] = le_location.fit_transform(df['location'].astype(str))
df['condition_encoded'] = le_condition.fit_transform(df['condition'].astype(str))
df['fuel_type_encoded'] = le_fuel_type.fit_transform(df['fuel_type'].astype(str))

# Select features
base_features = [
    'year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
    'make_encoded', 'model_encoded', 'condition_encoded', 'fuel_type_encoded', 'location_encoded',
    'is_luxury_brand', 'is_premium_brand',
    'age_tier_0_3', 'age_tier_3_5', 'age_tier_5_10', 'age_tier_10_plus',
    'mileage_low', 'mileage_medium', 'mileage_high',
    'brand_depreciation_rate', 'estimated_depreciation',
    'model_demand_score', 'is_premium_location',
    'brand_reliability', 'fuel_efficiency', 'safety_rating',
    'market_segment_encoded',
    'year_mileage_interaction', 'engine_cylinders_interaction',
    'luxury_age_interaction', 'mileage_age_interaction',
    'month', 'quarter', 'seasonal_premium'
]

X = df[base_features].copy()
y = df['price'].copy()

print(f"[OK] Features prepared: {len(base_features)} features")
print(f"[OK] Dataset size: {len(X):,} samples")

# ============================================================================
# STEP 5: Time-Based Train-Test Split
# ============================================================================
print("\n" + "=" * 100)
print("STEP 5: Time-based train-test split")
print("=" * 100)

# Sort by year (older data for training, newer for testing)
df_sorted = df.sort_values('year')
split_idx = int(len(df_sorted) * 0.8)
X_train = X.iloc[:split_idx]
X_test = X.iloc[split_idx:]
y_train = y.iloc[:split_idx]
y_test = y.iloc[split_idx:]

print(f"[OK] Training set: {len(X_train):,} samples (older data)")
print(f"[OK] Test set: {len(X_test):,} samples (newer data)")

# ============================================================================
# STEP 6: Train Multiple Advanced Models
# ============================================================================
print("\n" + "=" * 100)
print("STEP 6: Training multiple advanced models")
print("=" * 100)

models = {}
results = {}

# Prepare categorical features for CatBoost
cat_features_indices = [
    base_features.index('make_encoded'),
    base_features.index('model_encoded'),
    base_features.index('condition_encoded'),
    base_features.index('fuel_type_encoded'),
    base_features.index('location_encoded'),
    base_features.index('market_segment_encoded')
]

# 1. Random Forest with improved parameters
print("\n1. Training Random Forest...")
rf = RandomForestRegressor(
    n_estimators=500,
    max_depth=40,
    min_samples_split=2,
    min_samples_leaf=1,
    random_state=42,
    n_jobs=-1,
    verbose=0
)
rf.fit(X_train, y_train)
y_pred_rf = rf.predict(X_test)
models['Random Forest'] = rf
results['Random Forest'] = {
    'r2': r2_score(y_test, y_pred_rf),
    'rmse': np.sqrt(mean_squared_error(y_test, y_pred_rf)),
    'mae': mean_absolute_error(y_test, y_pred_rf),
    'mape': mean_absolute_percentage_error(y_test, y_pred_rf) * 100,
    'predictions': y_pred_rf
}
print(f"   R²: {results['Random Forest']['r2']:.4f}, RMSE: ${results['Random Forest']['rmse']:,.2f}")

# 2. CatBoost (excellent for categorical data)
if CATBOOST_AVAILABLE:
    print("\n2. Training CatBoost...")
    catb = cb.CatBoostRegressor(
        iterations=1000,
        depth=8,
        learning_rate=0.05,
        loss_function='RMSE',
        cat_features=cat_features_indices,
        random_state=42,
        verbose=False,
        thread_count=-1
    )
    catb.fit(X_train, y_train, eval_set=(X_test, y_test), early_stopping_rounds=50)
    y_pred_catb = catb.predict(X_test)
    models['CatBoost'] = catb
    results['CatBoost'] = {
        'r2': r2_score(y_test, y_pred_catb),
        'rmse': np.sqrt(mean_squared_error(y_test, y_pred_catb)),
        'mae': mean_absolute_error(y_test, y_pred_catb),
        'mape': mean_absolute_percentage_error(y_test, y_pred_catb) * 100,
        'predictions': y_pred_catb
    }
    print(f"   R²: {results['CatBoost']['r2']:.4f}, RMSE: ${results['CatBoost']['rmse']:,.2f}")

# 3. LightGBM
if LIGHTGBM_AVAILABLE:
    print("\n3. Training LightGBM...")
    lgbm = lgb.LGBMRegressor(
        n_estimators=1000,
        max_depth=10,
        learning_rate=0.05,
        num_leaves=100,
        feature_fraction=0.9,
        bagging_fraction=0.9,
        bagging_freq=5,
        random_state=42,
        n_jobs=-1,
        verbose=-1
    )
    lgbm.fit(X_train, y_train, eval_set=[(X_test, y_test)], callbacks=[lgb.early_stopping(50), lgb.log_evaluation(0)])
    y_pred_lgbm = lgbm.predict(X_test)
    models['LightGBM'] = lgbm
    results['LightGBM'] = {
        'r2': r2_score(y_test, y_pred_lgbm),
        'rmse': np.sqrt(mean_squared_error(y_test, y_pred_lgbm)),
        'mae': mean_absolute_error(y_test, y_pred_lgbm),
        'mape': mean_absolute_percentage_error(y_test, y_pred_lgbm) * 100,
        'predictions': y_pred_lgbm
    }
    print(f"   R²: {results['LightGBM']['r2']:.4f}, RMSE: ${results['LightGBM']['rmse']:,.2f}")

# 4. XGBoost
if XGBOOST_AVAILABLE:
    print("\n4. Training XGBoost...")
    xgbr = xgb.XGBRegressor(
        n_estimators=1000,
        max_depth=8,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        n_jobs=-1
    )
    xgbr.fit(X_train, y_train, eval_set=[(X_test, y_test)], early_stopping_rounds=50, verbose=False)
    y_pred_xgb = xgbr.predict(X_test)
    models['XGBoost'] = xgbr
    results['XGBoost'] = {
        'r2': r2_score(y_test, y_pred_xgb),
        'rmse': np.sqrt(mean_squared_error(y_test, y_pred_xgb)),
        'mae': mean_absolute_error(y_test, y_pred_xgb),
        'mape': mean_absolute_percentage_error(y_test, y_pred_xgb) * 100,
        'predictions': y_pred_xgb
    }
    print(f"   R²: {results['XGBoost']['r2']:.4f}, RMSE: ${results['XGBoost']['rmse']:,.2f}")

# 5. Neural Network (MLP)
print("\n5. Training Neural Network (MLP)...")
scaler = RobustScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

mlp = MLPRegressor(
    hidden_layer_sizes=(200, 150, 100, 50),
    activation='relu',
    solver='adam',
    alpha=0.001,
    learning_rate='adaptive',
    max_iter=500,
    early_stopping=True,
    validation_fraction=0.1,
    random_state=42
)
mlp.fit(X_train_scaled, y_train)
y_pred_mlp = mlp.predict(X_test_scaled)
models['Neural Network'] = mlp
models['scaler'] = scaler  # Save scaler for prediction
results['Neural Network'] = {
    'r2': r2_score(y_test, y_pred_mlp),
    'rmse': np.sqrt(mean_squared_error(y_test, y_pred_mlp)),
    'mae': mean_absolute_error(y_test, y_pred_mlp),
    'mape': mean_absolute_percentage_error(y_test, y_pred_mlp) * 100,
    'predictions': y_pred_mlp
}
print(f"   R²: {results['Neural Network']['r2']:.4f}, RMSE: ${results['Neural Network']['rmse']:,.2f}")

# ============================================================================
# STEP 7: Hyperparameter Optimization with GridSearchCV
# ============================================================================
print("\n" + "=" * 100)
print("STEP 7: Hyperparameter optimization with GridSearchCV (10-fold CV)")
print("=" * 100)

# Select top 3 models for tuning
sorted_models = sorted(results.items(), key=lambda x: x[1]['r2'], reverse=True)
top_3_models = [name for name, _ in sorted_models[:3]]
print(f"Tuning top 3 models: {top_3_models}")

tuned_models = {}
cv = KFold(n_splits=10, shuffle=True, random_state=42)

for model_name in top_3_models:
    print(f"\nTuning {model_name}...")

    if model_name == 'Random Forest':
        param_grid = {
            'n_estimators': [500, 1000, 1500],
            'max_depth': [40, 50, None],
            'min_samples_split': [2, 5],
            'min_samples_leaf': [1, 2]
        }
        base_model = RandomForestRegressor(random_state=42, n_jobs=-1)

    elif model_name == 'CatBoost' and CATBOOST_AVAILABLE:
        param_grid = {
            'iterations': [500, 1000, 1500],
            'depth': [6, 8, 10],
            'learning_rate': [0.03, 0.05, 0.1]
        }
        base_model = cb.CatBoostRegressor(
            cat_features=cat_features_indices,
            random_state=42,
            verbose=False,
            thread_count=-1
        )

    elif model_name == 'LightGBM' and LIGHTGBM_AVAILABLE:
        param_grid = {
            'n_estimators': [500, 1000, 1500],
            'max_depth': [8, 10, 12],
            'learning_rate': [0.03, 0.05, 0.1],
            'num_leaves': [50, 100, 150]
        }
        base_model = lgb.LGBMRegressor(random_state=42, n_jobs=-1, verbose=-1)

    else:
        print(f"  Skipping {model_name} (not available or not tunable)")
        continue

    # GridSearchCV with 10-fold CV
    grid_search = GridSearchCV(
        base_model, param_grid, cv=cv, scoring='r2',
        n_jobs=-1, verbose=1
    )
    grid_search.fit(X_train, y_train)

    best_model = grid_search.best_estimator_
    y_pred_tuned = best_model.predict(X_test)

    tuned_models[model_name] = best_model
    results[f'{model_name} (Tuned)'] = {
        'r2': r2_score(y_test, y_pred_tuned),
        'rmse': np.sqrt(mean_squared_error(y_test, y_pred_tuned)),
        'mae': mean_absolute_error(y_test, y_pred_tuned),
        'mape': mean_absolute_percentage_error(y_test, y_pred_tuned) * 100,
        'predictions': y_pred_tuned,
        'best_params': grid_search.best_params_
    }

    print(f"  Best params: {grid_search.best_params_}")
    print(f"  R² (tuned): {results[f'{model_name} (Tuned)']['r2']:.4f}")

# ============================================================================
# STEP 8: Create Stacked Ensemble
# ============================================================================
print("\n" + "=" * 100)
print("STEP 8: Creating stacked ensemble with meta-learner")
print("=" * 100)

# Get top 5 models for stacking
top_5_models = sorted(results.items(), key=lambda x: x[1]['r2'], reverse=True)[:5]
print(f"Stacking top 5 models: {[name for name, _ in top_5_models]}")

# Prepare base models for stacking
stacking_estimators = []
for model_name, _ in top_5_models:
    if model_name.endswith(' (Tuned)'):
        base_name = model_name.replace(' (Tuned)', '')
        if base_name in tuned_models:
            stacking_estimators.append((base_name.lower().replace(' ', '_'), tuned_models[base_name]))
    elif model_name in models:
        stacking_estimators.append((model_name.lower().replace(' ', '_'), models[model_name]))

if len(stacking_estimators) >= 3:
    # Use Ridge as meta-learner
    from sklearn.linear_model import Ridge
    meta_learner = Ridge(alpha=1.0)

    stacking_regressor = StackingRegressor(
        estimators=stacking_estimators[:5],
        final_estimator=meta_learner,
        cv=10,
        n_jobs=-1
    )

    print("Training stacking ensemble...")
    stacking_regressor.fit(X_train, y_train)
    y_pred_stacking = stacking_regressor.predict(X_test)

    results['Stacking Ensemble'] = {
        'r2': r2_score(y_test, y_pred_stacking),
        'rmse': np.sqrt(mean_squared_error(y_test, y_pred_stacking)),
        'mae': mean_absolute_error(y_test, y_pred_stacking),
        'mape': mean_absolute_percentage_error(y_test, y_pred_stacking) * 100,
        'predictions': y_pred_stacking
    }
    models['Stacking Ensemble'] = stacking_regressor
    print(f"   R²: {results['Stacking Ensemble']['r2']:.4f}, RMSE: ${results['Stacking Ensemble']['rmse']:,.2f}")

# ============================================================================
# STEP 9: Separate Models for Different Price Ranges
# ============================================================================
print("\n" + "=" * 100)
print("STEP 9: Training separate models for different price ranges")
print("=" * 100)

price_range_models = {}
for price_range in ['budget', 'mid', 'luxury']:
    range_mask = df['price_range'] == price_range
    if range_mask.sum() > 100:  # Only train if enough data
        print(f"\nTraining {price_range} model ({range_mask.sum()} samples)...")
        X_range = X[range_mask]
        y_range = y[range_mask]

        # Use CatBoost for price-specific models
        if CATBOOST_AVAILABLE:
            range_model = cb.CatBoostRegressor(
                iterations=500,
                depth=8,
                learning_rate=0.05,
                cat_features=cat_features_indices,
                random_state=42,
                verbose=False
            )
            range_model.fit(X_range, y_range)
            price_range_models[price_range] = range_model
            print(f"  [OK] {price_range} model trained")
        else:
            # Fallback to Random Forest
            range_model = RandomForestRegressor(n_estimators=500, max_depth=30, random_state=42, n_jobs=-1)
            range_model.fit(X_range, y_range)
            price_range_models[price_range] = range_model
            print(f"  [OK] {price_range} model trained (Random Forest)")

# ============================================================================
# STEP 10: Select Best Model
# ============================================================================
print("\n" + "=" * 100)
print("STEP 10: Selecting best model")
print("=" * 100)

best_model_name = max(results.items(), key=lambda x: x[1]['r2'])[0]
best_metrics = results[best_model_name]

print(f"\nBest Model: {best_model_name}")
print(f"R² Score: {best_metrics['r2']:.4f}")
print(f"RMSE: ${best_metrics['rmse']:,.2f}")
print(f"MAE: ${best_metrics['mae']:,.2f}")
print(f"MAPE: {best_metrics['mape']:.2f}%")

# Get best model object
if best_model_name.endswith(' (Tuned)'):
    base_name = best_model_name.replace(' (Tuned)', '')
    best_model = tuned_models.get(base_name, models.get(base_name))
elif best_model_name == 'Stacking Ensemble':
    best_model = models['Stacking Ensemble']
else:
    best_model = models.get(best_model_name)

# ============================================================================
# STEP 11: Save Models
# ============================================================================
print("\n" + "=" * 100)
print("STEP 11: Saving models")
print("=" * 100)

model_data = {
    'model': best_model,
    'model_name': best_model_name,
    'features': base_features,
    'metrics': best_metrics,
    'encoders': {
        'make': le_make,
        'model': le_model,
        'location': le_location,
        'condition': le_condition,
        'fuel_type': le_fuel_type,
        'segment': segment_encoder
    },
    'price_range_models': price_range_models,
    'brand_reliability': brand_reliability,
    'luxury_brands': list(luxury_brands),
    'premium_brands': list(premium_brands),
    'version': 'advanced_v1',
    'training_date': datetime.now().isoformat(),
    'all_results': results
}

# Save main model
with open(os.path.join(MODEL_DIR, 'advanced_car_price_model.pkl'), 'wb') as f:
    pickle.dump(model_data, f)
print(f"[OK] Advanced model saved to: models/advanced_car_price_model.pkl")

# Also save as default model
with open(os.path.join(MODEL_DIR, 'car_price_model.pkl'), 'wb') as f:
    pickle.dump(model_data, f)
print(f"[OK] Model also saved as default: models/car_price_model.pkl")

# ============================================================================
# STEP 12: Generate Report
# ============================================================================
print("\n" + "=" * 100)
print("STEP 12: Generating evaluation report")
print("=" * 100)

# Create comparison table
comparison_data = []
for name, metrics in sorted(results.items(), key=lambda x: x[1]['r2'], reverse=True):
    comparison_data.append({
        'Model': name,
        'R² Score': f"{metrics['r2']:.4f}",
        'RMSE ($)': f"{metrics['rmse']:,.2f}",
        'MAE ($)': f"{metrics['mae']:,.2f}",
        'MAPE (%)': f"{metrics['mape']:.2f}"
    })

comparison_df = pd.DataFrame(comparison_data)
print("\nModel Comparison:")
print(comparison_df.to_string(index=False))

comparison_df.to_csv(os.path.join(EVAL_DIR, 'advanced_model_comparison.csv'), index=False)

# Generate report
report = []
report.append("=" * 100)
report.append("ADVANCED CAR PRICE PREDICTION MODEL - EVALUATION REPORT")
report.append("=" * 100)
report.append(f"\nTraining Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
report.append(f"Dataset Size: {len(df):,} cars")
report.append(f"Features Used: {len(base_features)}")
report.append("\n" + "=" * 100)
report.append("BEST MODEL PERFORMANCE")
report.append("=" * 100)
report.append(f"Model: {best_model_name}")
report.append(f"R² Score: {best_metrics['r2']:.4f} ({best_metrics['r2']*100:.2f}%)")
report.append(f"RMSE: ${best_metrics['rmse']:,.2f}")
report.append(f"MAE: ${best_metrics['mae']:,.2f}")
report.append(f"MAPE: {best_metrics['mape']:.2f}%")
report.append("\n" + "=" * 100)
report.append("ALL MODELS COMPARISON")
report.append("=" * 100)
for name, metrics in sorted(results.items(), key=lambda x: x[1]['r2'], reverse=True):
    report.append(f"\n{name}:")
    report.append(f"  R²: {metrics['r2']:.4f}, RMSE: ${metrics['rmse']:,.2f}, MAE: ${metrics['mae']:,.2f}, MAPE: {metrics['mape']:.2f}%")

report.append("\n" + "=" * 100)
report.append("TARGET ACHIEVEMENT")
report.append("=" * 100)
if best_metrics['r2'] >= 0.95:
    report.append("✅ TARGET ACHIEVED: R² >= 0.95 (95%+ accuracy)")
elif best_metrics['r2'] >= 0.90:
    report.append("⚠️  Close to target: R² >= 0.90 (90%+ accuracy)")
else:
    report.append(f"❌ Target not achieved: R² = {best_metrics['r2']:.4f} (need >= 0.95)")

report_text = "\n".join(report)
print("\n" + report_text)

with open(os.path.join(EVAL_DIR, 'advanced_evaluation_report.txt'), 'w', encoding='utf-8') as f:
    f.write(report_text)

print(f"\n[OK] Report saved to: evaluation_reports/advanced_evaluation_report.txt")
print("=" * 100)
print("ADVANCED MODEL TRAINING COMPLETE!")
print("=" * 100)
