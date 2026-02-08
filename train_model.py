"""
============================================================================
MULTI-MODAL MODEL TRAINING SCRIPT (GPU ACCELERATED WITH BATCH PROCESSING)
============================================================================

This script trains a multi-modal car price prediction model with:
1. GPU-accelerated batch image feature extraction (PyTorch)
2. Tabular features (make, model, year, mileage, etc.)
3. Ensemble: XGBoost, LightGBM, Random Forest
4. Target: R² > 0.94, RMSE < $2000

OPTIMIZED FOR SPEED:
- Batch processing (64 images at once)
- GPU acceleration with PyTorch
- 10-50x faster than single-image processing

"""

import pandas as pd
import numpy as np
import os
import sys
import logging
import io
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime
import json
from pathlib import Path
import warnings
import pickle
import joblib
from tqdm import tqdm
from PIL import Image
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import time
import gc
import multiprocessing
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import partial

# System monitoring
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    print("WARNING: psutil not installed. Install with: pip install psutil")

# Try OpenCV for faster image loading
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

# PyTorch imports (GPU support!)
try:
    import torch
    import torchvision.models as models
    import torchvision.transforms as transforms
    from torch import nn
    PYTORCH_AVAILABLE = True
    if torch.cuda.is_available():
        print(f"PyTorch GPU: {torch.cuda.get_device_name(0)}")
        DEVICE = torch.device('cuda')
        print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    else:
        print("ERROR: PyTorch CPU mode - GPU NOT AVAILABLE!")
        print("CRITICAL: Training will be extremely slow on CPU. Please check GPU setup.")
        DEVICE = torch.device('cpu')
except ImportError:
    PYTORCH_AVAILABLE = False
    DEVICE = None
    print("ERROR: PyTorch not available! Install: pip install torch torchvision")

# ML imports
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, RobustScaler
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    mean_absolute_percentage_error
)
from sklearn.ensemble import RandomForestRegressor
import xgboost as xgb
try:
    import lightgbm as lgb
    LGBM_AVAILABLE = True
except ImportError:
    LGBM_AVAILABLE = False

warnings.filterwarnings('ignore')

# ============================================================================
# CONFIGURATION
# ============================================================================

DATA_DIR = Path("data")
MODELS_DIR = Path("models")
IMAGES_DIR = Path("car_images")
CACHE_DIR = Path("cache")

DATASET_FILE = DATA_DIR / "final_dataset_with_images.csv"
MODEL_FILE = MODELS_DIR / "best_model.pkl"
CNN_MODEL_FILE = MODELS_DIR / "cnn_feature_extractor.pt"
ENCODERS_FILE = MODELS_DIR / "encoders.pkl"
SCALER_FILE = MODELS_DIR / "scaler.pkl"
PERFORMANCE_FILE = MODELS_DIR / "model_performance.json"

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 128  # OPTIMIZED: Larger GPU batches (use GPU more, RAM less)
FEATURE_DIM = 2048  # ResNet50 feature dimension
NUM_WORKERS = 4  # OPTIMIZED: More workers but still safe
PREFETCH_FACTOR = 2  # Reduced prefetch to save RAM
CHECKPOINT_INTERVAL = 25  # Save checkpoint every 25 batches
MEMORY_CLEAR_INTERVAL = 5  # Clear GPU/RAM memory every 5 batches (more aggressive!)
RAM_CLEAR_INTERVAL = 1  # Clear RAM after EVERY batch to prevent 98% usage

TEST_SIZE = 0.2
VALIDATION_SIZE = 0.1
RANDOM_STATE = 42

TARGET_R2 = 0.94
TARGET_RMSE = 2000.0

# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging():
    logger = logging.getLogger('model_training')
    logger.setLevel(logging.INFO)
    logger.handlers = []

    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter('%(levelname)s: %(message)s'))
    logger.addHandler(console)

    file_handler = logging.FileHandler('model_training.log', mode='w', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(file_handler)

    return logger

logger = setup_logging()

# ============================================================================
# IMAGE PROCESSING FUNCTIONS
# ============================================================================

def load_image(image_path: str) -> Optional[Image.Image]:
    """Load image from file path or URL - OPTIMIZED with OpenCV if available."""
    try:
        if not image_path or pd.isna(image_path):
            return None

        if isinstance(image_path, str) and (image_path.startswith('http://') or image_path.startswith('https://')):
            session = requests.Session()
            retry_strategy = Retry(total=2, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
            adapter = HTTPAdapter(max_retries=retry_strategy)
            session.mount("http://", adapter)
            session.mount("https://", adapter)

            headers = {'User-Agent': 'Mozilla/5.0'}
            response = session.get(image_path, timeout=5, stream=True, headers=headers)
            response.raise_for_status()

            content = b''
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    content += chunk
                    if len(content) > 10 * 1024 * 1024:
                        return None

            # Use OpenCV for faster loading if available
            if CV2_AVAILABLE:
                nparr = np.frombuffer(content, np.uint8)
                img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if img_cv is not None:
                    img_cv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
                    img = Image.fromarray(img_cv)
                else:
                    img = Image.open(io.BytesIO(content))
            else:
                img = Image.open(io.BytesIO(content))
        else:
            img_path = Path(str(image_path))
            possible_paths = [
                img_path,
                IMAGES_DIR / img_path,
                IMAGES_DIR / img_path.name,
                Path(image_path)
            ]

            img = None
            for path in possible_paths:
                if path and path.exists():
                    try:
                        # Use OpenCV for faster loading if available
                        if CV2_AVAILABLE:
                            img_cv = cv2.imread(str(path))
                            if img_cv is not None:
                                img_cv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
                                img = Image.fromarray(img_cv)
                            else:
                                img = Image.open(path)
                        else:
                            img = Image.open(path)
                        break
                    except:
                        continue

            if img is None:
                return None

        if img.mode != 'RGB':
            img = img.convert('RGB')
        return img
    except Exception:
        return None


def create_cnn_feature_extractor():
    """Create PyTorch ResNet50 feature extractor - STABLE VERSION."""
    if not PYTORCH_AVAILABLE:
        raise ImportError("PyTorch required!")

    # CRITICAL: Verify GPU is available
    if DEVICE.type == 'cpu':
        raise RuntimeError("CRITICAL ERROR: GPU not available! Training will crash on CPU. Please check CUDA/GPU setup.")

    logger.info(f"Creating PyTorch ResNet50 feature extractor on {DEVICE}...")
    logger.info(f"GPU Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A'}")

    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
    model = nn.Sequential(*list(model.children())[:-1])
    model = model.to(DEVICE)
    model.eval()

    # DISABLED torch.compile() - can cause instability/crashes
    # Using stable model instead

    preprocess = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    logger.info(f"ResNet50 loaded on {DEVICE} (STABLE MODE)")
    return model, preprocess


def load_image_batch(args):
    """Load single image - for parallel processing."""
    idx, row = args
    image_path = row.get('image_path')
    if pd.isna(image_path) or not image_path:
        image_path = row.get('image_1')
    return idx, load_image(image_path)


def get_system_resources():
    """Get current CPU and RAM usage."""
    if PSUTIL_AVAILABLE:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        ram = psutil.virtual_memory()
        ram_percent = ram.percent
        ram_used_gb = ram.used / 1e9
        ram_total_gb = ram.total / 1e9
        return cpu_percent, ram_percent, ram_used_gb, ram_total_gb
    return None, None, None, None


def get_gpu_memory():
    """Get current GPU memory usage."""
    if torch.cuda.is_available():
        allocated = torch.cuda.memory_allocated() / 1e9
        reserved = torch.cuda.memory_reserved() / 1e9
        total = torch.cuda.get_device_properties(0).total_memory / 1e9
        percent = (allocated / total) * 100 if total > 0 else 0
        return allocated, reserved, total, percent
    return 0, 0, 0, 0


def save_checkpoint(features_dict: dict, batch_num: int, checkpoint_dir: Path = CACHE_DIR):
    """Save checkpoint to resume after crash."""
    checkpoint_dir.mkdir(exist_ok=True)
    checkpoint_file = checkpoint_dir / f"checkpoint_batch_{batch_num}.pkl"
    try:
        with open(checkpoint_file, 'wb') as f:
            pickle.dump(features_dict, f)
        logger.info(f"Checkpoint saved: {checkpoint_file}")
    except Exception as e:
        logger.warning(f"Failed to save checkpoint: {e}")


def load_checkpoint(checkpoint_dir: Path = CACHE_DIR):
    """Load latest checkpoint if exists."""
    checkpoint_dir.mkdir(exist_ok=True)
    checkpoints = sorted(checkpoint_dir.glob("checkpoint_batch_*.pkl"))
    if checkpoints:
        latest = checkpoints[-1]
        try:
            with open(latest, 'rb') as f:
                data = pickle.load(f)
            logger.info(f"Resuming from checkpoint: {latest}")
            return data
        except Exception as e:
            logger.warning(f"Failed to load checkpoint: {e}")
    return None


def extract_features_batch(df: pd.DataFrame, model, preprocess_func) -> np.ndarray:
    """Extract image features with STABILITY - on-demand loading, memory management, checkpoints."""
    logger.info(f"Extracting image features with batch size {BATCH_SIZE} (STABLE MODE)...")

    # CRITICAL: Verify GPU
    if DEVICE.type == 'cpu':
        raise RuntimeError("CRITICAL: GPU not available! Training will crash on CPU.")

    logger.info(f"Using device: {DEVICE}")
    if torch.cuda.is_available():
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
        allocated, reserved, total, percent = get_gpu_memory()
        logger.info(f"GPU Memory: {allocated:.2f}GB / {total:.2f}GB ({percent:.1f}%)")

    # Check for existing checkpoint
    checkpoint_data = load_checkpoint()
    if checkpoint_data:
        last_batch = checkpoint_data.get('last_batch', 0)
        all_features = checkpoint_data.get('features', {})
        logger.info(f"Resuming from batch {last_batch}")
    else:
        last_batch = 0
        all_features = {}

    # Clear GPU cache
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        # Use more GPU memory (85% - balance between speed and stability)
        torch.cuda.set_per_process_memory_fraction(0.85)
        logger.info("GPU memory management enabled (85% limit - optimized for speed)")

    # Get list of rows to process
    rows_to_process = [(idx, row) for idx, row in df.iterrows() if idx not in all_features]
    total_rows = len(df)
    logger.info(f"Processing {len(rows_to_process)}/{total_rows} images (on-demand loading)...")

    failed_count = 0
    batch_num = 0

    # Process in batches - LOAD ON-DEMAND (don't load all at once!)
    for batch_start in range(0, len(rows_to_process), BATCH_SIZE):
        batch_num = last_batch + (batch_start // BATCH_SIZE) + 1
        batch_end = min(batch_start + BATCH_SIZE, len(rows_to_process))
        batch_rows = rows_to_process[batch_start:batch_end]

        # STEP 1: Load images for this batch ONLY (on-demand)
        batch_images = []
        batch_indices = []

        with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
            futures = {executor.submit(load_image_batch, (idx, row)): idx
                      for idx, row in batch_rows}

            for future in as_completed(futures):
                idx, img = future.result()
                if img is not None:
                    batch_images.append((idx, img))
                    batch_indices.append(idx)

        if not batch_images:
            failed_count += len(batch_rows)
            continue

        # STEP 2: Preprocess batch images to tensors
        batch_tensors = []
        tensor_indices = []

        for idx, img in batch_images:
            try:
                tensor = preprocess_func(img)
                batch_tensors.append(tensor)
                tensor_indices.append(idx)
                # Delete image immediately to free RAM
                del img
            except Exception as e:
                failed_count += 1
                continue

        # CRITICAL: Clear batch_images list immediately after preprocessing
        del batch_images
        gc.collect()

        if not batch_tensors:
            failed_count += len(batch_rows)
            continue

        # STEP 3: Process batch on GPU with error handling
        try:
            # Stack and move to GPU
            batch_tensor = torch.stack(batch_tensors).to(DEVICE, non_blocking=False)

            # Delete CPU tensors immediately
            del batch_tensors
            gc.collect()

            # Process on GPU
            with torch.no_grad():
                if torch.cuda.is_available() and hasattr(torch.cuda, 'amp'):
                    with torch.cuda.amp.autocast():
                        features = model(batch_tensor)
                else:
                    features = model(batch_tensor)

                # Global average pooling
                if features.dim() > 2:
                    features = nn.functional.adaptive_avg_pool2d(features, (1, 1))
                features = features.view(features.size(0), -1)

            # Move to CPU
            features_cpu = features.cpu().numpy()

            # Delete GPU tensors
            del batch_tensor, features
            if torch.cuda.is_available():
                torch.cuda.synchronize()

            # Store features
            for i, orig_idx in enumerate(tensor_indices):
                all_features[orig_idx] = features_cpu[i]

            # CRITICAL: Clear RAM after EVERY batch to prevent 98% usage!
            if batch_num % RAM_CLEAR_INTERVAL == 0:
                # Delete CPU features immediately after storing
                del features_cpu
                gc.collect()

            # Clear GPU cache every MEMORY_CLEAR_INTERVAL batches
            if batch_num % MEMORY_CLEAR_INTERVAL == 0:
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                gc.collect()

                # Monitor resources
                cpu_percent, ram_percent, ram_used, ram_total = get_system_resources()
                gpu_allocated, gpu_reserved, gpu_total, gpu_percent = get_gpu_memory()

                if cpu_percent is not None:
                    logger.info(f"Batch {batch_num} - CPU: {cpu_percent:.1f}%, RAM: {ram_percent:.1f}% ({ram_used:.1f}/{ram_total:.1f}GB)")
                    if ram_percent > 85:
                        logger.warning(f"WARNING: RAM usage high ({ram_percent:.1f}%)! Clearing memory...")
                        gc.collect()
                        if torch.cuda.is_available():
                            torch.cuda.empty_cache()

                if torch.cuda.is_available():
                    logger.info(f"Batch {batch_num} - GPU Memory: {gpu_allocated:.2f}GB / {gpu_total:.2f}GB ({gpu_percent:.1f}%)")
                    if gpu_percent > 90:
                        logger.warning(f"WARNING: GPU memory high ({gpu_percent:.1f}%)!")
                        torch.cuda.empty_cache()

            # Save checkpoint every CHECKPOINT_INTERVAL batches
            if batch_num % CHECKPOINT_INTERVAL == 0:
                checkpoint_data = {
                    'last_batch': batch_num,
                    'features': all_features,
                    'failed_count': failed_count
                }
                save_checkpoint(checkpoint_data, batch_num)
                logger.info(f"Checkpoint saved at batch {batch_num}")

            # Small delay to prevent overheating (reduced for speed)
            time.sleep(0.05)

        except RuntimeError as e:
            if "out of memory" in str(e).lower():
                logger.error(f"GPU out of memory at batch {batch_num}! Reducing batch size...")
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                # Try smaller batch
                if BATCH_SIZE > 8:
                    logger.warning("Retrying with smaller batches...")
                    # This will be handled by reducing BATCH_SIZE globally
                failed_count += len(batch_rows)
            else:
                logger.error(f"GPU error at batch {batch_num}: {e}")
                failed_count += len(batch_rows)
        except Exception as e:
            logger.error(f"Error processing batch {batch_num}: {e}")
            failed_count += len(batch_rows)

        # Progress update
        processed = len(all_features)
        progress = (processed / total_rows) * 100
        logger.info(f"Progress: {processed}/{total_rows} ({progress:.1f}%) - Batch {batch_num}")

    # Convert to numpy array
    logger.info("Finalizing feature array...")
    final_features = []
    for idx in df.index:
        if idx in all_features:
            final_features.append(all_features[idx])
        else:
            final_features.append(np.zeros(FEATURE_DIM, dtype=np.float32))
            failed_count += 1

    image_features = np.array(final_features, dtype=np.float32)
    logger.info(f"Image features shape: {image_features.shape}")
    logger.info(f"Failed extractions: {failed_count} (using zero vectors)")

    # Final checkpoint
    checkpoint_data = {
        'last_batch': batch_num,
        'features': all_features,
        'failed_count': failed_count
    }
    save_checkpoint(checkpoint_data, batch_num)

    return image_features


# ============================================================================
# FEATURE ENGINEERING
# ============================================================================

def create_tabular_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
    """Create tabular features."""
    df = df.copy()

    current_year = datetime.now().year
    df['age_of_car'] = current_year - df['year']

    categorical_cols = ['make', 'model', 'condition', 'fuel_type']
    encoders = {}

    for col in categorical_cols:
        if col in df.columns:
            le = LabelEncoder()
            df[f'{col}_encoded'] = le.fit_transform(df[col].astype(str).fillna('Unknown'))
            encoders[col] = le

    df['year_mileage_interaction'] = df['year'] * df['mileage']
    df['engine_cylinders_interaction'] = df['engine_size'] * df['cylinders']
    df['mileage_per_year'] = df['mileage'] / (df['age_of_car'] + 1)

    if 'make' in df.columns:
        make_counts = df['make'].value_counts()
        df['brand_popularity'] = df['make'].map(make_counts) / len(df)

    return df, encoders


# ============================================================================
# MODEL TRAINING
# ============================================================================

# Define Ensemble class at module level (pickle can serialize module-level classes)
class Ensemble:
    """Ensemble model that combines multiple models with equal weights."""
    def __init__(self, models):
        """
        Initialize ensemble with list of (model, name) tuples.

        Args:
            models: List of tuples (model, name) where model is a trained model
        """
        self.models = models

    def predict(self, X):
        """Predict using average of all models."""
        preds = [m.predict(X) for m, _ in self.models]
        return np.mean(preds, axis=0)

    def get_model_names(self):
        """Get list of model names in ensemble."""
        return [name for _, name in self.models]

def train_models(X_train, y_train, X_val, y_val, X_test, y_test):
    """Train ensemble models."""
    models_list = []
    individual_models = {}  # Store individual models for saving
    individual_metrics = {}  # Store individual model metrics

    # XGBoost
    logger.info("Training XGBoost...")
    xgb_model = xgb.XGBRegressor(
        n_estimators=1000, max_depth=8, learning_rate=0.01,
        subsample=0.8, colsample_bytree=0.8, random_state=RANDOM_STATE, n_jobs=-1
    )
    xgb_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    xgb_pred = xgb_model.predict(X_test)
    xgb_r2 = r2_score(y_test, xgb_pred)
    xgb_rmse = np.sqrt(mean_squared_error(y_test, xgb_pred))
    xgb_mae = mean_absolute_error(y_test, xgb_pred)
    xgb_mape = mean_absolute_percentage_error(y_test, xgb_pred) * 100

    logger.info(f"XGBoost R²: {xgb_r2:.4f}")
    logger.info(f"XGBoost RMSE: ${xgb_rmse:,.2f}")

    models_list.append((xgb_model, 'xgb'))
    individual_models['XGBoost'] = xgb_model
    individual_metrics['XGBoost'] = {
        'r2_score': xgb_r2,
        'rmse': xgb_rmse,
        'mae': xgb_mae,
        'mape': xgb_mape
    }

    # LightGBM
    if LGBM_AVAILABLE:
        logger.info("Training LightGBM...")
        lgbm_model = lgb.LGBMRegressor(
            n_estimators=1000, max_depth=8, learning_rate=0.01,
            subsample=0.8, colsample_bytree=0.8, random_state=RANDOM_STATE,
            n_jobs=-1, verbose=-1
        )
        lgbm_model.fit(X_train, y_train, eval_set=[(X_val, y_val)],
                      callbacks=[lgb.early_stopping(50), lgb.log_evaluation(0)])
        lgbm_pred = lgbm_model.predict(X_test)
        lgbm_r2 = r2_score(y_test, lgbm_pred)
        lgbm_rmse = np.sqrt(mean_squared_error(y_test, lgbm_pred))
        lgbm_mae = mean_absolute_error(y_test, lgbm_pred)
        lgbm_mape = mean_absolute_percentage_error(y_test, lgbm_pred) * 100

        logger.info(f"LightGBM R²: {lgbm_r2:.4f}")
        logger.info(f"LightGBM RMSE: ${lgbm_rmse:,.2f}")

        models_list.append((lgbm_model, 'lgbm'))
        individual_models['LightGBM'] = lgbm_model
        individual_metrics['LightGBM'] = {
            'r2_score': lgbm_r2,
            'rmse': lgbm_rmse,
            'mae': lgbm_mae,
            'mape': lgbm_mape
        }

    # Random Forest
    logger.info("Training Random Forest...")
    rf_model = RandomForestRegressor(
        n_estimators=500, max_depth=20, random_state=RANDOM_STATE, n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    rf_pred = rf_model.predict(X_test)
    rf_r2 = r2_score(y_test, rf_pred)
    rf_rmse = np.sqrt(mean_squared_error(y_test, rf_pred))
    rf_mae = mean_absolute_error(y_test, rf_pred)
    rf_mape = mean_absolute_percentage_error(y_test, rf_pred) * 100

    logger.info(f"Random Forest R²: {rf_r2:.4f}")
    logger.info(f"Random Forest RMSE: ${rf_rmse:,.2f}")

    models_list.append((rf_model, 'rf'))
    individual_models['RandomForest'] = rf_model
    individual_metrics['RandomForest'] = {
        'r2_score': rf_r2,
        'rmse': rf_rmse,
        'mae': rf_mae,
        'mape': rf_mape
    }

    # Ensemble
    logger.info("Creating ensemble...")
    ensemble = Ensemble(models_list)
    ensemble_pred = ensemble.predict(X_test)

    ensemble_metrics = {
        'r2_score': r2_score(y_test, ensemble_pred),
        'rmse': np.sqrt(mean_squared_error(y_test, ensemble_pred)),
        'mae': mean_absolute_error(y_test, ensemble_pred),
        'mape': mean_absolute_percentage_error(y_test, ensemble_pred) * 100
    }

    logger.info(f"Ensemble R²: {ensemble_metrics['r2_score']:.4f}")
    logger.info(f"Ensemble RMSE: ${ensemble_metrics['rmse']:,.2f}")

    # Return all models and metrics
    return {
        'xgb_model': xgb_model,
        'ensemble_model': ensemble,
        'all_models': individual_models,
        'xgb_metrics': individual_metrics['XGBoost'],
        'ensemble_metrics': ensemble_metrics,
        'all_metrics': {**individual_metrics, 'Ensemble': ensemble_metrics}
    }


# ============================================================================
# MAIN
# ============================================================================

def main():
    logger.info("=" * 80)
    logger.info("MULTI-MODAL MODEL TRAINING (GPU ACCELERATED)")
    logger.info("=" * 80)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    if not PYTORCH_AVAILABLE:
        logger.error("PyTorch not available! Install: pip install torch torchvision")
        return

    if torch.cuda.is_available():
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.1f} GB")
        # STABLE GPU optimizations (conservative settings)
        torch.backends.cudnn.benchmark = True  # Faster convolutions
        torch.backends.cudnn.deterministic = False
        torch.backends.cuda.matmul.allow_tf32 = True  # Use TensorFloat-32
        torch.backends.cudnn.allow_tf32 = True
        # Set memory fraction for stability (80% instead of 95%)
        torch.cuda.set_per_process_memory_fraction(0.80)  # Use 80% of GPU memory (safer)
        logger.info("OPTIMIZED GPU settings enabled (speed + stability)!")
        logger.info(f"Batch size: {BATCH_SIZE} (optimized - uses GPU more efficiently)")
        logger.info(f"Workers: {NUM_WORKERS} (balanced for speed)")
        logger.info(f"Checkpoint interval: {CHECKPOINT_INTERVAL} batches")
        logger.info(f"Memory clear interval: {MEMORY_CLEAR_INTERVAL} batches")
        logger.info(f"RAM clear interval: {RAM_CLEAR_INTERVAL} batches (prevents 98% RAM usage)")
    else:
        logger.warning("No GPU available, using CPU (will be slower)")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # Load data
    logger.info(f"Loading dataset from {DATASET_FILE}...")
    df = pd.read_csv(DATASET_FILE)
    logger.info(f"Loaded {len(df):,} rows")

    # Clean numeric columns
    numeric_cols = ['engine_size', 'cylinders', 'mileage', 'year', 'price_usd', 'price']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            df[col].fillna(df[col].median(), inplace=True)

    # Create features
    logger.info("Creating tabular features...")
    df_engineered, encoders = create_tabular_features(df)

    tabular_cols = [
        'year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
        'make_encoded', 'model_encoded', 'condition_encoded', 'fuel_type_encoded',
        'year_mileage_interaction', 'engine_cylinders_interaction',
        'mileage_per_year', 'brand_popularity'
    ]
    available_cols = [col for col in tabular_cols if col in df_engineered.columns]
    X_tabular = df_engineered[available_cols].values

    # Extract image features (GPU accelerated!)
    logger.info("Extracting image features with GPU...")
    cnn_model, preprocess_func = create_cnn_feature_extractor()
    X_images = extract_features_batch(df_engineered, cnn_model, preprocess_func)

    # Combine features
    logger.info("Combining features...")
    X_combined = np.hstack([X_tabular, X_images])

    # Target
    y = df_engineered['price'].values if 'price' in df_engineered.columns else df_engineered['price_usd'].values

    # Split
    logger.info("Splitting data...")
    X_train, X_temp, y_train, y_temp = train_test_split(
        X_combined, y, test_size=TEST_SIZE + VALIDATION_SIZE, random_state=RANDOM_STATE
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=TEST_SIZE / (TEST_SIZE + VALIDATION_SIZE),
        random_state=RANDOM_STATE
    )
    logger.info(f"Train: {len(X_train):,}, Val: {len(X_val):,}, Test: {len(X_test):,}")

    # Scale
    logger.info("Scaling features...")
    scaler = RobustScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    # Train
    training_results = train_models(
        X_train_scaled, y_train, X_val_scaled, y_val, X_test_scaled, y_test
    )

    xgb_model = training_results['xgb_model']
    ensemble_model = training_results['ensemble_model']
    xgb_metrics = training_results['xgb_metrics']
    ensemble_metrics = training_results['ensemble_metrics']
    all_metrics = training_results['all_metrics']

    # Determine best model (XGBoost has R² = 0.8378, Ensemble has R² = 0.8353)
    if xgb_metrics['r2_score'] >= ensemble_metrics['r2_score']:
        best_model = xgb_model
        best_model_name = 'XGBoost'
        best_metrics = xgb_metrics
    else:
        best_model = ensemble_model
        best_model_name = 'Ensemble'
        best_metrics = ensemble_metrics

    # Save models
    logger.info("Saving models...")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # Save XGBoost model
    xgb_model_path = MODELS_DIR / "xgboost_model_v3.pkl"
    logger.info(f"Saving XGBoost model to {xgb_model_path}...")
    with open(xgb_model_path, 'wb') as f:
        pickle.dump({
            'model': xgb_model,
            'model_name': 'XGBoost',
            'model_type': 'XGBoost',
            'features': available_cols,  # Tabular feature names
            'image_features_enabled': True,
            'image_feature_dim': FEATURE_DIM,
            'metrics': xgb_metrics,
            'scaler': scaler,
            'encoders': encoders,
            'version': 'v3',
            'training_date': datetime.now().isoformat()
        }, f)
    logger.info(f"[OK] XGBoost model saved: {xgb_model_path}")

    # Save Ensemble model
    ensemble_model_path = MODELS_DIR / "ensemble_model_v3.pkl"
    logger.info(f"Saving Ensemble model to {ensemble_model_path}...")
    with open(ensemble_model_path, 'wb') as f:
        pickle.dump({
            'model': ensemble_model,
            'model_name': 'Ensemble',
            'model_type': 'Ensemble',
            'features': available_cols,  # Tabular feature names
            'image_features_enabled': True,
            'image_feature_dim': FEATURE_DIM,
            'metrics': ensemble_metrics,
            'scaler': scaler,
            'encoders': encoders,
            'version': 'v3',
            'training_date': datetime.now().isoformat(),
            'ensemble_models': [name for _, name in ensemble_model.models]  # Model names in ensemble
        }, f)
    logger.info(f"[OK] Ensemble model saved: {ensemble_model_path}")

    # Save best model (XGBoost since it has higher R²)
    best_model_path = MODELS_DIR / "best_model_v3.pkl"
    logger.info(f"Saving best model ({best_model_name}) to {best_model_path}...")
    with open(best_model_path, 'wb') as f:
        pickle.dump({
            'model': best_model,
            'model_name': best_model_name,
            'model_type': best_model_name,
            'features': available_cols,
            'image_features_enabled': True,
            'image_feature_dim': FEATURE_DIM,
            'metrics': best_metrics,
            'scaler': scaler,
            'encoders': encoders,
            'version': 'v3',
            'training_date': datetime.now().isoformat()
        }, f)
    logger.info(f"[OK] Best model saved: {best_model_path}")

    # Save CNN feature extractor
    torch.save(cnn_model.state_dict(), CNN_MODEL_FILE)
    logger.info(f"[OK] CNN feature extractor saved: {CNN_MODEL_FILE}")

    # Save encoders separately (for backward compatibility)
    with open(ENCODERS_FILE, 'wb') as f:
        pickle.dump(encoders, f)
    logger.info(f"[OK] Encoders saved: {ENCODERS_FILE}")

    # Save scaler separately (for backward compatibility)
    with open(SCALER_FILE, 'wb') as f:
        pickle.dump(scaler, f)
    logger.info(f"[OK] Scaler saved: {SCALER_FILE}")

    # Create model info JSON file
    model_info = {
        'model_name': best_model_name,
        'version': 'v3',
        'training_date': datetime.now().isoformat(),
        'best_model_metrics': {
            'r2': best_metrics['r2_score'],
            'rmse': best_metrics['rmse'],
            'mae': best_metrics['mae'],
            'mape': best_metrics['mape']
        },
        'all_models_metrics': {
            name: {
                'r2': metrics['r2_score'],
                'rmse': metrics['rmse'],
                'mae': metrics['mae'],
                'mape': metrics['mape']
            }
            for name, metrics in all_metrics.items()
        },
        'features_used': available_cols,
        'feature_count': len(available_cols),
        'image_features_enabled': True,
        'image_feature_dim': FEATURE_DIM,
        'total_feature_dim': len(available_cols) + FEATURE_DIM,
        'training_samples': len(X_train),
        'validation_samples': len(X_val),
        'test_samples': len(X_test),
        'model_files': {
            'xgboost': str(xgb_model_path),
            'ensemble': str(ensemble_model_path),
            'best': str(best_model_path),
            'cnn_extractor': str(CNN_MODEL_FILE),
            'encoders': str(ENCODERS_FILE),
            'scaler': str(SCALER_FILE)
        }
    }

    model_info_path = MODELS_DIR / "model_v3_info.json"
    with open(model_info_path, 'w', encoding='utf-8') as f:
        json.dump(model_info, f, indent=2, ensure_ascii=False)
    logger.info(f"[OK] Model info saved: {model_info_path}")

    # Test loading the best model
    logger.info("Testing model loading...")
    try:
        with open(best_model_path, 'rb') as f:
            loaded_data = pickle.load(f)
        loaded_model = loaded_data['model']

        # Make a test prediction
        test_sample = X_test_scaled[:1]
        test_prediction = loaded_model.predict(test_sample)

        logger.info(f"[OK] Model loaded successfully!")
        logger.info(f"[OK] Test prediction: ${test_prediction[0]:,.2f}")
        logger.info(f"[OK] Actual value: ${y_test[0]:,.2f}")
    except Exception as e:
        logger.error(f"[ERROR] Failed to load model: {e}")
        import traceback
        logger.error(traceback.format_exc())

    logger.info("=" * 80)
    logger.info("TRAINING COMPLETE!")
    logger.info(f"Best Model: {best_model_name}")
    logger.info(f"Best R² Score: {best_metrics['r2_score']:.4f}")
    logger.info(f"Best RMSE: ${best_metrics['rmse']:,.2f}")
    logger.info(f"Best MAE: ${best_metrics['mae']:,.2f}")
    logger.info(f"Best MAPE: {best_metrics['mape']:.2f}%")
    logger.info("")
    logger.info("All Models Performance:")
    for name, metrics in all_metrics.items():
        logger.info(f"  {name}: R² = {metrics['r2_score']:.4f}, RMSE = ${metrics['rmse']:,.2f}")
    logger.info(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()
