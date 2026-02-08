"""
============================================================================
ADVANCED MULTI-MODAL PREDICTION SCRIPT
============================================================================

This script provides production-ready car price prediction with:
1. Multi-modal prediction (text features + image features)
2. Batch processing for multiple predictions
3. Caching for improved performance
4. Progress bars for long operations
5. Comprehensive error handling
6. Detailed logging
7. Beautiful visualizations

Performance optimizations:
- GPU acceleration for image processing
- Cached image feature extraction
- Batch prediction support
- Multiprocessing for image downloads
- Progress tracking

Usage:
    # Single prediction
    python predict_with_images_advanced.py --make Toyota --model Camry --year 2020 --mileage 30000 --image_url https://example.com/car.jpg

    # Batch prediction from CSV
    python predict_with_images_advanced.py --batch_file cars_to_predict.csv --output predictions.csv

    # Interactive mode
    python predict_with_images_advanced.py --interactive

"""

import pandas as pd
import numpy as np
import os
import sys
import logging
from typing import List, Dict, Tuple, Optional, Union, Any
from datetime import datetime
import json
from pathlib import Path
import warnings
import pickle
import argparse
from tqdm import tqdm
import requests
from PIL import Image
import io
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import joblib

# Deep learning imports
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras.applications.resnet50 import preprocess_input as resnet_preprocess
    from tensorflow.keras.preprocessing import image
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("WARNING: TensorFlow not available. Install tensorflow-gpu for best performance.")

# Visualization imports
try:
    import matplotlib.pyplot as plt
    import seaborn as sns
    PLOTTING_AVAILABLE = True
except ImportError:
    PLOTTING_AVAILABLE = False
    print("WARNING: Matplotlib/Seaborn not available. Visualizations disabled.")

warnings.filterwarnings('ignore')

# ============================================================================
# CONFIGURATION
# ============================================================================

# Paths
MODELS_DIR = Path("models")
CACHE_DIR = Path("cache")
OUTPUT_DIR = Path("predictions")
LOG_FILE = "prediction.log"

# Model files
MODEL_FILE = MODELS_DIR / "best_model.pkl"
CNN_MODEL_FILE = MODELS_DIR / "cnn_feature_extractor.h5"
ENCODERS_FILE = MODELS_DIR / "encoders.pkl"
SCALER_FILE = MODELS_DIR / "scaler.pkl"
FEATURE_INFO_FILE = MODELS_DIR / "feature_info.pkl"

# Cache files
IMAGE_FEATURE_CACHE = CACHE_DIR / "image_feature_cache.pkl"
IMAGE_DOWNLOAD_CACHE = CACHE_DIR / "image_download_cache.pkl"

# Image processing
IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32
MAX_IMAGES_PER_CAR = 5
DOWNLOAD_TIMEOUT = 10

# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging(log_file: str = LOG_FILE) -> logging.Logger:
    """Set up detailed logging."""
    logger = logging.getLogger('prediction')
    logger.setLevel(logging.DEBUG)

    logger.handlers = []

    file_handler = logging.FileHandler(log_file, mode='a', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(file_formatter)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('%(levelname)s: %(message)s')
    console_handler.setFormatter(console_formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger

logger = setup_logging()

# ============================================================================
# CACHE MANAGEMENT
# ============================================================================

class ImageFeatureCache:
    """Cache for extracted image features."""

    def __init__(self, cache_file: Path = IMAGE_FEATURE_CACHE):
        self.cache_file = cache_file
        self.cache = {}
        self.load_cache()

    def load_cache(self):
        """Load cache from disk."""
        if self.cache_file.exists():
            try:
                self.cache = joblib.load(self.cache_file)
                logger.info(f"Loaded {len(self.cache)} cached image features")
            except Exception as e:
                logger.warning(f"Failed to load cache: {e}")
                self.cache = {}
        else:
            self.cache = {}

    def save_cache(self):
        """Save cache to disk."""
        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            joblib.dump(self.cache, self.cache_file)
            logger.debug(f"Saved {len(self.cache)} cached image features")
        except Exception as e:
            logger.warning(f"Failed to save cache: {e}")

    def get_key(self, image_url: str) -> str:
        """Generate cache key from image URL."""
        return hashlib.md5(image_url.encode()).hexdigest()

    def get(self, image_url: str) -> Optional[np.ndarray]:
        """Get cached features for image URL."""
        key = self.get_key(image_url)
        return self.cache.get(key)

    def set(self, image_url: str, features: np.ndarray):
        """Cache features for image URL."""
        key = self.get_key(image_url)
        self.cache[key] = features


class ImageDownloadCache:
    """Cache for downloaded images."""

    def __init__(self, cache_file: Path = IMAGE_DOWNLOAD_CACHE):
        self.cache_file = cache_file
        self.cache = {}
        self.load_cache()

    def load_cache(self):
        """Load cache from disk."""
        if self.cache_file.exists():
            try:
                self.cache = joblib.load(self.cache_file)
                logger.info(f"Loaded {len(self.cache)} cached images")
            except Exception as e:
                logger.warning(f"Failed to load image cache: {e}")
                self.cache = {}
        else:
            self.cache = {}

    def save_cache(self):
        """Save cache to disk."""
        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            joblib.dump(self.cache, self.cache_file)
        except Exception as e:
            logger.warning(f"Failed to save image cache: {e}")

    def get_key(self, image_url: str) -> str:
        """Generate cache key from image URL."""
        return hashlib.md5(image_url.encode()).hexdigest()

    def get(self, image_url: str) -> Optional[Image.Image]:
        """Get cached image."""
        key = self.get_key(image_url)
        return self.cache.get(key)

    def set(self, image_url: str, image: Image.Image):
        """Cache image."""
        key = self.get_key(image_url)
        self.cache[key] = image


# ============================================================================
# MODEL LOADING
# ============================================================================

class ModelLoader:
    """Load and manage prediction models."""

    def __init__(self):
        self.model = None
        self.cnn_model = None
        self.preprocess_func = None
        self.encoders = None
        self.scaler = None
        self.feature_info = None
        self._load_models()

    def _load_models(self):
        """Load all required models and preprocessors."""
        logger.info("Loading models...")

        # Load main model
        if not MODEL_FILE.exists():
            raise FileNotFoundError(f"Model file not found: {MODEL_FILE}")

        with open(MODEL_FILE, 'rb') as f:
            self.model = pickle.load(f)
        logger.info(f"Loaded main model from {MODEL_FILE}")

        # Load CNN model
        if TF_AVAILABLE and CNN_MODEL_FILE.exists():
            self.cnn_model = keras.models.load_model(str(CNN_MODEL_FILE))
            self.preprocess_func = resnet_preprocess
            logger.info(f"Loaded CNN model from {CNN_MODEL_FILE}")
        else:
            logger.warning("CNN model not available - image features will be zero vectors")

        # Load encoders
        if ENCODERS_FILE.exists():
            with open(ENCODERS_FILE, 'rb') as f:
                self.encoders = pickle.load(f)
            logger.info(f"Loaded encoders from {ENCODERS_FILE}")
        else:
            logger.warning("Encoders file not found")
            self.encoders = {}

        # Load scaler
        if SCALER_FILE.exists():
            with open(SCALER_FILE, 'rb') as f:
                self.scaler = pickle.load(f)
            logger.info(f"Loaded scaler from {SCALER_FILE}")
        else:
            logger.warning("Scaler file not found")

        # Load feature info
        if FEATURE_INFO_FILE.exists():
            with open(FEATURE_INFO_FILE, 'rb') as f:
                self.feature_info = pickle.load(f)
            logger.info(f"Loaded feature info from {FEATURE_INFO_FILE}")
        else:
            logger.warning("Feature info file not found")
            self.feature_info = {'text_features': [], 'image_feature_dim': 2048}


# ============================================================================
# IMAGE PROCESSING
# ============================================================================

def download_image(url: str, download_cache: ImageDownloadCache,
                   timeout: int = DOWNLOAD_TIMEOUT) -> Optional[Image.Image]:
    """
    Download image from URL with caching.

    Parameters:
    -----------
    url : str
        Image URL
    download_cache : ImageDownloadCache
        Cache for downloaded images
    timeout : int
        Request timeout in seconds

    Returns:
    --------
    image : Optional[Image.Image]
        PIL Image or None if download fails
    """
    # Check cache first
    cached_img = download_cache.get(url)
    if cached_img is not None:
        return cached_img

    try:
        response = requests.get(url, timeout=timeout, stream=True)
        response.raise_for_status()

        img = Image.open(io.BytesIO(response.content))

        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # Cache image
        download_cache.set(url, img)

        return img
    except Exception as e:
        logger.debug(f"Failed to download image {url}: {str(e)}")
        return None


def preprocess_image(img: Image.Image, target_size: Tuple[int, int] = IMAGE_SIZE) -> np.ndarray:
    """Preprocess image for CNN input."""
    img_resized = img.resize(target_size, Image.LANCZOS)
    img_array = image.img_to_array(img_resized)
    img_array = np.expand_dims(img_array, axis=0)
    return img_array


def extract_features_from_image(img: Image.Image, cnn_model: keras.Model,
                                preprocess_func, feature_cache: ImageFeatureCache,
                                image_url: str = None) -> np.ndarray:
    """
    Extract features from a single image with caching.

    Parameters:
    -----------
    img : Image.Image
        PIL Image
    cnn_model : keras.Model
        Feature extraction model
    preprocess_func : callable
        Preprocessing function
    feature_cache : ImageFeatureCache
        Cache for extracted features
    image_url : str
        Image URL for caching (optional)

    Returns:
    --------
    features : np.ndarray
        Extracted features
    """
    # Check cache if URL provided
    if image_url:
        cached_features = feature_cache.get(image_url)
        if cached_features is not None:
            return cached_features

    try:
        img_array = preprocess_image(img)
        img_array = preprocess_func(img_array)
        features = cnn_model.predict(img_array, verbose=0)
        features = features.flatten()

        # Cache features if URL provided
        if image_url:
            feature_cache.set(image_url, features)

        return features
    except Exception as e:
        logger.debug(f"Feature extraction failed: {str(e)}")
        # Return zero vector on failure
        return np.zeros(cnn_model.output_shape[-1])


def extract_features_from_urls(image_urls: List[str], cnn_model: keras.Model,
                               preprocess_func, feature_cache: ImageFeatureCache,
                               download_cache: ImageDownloadCache,
                               max_images: int = MAX_IMAGES_PER_CAR) -> np.ndarray:
    """
    Extract features from multiple image URLs and aggregate.

    Parameters:
    -----------
    image_urls : List[str]
        List of image URLs
    cnn_model : keras.Model
        Feature extraction model
    preprocess_func : callable
        Preprocessing function
    feature_cache : ImageFeatureCache
        Cache for extracted features
    download_cache : ImageDownloadCache
        Cache for downloaded images
    max_images : int
        Maximum number of images to process

    Returns:
    --------
    aggregated_features : np.ndarray
        Aggregated feature vector
    """
    if not image_urls or not cnn_model:
        # Return zero vector if no images or model
        return np.zeros(cnn_model.output_shape[-1] if cnn_model else 2048)

    features_list = []
    urls_to_process = image_urls[:max_images]

    for url in urls_to_process:
        img = download_image(url, download_cache)
        if img is not None:
            features = extract_features_from_image(
                img, cnn_model, preprocess_func, feature_cache, url
            )
            features_list.append(features)

    if not features_list:
        # Return zero vector if all downloads failed
        return np.zeros(cnn_model.output_shape[-1] if cnn_model else 2048)

    # Aggregate features: mean pooling
    aggregated = np.mean(features_list, axis=0)
    return aggregated


# ============================================================================
# FEATURE PREPARATION
# ============================================================================

def prepare_features(car_data: Dict[str, Any], model_loader: ModelLoader,
                     feature_cache: ImageFeatureCache,
                     download_cache: ImageDownloadCache) -> np.ndarray:
    """
    Prepare features for prediction from car data.

    Parameters:
    -----------
    car_data : Dict[str, Any]
        Car data dictionary
    model_loader : ModelLoader
        Loaded models and preprocessors
    feature_cache : ImageFeatureCache
        Cache for image features
    download_cache : ImageDownloadCache
        Cache for downloaded images

    Returns:
    --------
    features : np.ndarray
        Prepared feature vector
    """
    # Extract text features
    text_features = []
    feature_info = model_loader.feature_info

    # Get image URLs
    image_urls = []
    if 'image_url' in car_data and car_data['image_url']:
        image_urls = [car_data['image_url']]
    elif 'image_urls' in car_data and car_data['image_urls']:
        if isinstance(car_data['image_urls'], str):
            image_urls = car_data['image_urls'].split('|')
        elif isinstance(car_data['image_urls'], list):
            image_urls = car_data['image_urls']

    # Calculate age
    current_year = datetime.now().year
    year = car_data.get('year', current_year)
    age_of_car = current_year - year

    # Build text features in order
    text_feature_cols = feature_info.get('text_features', [
        'year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
        'make_encoded', 'model_encoded', 'condition_encoded',
        'fuel_type_encoded', 'location_encoded',
        'year_mileage_interaction', 'engine_cylinders_interaction',
        'mileage_per_year', 'brand_popularity'
    ])

    feature_dict = {}

    # Numeric features
    feature_dict['year'] = year
    feature_dict['mileage'] = car_data.get('mileage', 50000)
    feature_dict['engine_size'] = car_data.get('engine_size', 2.0)
    feature_dict['cylinders'] = car_data.get('cylinders', 4)
    feature_dict['age_of_car'] = age_of_car

    # Encode categorical features
    encoders = model_loader.encoders

    for col in ['make', 'model', 'condition', 'fuel_type', 'location']:
        value = car_data.get(col, 'Unknown')
        encoded_col = f'{col}_encoded'

        if col in encoders:
            try:
                encoded_value = encoders[col].transform([str(value)])[0]
            except (ValueError, KeyError):
                # Handle unseen categories
                encoded_value = 0
        else:
            encoded_value = 0

        feature_dict[encoded_col] = encoded_value

    # Interaction features
    feature_dict['year_mileage_interaction'] = feature_dict['year'] * feature_dict['mileage']
    feature_dict['engine_cylinders_interaction'] = feature_dict['engine_size'] * feature_dict['cylinders']
    feature_dict['mileage_per_year'] = feature_dict['mileage'] / (age_of_car + 1)

    # Brand popularity (simplified - use 0.5 as default)
    feature_dict['brand_popularity'] = 0.5

    # Build text feature vector
    for col in text_feature_cols:
        text_features.append(feature_dict.get(col, 0))

    text_features = np.array(text_features)

    # Extract image features
    if model_loader.cnn_model:
        image_features = extract_features_from_urls(
            image_urls, model_loader.cnn_model, model_loader.preprocess_func,
            feature_cache, download_cache
        )
    else:
        image_features = np.zeros(feature_info.get('image_feature_dim', 2048))

    # Combine features
    combined_features = np.hstack([text_features, image_features])

    return combined_features


# ============================================================================
# PREDICTION FUNCTIONS
# ============================================================================

def predict_single(car_data: Dict[str, Any], model_loader: ModelLoader,
                   feature_cache: ImageFeatureCache,
                   download_cache: ImageDownloadCache) -> Dict[str, Any]:
    """
    Predict price for a single car.

    Parameters:
    -----------
    car_data : Dict[str, Any]
        Car data dictionary
    model_loader : ModelLoader
        Loaded models
    feature_cache : ImageFeatureCache
        Cache for image features
    download_cache : ImageDownloadCache
        Cache for downloaded images

    Returns:
    --------
    prediction : Dict[str, Any]
        Prediction results
    """
    try:
        # Prepare features
        features = prepare_features(car_data, model_loader, feature_cache, download_cache)

        # Scale features
        if model_loader.scaler:
            features_scaled = model_loader.scaler.transform(features.reshape(1, -1))
        else:
            features_scaled = features.reshape(1, -1)

        # Predict
        predicted_price = model_loader.model.predict(features_scaled)[0]

        # Ensure positive price
        predicted_price = max(0, predicted_price)

        return {
            'success': True,
            'predicted_price': float(predicted_price),
            'car_data': car_data
        }

    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'car_data': car_data
        }


def predict_batch(car_data_list: List[Dict[str, Any]], model_loader: ModelLoader,
                  feature_cache: ImageFeatureCache,
                  download_cache: ImageDownloadCache,
                  use_multiprocessing: bool = True) -> List[Dict[str, Any]]:
    """
    Predict prices for multiple cars with batch processing.

    Parameters:
    -----------
    car_data_list : List[Dict[str, Any]]
        List of car data dictionaries
    model_loader : ModelLoader
        Loaded models
    feature_cache : ImageFeatureCache
        Cache for image features
    download_cache : ImageDownloadCache
        Cache for downloaded images
    use_multiprocessing : bool
        Whether to use multiprocessing

    Returns:
    --------
    predictions : List[Dict[str, Any]]
        List of prediction results
    """
    logger.info(f"Predicting prices for {len(car_data_list)} cars...")

    predictions = []

    if use_multiprocessing and len(car_data_list) > 1:
        # Use multiprocessing for batch prediction
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [
                executor.submit(
                    predict_single, car_data, model_loader,
                    feature_cache, download_cache
                )
                for car_data in car_data_list
            ]

            for future in tqdm(as_completed(futures), total=len(futures), desc="Predicting"):
                try:
                    result = future.result()
                    predictions.append(result)
                except Exception as e:
                    logger.error(f"Batch prediction error: {str(e)}")
                    predictions.append({
                        'success': False,
                        'error': str(e),
                        'car_data': {}
                    })
    else:
        # Sequential prediction
        for car_data in tqdm(car_data_list, desc="Predicting"):
            result = predict_single(car_data, model_loader, feature_cache, download_cache)
            predictions.append(result)

    return predictions


# ============================================================================
# VISUALIZATION FUNCTIONS
# ============================================================================

def visualize_predictions(predictions: List[Dict[str, Any]], output_file: Path = None):
    """
    Create visualizations of predictions.

    Parameters:
    -----------
    predictions : List[Dict[str, Any]]
        List of prediction results
    output_file : Path
        Output file path for saving plot
    """
    if not PLOTTING_AVAILABLE:
        logger.warning("Plotting libraries not available, skipping visualization")
        return

    successful_predictions = [p for p in predictions if p.get('success', False)]

    if not successful_predictions:
        logger.warning("No successful predictions to visualize")
        return

    prices = [p['predicted_price'] for p in successful_predictions]

    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle('Prediction Analysis', fontsize=16, fontweight='bold')

    # Price distribution
    axes[0, 0].hist(prices, bins=30, edgecolor='black', alpha=0.7)
    axes[0, 0].set_title('Price Distribution')
    axes[0, 0].set_xlabel('Predicted Price ($)')
    axes[0, 0].set_ylabel('Frequency')
    axes[0, 0].grid(True, alpha=0.3)

    # Price box plot
    axes[0, 1].boxplot(prices, vert=True)
    axes[0, 1].set_title('Price Box Plot')
    axes[0, 1].set_ylabel('Predicted Price ($)')
    axes[0, 1].grid(True, alpha=0.3)

    # Price statistics
    stats_text = f"""
    Statistics:
    Mean: ${np.mean(prices):,.2f}
    Median: ${np.median(prices):,.2f}
    Min: ${np.min(prices):,.2f}
    Max: ${np.max(prices):,.2f}
    Std: ${np.std(prices):,.2f}
    """
    axes[1, 0].text(0.1, 0.5, stats_text, fontsize=12, verticalalignment='center',
                    family='monospace')
    axes[1, 0].axis('off')

    # Success rate
    success_count = len(successful_predictions)
    total_count = len(predictions)
    success_rate = (success_count / total_count) * 100 if total_count > 0 else 0

    axes[1, 1].bar(['Successful', 'Failed'],
                   [success_count, total_count - success_count],
                   color=['green', 'red'], alpha=0.7)
    axes[1, 1].set_title(f'Success Rate: {success_rate:.1f}%')
    axes[1, 1].set_ylabel('Count')
    axes[1, 1].grid(True, alpha=0.3, axis='y')

    plt.tight_layout()

    if output_file:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        logger.info(f"Saved visualization to {output_file}")
    else:
        plt.show()

    plt.close()


# ============================================================================
# MAIN FUNCTIONS
# ============================================================================

def main():
    """Main prediction function."""
    parser = argparse.ArgumentParser(
        description='Advanced Multi-Modal Car Price Prediction',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single prediction
  python predict_with_images_advanced.py --make Toyota --model Camry --year 2020 --mileage 30000 --image_url https://example.com/car.jpg

  # Batch prediction
  python predict_with_images_advanced.py --batch_file cars.csv --output predictions.csv

  # Interactive mode
  python predict_with_images_advanced.py --interactive
        """
    )

    # Single prediction arguments
    parser.add_argument('--make', type=str, help='Car make')
    parser.add_argument('--model', type=str, help='Car model')
    parser.add_argument('--year', type=int, help='Car year')
    parser.add_argument('--mileage', type=float, help='Car mileage')
    parser.add_argument('--engine_size', type=float, default=2.0, help='Engine size')
    parser.add_argument('--cylinders', type=int, default=4, help='Number of cylinders')
    parser.add_argument('--condition', type=str, default='Good', help='Car condition')
    parser.add_argument('--fuel_type', type=str, default='Gasoline', help='Fuel type')
    parser.add_argument('--location', type=str, default='Unknown', help='Location')
    parser.add_argument('--image_url', type=str, help='Image URL')
    parser.add_argument('--image_urls', type=str, help='Image URLs (pipe-separated)')

    # Batch prediction arguments
    parser.add_argument('--batch_file', type=str, help='CSV file with car data')
    parser.add_argument('--output', type=str, help='Output CSV file for predictions')

    # Other arguments
    parser.add_argument('--interactive', action='store_true', help='Interactive mode')
    parser.add_argument('--visualize', action='store_true', help='Create visualizations')

    args = parser.parse_args()

    logger.info("=" * 80)
    logger.info("ADVANCED MULTI-MODAL PREDICTION")
    logger.info("=" * 80)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Initialize caches
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    feature_cache = ImageFeatureCache()
    download_cache = ImageDownloadCache()

    # Load models
    try:
        model_loader = ModelLoader()
    except Exception as e:
        logger.error(f"Failed to load models: {str(e)}")
        sys.exit(1)

    # Interactive mode
    if args.interactive:
        logger.info("Interactive mode")
        car_data = {}
        car_data['make'] = input("Make: ") or 'Toyota'
        car_data['model'] = input("Model: ") or 'Camry'
        car_data['year'] = int(input("Year: ") or '2020')
        car_data['mileage'] = float(input("Mileage: ") or '30000')
        car_data['engine_size'] = float(input("Engine size: ") or '2.0')
        car_data['cylinders'] = int(input("Cylinders: ") or '4')
        car_data['condition'] = input("Condition: ") or 'Good'
        car_data['fuel_type'] = input("Fuel type: ") or 'Gasoline'
        car_data['location'] = input("Location: ") or 'Unknown'
        car_data['image_url'] = input("Image URL (optional): ") or None

        result = predict_single(car_data, model_loader, feature_cache, download_cache)

        if result['success']:
            print(f"\nPredicted Price: ${result['predicted_price']:,.2f}")
        else:
            print(f"\nError: {result.get('error', 'Unknown error')}")

    # Batch prediction
    elif args.batch_file:
        logger.info(f"Batch prediction from {args.batch_file}")

        if not Path(args.batch_file).exists():
            logger.error(f"File not found: {args.batch_file}")
            sys.exit(1)

        df = pd.read_csv(args.batch_file)
        logger.info(f"Loaded {len(df)} cars from {args.batch_file}")

        # Convert DataFrame to list of dictionaries
        car_data_list = df.to_dict('records')

        # Predict
        predictions = predict_batch(car_data_list, model_loader, feature_cache, download_cache)

        # Create results DataFrame
        results = []
        for pred in predictions:
            if pred['success']:
                result = pred['car_data'].copy()
                result['predicted_price'] = pred['predicted_price']
                results.append(result)
            else:
                result = pred['car_data'].copy()
                result['predicted_price'] = None
                result['error'] = pred.get('error', 'Unknown error')
                results.append(result)

        results_df = pd.DataFrame(results)

        # Save results
        output_file = Path(args.output) if args.output else OUTPUT_DIR / f"predictions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        results_df.to_csv(output_file, index=False)
        logger.info(f"Saved predictions to {output_file}")

        # Visualize if requested
        if args.visualize:
            visualize_predictions(predictions, OUTPUT_DIR / "prediction_visualization.png")

        # Print summary
        successful = sum(1 for p in predictions if p['success'])
        logger.info(f"\nSummary:")
        logger.info(f"  Total: {len(predictions)}")
        logger.info(f"  Successful: {successful}")
        logger.info(f"  Failed: {len(predictions) - successful}")
        if successful > 0:
            avg_price = np.mean([p['predicted_price'] for p in predictions if p['success']])
            logger.info(f"  Average predicted price: ${avg_price:,.2f}")

    # Single prediction
    elif args.make and args.model and args.year:
        logger.info("Single prediction")

        car_data = {
            'make': args.make,
            'model': args.model,
            'year': args.year,
            'mileage': args.mileage or 30000,
            'engine_size': args.engine_size,
            'cylinders': args.cylinders,
            'condition': args.condition,
            'fuel_type': args.fuel_type,
            'location': args.location
        }

        if args.image_url:
            car_data['image_url'] = args.image_url
        elif args.image_urls:
            car_data['image_urls'] = args.image_urls.split('|')

        result = predict_single(car_data, model_loader, feature_cache, download_cache)

        if result['success']:
            print(f"\nPredicted Price: ${result['predicted_price']:,.2f}")
            logger.info(f"Predicted price: ${result['predicted_price']:,.2f}")
        else:
            print(f"\nError: {result.get('error', 'Unknown error')}")
            logger.error(f"Prediction failed: {result.get('error', 'Unknown error')}")

    else:
        parser.print_help()
        sys.exit(1)

    # Save caches
    feature_cache.save_cache()
    download_cache.save_cache()

    logger.info(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
