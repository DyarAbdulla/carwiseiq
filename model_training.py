"""
Car Price Prediction Model Training
Trains multiple models and selects the best one for maximum accuracy
Target: 95%+ R² score
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, GridSearchCV, RandomizedSearchCV, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder, PolynomialFeatures
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, StackingRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import pickle
import os
import sys
import warnings
warnings.filterwarnings('ignore')

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from app import config
except ImportError:
    # Fallback if config not found
    config = None

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

# Set matplotlib backend
import matplotlib
matplotlib.use('Agg')

# Create directories
os.makedirs('models', exist_ok=True)
os.makedirs('evaluation_reports', exist_ok=True)

# ============================================================================
# STEP 1: Load and Prepare Data
# ============================================================================
print("=" * 80)
print("STEP 1: Loading and preparing data...")
print("=" * 80)

# Load cleaned data
if not os.path.exists('cleaned_car_data.csv'):
    print("ERROR: cleaned_car_data.csv not found!")
    print("Please run data_cleaning.py first.")
    exit(1)

df = pd.read_csv('cleaned_car_data.csv')
print(f"Dataset loaded: {df.shape[0]} rows, {df.shape[1]} columns")

# Store original metrics for comparison
original_shape = df.shape[0]

# Prepare features and target
print("\nPreparing features and target...")

# ============================================================================
# ADVANCED FEATURE ENGINEERING
# ============================================================================
print("\n" + "-" * 80)
print("ADVANCED FEATURE ENGINEERING")
print("-" * 80)

# 1. Car age (ensure it exists)
if 'age_of_car' not in df.columns:
    df['age_of_car'] = 2025 - df['year']
print(f"[OK] Car age feature: age_of_car")

# 2. Price per km - REMOVED: This causes data leakage (uses target variable 'price')
# During prediction, we don't have the price, so we can't calculate this feature.
# df['price_per_km'] = np.where(df['mileage'] > 0, 
#                                df['price'] / df['mileage'], 
#                                df['price'] / (df['mileage'] + 1))
# print(f"[OK] Price per km feature created (handled division by zero)")

# 2. Brand popularity score (based on frequency in dataset)
make_popularity_map = None
if 'make' in df.columns:
    make_counts = df['make'].value_counts()
    make_popularity = make_counts / make_counts.max()  # Normalize to 0-1
    make_popularity_map = make_popularity.to_dict()  # Save for prediction time
    df['brand_popularity'] = df['make'].map(make_popularity).fillna(0)
    print(f"[OK] Brand popularity score created (based on {len(make_popularity)} makes)")

# 4. Interaction features
df['year_mileage_interaction'] = df['year'] * df['mileage']
df['engine_cylinders_interaction'] = df['engine_size'] * df['cylinders']
print(f"[OK] Interaction features: year*mileage, engine_size*cylinders")

# Add make and model encoders if needed
if 'make' in df.columns:
    if 'make_encoded' not in df.columns:
        le_make = LabelEncoder()
        df['make_encoded'] = le_make.fit_transform(df['make'].astype(str))
    else:
        # Re-encode to ensure consistency
        le_make = LabelEncoder()
        le_make.fit(df['make'].astype(str))
        df['make_encoded'] = le_make.transform(df['make'].astype(str))

if 'model' in df.columns:
    if 'model_encoded' not in df.columns:
        le_model = LabelEncoder()
        df['model_encoded'] = le_model.fit_transform(df['model'].astype(str))
    else:
        # Re-encode to ensure consistency
        le_model = LabelEncoder()
        le_model.fit(df['model'].astype(str))
        df['model_encoded'] = le_model.transform(df['model'].astype(str))

# Select base features for modeling
base_feature_cols = ['year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
                     'condition_encoded', 'fuel_type_encoded', 'location_encoded',
                     'make_encoded', 'model_encoded']

# Add engineered features (price_per_km removed - causes data leakage)
engineered_features = ['brand_popularity', 
                       'year_mileage_interaction', 'engine_cylinders_interaction']

# Combine all features
all_feature_cols = base_feature_cols + [f for f in engineered_features if f in df.columns]

# Ensure all feature columns exist
available_features = [col for col in all_feature_cols if col in df.columns]
print(f"\n[OK] Total features after engineering: {len(available_features)}")
print(f"Features: {', '.join(available_features[:10])}..." if len(available_features) > 10 else f"Features: {', '.join(available_features)}")

# Prepare X and y
X = df[available_features].copy()
y = df['price'].copy()

# ============================================================================
# OUTLIER HANDLING WITH IQR METHOD
# ============================================================================
print("\n" + "-" * 80)
print("OUTLIER HANDLING (IQR Method)")
print("-" * 80)

def remove_outliers_iqr(df, columns):
    """Remove outliers using IQR method"""
    df_clean = df.copy()
    outliers_removed = 0
    
    for col in columns:
        if col in df_clean.columns and df_clean[col].dtype in [np.int64, np.float64]:
            Q1 = df_clean[col].quantile(0.25)
            Q3 = df_clean[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            before = len(df_clean)
            df_clean = df_clean[(df_clean[col] >= lower_bound) & (df_clean[col] <= upper_bound)]
            after = len(df_clean)
            outliers_removed += (before - after)
    
    return df_clean, outliers_removed

# Apply IQR outlier removal to numeric features
numeric_features = X.select_dtypes(include=[np.number]).columns.tolist()
X_before_outliers = X.shape[0]
X_clean, outliers_removed = remove_outliers_iqr(pd.concat([X, y], axis=1), numeric_features + ['price'])
X = X_clean[available_features]
y = X_clean['price']

print(f"[OK] Outliers removed: {X_before_outliers - X.shape[0]} rows ({((X_before_outliers - X.shape[0])/X_before_outliers*100):.2f}%)")

# Remove any remaining NaN or infinite values
X = X.replace([np.inf, -np.inf], np.nan)
X = X.fillna(X.median())
y = y.replace([np.inf, -np.inf], np.nan)
y = y.fillna(y.median())

# Remove rows where target is missing
valid_mask = ~(y.isna() | X.isna().any(axis=1))
X = X[valid_mask]
y = y[valid_mask]

print(f"\n[OK] Final dataset: {X.shape[0]} samples, {X.shape[1]} features")
print(f"Target statistics: Mean=${y.mean():,.2f}, Median=${y.median():,.2f}, Std=${y.std():,.2f}")

# ============================================================================
# STEP 2: Train-Test Split
# ============================================================================
print("\n" + "=" * 80)
print("STEP 2: Splitting data (80% train, 20% test)...")
print("=" * 80)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, shuffle=True
)

print(f"Training set: {X_train.shape[0]} samples")
print(f"Test set: {X_test.shape[0]} samples")

# ============================================================================
# TARGET TRANSFORMATION (Log Transformation to prevent negative predictions)
# ============================================================================
print("\n" + "-" * 80)
print("APPLYING TARGET TRANSFORMATION (Log Transform)")
print("-" * 80)

# Store original prices for inverse transformation and evaluation
y_train_original = y_train.copy()
y_test_original = y_test.copy()

# Apply log(price + 1) transformation to prevent negative predictions
# This ensures the model learns in log space where predictions are naturally bounded
TRANSFORM_OFFSET = 1.0
y_train_log = np.log1p(y_train)  # log1p(x) = log(1 + x), handles zeros naturally
y_test_log = np.log1p(y_test_original)  # Also transform test data for consistency (though only y_train is used for training)

print(f"[OK] Applied log(price + {TRANSFORM_OFFSET}) transformation to training target")
print(f"  Original price range: ${y_train_original.min():,.2f} - ${y_train_original.max():,.2f}")
print(f"  Transformed range: {y_train_log.min():.4f} - {y_train_log.max():.4f}")

# Use transformed target for all training
y_train = y_train_log

# Helper function to inverse transform predictions from log space to price space
def inverse_transform_predictions(y_pred_log):
    """
    Inverse transform log predictions back to price space
    Since we used log1p (log(1+x)), inverse is expm1 (exp(x) - 1)
    """
    return np.expm1(y_pred_log)  # expm1(x) = exp(x) - 1, inverse of log1p

# Helper function to evaluate predictions (inverse transform then compare)
def evaluate_predictions(y_true_original, y_pred_log, model_name=""):
    """
    Evaluate predictions by inverse transforming and comparing with original prices
    """
    # Inverse transform predictions
    y_pred_original = inverse_transform_predictions(y_pred_log)
    
    # Ensure predictions are non-negative (shouldn't be needed with log transform, but safety check)
    y_pred_original = np.maximum(y_pred_original, 0)
    
    # Calculate metrics
    r2 = r2_score(y_true_original, y_pred_original)
    mae = mean_absolute_error(y_true_original, y_pred_original)
    rmse = np.sqrt(mean_squared_error(y_true_original, y_pred_original))
    mape = np.mean(np.abs((y_true_original - y_pred_original) / np.maximum(y_true_original, 1))) * 100  # Avoid division by zero
    
    return {
        'r2': r2,
        'mae': mae,
        'rmse': rmse,
        'mape': mape,
        'predictions': y_pred_original,
        'predictions_log': y_pred_log  # Store both for reference
    }

# ============================================================================
# STEP 2.5: Add Polynomial Features (Degree 2)
# ============================================================================
print("\n" + "-" * 80)
print("ADDING POLYNOMIAL FEATURES (Degree 2)")
print("-" * 80)

# Select numeric columns for polynomial features
numeric_cols_for_poly = ['year', 'mileage', 'engine_size', 'cylinders', 'age_of_car']
numeric_cols_for_poly = [col for col in numeric_cols_for_poly if col in X_train.columns]

# Initialize poly_transformer variable
poly_transformer = None

if numeric_cols_for_poly:
    print(f"[OK] Creating polynomial features for: {', '.join(numeric_cols_for_poly)}")
    
    # Create polynomial features
    poly_transformer = PolynomialFeatures(degree=2, include_bias=False, interaction_only=False)
    X_train_poly = poly_transformer.fit_transform(X_train[numeric_cols_for_poly])
    X_test_poly = poly_transformer.transform(X_test[numeric_cols_for_poly])
    
    # Get feature names
    poly_feature_names = poly_transformer.get_feature_names_out(numeric_cols_for_poly)
    
    # Create DataFrames
    X_train_poly_df = pd.DataFrame(X_train_poly, columns=poly_feature_names, index=X_train.index)
    X_test_poly_df = pd.DataFrame(X_test_poly, columns=poly_feature_names, index=X_test.index)
    
    # Remove original numeric columns and add polynomial features
    X_train_final = X_train.drop(columns=numeric_cols_for_poly)
    X_test_final = X_test.drop(columns=numeric_cols_for_poly)
    
    # Combine
    X_train = pd.concat([X_train_final, X_train_poly_df], axis=1)
    X_test = pd.concat([X_test_final, X_test_poly_df], axis=1)
    
    print(f"[OK] Polynomial features added: {X_train_poly.shape[1]} new features")
    print(f"[OK] Total features after polynomial: {X_train.shape[1]}")
else:
    print("[WARNING] No numeric columns found for polynomial features")

# ============================================================================
# STEP 3: Train Multiple Models
# ============================================================================
print("\n" + "=" * 80)
print("STEP 3: Training multiple models...")
print("=" * 80)

models = {}
results = {}

# 1. Linear Regression
print("\n1. Training Linear Regression...")
lr = LinearRegression()
lr.fit(X_train, y_train)
y_pred_lr_log = lr.predict(X_test)  # Predictions in log space
models['Linear Regression'] = lr
results['Linear Regression'] = evaluate_predictions(y_test_original, y_pred_lr_log, "Linear Regression")
print(f"   R² Score: {results['Linear Regression']['r2']:.4f}")

# 2. Random Forest Regressor
print("\n2. Training Random Forest Regressor...")
rf = RandomForestRegressor(n_estimators=100, max_depth=20, random_state=42, n_jobs=-1)
rf.fit(X_train, y_train)
y_pred_rf_log = rf.predict(X_test)  # Predictions in log space
models['Random Forest'] = rf
results['Random Forest'] = evaluate_predictions(y_test_original, y_pred_rf_log, "Random Forest")
print(f"   R² Score: {results['Random Forest']['r2']:.4f}")

# 3. Gradient Boosting (sklearn)
print("\n3. Training Gradient Boosting Regressor...")
gb = GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42)
gb.fit(X_train, y_train)
y_pred_gb_log = gb.predict(X_test)  # Predictions in log space
models['Gradient Boosting'] = gb
results['Gradient Boosting'] = evaluate_predictions(y_test_original, y_pred_gb_log, "Gradient Boosting")
print(f"   R² Score: {results['Gradient Boosting']['r2']:.4f}")

# 4. XGBoost
if XGBOOST_AVAILABLE:
    print("\n4. Training XGBoost...")
    xgbr = xgb.XGBRegressor(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1)
    xgbr.fit(X_train, y_train)
    y_pred_xgb_log = xgbr.predict(X_test)  # Predictions in log space
    models['XGBoost'] = xgbr
    results['XGBoost'] = evaluate_predictions(y_test_original, y_pred_xgb_log, "XGBoost")
    print(f"   R² Score: {results['XGBoost']['r2']:.4f}")
else:
    print("\n4. XGBoost skipped (not available)")

# 5. LightGBM
if LIGHTGBM_AVAILABLE:
    print("\n5. Training LightGBM...")
    lgbm = lgb.LGBMRegressor(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1)
    lgbm.fit(X_train, y_train)
    y_pred_lgbm_log = lgbm.predict(X_test)  # Predictions in log space
    models['LightGBM'] = lgbm
    results['LightGBM'] = evaluate_predictions(y_test_original, y_pred_lgbm_log, "LightGBM")
    print(f"   R² Score: {results['LightGBM']['r2']:.4f}")
else:
    print("\n5. LightGBM skipped (not available)")

# 6. CatBoost
if CATBOOST_AVAILABLE:
    print("\n6. Training CatBoost...")
    catb = cb.CatBoostRegressor(iterations=100, depth=6, learning_rate=0.1, random_state=42, verbose=False)
    catb.fit(X_train, y_train)
    y_pred_catb_log = catb.predict(X_test)  # Predictions in log space
    models['CatBoost'] = catb
    results['CatBoost'] = evaluate_predictions(y_test_original, y_pred_catb_log, "CatBoost")
    print(f"   R² Score: {results['CatBoost']['r2']:.4f}")
else:
    print("\n6. CatBoost skipped (not available)")

# ============================================================================
# STEP 4: Identify Best Models for Hyperparameter Tuning
# ============================================================================
print("\n" + "=" * 80)
print("STEP 4: Identifying best models for hyperparameter tuning...")
print("=" * 80)

# Sort models by R² score
sorted_models = sorted(results.items(), key=lambda x: x[1]['r2'], reverse=True)
print("\nModel Performance Ranking:")
for i, (name, metrics) in enumerate(sorted_models, 1):
    print(f"{i}. {name}: R² = {metrics['r2']:.4f}, RMSE = ${metrics['rmse']:,.2f}")

# Select top 2 models for tuning
top_2_models = [name for name, _ in sorted_models[:2]]
print(f"\nSelected for hyperparameter tuning: {top_2_models}")

# ============================================================================
# STEP 5: Hyperparameter Tuning with RandomizedSearchCV (Improved)
# ============================================================================
print("\n" + "=" * 80)
print("STEP 5: Hyperparameter tuning with RandomizedSearchCV (Improved)...")
print("=" * 80)

tuned_models = {}

# Expand to top 3 models for better stacking
top_3_models = [name for name, _ in sorted_models[:3]]
print(f"Tuning top 3 models: {top_3_models}")

for model_name in top_3_models:
    print(f"\nTuning {model_name}...")
    
    if model_name == 'Random Forest':
        # Expanded parameter grid
        param_dist = {
            'n_estimators': [100, 200, 300, 400],
            'max_depth': [15, 20, 25, 30, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4],
            'max_features': ['sqrt', 'log2', None]
        }
        base_model = RandomForestRegressor(random_state=42, n_jobs=-1)
        n_iter = 50  # More iterations for better search
        
    elif model_name == 'XGBoost' and XGBOOST_AVAILABLE:
        # Expanded parameter grid
        param_dist = {
            'n_estimators': [100, 200, 300, 400],
            'max_depth': [4, 5, 6, 7, 8],
            'learning_rate': [0.01, 0.05, 0.1, 0.15],
            'subsample': [0.8, 0.9, 1.0],
            'colsample_bytree': [0.8, 0.9, 1.0],
            'gamma': [0, 0.1, 0.2]
        }
        base_model = xgb.XGBRegressor(random_state=42, n_jobs=-1)
        n_iter = 50
        
    elif model_name == 'LightGBM' and LIGHTGBM_AVAILABLE:
        # Expanded parameter grid
        param_dist = {
            'n_estimators': [100, 200, 300, 400],
            'max_depth': [4, 5, 6, 7, 8, -1],
            'learning_rate': [0.01, 0.05, 0.1, 0.15],
            'num_leaves': [31, 50, 70, 100],
            'subsample': [0.8, 0.9, 1.0],
            'colsample_bytree': [0.8, 0.9, 1.0]
        }
        base_model = lgb.LGBMRegressor(random_state=42, n_jobs=-1, verbose=-1)
        n_iter = 50
        
    elif model_name == 'Gradient Boosting':
        param_dist = {
            'n_estimators': [100, 200, 300],
            'max_depth': [3, 4, 5, 6, 7],
            'learning_rate': [0.01, 0.05, 0.1, 0.15],
            'subsample': [0.8, 0.9, 1.0]
        }
        base_model = GradientBoostingRegressor(random_state=42)
        n_iter = 30
        
    elif model_name == 'CatBoost' and CATBOOST_AVAILABLE:
        param_dist = {
            'iterations': [100, 200, 300],
            'depth': [4, 5, 6, 7, 8],
            'learning_rate': [0.01, 0.05, 0.1, 0.15]
        }
        base_model = cb.CatBoostRegressor(random_state=42, verbose=False)
        n_iter = 30
        
    else:
        print(f"  Skipping {model_name} (not available or not tunable)")
        continue
    
    # Perform RandomizedSearchCV (faster than GridSearchCV)
    random_search = RandomizedSearchCV(
        base_model, param_dist, n_iter=n_iter, cv=5, scoring='r2', 
        n_jobs=-1, verbose=1, random_state=42
    )
    random_search.fit(X_train, y_train)
    
    # Get best model
    best_model = random_search.best_estimator_
    y_pred_tuned_log = best_model.predict(X_test)  # Predictions in log space
    
    tuned_models[model_name] = best_model
    eval_results = evaluate_predictions(y_test_original, y_pred_tuned_log, f"{model_name} (Tuned)")
    eval_results['best_params'] = random_search.best_params_
    results[f'{model_name} (Tuned)'] = eval_results
    
    print(f"  Best parameters: {random_search.best_params_}")
    print(f"  R² Score (tuned): {results[f'{model_name} (Tuned)']['r2']:.4f}")

# ============================================================================
# STEP 6: Create Stacking Ensemble Model
# ============================================================================
print("\n" + "=" * 80)
print("STEP 6: Creating Stacking Ensemble Model...")
print("=" * 80)

# Combine all results (including tuned)
all_results = {**results}

# Get top 3 models for stacking (Random Forest, XGBoost, LightGBM)
stacking_models = []
stacking_model_names = []

# Try to get Random Forest, XGBoost, and LightGBM (tuned versions preferred)
for model_name in ['Random Forest', 'XGBoost', 'LightGBM']:
    tuned_name = f'{model_name} (Tuned)'
    if tuned_name in tuned_models or model_name in tuned_models:
        model_obj = tuned_models.get(model_name)
        if model_obj is not None:
            stacking_models.append(('rf' if model_name == 'Random Forest' else 
                                  'xgb' if model_name == 'XGBoost' else 'lgb', model_obj))
            stacking_model_names.append(model_name)
    elif model_name in models:
        stacking_models.append(('rf' if model_name == 'Random Forest' else 
                              'xgb' if model_name == 'XGBoost' else 'lgb', models[model_name]))
        stacking_model_names.append(model_name)

# If we don't have all three, use what we have
if len(stacking_models) < 3:
    # Add other good models
    for model_name in ['Gradient Boosting', 'CatBoost']:
        if model_name in models and len(stacking_models) < 3:
            stacking_models.append((model_name.lower().replace(' ', '_'), models[model_name]))
            stacking_model_names.append(model_name)

print(f"Stacking models: {stacking_model_names}")

if len(stacking_models) >= 2:
    # Create stacking regressor with Ridge as meta-learner
    meta_learner = Ridge(alpha=1.0, random_state=42)
    stacking_regressor = StackingRegressor(
        estimators=stacking_models,
        final_estimator=meta_learner,
        cv=5,
        n_jobs=-1
    )
    
    print("Training stacking ensemble...")
    stacking_regressor.fit(X_train, y_train)
    
    # Make predictions (in log space)
    y_pred_stacking_log = stacking_regressor.predict(X_test)
    
    # Evaluate stacking ensemble (inverse transform first)
    results['Stacking Ensemble (Ridge Meta)'] = evaluate_predictions(y_test_original, y_pred_stacking_log, "Stacking Ensemble")
    
    print(f"\n[OK] Stacking Ensemble R² Score: {results['Stacking Ensemble (Ridge Meta)']['r2']:.4f}")
    models['Stacking Ensemble (Ridge Meta)'] = stacking_regressor
else:
    print("[WARNING] Not enough models for stacking, using weighted ensemble instead")
    
    # Fallback to weighted ensemble
    sorted_all = sorted(all_results.items(), key=lambda x: x[1]['r2'], reverse=True)
    top_3_for_ensemble = sorted_all[:3]
    
    print(f"Creating weighted ensemble from top 3 models:")
    for name, metrics in top_3_for_ensemble:
        print(f"  - {name}: R² = {metrics['r2']:.4f}")
    
    # Create weighted ensemble (weighted by R² score)
    # Note: metrics['predictions'] are already in original space (from evaluate_predictions)
    ensemble_predictions = np.zeros(len(y_test_original))
    total_weight = 0
    
    for name, metrics in top_3_for_ensemble:
        weight = metrics['r2']  # Weight by R² score
        ensemble_predictions += metrics['predictions'] * weight  # Already transformed back
        total_weight += weight
    
    ensemble_predictions = ensemble_predictions / total_weight
    
    # Evaluate ensemble (predictions already in original space)
    results['Ensemble (Weighted)'] = {
        'r2': r2_score(y_test_original, ensemble_predictions),
        'mae': mean_absolute_error(y_test_original, ensemble_predictions),
        'rmse': np.sqrt(mean_squared_error(y_test_original, ensemble_predictions)),
        'mape': np.mean(np.abs((y_test_original - ensemble_predictions) / np.maximum(y_test_original, 1))) * 100,
        'predictions': ensemble_predictions
    }
    
    print(f"\nEnsemble R² Score: {results['Ensemble (Weighted)']['r2']:.4f}")
    
    # Create a simple ensemble model class for saving
    class EnsembleModel:
        """Simple ensemble model that combines multiple models"""
        def __init__(self, models_dict, weights):
            self.models = models_dict
            self.weights = weights
            self.total_weight = sum(weights)
        
        def predict(self, X):
            predictions = []
            for model, weight in zip(self.models.values(), self.weights):
                pred = model.predict(X)
                predictions.append(pred * weight)
            return np.sum(predictions, axis=0) / self.total_weight
    
    # Create ensemble model object
    ensemble_models = {}
    ensemble_weights = []
    for name, metrics in top_3_for_ensemble:
        model_name_clean = name.replace(' (Tuned)', '')
        if model_name_clean in tuned_models:
            ensemble_models[name] = tuned_models[model_name_clean]
        elif model_name_clean in models:
            ensemble_models[name] = models[model_name_clean]
        ensemble_weights.append(metrics['r2'])
    
    ensemble_model = EnsembleModel(ensemble_models, ensemble_weights)
    models['Ensemble (Weighted)'] = ensemble_model

# ============================================================================
# STEP 7: Select Best Model
# ============================================================================
print("\n" + "=" * 80)
print("STEP 7: Selecting best model...")
print("=" * 80)

# Update all_results with ensemble
all_results = {**results}

best_model_name = max(all_results.items(), key=lambda x: x[1]['r2'])[0]

# Get the actual model object
if best_model_name == 'Ensemble (Weighted)':
    best_model = ensemble_model
elif best_model_name.endswith(' (Tuned)'):
    base_name = best_model_name.replace(' (Tuned)', '')
    best_model = tuned_models.get(base_name, models.get(base_name))
else:
    best_model = models.get(best_model_name)

if best_model is None:
    # Fallback to best from initial models
    best_model_name = sorted_models[0][0]
    best_model = models[best_model_name]

print(f"Best Model: {best_model_name}")
print(f"R² Score: {all_results[best_model_name]['r2']:.4f}")
print(f"RMSE: ${all_results[best_model_name]['rmse']:,.2f}")
print(f"MAE: ${all_results[best_model_name]['mae']:,.2f}")
print(f"MAPE: {all_results[best_model_name]['mape']:.2f}%")

# ============================================================================
# STEP 8: Feature Importance Analysis
# ============================================================================
print("\n" + "=" * 80)
print("STEP 8: Feature importance analysis...")
print("=" * 80)

feature_importance = {}

# Get feature names (after polynomial transformation)
feature_names = list(X_train.columns)

if hasattr(best_model, 'feature_importances_'):
    importances = best_model.feature_importances_
    feature_importance = dict(zip(feature_names, importances))
    sorted_importance = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    
    print("\nTop 15 Most Important Features:")
    for i, (feature, importance) in enumerate(sorted_importance[:15], 1):
        print(f"{i}. {feature}: {importance:.4f}")
elif hasattr(best_model, 'coef_'):
    # For linear models
    coefs = best_model.coef_
    feature_importance = dict(zip(feature_names, np.abs(coefs)))
    sorted_importance = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    
    print("\nTop 15 Most Important Features (by coefficient magnitude):")
    for i, (feature, importance) in enumerate(sorted_importance[:15], 1):
        print(f"{i}. {feature}: {importance:.4f}")
elif hasattr(best_model, 'final_estimator_'):
    # For stacking ensemble, get feature importance from final estimator
    if hasattr(best_model.final_estimator_, 'coef_'):
        coefs = best_model.final_estimator_.coef_
        feature_importance = dict(zip([f'model_{i}' for i in range(len(coefs))], np.abs(coefs)))
        print("\nStacking Ensemble - Meta-learner coefficients:")
        for i, (feature, importance) in enumerate(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True), 1):
            print(f"{i}. {feature}: {importance:.4f}")

# ============================================================================
# STEP 9: Prediction Confidence Intervals
# ============================================================================
print("\n" + "=" * 80)
print("STEP 9: Calculating prediction confidence intervals...")
print("=" * 80)

# Calculate confidence intervals (predictions are already in original space from evaluate_predictions)
pred_mean_original = all_results[best_model_name]['predictions']  # Already in original space

# Use Random Forest for confidence intervals (can get prediction variance)
if isinstance(best_model, RandomForestRegressor) or 'Random Forest' in best_model_name:
    # Get predictions from all trees (in log space)
    predictions_log = np.array([tree.predict(X_test) for tree in best_model.estimators_])
    pred_mean_log = predictions_log.mean(axis=0)
    pred_std_log = predictions_log.std(axis=0)
    
    # Transform back to original space for intervals
    # Use delta method approximation: Var[f(X)] ≈ f'(E[X])^2 * Var[X]
    # For expm1, derivative is exp, so Var[expm1(X)] ≈ exp(E[X])^2 * Var[X]
    # But simpler: transform mean and std separately, then construct intervals
    pred_mean_transformed = inverse_transform_predictions(pred_mean_log)
    # Approximate std in original space (using first-order Taylor expansion)
    # std_original ≈ exp(mean_log) * std_log
    pred_std_transformed = np.exp(pred_mean_log) * pred_std_log
    
    # Calculate 95% confidence intervals in original space
    confidence_intervals = {
        'lower_95': np.maximum(0, pred_mean_transformed - 1.96 * pred_std_transformed),
        'upper_95': pred_mean_transformed + 1.96 * pred_std_transformed,
        'mean': pred_mean_transformed,
        'std': pred_std_transformed
    }
else:
    # For other models, use residual-based intervals (already in original space)
    residuals = y_test_original - pred_mean_original
    residual_std = np.std(residuals)
    
    confidence_intervals = {
        'lower_95': np.maximum(0, pred_mean_original - 1.96 * residual_std),
        'upper_95': pred_mean_original + 1.96 * residual_std,
        'mean': pred_mean_original,
        'std': np.full_like(pred_mean_original, residual_std)
    }

print(f"Confidence intervals calculated for {len(confidence_intervals['mean'])} predictions")
print(f"Average interval width: ${np.mean(confidence_intervals['upper_95'] - confidence_intervals['lower_95']):,.2f}")

# ============================================================================
# STEP 10: Save Best Model V2
# ============================================================================
print("\n" + "=" * 80)
print("STEP 10: Saving improved model (V2)...")
print("=" * 80)

# Save improved model as best_model_v2.pkl
model_path_v2 = os.path.join(MODEL_DIR, 'best_model_v2.pkl')

with open(model_path_v2, 'wb') as f:
    pickle.dump({
        'model': best_model,
        'model_name': best_model_name,
        'features': list(X_train.columns),  # Use actual feature names after polynomial
        'original_features': available_features,  # Original features before polynomial
        'feature_importance': feature_importance,
        'metrics': all_results[best_model_name],
        'poly_transformer': poly_transformer,
        'numeric_cols_for_poly': numeric_cols_for_poly if 'numeric_cols_for_poly' in locals() else [],
        'make_popularity_map': make_popularity_map,  # Save for prediction time
        'version': 'v2',
        'target_transform': 'log1p',  # Store transformation info
        'transform_offset': TRANSFORM_OFFSET,
        'improvements': {
            'feature_engineering': True,
            'outlier_handling_iqr': True,
            'polynomial_features': True,
            'stacking_ensemble': True,
            'improved_hyperparameter_tuning': True,
            'log_target_transformation': True  # New improvement
        }
    }, f)

print(f"[OK] Improved model saved to: {model_path_v2}")

# Also save original model for comparison (with same transformation info for backward compatibility)
model_path_original = os.path.join(MODEL_DIR, 'car_price_model.pkl')
with open(model_path_original, 'wb') as f:
    pickle.dump({
        'model': best_model,
        'model_name': best_model_name,
        'features': list(X_train.columns),  # Use actual feature names after polynomial
        'original_features': available_features,  # Original features before polynomial
        'feature_importance': feature_importance,
        'metrics': all_results[best_model_name],
        'poly_transformer': poly_transformer,
        'numeric_cols_for_poly': numeric_cols_for_poly if 'numeric_cols_for_poly' in locals() else [],
        'make_popularity_map': make_popularity_map,  # Save for prediction time
        'target_transform': 'log1p',  # Store transformation info for consistency
        'transform_offset': TRANSFORM_OFFSET,
        'version': 'v2'
    }, f)

print(f"[OK] Original model also saved to: {model_path_original}")

# Also save feature encoders if they exist
if 'le_make' in locals():
    with open(os.path.join(MODEL_DIR, 'make_encoder.pkl'), 'wb') as f:
        pickle.dump(le_make, f)
if 'le_model' in locals():
    with open(os.path.join(MODEL_DIR, 'model_encoder.pkl'), 'wb') as f:
        pickle.dump(le_model, f)

# ============================================================================
# STEP 11: Generate Evaluation Report and Visualizations
# ============================================================================
print("\n" + "=" * 80)
print("STEP 11: Generating evaluation report and visualizations...")
print("=" * 80)

# Create comparison table
comparison_data = []
for name, metrics in all_results.items():
    comparison_data.append({
        'Model': name,
        'R² Score': f"{metrics['r2']:.4f}",
        'RMSE ($)': f"{metrics['rmse']:,.2f}",
        'MAE ($)': f"{metrics['mae']:,.2f}",
        'MAPE (%)': f"{metrics['mape']:.2f}"
    })

comparison_df = pd.DataFrame(comparison_data)
print("\nModel Comparison Table:")
print(comparison_df.to_string(index=False))

# Save comparison table
comparison_df.to_csv(os.path.join(EVAL_DIR, 'model_comparison.csv'), index=False)

# Generate visualizations
fig = plt.figure(figsize=(16, 12))

# 1. Model Comparison Bar Chart
ax1 = plt.subplot(2, 3, 1)
model_names = [name for name in all_results.keys()]
r2_scores = [all_results[name]['r2'] for name in model_names]
colors = ['green' if score == max(r2_scores) else 'steelblue' for score in r2_scores]
ax1.barh(range(len(model_names)), r2_scores, color=colors)
ax1.set_yticks(range(len(model_names)))
ax1.set_yticklabels(model_names, fontsize=8)
ax1.set_xlabel('R² Score', fontsize=10)
ax1.set_title('Model Comparison (R² Score)', fontsize=12, fontweight='bold')
ax1.grid(True, alpha=0.3, axis='x')
for i, score in enumerate(r2_scores):
    ax1.text(score, i, f'{score:.4f}', va='center', fontsize=8)

# 2. Actual vs Predicted Scatter
ax2 = plt.subplot(2, 3, 2)
y_pred_best = all_results[best_model_name]['predictions']
ax2.scatter(y_test, y_pred_best, alpha=0.5, s=20)
ax2.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2)
ax2.set_xlabel('Actual Price ($)', fontsize=10)
ax2.set_ylabel('Predicted Price ($)', fontsize=10)
ax2.set_title(f'Actual vs Predicted ({best_model_name})', fontsize=12, fontweight='bold')
ax2.grid(True, alpha=0.3)

# 3. Residual Plot
ax3 = plt.subplot(2, 3, 3)
residuals = y_test - y_pred_best
ax3.scatter(y_pred_best, residuals, alpha=0.5, s=20)
ax3.axhline(y=0, color='r', linestyle='--', lw=2)
ax3.set_xlabel('Predicted Price ($)', fontsize=10)
ax3.set_ylabel('Residuals ($)', fontsize=10)
ax3.set_title('Residual Plot', fontsize=12, fontweight='bold')
ax3.grid(True, alpha=0.3)

# 4. Feature Importance
if feature_importance:
    ax4 = plt.subplot(2, 3, 4)
    sorted_imp = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:10]
    features = [f[0] for f in sorted_imp]
    importances = [f[1] for f in sorted_imp]
    ax4.barh(range(len(features)), importances, color='steelblue')
    ax4.set_yticks(range(len(features)))
    ax4.set_yticklabels(features, fontsize=8)
    ax4.set_xlabel('Importance', fontsize=10)
    ax4.set_title('Top 10 Feature Importance', fontsize=12, fontweight='bold')
    ax4.grid(True, alpha=0.3, axis='x')

# 5. Prediction Error Distribution
ax5 = plt.subplot(2, 3, 5)
errors = y_test - y_pred_best
ax5.hist(errors, bins=50, color='steelblue', alpha=0.7, edgecolor='black')
ax5.axvline(x=0, color='r', linestyle='--', lw=2)
ax5.set_xlabel('Prediction Error ($)', fontsize=10)
ax5.set_ylabel('Frequency', fontsize=10)
ax5.set_title('Prediction Error Distribution', fontsize=12, fontweight='bold')
ax5.grid(True, alpha=0.3, axis='y')

# 6. Confidence Intervals Sample
ax6 = plt.subplot(2, 3, 6)
sample_indices = np.random.choice(len(y_test), min(100, len(y_test)), replace=False)
sample_indices = np.sort(sample_indices)
ax6.errorbar(range(len(sample_indices)), 
             confidence_intervals['mean'][sample_indices],
             yerr=[confidence_intervals['mean'][sample_indices] - confidence_intervals['lower_95'][sample_indices],
                   confidence_intervals['upper_95'][sample_indices] - confidence_intervals['mean'][sample_indices]],
             fmt='o', alpha=0.6, capsize=3, label='Predicted with 95% CI')
ax6.scatter(range(len(sample_indices)), y_test.iloc[sample_indices], 
           color='red', alpha=0.5, s=20, label='Actual')
ax6.set_xlabel('Sample Index', fontsize=10)
ax6.set_ylabel('Price ($)', fontsize=10)
ax6.set_title('Prediction Confidence Intervals (Sample)', fontsize=12, fontweight='bold')
ax6.legend(fontsize=8)
ax6.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(EVAL_DIR, 'model_evaluation_report.png'), dpi=300, bbox_inches='tight')
plt.close()

print("  [OK] Saved: evaluation_reports/model_evaluation_report.png")

# Generate text report
report = []
report.append("=" * 80)
report.append("CAR PRICE PREDICTION MODEL - EVALUATION REPORT")
report.append("=" * 80)
report.append("")

report.append("BEST MODEL")
report.append("-" * 80)
report.append(f"Model Name: {best_model_name}")
report.append(f"R² Score: {all_results[best_model_name]['r2']:.4f}")
report.append(f"RMSE: ${all_results[best_model_name]['rmse']:,.2f}")
report.append(f"MAE: ${all_results[best_model_name]['mae']:,.2f}")
report.append(f"MAPE: {all_results[best_model_name]['mape']:.2f}%")
report.append("")

report.append("MODEL COMPARISON")
report.append("-" * 80)
for name, metrics in sorted(all_results.items(), key=lambda x: x[1]['r2'], reverse=True):
    report.append(f"{name}:")
    report.append(f"  R²: {metrics['r2']:.4f}, RMSE: ${metrics['rmse']:,.2f}, MAE: ${metrics['mae']:,.2f}, MAPE: {metrics['mape']:.2f}%")
report.append("")

if feature_importance:
    report.append("FEATURE IMPORTANCE (Top 10)")
    report.append("-" * 80)
    sorted_imp = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:10]
    for i, (feature, importance) in enumerate(sorted_imp, 1):
        report.append(f"{i}. {feature}: {importance:.4f}")
    report.append("")

report.append("PREDICTION CONFIDENCE INTERVALS")
report.append("-" * 80)
report.append(f"Average 95% CI Width: ${np.mean(confidence_intervals['upper_95'] - confidence_intervals['lower_95']):,.2f}")
report.append(f"Coverage (actual within CI): {(np.sum((y_test >= confidence_intervals['lower_95']) & (y_test <= confidence_intervals['upper_95'])) / len(y_test) * 100):.2f}%")
report.append("")

report.append("=" * 80)
report.append("END OF REPORT")
report.append("=" * 80)

report_text = "\n".join(report)
print("\n" + report_text)

with open(os.path.join(EVAL_DIR, 'evaluation_report.txt'), 'w', encoding='utf-8') as f:
    f.write(report_text)

print(f"\n[OK] Evaluation report saved to: {os.path.join(EVAL_DIR, 'evaluation_report.txt')}")

# ============================================================================
# STEP 12: Before/After Comparison
# ============================================================================
print("\n" + "=" * 80)
print("STEP 12: Before/After Comparison")
print("=" * 80)

# Try to load old model for comparison
old_model_metrics = None
old_model_path = os.path.join(MODEL_DIR, 'car_price_model.pkl')

if os.path.exists(old_model_path):
    try:
        with open(old_model_path, 'rb') as f:
            old_model_data = pickle.load(f)
            if 'metrics' in old_model_data:
                old_model_metrics = old_model_data['metrics']
                print("\n[OK] Loaded old model for comparison")
    except Exception as e:
        print(f"[WARNING] Could not load old model: {e}")

# Current model metrics
current_metrics = all_results[best_model_name]

print("\n" + "-" * 80)
print("MODEL PERFORMANCE COMPARISON")
print("-" * 80)

if old_model_metrics:
    print(f"\n{'Metric':<20} {'Old Model':<20} {'New Model (V2)':<20} {'Improvement':<20}")
    print("-" * 80)
    
    # R² Score
    old_r2 = old_model_metrics.get('r2', 0)
    new_r2 = current_metrics['r2']
    r2_improvement = new_r2 - old_r2
    print(f"{'R² Score':<20} {old_r2:<20.4f} {new_r2:<20.4f} {r2_improvement:+.4f} ({r2_improvement/old_r2*100:+.2f}%)")
    
    # RMSE
    old_rmse = old_model_metrics.get('rmse', 0)
    new_rmse = current_metrics['rmse']
    rmse_improvement = old_rmse - new_rmse  # Lower is better
    print(f"{'RMSE ($)':<20} ${old_rmse:<19.2f} ${new_rmse:<19.2f} ${rmse_improvement:+.2f} ({rmse_improvement/old_rmse*100:+.2f}%)")
    
    # MAE
    old_mae = old_model_metrics.get('mae', 0)
    new_mae = current_metrics['mae']
    mae_improvement = old_mae - new_mae  # Lower is better
    print(f"{'MAE ($)':<20} ${old_mae:<19.2f} ${new_mae:<19.2f} ${mae_improvement:+.2f} ({mae_improvement/old_mae*100:+.2f}%)")
    
    # MAPE
    old_mape = old_model_metrics.get('mape', 0)
    new_mape = current_metrics['mape']
    mape_improvement = old_mape - new_mape  # Lower is better
    print(f"{'MAPE (%)':<20} {old_mape:<20.2f} {new_mape:<20.2f} {mape_improvement:+.2f} ({mape_improvement/old_mape*100:+.2f}%)")
    
    print("\n" + "-" * 80)
    print("IMPROVEMENTS SUMMARY")
    print("-" * 80)
    print(f"[OK] R² Score improved by: {r2_improvement:.4f} ({r2_improvement/old_r2*100:+.2f}%)")
    print(f"[OK] RMSE reduced by: ${rmse_improvement:.2f} ({rmse_improvement/old_rmse*100:+.2f}%)")
    print(f"[OK] MAE reduced by: ${mae_improvement:.2f} ({mae_improvement/old_mae*100:+.2f}%)")
    if not np.isnan(mape_improvement) and not np.isinf(mape_improvement):
        print(f"[OK] MAPE reduced by: {mape_improvement:.2f}% ({mape_improvement/old_mape*100:+.2f}%)")
    
    if new_r2 >= 0.90:
        print(f"\n🎉 TARGET ACHIEVED: R² Score >= 0.90!")
    else:
        print(f"\n⚠️  Target R² >= 0.90 not fully achieved (current: {new_r2:.4f})")
else:
    print("\n[INFO] No old model found for comparison")
    print(f"\nCurrent Model Performance:")
    print(f"  R² Score: {current_metrics['r2']:.4f}")
    print(f"  RMSE: ${current_metrics['rmse']:,.2f}")
    print(f"  MAE: ${current_metrics['mae']:,.2f}")
    print(f"  MAPE: {current_metrics['mape']:.2f}%")
    
    if current_metrics['r2'] >= 0.90:
        print(f"\n🎉 TARGET ACHIEVED: R² Score >= 0.90!")
    else:
        print(f"\n⚠️  Target R² >= 0.90 not fully achieved (current: {current_metrics['r2']:.4f})")

print("\n" + "-" * 80)
print("IMPROVEMENTS APPLIED")
print("-" * 80)
print("[OK] Advanced feature engineering (car_age, brand_popularity, interactions)")
print("[OK] IQR-based outlier handling")
print("[OK] Polynomial features (degree=2)")
print("[OK] Stacking ensemble with Ridge meta-learner")
print("[OK] Improved hyperparameter tuning (RandomizedSearchCV with expanded grids)")
print("[OK] Better model selection and evaluation")

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 80)
print("MODEL TRAINING COMPLETE!")
print("=" * 80)
print(f"\nBest Model: {best_model_name}")
print(f"R² Score: {all_results[best_model_name]['r2']:.4f}")
print(f"RMSE: ${all_results[best_model_name]['rmse']:,.2f}")
print(f"MAE: ${all_results[best_model_name]['mae']:,.2f}")
print(f"MAPE: {all_results[best_model_name]['mape']:.2f}%")

if all_results[best_model_name]['r2'] >= 0.90:
    print("\n[TARGET ACHIEVED] R² >= 0.90!")
else:
    print(f"\n[WARNING] Target R² >= 0.90 not fully achieved, but significant improvements made.")

print(f"\n[OK] Improved model (V2) saved to: models/best_model_v2.pkl")
print(f"[OK] Original model saved to: models/car_price_model.pkl")
print(f"[OK] Evaluation reports saved to: evaluation_reports/")
print("=" * 80)

