"""
============================================================================
MULTI-MODAL MODEL CONFIGURATION
============================================================================

Centralized configuration file for hyperparameters and model settings.
Modify these values to tune model performance.

"""

# ============================================================================
# MODEL HYPERPARAMETERS
# ============================================================================

# XGBoost hyperparameters
XGBOOST_PARAMS = {
    'n_estimators': 1000,
    'max_depth': 8,
    'learning_rate': 0.01,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'min_child_weight': 3,
    'gamma': 0.1,
    'reg_alpha': 0.1,
    'reg_lambda': 1.0,
    'random_state': 42,
    'n_jobs': -1
}

# LightGBM hyperparameters
LIGHTGBM_PARAMS = {
    'n_estimators': 1000,
    'max_depth': 8,
    'learning_rate': 0.01,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'min_child_samples': 20,
    'reg_alpha': 0.1,
    'reg_lambda': 1.0,
    'random_state': 42,
    'n_jobs': -1,
    'verbose': -1
}

# CatBoost hyperparameters
CATBOOST_PARAMS = {
    'iterations': 1000,
    'depth': 8,
    'learning_rate': 0.01,
    'l2_leaf_reg': 3,
    'random_seed': 42,
    'verbose': False
}

# Random Forest hyperparameters
RANDOM_FOREST_PARAMS = {
    'n_estimators': 500,
    'max_depth': 20,
    'min_samples_split': 5,
    'min_samples_leaf': 2,
    'random_state': 42,
    'n_jobs': -1
}

# ============================================================================
# TRAINING CONFIGURATION
# ============================================================================

# Data split ratios
TEST_SIZE = 0.2
VALIDATION_SIZE = 0.1
RANDOM_STATE = 42

# Early stopping
EARLY_STOPPING_ROUNDS = 50

# Cross-validation
CV_FOLDS = 5

# ============================================================================
# IMAGE PROCESSING CONFIGURATION
# ============================================================================

# Image dimensions
IMAGE_SIZE = (224, 224)

# Batch size for image processing
IMAGE_BATCH_SIZE = 32

# Maximum images per car
MAX_IMAGES_PER_CAR = 5

# CNN model selection ('resnet50' or 'efficientnet')
CNN_BASE_MODEL = 'resnet50'

# Feature dimension (ResNet50: 2048, EfficientNetB0: 1280)
FEATURE_DIM = 2048

# Image download timeout (seconds)
DOWNLOAD_TIMEOUT = 10

# ============================================================================
# PERFORMANCE TARGETS
# ============================================================================

# Target metrics
TARGET_R2_SCORE = 0.94  # 94% variance explained
TARGET_RMSE = 2000.0     # $2,000
TARGET_MAE = 1500.0      # $1,500
TARGET_MAPE = 8.0        # 8%

# ============================================================================
# FEATURE ENGINEERING
# ============================================================================

# Feature columns to use
TEXT_FEATURE_COLUMNS = [
    'year',
    'mileage',
    'engine_size',
    'cylinders',
    'age_of_car',
    'make_encoded',
    'model_encoded',
    'condition_encoded',
    'fuel_type_encoded',
    'location_encoded',
    'year_mileage_interaction',
    'engine_cylinders_interaction',
    'mileage_per_year',
    'brand_popularity'
]

# Categorical columns to encode
CATEGORICAL_COLUMNS = [
    'make',
    'model',
    'condition',
    'fuel_type',
    'location'
]

# ============================================================================
# DATA VALIDATION
# ============================================================================

# Valid conditions
VALID_CONDITIONS = ['New', 'Used', 'Excellent', 'Good', 'Fair', 'Poor']

# Valid fuel types
VALID_FUEL_TYPES = ['Gasoline', 'Diesel', 'Hybrid', 'EV', 'Electric', 'Plug-in Hybrid']

# Numeric value ranges
YEAR_MIN = 1900
YEAR_MAX = 2025
PRICE_MIN = 0
PRICE_MAX = 1000000
MILEAGE_MIN = 0
MILEAGE_MAX = 1000000
ENGINE_SIZE_MIN = 0.5
ENGINE_SIZE_MAX = 10.0
CYLINDERS_MIN = 2
CYLINDERS_MAX = 16

# ============================================================================
# CACHING CONFIGURATION
# ============================================================================

# Enable caching
USE_CACHE = True

# Cache directory
CACHE_DIR = "cache"

# Feature cache file
FEATURE_CACHE_FILE = "cache/extracted_image_features.pkl"

# Image download cache file
IMAGE_CACHE_FILE = "cache/image_download_cache.pkl"

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

# Log level ('DEBUG', 'INFO', 'WARNING', 'ERROR')
LOG_LEVEL = 'INFO'

# Log file
LOG_FILE = "multimodal_training.log"

# ============================================================================
# MULTIPROCESSING CONFIGURATION
# ============================================================================

# Number of workers for parallel processing
NUM_WORKERS = 4

# Use multiprocessing for batch predictions
USE_MULTIPROCESSING = True

# ============================================================================
# PATHS
# ============================================================================

# Data directory
DATA_DIR = "data"

# Models directory
MODELS_DIR = "models"

# Images directory
IMAGES_DIR = "car_images"

# Output directory
OUTPUT_DIR = "predictions"

# Dataset file
DATASET_FILE = "data/final_dataset_with_images.csv"

# Model files
MODEL_FILE = "models/best_model.pkl"
CNN_MODEL_FILE = "models/cnn_feature_extractor.h5"
ENCODERS_FILE = "models/encoders.pkl"
SCALER_FILE = "models/scaler.pkl"
FEATURE_INFO_FILE = "models/feature_info.pkl"

# Performance files
PERFORMANCE_FILE = "models/model_performance.json"
ERROR_ANALYSIS_FILE = "models/error_analysis.csv"
