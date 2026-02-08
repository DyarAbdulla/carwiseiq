"""
Configuration file for Car Price Predictor
Contains all constants, file paths, and configuration settings
"""

import os

# ============================================================================
# File Paths
# ============================================================================
# Get the root directory (parent of app folder)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Data files
DATA_DIR = os.path.join(BASE_DIR, 'data')
RAW_DATA_FILE = os.path.join(DATA_DIR, 'iqcars60000data.xlsx')
CLEANED_DATA_FILE = os.path.join(DATA_DIR, 'cleaned_car_data.csv')

# Model files
MODEL_DIR = os.path.join(BASE_DIR, 'models')
MODEL_FILE = os.path.join(MODEL_DIR, 'best_model_v2.pkl')  # Use best_model_v2.pkl which has target_transform flag
MAKE_ENCODER_FILE = os.path.join(MODEL_DIR, 'make_encoder.pkl')
MODEL_ENCODER_FILE = os.path.join(MODEL_DIR, 'model_encoder.pkl')

# Output directories
VISUALIZATIONS_DIR = os.path.join(BASE_DIR, 'visualizations')
EVALUATION_REPORTS_DIR = os.path.join(BASE_DIR, 'evaluation_reports')
DATA_QUALITY_REPORT_FILE = os.path.join(BASE_DIR, 'data_quality_report.txt')

# ============================================================================
# Data Processing Configuration
# ============================================================================
CURRENT_YEAR = 2025
TEST_SIZE = 0.2
RANDOM_STATE = 42

# Missing value handling
NUMERIC_FILL_METHOD = 'median'
CATEGORICAL_FILL_METHOD = 'mode'

# Outlier handling
OUTLIER_METHOD = 'iqr'  # 'iqr' or 'percentile'
LOWER_PERCENTILE = 0.01
UPPER_PERCENTILE = 0.99

# ============================================================================
# Model Training Configuration
# ============================================================================
# Random Forest parameters
RF_N_ESTIMATORS = [100, 200]
RF_MAX_DEPTH = [15, 20, 25]
RF_MIN_SAMPLES_SPLIT = [2, 5]
RF_MIN_SAMPLES_LEAF = [1, 2]

# XGBoost parameters
XGB_N_ESTIMATORS = [100, 200]
XGB_MAX_DEPTH = [5, 6, 7]
XGB_LEARNING_RATE = [0.05, 0.1]
XGB_SUBSAMPLE = [0.8, 1.0]

# Cross-validation
CV_FOLDS = 3
SCORING_METRIC = 'r2'

# ============================================================================
# Feature Configuration
# ============================================================================
FEATURE_COLUMNS = [
    'year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
    'condition_encoded', 'fuel_type_encoded', 'location_encoded',
    'make_encoded', 'model_encoded'
]

# Categorical encoding maps
CONDITION_MAP = {
    'New': 0, 'Like New': 1, 'Excellent': 2, 'Good': 3,
    'Fair': 4, 'Poor': 5, 'Salvage': 6
}

FUEL_TYPE_MAP = {
    'Gasoline': 0, 'Diesel': 1, 'Electric': 2, 'Hybrid': 3,
    'Plug-in Hybrid': 4, 'Other': 5
}

# ============================================================================
# Visualization Configuration
# ============================================================================
FIGURE_DPI = 300
FIGURE_SIZE = (14, 7)
PLOT_STYLE = 'seaborn-v0_8-darkgrid'

# Color schemes
PRIMARY_COLOR = '#1f77b4'
SECONDARY_COLOR = '#667eea'
GRADIENT_START = '#667eea'
GRADIENT_END = '#764ba2'

# ============================================================================
# Web Application Configuration
# ============================================================================
APP_TITLE = "Car Price Predictor"
APP_ICON = "🚗"
APP_LAYOUT = "wide"
SIDEBAR_STATE = "expanded"

# Prediction confidence
CONFIDENCE_LEVEL = 0.95
CONFIDENCE_Z_SCORE = 1.96

# ============================================================================
# Model Performance Targets
# ============================================================================
TARGET_R2_SCORE = 0.95
TARGET_RMSE = 5000  # dollars
TARGET_MAE = 3000  # dollars

# ============================================================================
# Data Validation
# ============================================================================
MIN_YEAR = 1900
MAX_YEAR = 2025
MIN_MILEAGE = 0
MAX_MILEAGE = 1000000
MIN_ENGINE_SIZE = 0.5
MAX_ENGINE_SIZE = 10.0
MIN_CYLINDERS = 2
MAX_CYLINDERS = 12

# ============================================================================
# Logging Configuration
# ============================================================================
LOG_LEVEL = 'INFO'
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

# Debug configuration
DEBUG_PREDICTIONS = False  # Set to True to enable debug prints in predict_price.py




