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
from sklearn.model_selection import train_test_split
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
    cb = None
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


class CategoryEncoder:
    """Label-style encoding with rare-category pooling + unknown at inference."""

    __slots__ = ("class_to_idx", "other_token", "_min_freq", "col_name")

    def __init__(self, column_name="", min_frequency=8, other_token="__OTHER__"):
        self.col_name = column_name
        self._min_freq = min_frequency
        self.other_token = str(other_token)
        self.class_to_idx = {}

    def fit(self, series: pd.Series):
        pooled = pool_rare_categories(series.astype(str), self._min_freq, self.other_token)
        classes = sorted(pooled.unique().tolist())
        self.class_to_idx = {c: i for i, c in enumerate(classes)}
        # Ensure OTHER bucket exists — rare tail maps here at inference
        if self.other_token not in self.class_to_idx:
            self.class_to_idx[self.other_token] = len(self.class_to_idx)
        return self

    def transform(self, series: pd.Series) -> np.ndarray:
        if not self.class_to_idx:
            raise RuntimeError(f"Encoder not fitted: {self.col_name}")

        other_idx = self.class_to_idx[self.other_token]

        def encode_one(v):
            s = normalize_category_str(v)
            return self.class_to_idx.get(s, other_idx)

        return series.map(encode_one).astype(np.int32).values

    @property
    def classes_(self):
        """Sklearn-compat: ordered class names."""
        return np.array(sorted(self.class_to_idx.keys(), key=lambda k: self.class_to_idx[k]))


def normalize_category_str(v) -> str:
    if pd.isna(v):
        return "Unknown"
    s = str(v).strip()
    if s.lower() in ("", "nan", "none"):
        return "Unknown"
    return " ".join(s.split())


def normalize_trim_str(v) -> str:
    if pd.isna(v):
        return "Standard"
    s = str(v).strip()
    if s.lower() in ("", "nan", "none"):
        return "Standard"
    return s.title()


def pool_rare_categories(series: pd.Series, min_frequency: int, other_label: str) -> pd.Series:
    vc = series.value_counts(dropna=False)
    rare_mask = vc < min_frequency
    rare_vals = set(vc[rare_mask].index.astype(str))
    if not rare_vals:
        return series
    pooled = series.astype(str).where(~series.astype(str).isin(rare_vals), other_label)
    return pooled


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
    df = df.copy()

    CURRENT_YEAR = 2026

    # --- Target & obvious bad rows ---
    df['price'] = pd.to_numeric(df['price'], errors='coerce')
    pq = df['price'].astype(float).clip(lower=0)
    pq_lo, pq_hi = pq.quantile(0.005), pq.quantile(0.997)
    sane = pq.between(max(350, pq_lo), min(800_000, pq_hi)) & pq.notna()
    before_n = len(df)
    df = df.loc[sane].reset_index(drop=True)
    print(f"[OK] Price filter: kept {len(df):,}/{before_n:,} rows (reasonable range)")
    if len(df) < 250:
        raise RuntimeError("Too few rows after price filtering — check dataset.")

    # age_of_car consistent with prediction code
    if 'age_of_car' not in df.columns and 'year' in df.columns:
        yr = pd.to_numeric(df['year'], errors='coerce').fillna(CURRENT_YEAR - 5).astype(int).clip(lower=1950)
        df['age_of_car'] = np.maximum(0, CURRENT_YEAR - yr)
    elif 'age_of_car' not in df.columns:
        df['age_of_car'] = 5.0
    
    # Target variable
    y = df['price'].astype(float)

    feature_cols = []
    categorical_cols = []
    numeric_cols = []
    freq_min_cat = {}

    # Required features
    if 'make' in df.columns:
        feature_cols.append('make')
        categorical_cols.append('make')
        freq_min_cat['make'] = 30
    if 'model' in df.columns:
        feature_cols.append('model')
        categorical_cols.append('model')
        freq_min_cat['model'] = 12
    if 'trim' in df.columns:
        feature_cols.append('trim')
        categorical_cols.append('trim')
        freq_min_cat['trim'] = 4
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
        freq_min_cat['condition'] = 12
    if 'fuel_type' in df.columns:
        feature_cols.append('fuel_type')
        categorical_cols.append('fuel_type')
        freq_min_cat['fuel_type'] = 8
    if 'location' in df.columns:
        feature_cols.append('location')
        categorical_cols.append('location')
        freq_min_cat['location'] = 15
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
            if col == 'trim':
                X[col] = X[col].apply(normalize_trim_str)
            else:
                X[col] = X[col].fillna('Unknown').astype(str).apply(normalize_category_str)

    # Engineered numeric (helps tree splits across trims/makes)
    if 'mileage' in X.columns and 'age_of_car' in X.columns:
        eps = 1.0
        X['mileage_per_year'] = (
            pd.to_numeric(X['mileage'], errors='coerce').fillna(50000).astype(float)
            / (pd.to_numeric(X['age_of_car'], errors='coerce').fillna(5).astype(float) + eps)
        ).clip(0.0, 125000.0)
        numeric_cols.append('mileage_per_year')

    # Interaction (same scale as root model_training / predict pipeline)
    if 'year' in X.columns and 'mileage' in X.columns:
        X['year_mileage_interaction'] = (
            pd.to_numeric(X['year'], errors='coerce').fillna(2015)
            * pd.to_numeric(X['mileage'], errors='coerce').fillna(50000) / 1000.0
        )
        numeric_cols.append('year_mileage_interaction')
    if 'engine_size' in X.columns and 'cylinders' in X.columns:
        X['engine_cylinders_interaction'] = (
            pd.to_numeric(X['engine_size'], errors='coerce').fillna(2.0)
            * pd.to_numeric(X['cylinders'], errors='coerce').fillna(4.0)
        )
        numeric_cols.append('engine_cylinders_interaction')

    # Encoders: rare-category pooling + stable unknown handling
    encoders = {}
    for col in categorical_cols:
        if col not in X.columns:
            continue
        min_f = int(freq_min_cat.get(col, 10))
        enc = CategoryEncoder(column_name=col, min_frequency=min_f, other_token="__OTHER__")
        enc.fit(X[col])
        X[col + '_encoded'] = enc.transform(X[col])
        encoders[col] = enc

    # Drop original categorical columns (keep encoded versions)
    X = X.drop(columns=categorical_cols)

    # Auxiliary columns for downstream diagnostics / grouping (aligned with X)
    aux_series = {'make': None, 'trim': None}
    if 'make' in df.columns:
        aux_series['make'] = df['make'].astype(str).reset_index(drop=True).copy()
    if 'trim' in df.columns:
        aux_series['trim'] = df['trim'].astype(str).reset_index(drop=True).copy()

    # Feature info
    feature_info = {
        'feature_names': list(X.columns),
        'categorical_cols': categorical_cols,
        'numeric_cols': numeric_cols,
        'encoders': encoders,
    }
    
    return X, y, feature_info, aux_series


def _predict_price_space(pred_raw: np.ndarray, trained_with_log_target: bool) -> np.ndarray:
    raw = np.asarray(pred_raw, dtype=np.float64)
    if trained_with_log_target:
        return np.maximum(np.expm1(raw), 1.0)
    return raw


def evaluate_holdout(model, X_test, y_true_price: np.ndarray, aux_make: pd.Series = None,
                     trained_with_log_target: bool = True):
    """Report metrics on dollars; inverse log1p when the model learnt log(price)."""

    preds = _predict_price_space(model.predict(X_test), trained_with_log_target)
    yv = np.asarray(y_true_price, dtype=np.float64)

    test_mae = mean_absolute_error(yv, preds)
    test_rmse = np.sqrt(mean_squared_error(yv, preds))
    test_r2 = r2_score(yv, preds)
    denom = np.maximum(np.abs(yv), 500.0)
    test_mape = float(np.mean(np.abs(yv - preds) / denom) * 100)

    print(f"\n{'=' * 80}")
    print("HOLDOUT EVALUATION (original price units)")
    print(f"{'=' * 80}")
    print(f"  MAE:  ${test_mae:,.2f}")
    print(f"  RMSE: ${test_rmse:,.2f}")
    print(f"  R²:   {test_r2:.4f}")
    print(f"  MAPE: {test_mape:.2f}% (denom=max(|actual|,500))")

    per_make_summary = []
    if aux_make is not None and hasattr(aux_make, 'iloc'):
        err_pct = np.abs(yv - preds) / denom
        grp = pd.DataFrame({'make': aux_make.iloc[:len(yv)].astype(str).values, 'pct': err_pct})
        gm = grp.groupby('make').agg(samples=('pct', 'count'), median_abs_pct_err=('pct', 'median'))
        gm = gm[gm['samples'] >= 25].sort_values('median_abs_pct_err', ascending=False).head(20)
        per_make_summary = [{'make': ix, **row.to_dict()} for ix, row in gm.iterrows()]
        if per_make_summary:
            print("\n  Top ambiguous makes by median %-error (needs more data coverage):")
            for row in per_make_summary[:10]:
                print(f"    {row['make']}: median err {row['median_abs_pct_err']*100:.1f}% (n≥{row['samples']})")

    return {
        'test': {
            'mae': float(test_mae),
            'rmse': float(test_rmse),
            'r2': float(test_r2),
            'r2_score': float(test_r2),
            'mape': float(test_mape),
        },
        'per_make_diag': per_make_summary,
    }


def _encoded_column_indices(df: pd.DataFrame):
    """Column positions for *_encoded — CatBoost should treat high-cardinality as categorical."""

    return [i for i, col in enumerate(df.columns) if str(col).endswith('_encoded')]


def new_catboost_regressor(X_df: pd.DataFrame, task_type: str):
    """Stronger defaults (depth, stochasticity, L2) to reduce wild low/high outliers."""
    if cb is None:
        raise RuntimeError("CatBoost is not installed")
    cat_idx = _encoded_column_indices(X_df)
    gpu = task_type.upper() == 'GPU'
    kwargs = dict(
        iterations=2800,
        learning_rate=0.032,
        depth=10,
        l2_leaf_reg=8,
        min_data_in_leaf=15,
        random_strength=1.5,
        bagging_temperature=0.18,
        border_count=184,
        subsample=0.88,
        bootstrap_type='Bernoulli',
        loss_function='RMSE',
        random_seed=42,
        verbose=250,
        cat_features=cat_idx if cat_idx else None,
        task_type='GPU' if gpu else 'CPU',
    )
    if gpu:
        kwargs['devices'] = '0'
    return cb.CatBoostRegressor(**kwargs)


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
                    
                    model = new_catboost_regressor(X, 'GPU')
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
                    model = new_catboost_regressor(X, 'CPU')
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
                model = new_catboost_regressor(X, 'CPU')
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


def save_model(model, feature_info, metrics, X_train=None, scaler=None, model_dir='models',
               target_transform='log1p', transform_offset=1.0):
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
    target_transform : str
        'log1p' when y was trained as log1p(price); predict pipeline will expm1().
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
        'version': '2.1',
        'feature_names': actual_feature_cols,  # Use exact order
        'encoders': feature_info.get('encoders', {}),
        'target_transform': target_transform,
        'transform_offset': float(transform_offset),
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
        'version': '2.1',
        'trained_on': datetime.now().isoformat(),
        'trained_samples': len(X_train) if X_train is not None and hasattr(X_train, '__len__') else 0,
        'features': actual_feature_cols,  # CRITICAL: exact feature order
        'feature_columns': actual_feature_cols,  # Alias for clarity
        'n_features': len(actual_feature_cols),
        'has_scaler': has_scaler_used,
        'scaler_n_features': scaler_n_features,
        'has_encoders': len(feature_info.get('encoders', {})) > 0,
        'model_type': feature_info.get('model_name', 'CatBoost'),
        'target_transform': target_transform,
        'metrics': metrics,
    }
    with open(info_path, 'w', encoding='utf-8') as f:
        json.dump(info, f, indent=2, default=str)
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
            pred_raw = reloaded_model.predict(sample_row_ordered.values if hasattr(sample_row_ordered, 'values') else sample_row_ordered)
            if isinstance(pred_raw, np.ndarray):
                pred_scalar = float(pred_raw.ravel()[0])
            else:
                pred_scalar = float(pred_raw)
            if target_transform == 'log1p':
                pred_show = float(np.expm1(pred_scalar))
            else:
                pred_show = pred_scalar
            print(f"✅ Self-check passed: Model reloads and predicts successfully")
            print(f"   Sample prediction: ${pred_show:,.2f}")
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
    with open(perf_path, 'w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=2, default=str)
    print(f"✅ Performance metrics saved to {perf_path}")


def main():
    """Main training pipeline — holdout metrics, then full-data fit for deployment."""
    print("=" * 80)
    print("IQCARS MODEL RETRAINING")
    print("=" * 80)

    gpu_info = get_gpu_info()
    use_gpu = gpu_info['available']
    if use_gpu:
        print(f"✅ GPU detected: {gpu_info.get('name', 'NVIDIA GPU')}")
    else:
        print("⚠️  No GPU detected, using CPU")

    data_path = Path('data/iqcars_cleaned.csv')
    if not data_path.exists():
        print(f"\n❌ Error: {data_path} not found!")
        print("Please run the data pipeline first:")
        print("  python core/pipelines/iqcars_pipeline.py")
        return

    df = load_cleaned_data(data_path)

    print("\nPreparing features...")
    X, y, feature_info, aux = prepare_features(df)
    feature_info['X'] = X
    feature_info['model_name'] = 'IQCars Production Model'

    print(f"Features: {len(X.columns)}")
    print(f"  Numeric: {len([c for c in X.columns if 'encoded' not in c])}")
    print(f"  Categorical (encoded): {len([c for c in X.columns if 'encoded' in c])}")

    # Stratified holdout on price rank (reduces train/test distribution shift)
    rank = pd.Series(y.values).rank(method='first')
    n_bins = min(40, max(5, len(y) // 200))
    strata = pd.qcut(rank, q=n_bins, duplicates='drop', labels=False)
    idx_all = np.arange(len(X))
    try:
        idx_tr, idx_te = train_test_split(
            idx_all, test_size=0.2, random_state=42, stratify=strata.astype(int)
        )
    except ValueError:
        idx_tr, idx_te = train_test_split(idx_all, test_size=0.2, random_state=42)

    X_train, X_test = X.iloc[idx_tr], X.iloc[idx_te]
    y_train_orig = y.iloc[idx_tr].astype(float)
    y_test_orig = y.iloc[idx_te].astype(float)
    make_test = aux['make'].iloc[idx_te] if aux.get('make') is not None else None

    y_train_log = np.log1p(y_train_orig.clip(lower=0.0))

    print("\n--- Diagnostic fit (train subset) ---")
    model_probe, model_name, training_info = train_model(X_train, pd.Series(y_train_log), use_gpu=use_gpu)
    feature_info['model_name'] = model_name

    metrics_pack = evaluate_holdout(
        model_probe, X_test, y_test_orig.values, aux_make=make_test, trained_with_log_target=True
    )

    print("\n--- Production fit (full data, log1p target) ---")
    y_full_log = np.log1p(y.astype(float).clip(lower=0.0))
    model_final, _, training_info_final = train_model(X, pd.Series(y_full_log.values), use_gpu=use_gpu)

    save_model(
        model_final,
        feature_info,
        metrics_pack,
        X_train=X,
        scaler=None,
        target_transform='log1p',
        transform_offset=1.0,
    )

    print("\n" + "=" * 80)
    print("GPU VERIFICATION TABLE")
    print("=" * 80)
    print(f"{'Model':<15} {'Requested':<12} {'ActualUsed':<12} {'MaxGPU%':<10} {'MaxVRAM(MB)':<15} {'TrainTime(s)':<15}")
    print("-" * 80)

    gs = training_info_final.get('gpu_stats', {})
    print(
        f"{model_name:<15} {training_info_final.get('requested_device', 'CPU'):<12} "
        f"{training_info_final.get('actual_device', 'CPU'):<12} "
        f"{gs.get('max_gpu_util', 0.0):<10.1f} {gs.get('max_vram_mb', 0.0):<15.0f} "
        f"{training_info_final.get('train_time', 0.0):<15.2f}"
    )
    print("=" * 80)

    print("\n" + "=" * 80)
    print("✅ TRAINING COMPLETE")
    print("=" * 80)
    print("\nFinal holdout metrics (subset):")
    t = metrics_pack['test']
    print(f"  Test MAE:  ${t['mae']:,.2f}")
    print(f"  Test RMSE: ${t['rmse']:,.2f}")
    print(f"  Test R²:   {t['r2']:.4f}")
    print(f"  Test MAPE: {t['mape']:.2f}%")
    print(f"\nModel saved to: models/production_model.pkl (trained on full data, log1p price)")


if __name__ == "__main__":
    main()
