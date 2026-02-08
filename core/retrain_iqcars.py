"""
Retrain Model on IQCars Dataset
Single script to retrain production model with proper GPU handling
"""

import pandas as pd
import numpy as np
import pickle
import json
import re
from pathlib import Path
from datetime import datetime
from sklearn.model_selection import KFold, train_test_split
from sklearn.preprocessing import LabelEncoder, RobustScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import warnings
warnings.filterwarnings('ignore')

# Import GPU detection and monitoring
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gpu import detect_nvidia_gpu, get_gpu_info
from gpu_monitor import GPUMonitor

# Try importing ML libraries
try:
    import catboost as cb
    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False
    print("Warning: CatBoost not available. Install with: pip install catboost")

try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False
    print("Warning: LightGBM not available. Install with: pip install lightgbm")

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("Warning: XGBoost not available. Install with: pip install xgboost")


def load_cleaned_data(data_path='data/iqcars_cleaned.csv'):
    """Load cleaned IQCars dataset"""
    data_path = Path(data_path)
    if not data_path.exists():
        raise FileNotFoundError(f"Cleaned dataset not found: {data_path}")
    
    print(f"Loading dataset from {data_path}...")
    df = pd.read_csv(data_path)
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    return df


def prepare_features(df):
    """
    Prepare features for training
    
    Returns:
    --------
    X : pd.DataFrame
        Feature matrix
    y : pd.Series
        Target (price)
    feature_info : dict
        Information about features (encoders, scaler, etc.)
    """
    # Copy dataframe
    df = df.copy()
    
    # Target variable
    y = df['price'].copy()
    
    # Features to use
    feature_cols = []
    categorical_cols = []
    numeric_cols = []
    
    # Required features
    if 'make' in df.columns:
        feature_cols.append('make')
        categorical_cols.append('make')
    if 'model' in df.columns:
        feature_cols.append('model')
        categorical_cols.append('model')
    if 'year' in df.columns:
        feature_cols.append('year')
        numeric_cols.append('year')
    if 'mileage' in df.columns:
        feature_cols.append('mileage')
        numeric_cols.append('mileage')
    
    # Optional features
    if 'engine_size' in df.columns:
        feature_cols.append('engine_size')
        numeric_cols.append('engine_size')
    if 'cylinders' in df.columns:
        feature_cols.append('cylinders')
        numeric_cols.append('cylinders')
    if 'condition' in df.columns:
        feature_cols.append('condition')
        categorical_cols.append('condition')
    if 'fuel_type' in df.columns:
        feature_cols.append('fuel_type')
        categorical_cols.append('fuel_type')
    if 'location' in df.columns:
        feature_cols.append('location')
        categorical_cols.append('location')
    if 'age_of_car' in df.columns:
        feature_cols.append('age_of_car')
        numeric_cols.append('age_of_car')
    
    # Select features
    X = df[feature_cols].copy()
    
    # Robust numeric conversion BEFORE using median
    def convert_to_numeric(series, col_name):
        """Convert series to numeric, handling strings with units"""
        # Convert to string first
        series_str = series.astype(str)
        
        # Handle different column types
        if col_name == 'engine_size':
            # Extract float from "3.0L", "2.5 l", "1800cc"
            def parse_engine(val):
                if pd.isna(val) or val == 'nan':
                    return np.nan
                val_str = str(val).strip().upper()
                val_str = re.sub(r'[L\s]', '', val_str)
                if 'CC' in val_str:
                    val_str = re.sub(r'CC', '', val_str)
                    match = re.search(r'[\d.]+', val_str)
                    if match:
                        try:
                            return float(match.group()) / 1000.0
                        except:
                            return np.nan
                match = re.search(r'[\d.]+', val_str)
                if match:
                    try:
                        return float(match.group())
                    except:
                        return np.nan
                return np.nan
            return series_str.apply(parse_engine)
        
        elif col_name == 'cylinders':
            # Extract integer from "V6", "6 cyl", "4"
            def parse_cyl(val):
                if pd.isna(val) or val == 'nan':
                    return np.nan
                val_str = str(val).strip().upper()
                val_str = re.sub(r'[VICYL\s]', '', val_str)
                match = re.search(r'\d+', val_str)
                if match:
                    try:
                        cyl = int(match.group())
                        if 2 <= cyl <= 12:
                            return cyl
                    except:
                        pass
                return np.nan
            return series_str.apply(parse_cyl)
        
        elif col_name == 'mileage':
            # Remove "km", commas, spaces
            def parse_mileage(val):
                if pd.isna(val) or val == 'nan':
                    return np.nan
                val_str = str(val).strip()
                val_str = re.sub(r'[KM,\s]', '', val_str, flags=re.IGNORECASE)
                match = re.search(r'\d+', val_str)
                if match:
                    try:
                        return int(match.group())
                    except:
                        return np.nan
                return np.nan
            return series_str.apply(parse_mileage)
        
        else:
            # Generic: strip units and extract first number
            def parse_generic(val):
                if pd.isna(val) or val == 'nan':
                    return np.nan
                val_str = str(val).strip()
                # Remove common units
                val_str = re.sub(r'[KM,L,\$,\s]', '', val_str, flags=re.IGNORECASE)
                match = re.search(r'[\d.]+', val_str)
                if match:
                    try:
                        return float(match.group())
                    except:
                        return np.nan
                return np.nan
            return series_str.apply(parse_generic)
    
    # Convert all numeric columns
    for col in numeric_cols:
        if col in X.columns:
            # Convert to numeric first
            X[col] = convert_to_numeric(X[col], col)
            # Then use pd.to_numeric for final conversion
            X[col] = pd.to_numeric(X[col], errors='coerce')
    
    # Debug: print dtypes and missing %
    print("\nFeature dtypes and missing values:")
    for col in numeric_cols + categorical_cols:
        if col in X.columns:
            missing_pct = (X[col].isna().sum() / len(X)) * 100
            dtype = X[col].dtype
            print(f"  {col}: {dtype}, {missing_pct:.1f}% missing")
    
    # Handle missing values AFTER conversion
    for col in numeric_cols:
        if col in X.columns:
            if X[col].notna().any():
                X[col] = X[col].fillna(X[col].median())
            else:
                # All NaN - use default
                if col == 'year':
                    X[col] = X[col].fillna(2020)
                elif col == 'mileage':
                    X[col] = X[col].fillna(50000)
                elif col == 'engine_size':
                    X[col] = X[col].fillna(2.0)
                elif col == 'cylinders':
                    X[col] = X[col].fillna(4)
                elif col == 'age_of_car':
                    X[col] = X[col].fillna(5)
    
    for col in categorical_cols:
        if col in X.columns:
            X[col] = X[col].fillna('Unknown')
    
    # Create encoders for categorical features
    encoders = {}
    for col in categorical_cols:
        if col in X.columns:
            le = LabelEncoder()
            X[col + '_encoded'] = le.fit_transform(X[col].astype(str))
            encoders[col] = le
    
    # Drop original categorical columns (keep encoded versions)
    X = X.drop(columns=categorical_cols)
    
    # Feature info
    feature_info = {
        'feature_names': list(X.columns),
        'categorical_cols': categorical_cols,
        'numeric_cols': numeric_cols,
        'encoders': encoders,
    }
    
    return X, y, feature_info


def train_model(X, y, use_gpu=False):
    """
    Train model with GPU support and fallback + real GPU monitoring
    
    Parameters:
    -----------
    X : pd.DataFrame
        Features
    y : pd.Series
        Target
    use_gpu : bool
        Whether to attempt GPU training
        
    Returns:
    --------
    model : trained model
    model_name : str
        Name of the model
    training_info : dict
        Training info: requested_device, actual_device, gpu_stats, train_time
    """
    # Detect GPU
    gpu_available = detect_nvidia_gpu() if use_gpu else False
    
    # Initialize GPU monitor
    gpu_monitor = GPUMonitor(sample_interval=0.5)
    monitor_started = False
    
    print(f"\n{'='*80}")
    print("MODEL TRAINING")
    print(f"{'='*80}")
    print(f"GPU available: {gpu_available}")
    print(f"Training samples: {len(X)}")
    print(f"Features: {len(X.columns)}")
    
    requested_device = "GPU" if (use_gpu and gpu_available) else "CPU"
    actual_device = "CPU"  # Default, will be updated if GPU actually used
    
    # Try CatBoost first (best for categoricals)
    if CATBOOST_AVAILABLE:
        print("\nTraining CatBoost model...")
        try:
            if gpu_available:
                try:
                    # Start GPU monitoring
                    monitor_started = gpu_monitor.start()
                    if monitor_started:
                        print("  📊 GPU monitoring started")
                    
                    # CatBoost: specify categorical features (encoded columns end with '_encoded')
                    cat_features_indices = []
                    for i, col in enumerate(X.columns):
                        if col.endswith('_encoded'):
                            cat_features_indices.append(i)
                    
                    model = cb.CatBoostRegressor(
                        iterations=1000,
                        learning_rate=0.05,
                        depth=6,
                        loss_function='RMSE',
                        task_type='GPU',
                        devices='0',
                        cat_features=cat_features_indices if cat_features_indices else None,
                        verbose=100,
                        random_seed=42
                    )
                    print("  Requested: GPU")
                    train_start = time.time()
                    model.fit(X, y)
                    train_time = time.time() - train_start
                    
                    # Stop monitoring and check GPU usage
                    gpu_monitor.stop()
                    gpu_stats = gpu_monitor.get_stats()
                    
                    if gpu_monitor.was_gpu_used(threshold_util=5.0, threshold_vram=200.0):
                        actual_device = "GPU"
                        print(f"  ✅ GPU USED - Max GPU%: {gpu_stats['max_gpu_util']:.1f}%, Max VRAM: {gpu_stats['max_vram_mb']:.0f} MB")
                    else:
                        actual_device = "CPU"
                        print(f"  ⚠️  GPU NOT USED (Max GPU%: {gpu_stats['max_gpu_util']:.1f}%, Max VRAM: {gpu_stats['max_vram_mb']:.0f} MB), falling back to CPU")
                    
                    print("✅ CatBoost training complete")
                    return model, 'CatBoost', {
                        'requested_device': requested_device,
                        'actual_device': actual_device,
                        'gpu_stats': gpu_stats,
                        'train_time': train_time
                    }
                except Exception as e:
                    if monitor_started:
                        gpu_monitor.stop()
                    print(f"  GPU training failed: {e}")
                    print("  Falling back to CPU")
                    requested_device = "CPU"
                    actual_device = "CPU"
                    # CatBoost: specify categorical features (encoded columns end with '_encoded')
                    cat_features_indices = []
                    for i, col in enumerate(X.columns):
                        if col.endswith('_encoded'):
                            cat_features_indices.append(i)
                    
                    model = cb.CatBoostRegressor(
                        iterations=1000,
                        learning_rate=0.05,
                        depth=6,
                        loss_function='RMSE',
                        task_type='CPU',
                        cat_features=cat_features_indices if cat_features_indices else None,
                        verbose=100,
                        random_seed=42
                    )
                    train_start = time.time()
                    model.fit(X, y)
                    train_time = time.time() - train_start
                    print("✅ CatBoost training complete (CPU)")
                    return model, 'CatBoost', {
                        'requested_device': requested_device,
                        'actual_device': actual_device,
                        'gpu_stats': {'max_gpu_util': 0.0, 'max_vram_mb': 0.0},
                        'train_time': train_time
                    }
            else:
                # CatBoost: specify categorical features (encoded columns end with '_encoded')
                cat_features_indices = []
                for i, col in enumerate(X.columns):
                    if col.endswith('_encoded'):
                        cat_features_indices.append(i)
                
                model = cb.CatBoostRegressor(
                    iterations=1000,
                    learning_rate=0.05,
                    depth=6,
                    loss_function='RMSE',
                    task_type='CPU',
                    cat_features=cat_features_indices if cat_features_indices else None,
                    verbose=100,
                    random_seed=42
                )
                train_start = time.time()
                model.fit(X, y)
                train_time = time.time() - train_start
                print("✅ CatBoost training complete (CPU)")
                return model, 'CatBoost', {
                    'requested_device': "CPU",
                    'actual_device': "CPU",
                    'gpu_stats': {'max_gpu_util': 0.0, 'max_vram_mb': 0.0},
                    'train_time': train_time
                }
        except Exception as e:
            if monitor_started:
                gpu_monitor.stop()
            print(f"CatBoost training failed: {e}")
    
    # Fallback to LightGBM
    if LIGHTGBM_AVAILABLE:
        print("\nTraining LightGBM model...")
        try:
            if gpu_available:
                try:
                    # Start GPU monitoring
                    monitor_started = gpu_monitor.start()
                    if monitor_started:
                        print("  📊 GPU monitoring started")
                    
                    model = lgb.LGBMRegressor(
                        n_estimators=1000,
                        learning_rate=0.05,
                        max_depth=6,
                        device='gpu',  # LightGBM uses 'device' parameter
                        gpu_platform_id=0,
                        gpu_device_id=0,
                        verbose=100,
                        random_state=42
                    )
                    print("  Requested: GPU")
                    train_start = time.time()
                    model.fit(X, y)
                    train_time = time.time() - train_start
                    
                    # Stop monitoring and check GPU usage
                    gpu_monitor.stop()
                    gpu_stats = gpu_monitor.get_stats()
                    
                    if gpu_monitor.was_gpu_used(threshold_util=5.0, threshold_vram=200.0):
                        actual_device = "GPU"
                        print(f"  ✅ GPU USED - Max GPU%: {gpu_stats['max_gpu_util']:.1f}%, Max VRAM: {gpu_stats['max_vram_mb']:.0f} MB")
                    else:
                        actual_device = "CPU"
                        print(f"  ⚠️  GPU NOT USED (Max GPU%: {gpu_stats['max_gpu_util']:.1f}%, Max VRAM: {gpu_stats['max_vram_mb']:.0f} MB), falling back to CPU")
                    
                    print("✅ LightGBM training complete")
                    return model, 'LightGBM', {
                        'requested_device': requested_device,
                        'actual_device': actual_device,
                        'gpu_stats': gpu_stats,
                        'train_time': train_time
                    }
                except Exception as e:
                    if monitor_started:
                        gpu_monitor.stop()
                    print(f"  GPU training failed: {e}")
                    print("  Falling back to CPU")
                    requested_device = "CPU"
                    actual_device = "CPU"
                    model = lgb.LGBMRegressor(
                        n_estimators=1000,
                        learning_rate=0.05,
                        max_depth=6,
                        verbose=100,
                        random_state=42
                    )
                    train_start = time.time()
                    model.fit(X, y)
                    train_time = time.time() - train_start
                    print("✅ LightGBM training complete (CPU)")
                    return model, 'LightGBM', {
                        'requested_device': requested_device,
                        'actual_device': actual_device,
                        'gpu_stats': {'max_gpu_util': 0.0, 'max_vram_mb': 0.0},
                        'train_time': train_time
                    }
            else:
                model = lgb.LGBMRegressor(
                    n_estimators=1000,
                    learning_rate=0.05,
                    max_depth=6,
                    verbose=100,
                    random_state=42
                )
                train_start = time.time()
                model.fit(X, y)
                train_time = time.time() - train_start
                print("✅ LightGBM training complete (CPU)")
                return model, 'LightGBM', {
                    'requested_device': "CPU",
                    'actual_device': "CPU",
                    'gpu_stats': {'max_gpu_util': 0.0, 'max_vram_mb': 0.0},
                    'train_time': train_time
                }
        except Exception as e:
            if monitor_started:
                gpu_monitor.stop()
            print(f"LightGBM training failed: {e}")
    
    # Fallback to XGBoost
    if XGBOOST_AVAILABLE:
        print("\nTraining XGBoost model...")
        try:
            if gpu_available:
                try:
                    # Start GPU monitoring
                    monitor_started = gpu_monitor.start()
                    if monitor_started:
                        print("  📊 GPU monitoring started")
                    
                    # XGBoost >= 3.1: use device="cuda", tree_method="hist"
                    model = xgb.XGBRegressor(
                        n_estimators=1000,
                        learning_rate=0.05,
                        max_depth=6,
                        tree_method='hist',
                        device='cuda',  # XGBoost >= 3.1 uses device="cuda"
                        random_state=42
                    )
                    print("  Requested: GPU")
                    train_start = time.time()
                    model.fit(X, y)
                    train_time = time.time() - train_start
                    
                    # Stop monitoring and check GPU usage
                    gpu_monitor.stop()
                    gpu_stats = gpu_monitor.get_stats()
                    
                    if gpu_monitor.was_gpu_used(threshold_util=5.0, threshold_vram=200.0):
                        actual_device = "GPU"
                        print(f"  ✅ GPU USED - Max GPU%: {gpu_stats['max_gpu_util']:.1f}%, Max VRAM: {gpu_stats['max_vram_mb']:.0f} MB")
                    else:
                        actual_device = "CPU"
                        print(f"  ⚠️  GPU NOT USED (Max GPU%: {gpu_stats['max_gpu_util']:.1f}%, Max VRAM: {gpu_stats['max_vram_mb']:.0f} MB), falling back to CPU")
                    
                    print("✅ XGBoost training complete")
                    return model, 'XGBoost', {
                        'requested_device': requested_device,
                        'actual_device': actual_device,
                        'gpu_stats': gpu_stats,
                        'train_time': train_time
                    }
                except Exception as e:
                    if monitor_started:
                        gpu_monitor.stop()
                    print(f"  GPU training failed: {e}")
                    print("  Falling back to CPU")
                    requested_device = "CPU"
                    actual_device = "CPU"
                    model = xgb.XGBRegressor(
                        n_estimators=1000,
                        learning_rate=0.05,
                        max_depth=6,
                        random_state=42
                    )
                    train_start = time.time()
                    model.fit(X, y)
                    train_time = time.time() - train_start
                    print("✅ XGBoost training complete (CPU)")
                    return model, 'XGBoost', {
                        'requested_device': requested_device,
                        'actual_device': actual_device,
                        'gpu_stats': {'max_gpu_util': 0.0, 'max_vram_mb': 0.0},
                        'train_time': train_time
                    }
            else:
                model = xgb.XGBRegressor(
                    n_estimators=1000,
                    learning_rate=0.05,
                    max_depth=6,
                    random_state=42
                )
                train_start = time.time()
                model.fit(X, y)
                train_time = time.time() - train_start
                print("✅ XGBoost training complete (CPU)")
                return model, 'XGBoost', {
                    'requested_device': "CPU",
                    'actual_device': "CPU",
                    'gpu_stats': {'max_gpu_util': 0.0, 'max_vram_mb': 0.0},
                    'train_time': train_time
                }
        except Exception as e:
            if monitor_started:
                gpu_monitor.stop()
            print(f"XGBoost training failed: {e}")
    
    raise RuntimeError("No ML library available! Install CatBoost, LightGBM, or XGBoost")


def evaluate_model(model, X, y, cv_folds=5):
    """
    Evaluate model with KFold cross-validation
    
    Returns:
    --------
    metrics : dict
        Evaluation metrics
    """
    print(f"\n{'='*80}")
    print("MODEL EVALUATION")
    print(f"{'='*80}")
    
    # KFold CV
    kf = KFold(n_splits=cv_folds, shuffle=True, random_state=42)
    cv_scores = {'mae': [], 'rmse': [], 'r2': []}
    
    print(f"\nCross-validation ({cv_folds} folds)...")
    for fold, (train_idx, val_idx) in enumerate(kf.split(X), 1):
        X_train_fold, X_val_fold = X.iloc[train_idx], X.iloc[val_idx]
        y_train_fold, y_val_fold = y.iloc[train_idx], y.iloc[val_idx]
        
        # Train on fold
        model_fold = type(model)(**model.get_params())
        model_fold.fit(X_train_fold, y_train_fold)
        
        # Predict
        y_pred_fold = model_fold.predict(X_val_fold)
        
        # Metrics
        mae = mean_absolute_error(y_val_fold, y_pred_fold)
        rmse = np.sqrt(mean_squared_error(y_val_fold, y_pred_fold))
        r2 = r2_score(y_val_fold, y_pred_fold)
        
        cv_scores['mae'].append(mae)
        cv_scores['rmse'].append(rmse)
        cv_scores['r2'].append(r2)
        
        print(f"  Fold {fold}: MAE=${mae:,.2f}, RMSE=${rmse:,.2f}, R²={r2:.4f}")
    
    # Final train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Train final model
    model.fit(X_train, y_train)
    
    # Predict on test set
    y_pred = model.predict(X_test)
    
    # Metrics
    test_mae = mean_absolute_error(y_test, y_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    test_r2 = r2_score(y_test, y_pred)
    # MAPE (Mean Absolute Percentage Error)
    test_mape = np.mean(np.abs((y_test - y_pred) / (y_test + 1e-8))) * 100  # +1e-8 to avoid division by zero
    
    print(f"\nHoldout test set:")
    print(f"  MAE:  ${test_mae:,.2f}")
    print(f"  RMSE: ${test_rmse:,.2f}")
    print(f"  R²:   {test_r2:.4f}")
    print(f"  MAPE: {test_mape:.2f}%")
    
    # CV summary
    cv_mae_mean = np.mean(cv_scores['mae'])
    cv_mae_std = np.std(cv_scores['mae'])
    cv_rmse_mean = np.mean(cv_scores['rmse'])
    cv_rmse_std = np.std(cv_scores['rmse'])
    cv_r2_mean = np.mean(cv_scores['r2'])
    cv_r2_std = np.std(cv_scores['r2'])
    
    print(f"\nCross-validation summary ({cv_folds} folds):")
    print(f"  MAE:  ${cv_mae_mean:,.2f} ± ${cv_mae_std:,.2f}")
    print(f"  RMSE: ${cv_rmse_mean:,.2f} ± ${cv_rmse_std:,.2f}")
    print(f"  R²:   {cv_r2_mean:.4f} ± {cv_r2_std:.4f}")
    
    metrics = {
        'cv': {
            'mae_mean': float(cv_mae_mean),
            'mae_std': float(cv_mae_std),
            'rmse_mean': float(cv_rmse_mean),
            'rmse_std': float(cv_rmse_std),
            'r2_mean': float(cv_r2_mean),
            'r2_std': float(cv_r2_std),
        },
        'test': {
            'mae': float(test_mae),
            'rmse': float(test_rmse),
            'r2': float(test_r2),
            'mape': float(test_mape),
        }
    }
    
    return metrics


def save_model(model, feature_info, metrics, X_train=None, scaler=None, model_dir='models'):
    """
    Save model and related files
    
    Parameters:
    -----------
    model : trained model
    feature_info : dict
        Feature information
    metrics : dict
        Evaluation metrics
    X_train : pd.DataFrame, optional
        Training features DataFrame (to get exact column order)
    scaler : scaler object, optional
        Scaler if used during training
    model_dir : str or Path
        Model directory
    """
    model_dir = Path(model_dir)
    model_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*80}")
    print("SAVING MODEL")
    print(f"{'='*80}")
    
    # Get actual feature columns used by model (CRITICAL: exact order)
    if X_train is not None and hasattr(X_train, 'columns'):
        actual_feature_cols = list(X_train.columns)
    else:
        actual_feature_cols = feature_info.get('feature_names', [])
    
    # Check scaler info
    has_scaler_used = scaler is not None
    scaler_n_features = None
    if scaler is not None:
        scaler_n_features = getattr(scaler, 'n_features_in_', None)
        if scaler_n_features is None and hasattr(scaler, 'feature_names_in_'):
            scaler_n_features = len(scaler.feature_names_in_)
    
    # Save model
    model_path = model_dir / 'production_model.pkl'
    model_data = {
        'model': model,
        'model_name': feature_info.get('model_name', 'Production Model'),
        'version': '2.0',
        'feature_names': actual_feature_cols,  # Use exact order
        'encoders': feature_info.get('encoders', {}),
        'target_transform': None,  # No log transform for now
        'trained_on': datetime.now().isoformat(),
        'metrics': metrics,
    }
    
    with open(model_path, 'wb') as f:
        pickle.dump(model_data, f)
    print(f"✅ Model saved to {model_path}")
    
    # Save encoders separately (if needed)
    if feature_info.get('encoders'):
        encoders_path = model_dir / 'encoders.pkl'
        with open(encoders_path, 'wb') as f:
            pickle.dump(feature_info['encoders'], f)
        print(f"✅ Encoders saved to {encoders_path}")
    
    # Save scaler separately (only if it exists and was used)
    if scaler is not None:
        scaler_path = model_dir / 'scaler.pkl'
        try:
            with open(scaler_path, 'wb') as f:
                pickle.dump(scaler, f)
            print(f"✅ Scaler saved to {scaler_path} (n_features={scaler_n_features})")
        except Exception as e:
            print(f"⚠️ [WARNING] Failed to save scaler: {e}")
    
    # Save model info JSON (CRITICAL: must match training features exactly)
    info_path = model_dir / 'model_info.json'
    
    info = {
        'model_name': feature_info.get('model_name', 'Production Model'),
        'version': '2.0',
        'trained_on': datetime.now().isoformat(),
        'trained_samples': len(X_train) if X_train is not None and hasattr(X_train, '__len__') else 0,
        'features': actual_feature_cols,  # CRITICAL: exact feature order
        'feature_columns': actual_feature_cols,  # Alias for clarity
        'n_features': len(actual_feature_cols),
        'has_scaler': has_scaler_used,
        'scaler_n_features': scaler_n_features,
        'has_encoders': len(feature_info.get('encoders', {})) > 0,
        'model_type': feature_info.get('model_name', 'CatBoost'),
        'target_transform': None,  # No log transform for now
        'metrics': metrics,
    }
    with open(info_path, 'w') as f:
        json.dump(info, f, indent=2)
    print(f"✅ Model info saved to {info_path}")
    print(f"   Features: {len(actual_feature_cols)}")
    print(f"   Scaler: {'Yes' if has_scaler_used else 'No'} (n_features={scaler_n_features})")
    
    # Post-training self-check: verify bundle consistency
    print(f"\n{'='*80}")
    print("POST-TRAINING SELF-CHECK")
    print(f"{'='*80}")
    try:
        # Reload model
        with open(model_path, 'rb') as f:
            reloaded_data = pickle.load(f)
        reloaded_model = reloaded_data['model']
        reloaded_features = reloaded_data.get('feature_names', [])
        
        # Build one sample row
        if X_train is not None and len(X_train) > 0:
            sample_row = X_train.iloc[0:1]
            
            # Ensure feature order matches
            sample_row_ordered = sample_row[reloaded_features] if hasattr(sample_row, '__getitem__') else sample_row
            
            # Try prediction
            pred = reloaded_model.predict(sample_row_ordered.values if hasattr(sample_row_ordered, 'values') else sample_row_ordered)
            print(f"✅ Self-check passed: Model reloads and predicts successfully")
            print(f"   Sample prediction: ${float(pred[0] if isinstance(pred, np.ndarray) else pred):,.2f}")
        else:
            print(f"⚠️ [WARNING] Cannot perform self-check: X_train not provided")
    except Exception as e:
        print(f"❌ [ERROR] Self-check failed: {e}")
        print(f"   This indicates the model bundle is inconsistent!")
        import traceback
        traceback.print_exc()
        raise RuntimeError(f"Model bundle verification failed: {e}")
    
    # Save performance JSON
    perf_path = model_dir / 'model_performance.json'
    with open(perf_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"✅ Performance metrics saved to {perf_path}")


def main():
    """Main training pipeline"""
    print("=" * 80)
    print("IQCARS MODEL RETRAINING")
    print("=" * 80)
    
    # Check GPU
    gpu_info = get_gpu_info()
    use_gpu = gpu_info['available']
    if use_gpu:
        print(f"✅ GPU detected: {gpu_info.get('name', 'NVIDIA GPU')}")
    else:
        print("⚠️  No GPU detected, using CPU")
    
    # Load data
    data_path = Path('data/iqcars_cleaned.csv')
    if not data_path.exists():
        print(f"\n❌ Error: {data_path} not found!")
        print("Please run the data pipeline first:")
        print("  python core/pipelines/iqcars_pipeline.py")
        return
    
    df = load_cleaned_data(data_path)
    
    # Prepare features
    print("\nPreparing features...")
    X, y, feature_info = prepare_features(df)
    feature_info['X'] = X  # Store for info
    feature_info['model_name'] = 'IQCars Production Model'
    
    print(f"Features: {len(X.columns)}")
    print(f"  Numeric: {len([c for c in X.columns if 'encoded' not in c])}")
    print(f"  Categorical (encoded): {len([c for c in X.columns if 'encoded' in c])}")
    
    # Train model
    model, model_name, training_info = train_model(X, y, use_gpu=use_gpu)
    feature_info['model_name'] = model_name
    
    # Evaluate
    metrics = evaluate_model(model, X, y, cv_folds=5)
    
    # Save (pass X_train and scaler=None since we don't use scaler for CatBoost/LightGBM/XGBoost)
    # Note: CatBoost/LightGBM/XGBoost don't require scaling, so scaler is None
    save_model(model, feature_info, metrics, X_train=X, scaler=None)
    
    # Print GPU verification table
    print("\n" + "=" * 80)
    print("GPU VERIFICATION TABLE")
    print("=" * 80)
    print(f"{'Model':<15} {'Requested':<12} {'ActualUsed':<12} {'MaxGPU%':<10} {'MaxVRAM(MB)':<15} {'TrainTime(s)':<15}")
    print("-" * 80)
    
    gpu_stats = training_info.get('gpu_stats', {})
    max_gpu_util = gpu_stats.get('max_gpu_util', 0.0)
    max_vram_mb = gpu_stats.get('max_vram_mb', 0.0)
    requested = training_info.get('requested_device', 'CPU')
    actual = training_info.get('actual_device', 'CPU')
    train_time = training_info.get('train_time', 0.0)
    
    print(f"{model_name:<15} {requested:<12} {actual:<12} {max_gpu_util:<10.1f} {max_vram_mb:<15.0f} {train_time:<15.2f}")
    print("=" * 80)
    
    print("\n" + "=" * 80)
    print("✅ TRAINING COMPLETE")
    print("=" * 80)
    print(f"\nFinal metrics:")
    print(f"  Test MAE:  ${metrics['test']['mae']:,.2f}")
    print(f"  Test RMSE: ${metrics['test']['rmse']:,.2f}")
    print(f"  Test R²:   {metrics['test']['r2']:.4f}")
    print(f"  Test MAPE: {metrics['test']['mape']:.2f}%")
    print(f"\nModel saved to: models/production_model.pkl")


if __name__ == "__main__":
    main()
