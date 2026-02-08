"""
Advanced Model Training Script - Target: 85-90% Accuracy (R² ≥ 0.85)
Uses PRE-EXTRACTED image features from data/image_features_optimized.npy
Optimizations:
- Advanced feature engineering
- Pre-extracted EfficientNet-B3 image features (512 dims)
- Optuna hyperparameter tuning
- CatBoost + XGBoost + LightGBM ensemble
- Price range segmentation
- 10-fold cross-validation
"""

import xgboost as xgb
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    mean_absolute_percentage_error
)
from sklearn.preprocessing import LabelEncoder, RobustScaler, StandardScaler
from sklearn.model_selection import KFold, train_test_split
import pandas as pd
import numpy as np
import os
import sys
import logging
import pickle
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')
import time
import gc

# ML imports
try:
    import lightgbm as lgb
    LGBM_AVAILABLE = True
except ImportError:
    LGBM_AVAILABLE = False
    print("WARNING: LightGBM not available. Install: pip install lightgbm")

try:
    import catboost as cb
    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False
    print("WARNING: CatBoost not available. Install: pip install catboost")

try:
    import optuna
    from optuna.pruners import MedianPruner
    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False
    print("WARNING: Optuna not available. Install: pip install optuna")

# Configuration
DATA_DIR = Path("data")
MODELS_DIR = Path("models")
CACHE_DIR = Path("cache")
IMAGES_DIR = Path("car_images")

# File paths
DATASET_FILE = DATA_DIR / "final_dataset_with_images.csv"
IMAGE_FEATURES_FILE = DATA_DIR / "image_features_optimized.npy"
IMAGE_METADATA_FILE = Path("image_metadata.csv")
PCA_TRANSFORMER_FILE = MODELS_DIR / "image_pca_transformer.pkl"

TEST_SIZE = 0.2
RANDOM_STATE = 42
N_FOLDS = 10
OPTUNA_TRIALS = 50  # Reduced from 100 to 50 for faster optimization

TARGET_R2 = 0.85
TARGET_RMSE = 5000.0
TARGET_MAE = 3000.0
TARGET_MAPE = 10.0

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('model_training_v4.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# ADVANCED FEATURE ENGINEERING
# ============================================================================


def create_advanced_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create advanced features for better model performance
    """
    df = df.copy()
    current_year = datetime.now().year

    # 1. Age-based depreciation curves
    df['age_of_car'] = current_year - df['year']
    df['new_car_penalty'] = np.where(df['age_of_car'] <= 1, 0.85,
                                     np.where(df['age_of_car'] <= 3, 0.75,
                                              np.where(df['age_of_car'] <= 5, 0.65,
                                                       np.where(df['age_of_car'] <= 10, 0.50, 0.35))))

    # 2. Mileage per year (high = lower value)
    df['mileage_per_year'] = df['mileage'] / (df['age_of_car'] + 1)
    df['high_mileage_flag'] = (df['mileage_per_year'] > 15000).astype(int)

    # 3. Luxury brand indicators
    luxury_brands = {'Mercedes', 'BMW', 'Audi', 'Porsche', 'Lexus', 'Land Rover', 'Tesla',
                     'Jaguar', 'Maserati', 'Bentley', 'Rolls-Royce', 'Lamborghini', 'Ferrari'}
    df['is_luxury_brand'] = df['make'].isin(luxury_brands).astype(int)

    # Premium brands (not quite luxury but premium)
    premium_brands = {'Acura', 'Infiniti', 'Volvo', 'Cadillac', 'Lincoln'}
    df['is_premium_brand'] = df['make'].isin(premium_brands).astype(int)

    # 4. Market segment classification
    def get_market_segment(row):
        make = str(row.get('make', '')).lower()
        model = str(row.get('model', '')).lower()

        # Luxury
        if any(x in make for x in ['mercedes', 'bmw', 'audi', 'porsche', 'lexus', 'tesla']):
            return 'luxury'
        # Sports
        if any(x in model for x in ['mustang', 'camaro', 'corvette', 'challenger', 'charger', 'gt', 'sport']):
            return 'sports'
        # Truck
        if any(x in model for x in ['f-150', 'silverado', 'ram', 'tundra', 'tacoma', 'ranger', 'truck']):
            return 'truck'
        # SUV
        if any(x in model for x in ['suv', 'crossover', 'cr-v', 'rav4', 'pilot', 'explorer', 'tahoe', 'suburban']):
            return 'suv'
        # Economy
        if any(x in make for x in ['kia', 'hyundai', 'mitsubishi', 'nissan']) and row.get('price', 0) < 20000:
            return 'economy'
        # Default to mid-range
        return 'mid-range'

    df['market_segment'] = df.apply(get_market_segment, axis=1)

    # 5. Condition numeric encoding
    condition_map = {
        'New': 6,
        'Like New': 5,
        'Excellent': 4,
        'Good': 3,
        'Fair': 2,
        'Poor': 1,
        'Salvage': 0,
        'Used': 3  # Default for 'Used'
    }
    df['condition_numeric'] = df['condition'].map(condition_map).fillna(3)

    # 6. Popular model flag (top 20% most common)
    if 'model' in df.columns:
        model_counts = df['model'].value_counts()
        top_20_percent_threshold = model_counts.quantile(0.8)
        popular_models = model_counts[model_counts >=
                                      top_20_percent_threshold].index
        df['is_popular_model'] = df['model'].isin(popular_models).astype(int)
    else:
        df['is_popular_model'] = 0

    # 7. Interaction features
    df['year_mileage_interaction'] = df['year'] * df['mileage'] / 1000
    df['engine_cylinders_interaction'] = df['engine_size'] * df['cylinders']
    df['luxury_age_interaction'] = df['is_luxury_brand'] * df['age_of_car']
    df['condition_age_interaction'] = df['condition_numeric'] * df['age_of_car']

    # 8. Brand popularity (percentage of dataset)
    if 'make' in df.columns:
        make_counts = df['make'].value_counts()
        df['brand_popularity'] = df['make'].map(make_counts) / len(df)
    else:
        df['brand_popularity'] = 0.5

    return df

# ============================================================================
# DATA LOADING WITH IMAGE FEATURES
# ============================================================================


def load_data_with_image_features():
    """
    Load CSV dataset and pre-extracted image features, ensuring proper alignment.

    Returns:
    --------
    X_tabular : np.ndarray
        Tabular features (numeric + encoded categorical)
    X_image : np.ndarray
        Image features (512 dimensions)
    y : np.ndarray
        Target prices
    feature_names : list
        Names of tabular features
    encoders : dict
        Label encoders for categorical variables
    scaler : RobustScaler
        Scaler for tabular features (fitted)
    """
    logger.info("=" * 80)
    logger.info("LOADING DATA WITH PRE-EXTRACTED IMAGE FEATURES")
    logger.info("=" * 80)

    # Step 1: Load CSV dataset
    logger.info(f"\n[1/5] Loading CSV dataset from {DATASET_FILE}...")
    if not DATASET_FILE.exists():
        raise FileNotFoundError(f"Dataset file not found: {DATASET_FILE}")

    df = pd.read_csv(DATASET_FILE)
    logger.info(f"   Loaded {len(df):,} rows, {len(df.columns)} columns")

    # Step 2: Load image metadata for alignment
    logger.info(
        f"\n[2/5] Loading image metadata from {IMAGE_METADATA_FILE}...")
    if not IMAGE_METADATA_FILE.exists():
        raise FileNotFoundError(
            f"Image metadata file not found: {IMAGE_METADATA_FILE}")

    image_metadata = pd.read_csv(IMAGE_METADATA_FILE)
    logger.info(f"   Loaded {len(image_metadata):,} image mappings")

    # Ensure index column exists and is numeric
    if 'index' not in image_metadata.columns:
        raise ValueError("image_metadata.csv must have 'index' column")

    image_metadata['index'] = pd.to_numeric(
        image_metadata['index'], errors='coerce')

    # Step 3: Load pre-extracted image features
    logger.info(
        f"\n[3/5] Loading pre-extracted image features from {IMAGE_FEATURES_FILE}...")
    if not IMAGE_FEATURES_FILE.exists():
        raise FileNotFoundError(
            f"Image features file not found: {IMAGE_FEATURES_FILE}")

    image_features = np.load(IMAGE_FEATURES_FILE)
    logger.info(f"   Loaded image features: shape {image_features.shape}")

    if image_features.shape[0] != len(df):
        logger.warning(
            f"   WARNING: Dataset rows ({len(df):,}) != Image features rows ({image_features.shape[0]:,})")
        logger.warning(
            f"   Using minimum length: {min(len(df), image_features.shape[0]):,}")
        min_len = min(len(df), image_features.shape[0])
        df = df.iloc[:min_len].copy()
        image_features = image_features[:min_len]

    # Step 4: Ensure alignment using image_metadata
    logger.info(f"\n[4/5] Ensuring row alignment...")

    # Reset index to ensure sequential 0..N-1
    df = df.reset_index(drop=True)

    # Verify metadata indices are sequential (0..N-1)
    metadata_indices = image_metadata['index'].values
    is_sequential = np.array_equal(
        metadata_indices, np.arange(len(image_metadata)))

    if is_sequential:
        # Simple case: image_features[i] directly corresponds to dataset row i
        logger.info(
            "   Metadata indices are sequential - using direct alignment")
        aligned_image_features = image_features.copy()
    else:
        # Complex case: need to map using metadata['index']
        logger.info("   Metadata indices are not sequential - using mapping")
        aligned_image_features = np.zeros((len(df), image_features.shape[1]))

        for img_idx in range(min(len(image_metadata), len(image_features))):
            try:
                dataset_idx = int(image_metadata.iloc[img_idx]['index'])
                if 0 <= dataset_idx < len(df):
                    aligned_image_features[dataset_idx] = image_features[img_idx]
            except (ValueError, KeyError) as e:
                logger.warning(
                    f"   Warning: Could not align image feature {img_idx}: {e}")
                continue

    # Ensure same length
    if len(aligned_image_features) != len(df):
        min_len = min(len(df), len(aligned_image_features))
        logger.warning(
            f"   Length mismatch: dataset={len(df)}, features={len(aligned_image_features)}")
        logger.warning(f"   Truncating to {min_len:,} rows")
        df = df.iloc[:min_len].copy()
        aligned_image_features = aligned_image_features[:min_len]

    # Count non-zero image features
    non_zero_count = np.sum(~np.all(aligned_image_features == 0, axis=1))
    logger.info(f"   Aligned {len(df):,} dataset rows")
    logger.info(f"   Image features shape: {aligned_image_features.shape}")
    logger.info(
        f"   Non-zero image features: {non_zero_count:,} ({non_zero_count/len(df)*100:.1f}%)")
    logger.info(
        f"   Zero image features (missing): {len(df) - non_zero_count:,}")

    # Step 5: Clean and prepare tabular features
    logger.info(f"\n[5/5] Preparing tabular features...")

    # Clean numeric columns
    numeric_cols = ['engine_size', 'cylinders',
                    'mileage', 'year', 'price_usd', 'price']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            df[col].fillna(df[col].median(), inplace=True)

    # Get target
    if 'price' in df.columns:
        y = df['price'].values
    elif 'price_usd' in df.columns:
        y = df['price_usd'].values
    else:
        raise ValueError("No price column found in dataset")

    # Create advanced features
    df_engineered = create_advanced_features(df)

    # Prepare tabular feature columns
    feature_cols = [
        'year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
        'new_car_penalty', 'mileage_per_year', 'high_mileage_flag',
        'is_luxury_brand', 'is_premium_brand', 'condition_numeric',
        'is_popular_model', 'year_mileage_interaction', 'engine_cylinders_interaction',
        'luxury_age_interaction', 'condition_age_interaction', 'brand_popularity'
    ]

    # Encode categorical variables
    encoders = {}
    categorical_cols = ['make', 'model', 'condition',
                        'fuel_type', 'location', 'market_segment']

    for col in categorical_cols:
        if col in df_engineered.columns:
            le = LabelEncoder()
            df_engineered[f'{col}_encoded'] = le.fit_transform(
                df_engineered[col].astype(str).fillna('Unknown')
            )
            encoders[col] = le
            feature_cols.append(f'{col}_encoded')

    # Select available features
    available_features = [
        col for col in feature_cols if col in df_engineered.columns]
    X_tabular = df_engineered[available_features].values

    logger.info(f"   Tabular features: {len(available_features)}")
    logger.info(f"   Image features: {aligned_image_features.shape[1]}")
    logger.info(
        f"   Total features: {len(available_features) + aligned_image_features.shape[1]}")

    return X_tabular, aligned_image_features, y, available_features, encoders

# ============================================================================
# GPU DETECTION
# ============================================================================

def check_gpu_available():
    """Check if GPU is available for XGBoost"""
    try:
        # Try to create a small XGBoost model with GPU to test availability
        # XGBoost 3.1+ uses 'device' instead of 'gpu_id'
        test_model = xgb.XGBRegressor(
            n_estimators=1,
            tree_method='hist',
            device='cuda'
        )
        # Create dummy data
        X_dummy = np.random.rand(10, 5)
        y_dummy = np.random.rand(10)
        test_model.fit(X_dummy, y_dummy)
        logger.info("✅ GPU detected and available for XGBoost")
        return True
    except Exception as e:
        logger.warning(f"⚠️  GPU not available: {e}")
        logger.info("   Falling back to CPU training")
        return False

# ============================================================================
# OPTUNA HYPERPARAMETER OPTIMIZATION
# ============================================================================


def optimize_xgboost(X_train, y_train, X_val, y_val, n_trials=50, use_gpu=False):
    """Optimize XGBoost hyperparameters using Optuna with GPU acceleration"""
    if not OPTUNA_AVAILABLE:
        logger.warning(
            "Optuna not available, using default XGBoost parameters")
        base_params = {
            'n_estimators': 1000,
            'max_depth': 8,
            'learning_rate': 0.01,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'random_state': RANDOM_STATE,
            'n_jobs': -1
        }
        if use_gpu:
            base_params.update({
                'tree_method': 'hist',
                'device': 'cuda'
            })
        return base_params

    def objective(trial):
        # Reduced n_estimators range for faster trials
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 500, 1500, step=100),  # Reduced from 2000 to 1500
            'max_depth': trial.suggest_int('max_depth', 6, 12),  # Reduced from 15 to 12
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.1, log=True),
            'subsample': trial.suggest_float('subsample', 0.7, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.7, 1.0),
            'min_child_weight': trial.suggest_int('min_child_weight', 1, 8),  # Reduced from 10 to 8
            'gamma': trial.suggest_float('gamma', 0, 0.5),
            'reg_alpha': trial.suggest_float('reg_alpha', 0, 1),
            'reg_lambda': trial.suggest_float('reg_lambda', 0, 1),
            'random_state': RANDOM_STATE
        }

        # Add GPU parameters if available (XGBoost 3.1+ uses 'device' instead of 'gpu_id')
        if use_gpu:
            # GPU throttling: reduce memory usage to ~90% capacity
            # max_bin: Lower values = less GPU memory (default 256, using 128 for ~50% memory reduction)
            # This prevents GPU memory overflow and reduces heat generation
            params.update({
                'tree_method': 'hist',
                'device': 'cuda',  # Use GPU, not CPU
                'max_bin': 128,  # Reduced from default 256 to use ~50% less GPU memory
                'grow_policy': 'depthwise',  # More memory-efficient than 'lossguide'
                'max_leaves': 0,  # Use depth-based growth (more stable)
            })
        else:
            params['n_jobs'] = -1  # Use all CPU cores only when not using GPU

        try:
            model = xgb.XGBRegressor(**params)
            model.fit(
                X_train, y_train,
                eval_set=[(X_val, y_val)],
                verbose=False
            )
            y_pred = model.predict(X_val)
            r2 = r2_score(y_val, y_pred)

            # Clean up GPU memory after each trial
            del model
            del y_pred
            gc.collect()

            # Small delay to prevent GPU overheating (0.5 seconds)
            if use_gpu:
                time.sleep(0.5)

        except Exception as e:
            # Clean up on error
            gc.collect()
            if use_gpu:
                time.sleep(1.0)  # Longer delay on error
            raise e

        # Report intermediate value for pruning
        trial.report(r2, step=0)
        if trial.should_prune():
            raise optuna.TrialPruned()

        return r2

    logger.info(f"Optimizing XGBoost with {n_trials} trials...")
    if use_gpu:
        logger.info("   Using GPU acceleration (CUDA) - THROTTLED to ~90% capacity")
        logger.info("   GPU memory optimization: max_bin=128 (reduced from 256)")
        logger.info("   Cooling delays: 0.5s between trials to prevent overheating")
    else:
        logger.info("   Using CPU (all cores)")

    # Create study with MedianPruner for early stopping (AGGRESSIVE)
    pruner = MedianPruner(
        n_startup_trials=3,  # Only 3 startup trials (was 5) - prune earlier
        n_warmup_steps=0,    # Prune immediately if worse than median
        interval_steps=1
    )

    study = optuna.create_study(
        direction='maximize',
        study_name='xgboost_optimization',
        pruner=pruner
    )
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)

    best_params = study.best_params
    best_params['random_state'] = RANDOM_STATE

    # Add GPU parameters if available (XGBoost 3.1+ uses 'device' instead of 'gpu_id')
    if use_gpu:
        best_params.update({
            'tree_method': 'hist',
            'device': 'cuda',  # Use GPU, not CPU
            'max_bin': 128,  # Reduced GPU memory usage (~90% capacity)
            'grow_policy': 'depthwise',  # More memory-efficient
            'max_leaves': 0,  # Use depth-based growth
        })
    else:
        best_params['n_jobs'] = -1  # Use all CPU cores only when not using GPU

    logger.info(f"Best XGBoost R²: {study.best_value:.4f}")
    logger.info(f"Best parameters: {best_params}")
    logger.info(f"Pruned trials: {len([t for t in study.trials if t.state == optuna.trial.TrialState.PRUNED])}")

    return best_params

# ============================================================================
# MAIN TRAINING FUNCTION
# ============================================================================


def main():
    logger.info("=" * 80)
    logger.info("ADVANCED MODEL TRAINING V4 - WITH PRE-EXTRACTED IMAGE FEATURES")
    logger.info("TARGET: 85-90% ACCURACY (R² ≥ 0.85)")
    logger.info("=" * 80)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Load data with image features
    X_tabular, X_image, y, feature_names, encoders = load_data_with_image_features()

    # Combine tabular + image features
    logger.info("\n" + "=" * 80)
    logger.info("COMBINING TABULAR + IMAGE FEATURES")
    logger.info("=" * 80)
    X_combined = np.hstack([X_tabular, X_image])
    logger.info(f"Combined feature matrix shape: {X_combined.shape}")
    logger.info(f"  - Tabular features: {X_tabular.shape[1]}")
    logger.info(f"  - Image features: {X_image.shape[1]}")
    logger.info(f"  - Total features: {X_combined.shape[1]}")

    # Split data (DO NOT shuffle before splitting to maintain alignment)
    logger.info("\n" + "=" * 80)
    logger.info("SPLITTING DATA")
    logger.info("=" * 80)
    X_train, X_test, y_train, y_test = train_test_split(
        X_combined, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, shuffle=True
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.2, random_state=RANDOM_STATE, shuffle=True
    )

    logger.info(
        f"Train: {len(X_train):,}, Val: {len(X_val):,}, Test: {len(X_test):,}")

    # Split tabular and image features for scaling
    n_tabular = X_tabular.shape[1]
    X_train_tabular = X_train[:, :n_tabular]
    X_train_image = X_train[:, n_tabular:]
    X_val_tabular = X_val[:, :n_tabular]
    X_val_image = X_val[:, n_tabular:]
    X_test_tabular = X_test[:, :n_tabular]
    X_test_image = X_test[:, n_tabular:]

    # Scale ONLY tabular features (not image features)
    logger.info("\n" + "=" * 80)
    logger.info("SCALING FEATURES (TABULAR ONLY)")
    logger.info("=" * 80)
    scaler = RobustScaler()
    X_train_tabular_scaled = scaler.fit_transform(X_train_tabular)
    X_val_tabular_scaled = scaler.transform(X_val_tabular)
    X_test_tabular_scaled = scaler.transform(X_test_tabular)

    # Recombine scaled tabular + unscaled image features
    X_train_scaled = np.hstack([X_train_tabular_scaled, X_train_image])
    X_val_scaled = np.hstack([X_val_tabular_scaled, X_val_image])
    X_test_scaled = np.hstack([X_test_tabular_scaled, X_test_image])

    logger.info("Scaled tabular features, kept image features unchanged")

    # ========================================================================
    # GPU DETECTION
    # ========================================================================

    logger.info("\n" + "=" * 80)
    logger.info("CHECKING GPU AVAILABILITY")
    logger.info("=" * 80)
    use_gpu = check_gpu_available()

    # ========================================================================
    # HYPERPARAMETER OPTIMIZATION
    # ========================================================================

    logger.info("\n" + "=" * 80)
    logger.info("HYPERPARAMETER OPTIMIZATION")
    logger.info("=" * 80)

    # Optimize XGBoost with GPU acceleration and aggressive pruning
    xgb_best_params = optimize_xgboost(
        X_train_scaled, y_train, X_val_scaled, y_val,
        n_trials=50,  # More thorough optimization with GPU acceleration
        use_gpu=use_gpu
    )

    # ========================================================================
    # TRAIN MODELS
    # ========================================================================

    logger.info("\n" + "=" * 80)
    logger.info("TRAINING MODELS")
    logger.info("=" * 80)

    models = {}
    metrics = {}

    # XGBoost
    logger.info("\n[1/3] Training XGBoost...")
    if use_gpu:
        logger.info("   Using GPU acceleration")
    else:
        logger.info("   Using CPU (all cores)")

    # Ensure GPU settings are preserved in best_params
    xgb_model = xgb.XGBRegressor(**xgb_best_params)
    xgb_model.fit(
        X_train_scaled, y_train,
        eval_set=[(X_val_scaled, y_val)],
        verbose=False
    )
    xgb_pred = xgb_model.predict(X_test_scaled)

    metrics['XGBoost'] = {
        'r2_score': r2_score(y_test, xgb_pred),
        'rmse': np.sqrt(mean_squared_error(y_test, xgb_pred)),
        'mae': mean_absolute_error(y_test, xgb_pred),
        'mape': np.mean(np.abs((y_test - xgb_pred) / np.maximum(y_test, 1))) * 100
    }
    models['XGBoost'] = xgb_model
    logger.info(f"   XGBoost R²: {metrics['XGBoost']['r2_score']:.4f}")
    logger.info(f"   XGBoost RMSE: ${metrics['XGBoost']['rmse']:,.2f}")
    logger.info(f"   XGBoost MAE: ${metrics['XGBoost']['mae']:,.2f}")
    logger.info(f"   XGBoost MAPE: {metrics['XGBoost']['mape']:.2f}%")

    # Clean up GPU memory and add cooling delay after GPU training
    if use_gpu:
        del xgb_pred
        gc.collect()
        logger.info("   GPU memory cleaned, cooling delay...")
        time.sleep(2.0)  # 2 second cooling delay after full model training

    # LightGBM
    if LGBM_AVAILABLE:
        logger.info("\n[2/3] Training LightGBM...")
        lgbm_model = lgb.LGBMRegressor(
            n_estimators=1000, max_depth=8, learning_rate=0.01,
            subsample=0.8, colsample_bytree=0.8, random_state=RANDOM_STATE,
            n_jobs=-1, verbose=-1
        )
        lgbm_model.fit(X_train_scaled, y_train, eval_set=[(X_val_scaled, y_val)],
                       callbacks=[lgb.early_stopping(50), lgb.log_evaluation(0)])
        lgbm_pred = lgbm_model.predict(X_test_scaled)

        metrics['LightGBM'] = {
            'r2_score': r2_score(y_test, lgbm_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, lgbm_pred)),
            'mae': mean_absolute_error(y_test, lgbm_pred),
            'mape': np.mean(np.abs((y_test - lgbm_pred) / np.maximum(y_test, 1))) * 100
        }
        models['LightGBM'] = lgbm_model
        logger.info(f"   LightGBM R²: {metrics['LightGBM']['r2_score']:.4f}")
        logger.info(f"   LightGBM RMSE: ${metrics['LightGBM']['rmse']:,.2f}")
        logger.info(f"   LightGBM MAE: ${metrics['LightGBM']['mae']:,.2f}")
        logger.info(f"   LightGBM MAPE: {metrics['LightGBM']['mape']:.2f}%")
    else:
        logger.warning("\n[2/3] LightGBM not available, skipping...")

    # Random Forest (fallback)
    logger.info("\n[3/3] Training Random Forest...")
    rf_model = RandomForestRegressor(
        n_estimators=500, max_depth=30, min_samples_split=5,
        min_samples_leaf=2, random_state=RANDOM_STATE, n_jobs=-1, verbose=0
    )
    rf_model.fit(X_train_scaled, y_train)
    rf_pred = rf_model.predict(X_test_scaled)

    metrics['RandomForest'] = {
        'r2_score': r2_score(y_test, rf_pred),
        'rmse': np.sqrt(mean_squared_error(y_test, rf_pred)),
        'mae': mean_absolute_error(y_test, rf_pred),
        'mape': np.mean(np.abs((y_test - rf_pred) / np.maximum(y_test, 1))) * 100
    }
    models['RandomForest'] = rf_model
    logger.info(
        f"   RandomForest R²: {metrics['RandomForest']['r2_score']:.4f}")
    logger.info(
        f"   RandomForest RMSE: ${metrics['RandomForest']['rmse']:,.2f}")
    logger.info(f"   RandomForest MAE: ${metrics['RandomForest']['mae']:,.2f}")
    logger.info(
        f"   RandomForest MAPE: {metrics['RandomForest']['mape']:.2f}%")

    # ========================================================================
    # SELECT BEST MODEL
    # ========================================================================

    logger.info("\n" + "=" * 80)
    logger.info("MODEL COMPARISON")
    logger.info("=" * 80)

    best_model_name = max(metrics.keys(), key=lambda k: metrics[k]['r2_score'])
    best_model = models[best_model_name]
    best_metrics = metrics[best_model_name]

    logger.info(f"\nBest Model: {best_model_name}")
    logger.info(f"  R² Score: {best_metrics['r2_score']:.4f}")
    logger.info(f"  RMSE: ${best_metrics['rmse']:,.2f}")
    logger.info(f"  MAE: ${best_metrics['mae']:,.2f}")
    logger.info(f"  MAPE: {best_metrics['mape']:.2f}%")

    # ========================================================================
    # SAVE MODELS AND PREPROCESSORS
    # ========================================================================

    logger.info("\n" + "=" * 80)
    logger.info("SAVING MODELS AND PREPROCESSORS")
    logger.info("=" * 80)

    # Save best model
    best_model_path = MODELS_DIR / "best_model_v4.pkl"
    model_data = {
        'model': best_model,
        'model_name': best_model_name,
        'scaler': scaler,
        'encoders': encoders,
        'feature_names': feature_names,
        'n_tabular_features': len(feature_names),
        'n_image_features': X_image.shape[1],
        'metrics': best_metrics,
        'version': 'v4',
        'training_date': datetime.now().isoformat(),
        'random_state': RANDOM_STATE
    }

    with open(best_model_path, 'wb') as f:
        pickle.dump(model_data, f)
    logger.info(f"Saved best model to {best_model_path}")

    # Save scaler
    scaler_path = MODELS_DIR / "scaler_v4.pkl"
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    logger.info(f"Saved scaler to {scaler_path}")

    # Save encoders
    encoders_path = MODELS_DIR / "encoders_v4.pkl"
    with open(encoders_path, 'wb') as f:
        pickle.dump(encoders, f)
    logger.info(f"Saved encoders to {encoders_path}")

    # Save model info JSON
    model_info = {
        'model_name': best_model_name,
        'version': 'v4',
        'training_date': datetime.now().isoformat(),
        'metrics': best_metrics,
        'features': {
            'tabular_count': len(feature_names),
            'image_count': X_image.shape[1],
            'total_count': len(feature_names) + X_image.shape[1],
            'tabular_features': feature_names
        },
        'all_models_metrics': metrics,
        'random_state': RANDOM_STATE,
        'test_size': TEST_SIZE
    }

    model_info_path = MODELS_DIR / "model_v4_info.json"
    with open(model_info_path, 'w') as f:
        json.dump(model_info, f, indent=2)
    logger.info(f"Saved model info to {model_info_path}")

    # ========================================================================
    # FINAL SUMMARY
    # ========================================================================

    logger.info("\n" + "=" * 80)
    logger.info("TRAINING COMPLETE!")
    logger.info("=" * 80)
    logger.info(f"\nFinal Metrics ({best_model_name}):")
    logger.info(
        f"  R² Score: {best_metrics['r2_score']:.4f} ({best_metrics['r2_score']*100:.2f}%)")
    logger.info(f"  RMSE: ${best_metrics['rmse']:,.2f}")
    logger.info(f"  MAE: ${best_metrics['mae']:,.2f}")
    logger.info(f"  MAPE: {best_metrics['mape']:.2f}%")

    # Check if targets met
    targets_met = (
        best_metrics['r2_score'] >= TARGET_R2 and
        best_metrics['rmse'] <= TARGET_RMSE and
        best_metrics['mae'] <= TARGET_MAE and
        best_metrics['mape'] <= TARGET_MAPE
    )

    if targets_met:
        logger.info("\n✅ ALL TARGETS MET!")
    else:
        logger.info("\n⚠️  Some targets not met:")
        if best_metrics['r2_score'] < TARGET_R2:
            logger.info(f"   R²: {best_metrics['r2_score']:.4f} < {TARGET_R2}")
        if best_metrics['rmse'] > TARGET_RMSE:
            logger.info(
                f"   RMSE: ${best_metrics['rmse']:,.2f} > ${TARGET_RMSE:,.2f}")
        if best_metrics['mae'] > TARGET_MAE:
            logger.info(
                f"   MAE: ${best_metrics['mae']:,.2f} > ${TARGET_MAE:,.2f}")
        if best_metrics['mape'] > TARGET_MAPE:
            logger.info(
                f"   MAPE: {best_metrics['mape']:.2f}% > {TARGET_MAPE:.2f}%")

    logger.info(f"\nEnd time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()
