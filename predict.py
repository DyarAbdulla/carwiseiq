"""
============================================================================
MULTI-MODAL PREDICTION SCRIPT
============================================================================

This script provides car price prediction with image display:
1. Load car image + details
2. Extract image features using ResNet50
3. Process tabular features
4. Predict price using trained ensemble model
5. Display car image with prediction

Usage:
    # Interactive mode
    python predict.py --interactive

    # Single prediction
    python predict.py --make Toyota --model Camry --year 2020 --mileage 30000 --image_path car_images/car_000001.jpg

    # Batch prediction from CSV
    python predict.py --batch_file cars_to_predict.csv --output predictions.csv

"""

import pandas as pd
import numpy as np
import os
import sys
import logging
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime
from pathlib import Path
import warnings
import pickle
import argparse

# Deep learning imports
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras.applications.resnet50 import preprocess_input as resnet_preprocess
    from tensorflow.keras.preprocessing import image
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("WARNING: TensorFlow not available.")

# Image display imports
try:
    import matplotlib.pyplot as plt
    from matplotlib import image as mpimg
    PLOTTING_AVAILABLE = True
except ImportError:
    PLOTTING_AVAILABLE = False
    print("WARNING: Matplotlib not available. Image display disabled.")

from PIL import Image
import warnings

warnings.filterwarnings('ignore')

# ============================================================================
# CONFIGURATION
# ============================================================================

MODELS_DIR = Path("models")
IMAGES_DIR = Path("car_images")
OUTPUT_DIR = Path("predictions")
LOG_FILE = "prediction.log"

MODEL_FILE = MODELS_DIR / "best_model.pkl"
CNN_MODEL_FILE = MODELS_DIR / "cnn_feature_extractor.h5"
ENCODERS_FILE = MODELS_DIR / "encoders.pkl"
SCALER_FILE = MODELS_DIR / "scaler.pkl"
FEATURE_INFO_FILE = MODELS_DIR / "feature_info.pkl"

IMAGE_SIZE = (224, 224)

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
            self.feature_info = {'tabular_features': [], 'image_feature_dim': 2048}


# ============================================================================
# IMAGE PROCESSING
# ============================================================================

def load_image(image_path: str) -> Optional[Image.Image]:
    """Load image from file path."""
    try:
        if not image_path or pd.isna(image_path):
            return None

        img_path = Path(image_path)
        if not img_path.exists():
            # Try relative to images directory
            img_path = IMAGES_DIR / image_path
            if not img_path.exists():
                return None

        img = Image.open(img_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        return img
    except Exception as e:
        logger.debug(f"Failed to load image {image_path}: {str(e)}")
        return None


def preprocess_image(img: Image.Image, target_size: Tuple[int, int] = IMAGE_SIZE) -> np.ndarray:
    """Preprocess image for CNN input."""
    img_resized = img.resize(target_size, Image.LANCZOS)
    img_array = image.img_to_array(img_resized)
    img_array = np.expand_dims(img_array, axis=0)
    return img_array


def extract_image_features(img: Image.Image, cnn_model: keras.Model,
                          preprocess_func) -> np.ndarray:
    """
    Extract features from image using CNN.

    Parameters:
    -----------
    img : Image.Image
        PIL Image
    cnn_model : keras.Model
        CNN feature extractor
    preprocess_func : callable
        Preprocessing function

    Returns:
    --------
    features : np.ndarray
        Extracted features
    """
    if cnn_model is None:
        return np.zeros(2048)  # Return zero vector if no CNN model

    try:
        img_array = preprocess_image(img)
        img_array = preprocess_func(img_array)
        features = cnn_model.predict(img_array, verbose=0)
        return features.flatten()
    except Exception as e:
        logger.error(f"Feature extraction failed: {str(e)}")
        return np.zeros(2048)


# ============================================================================
# FEATURE PREPARATION
# ============================================================================

def prepare_features(car_data: Dict[str, Any], model_loader: ModelLoader,
                     image_path: Optional[str] = None) -> np.ndarray:
    """
    Prepare features for prediction from car data.

    Parameters:
    -----------
    car_data : Dict[str, Any]
        Car data dictionary
    model_loader : ModelLoader
        Loaded models and preprocessors
    image_path : Optional[str]
        Path to car image

    Returns:
    --------
    features : np.ndarray
        Prepared feature vector
    """
    # Extract tabular features
    feature_info = model_loader.feature_info
    tabular_feature_cols = feature_info.get('tabular_features', [
        'year', 'mileage', 'engine_size', 'cylinders', 'age_of_car',
        'make_encoded', 'model_encoded', 'condition_encoded',
        'fuel_type_encoded',
        'year_mileage_interaction', 'engine_cylinders_interaction',
        'mileage_per_year', 'brand_popularity'
    ])

    # Calculate age
    current_year = datetime.now().year
    year = car_data.get('year', current_year)
    age_of_car = current_year - year

    # Build feature dictionary
    feature_dict = {}

    # Numeric features
    feature_dict['year'] = year
    feature_dict['mileage'] = car_data.get('mileage', 50000)
    feature_dict['engine_size'] = car_data.get('engine_size', 2.0)
    feature_dict['cylinders'] = car_data.get('cylinders', 4)
    feature_dict['age_of_car'] = age_of_car

    # Encode categorical features
    encoders = model_loader.encoders

    for col in ['make', 'model', 'condition', 'fuel_type']:
        value = car_data.get(col, 'Unknown')
        encoded_col = f'{col}_encoded'

        if col in encoders:
            try:
                # Handle unseen categories
                if str(value) in encoders[col].classes_:
                    encoded_value = encoders[col].transform([str(value)])[0]
                else:
                    encoded_value = 0  # Default for unseen categories
            except (ValueError, KeyError):
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

    # Build tabular feature vector
    tabular_features = []
    for col in tabular_feature_cols:
        tabular_features.append(feature_dict.get(col, 0))

    tabular_features = np.array(tabular_features)

    # Extract image features
    if image_path:
        img = load_image(image_path)
        if img is not None:
            image_features = extract_image_features(
                img, model_loader.cnn_model, model_loader.preprocess_func
            )
        else:
            logger.warning(f"Could not load image: {image_path}")
            image_features = np.zeros(feature_info.get('image_feature_dim', 2048))
    else:
        image_features = np.zeros(feature_info.get('image_feature_dim', 2048))

    # Combine features
    combined_features = np.hstack([tabular_features, image_features])

    return combined_features


# ============================================================================
# PREDICTION FUNCTIONS
# ============================================================================

def predict_price(car_data: Dict[str, Any], model_loader: ModelLoader,
                  image_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Predict price for a single car.

    Parameters:
    -----------
    car_data : Dict[str, Any]
        Car data dictionary
    model_loader : ModelLoader
        Loaded models
    image_path : Optional[str]
        Path to car image

    Returns:
    --------
    prediction : Dict[str, Any]
        Prediction results
    """
    try:
        # Prepare features
        features = prepare_features(car_data, model_loader, image_path)

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
            'car_data': car_data,
            'image_path': image_path
        }

    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'car_data': car_data,
            'image_path': image_path
        }


def display_prediction(prediction: Dict[str, Any]):
    """
    Display car image with prediction.

    Parameters:
    -----------
    prediction : Dict[str, Any]
        Prediction results
    """
    if not PLOTTING_AVAILABLE:
        print("\n" + "=" * 60)
        print("PREDICTION RESULT")
        print("=" * 60)
        car_data = prediction['car_data']
        print(f"Make: {car_data.get('make', 'N/A')}")
        print(f"Model: {car_data.get('model', 'N/A')}")
        print(f"Year: {car_data.get('year', 'N/A')}")
        print(f"Mileage: {car_data.get('mileage', 'N/A'):,.0f}")
        print(f"Condition: {car_data.get('condition', 'N/A')}")
        print(f"Fuel Type: {car_data.get('fuel_type', 'N/A')}")
        print(f"\nPredicted Price: ${prediction['predicted_price']:,.2f}")
        print("=" * 60)
        return

    car_data = prediction['car_data']
    image_path = prediction.get('image_path')

    # Create figure
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    # Display image
    if image_path:
        img = load_image(image_path)
        if img is not None:
            axes[0].imshow(img)
            axes[0].axis('off')
            axes[0].set_title('Car Image', fontsize=14, fontweight='bold')
        else:
            axes[0].text(0.5, 0.5, 'Image not available',
                        ha='center', va='center', fontsize=12)
            axes[0].axis('off')
    else:
        axes[0].text(0.5, 0.5, 'No image provided',
                    ha='center', va='center', fontsize=12)
        axes[0].axis('off')

    # Display prediction details
    axes[1].axis('off')
    details_text = f"""
    CAR DETAILS
    ──────────────────────────────
    Make:        {car_data.get('make', 'N/A')}
    Model:       {car_data.get('model', 'N/A')}
    Year:        {car_data.get('year', 'N/A')}
    Mileage:     {car_data.get('mileage', 'N/A'):,.0f} miles
    Engine Size: {car_data.get('engine_size', 'N/A')}L
    Cylinders:   {car_data.get('cylinders', 'N/A')}
    Condition:   {car_data.get('condition', 'N/A')}
    Fuel Type:   {car_data.get('fuel_type', 'N/A')}

    ──────────────────────────────

    PREDICTED PRICE
    ──────────────────────────────
    ${prediction['predicted_price']:,.2f}
    ──────────────────────────────
    """

    axes[1].text(0.1, 0.5, details_text, fontsize=12,
                verticalalignment='center', family='monospace',
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    plt.suptitle('Car Price Prediction', fontsize=16, fontweight='bold')
    plt.tight_layout()
    plt.show()


# ============================================================================
# MAIN FUNCTIONS
# ============================================================================

def interactive_mode(model_loader: ModelLoader):
    """Interactive prediction mode."""
    print("\n" + "=" * 60)
    print("INTERACTIVE CAR PRICE PREDICTION")
    print("=" * 60)

    car_data = {}

    car_data['make'] = input("Make: ").strip() or 'Toyota'
    car_data['model'] = input("Model: ").strip() or 'Camry'
    car_data['year'] = int(input("Year: ").strip() or '2020')
    car_data['mileage'] = float(input("Mileage: ").strip() or '30000')
    car_data['engine_size'] = float(input("Engine Size (L): ").strip() or '2.5')
    car_data['cylinders'] = int(input("Cylinders: ").strip() or '4')
    car_data['condition'] = input("Condition (New/Used/Good/Fair): ").strip() or 'Good'
    car_data['fuel_type'] = input("Fuel Type (Gasoline/Diesel/Hybrid/EV): ").strip() or 'Gasoline'

    image_path = input("Image path (optional, press Enter to skip): ").strip() or None

    print("\nPredicting...")
    result = predict_price(car_data, model_loader, image_path)

    if result['success']:
        display_prediction(result)
    else:
        print(f"\nError: {result.get('error', 'Unknown error')}")


def batch_prediction(batch_file: str, output_file: str, model_loader: ModelLoader):
    """Batch prediction from CSV file."""
    logger.info(f"Batch prediction from {batch_file}")

    if not Path(batch_file).exists():
        logger.error(f"File not found: {batch_file}")
        return

    df = pd.read_csv(batch_file)
    logger.info(f"Loaded {len(df)} cars from {batch_file}")

    results = []

    for idx, row in df.iterrows():
        car_data = row.to_dict()

        # Get image path
        image_path = car_data.get('image_path') or car_data.get('image_1')

        result = predict_price(car_data, model_loader, image_path)

        if result['success']:
            result['car_data']['predicted_price'] = result['predicted_price']
        else:
            result['car_data']['predicted_price'] = None
            result['car_data']['error'] = result.get('error', 'Unknown error')

        results.append(result['car_data'])

    # Save results
    results_df = pd.DataFrame(results)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    results_df.to_csv(output_file, index=False)
    logger.info(f"Saved predictions to {output_file}")

    # Print summary
    successful = sum(1 for r in results if 'predicted_price' in r and r['predicted_price'] is not None)
    print(f"\nSummary:")
    print(f"  Total: {len(results)}")
    print(f"  Successful: {successful}")
    print(f"  Failed: {len(results) - successful}")
    if successful > 0:
        avg_price = np.mean([r['predicted_price'] for r in results if 'predicted_price' in r and r['predicted_price'] is not None])
        print(f"  Average predicted price: ${avg_price:,.2f}")


def main():
    """Main prediction function."""
    parser = argparse.ArgumentParser(
        description='Multi-Modal Car Price Prediction',
        formatter_class=argparse.RawDescriptionHelpFormatter
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
    parser.add_argument('--image_path', type=str, help='Path to car image')

    # Batch prediction arguments
    parser.add_argument('--batch_file', type=str, help='CSV file with car data')
    parser.add_argument('--output', type=str, help='Output CSV file for predictions')

    # Other arguments
    parser.add_argument('--interactive', action='store_true', help='Interactive mode')

    args = parser.parse_args()

    logger.info("=" * 80)
    logger.info("MULTI-MODAL CAR PRICE PREDICTION")
    logger.info("=" * 80)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Load models
    try:
        model_loader = ModelLoader()
    except Exception as e:
        logger.error(f"Failed to load models: {str(e)}")
        print(f"\nError: Failed to load models. Please train the model first using train_model.py")
        sys.exit(1)

    # Interactive mode
    if args.interactive:
        interactive_mode(model_loader)

    # Batch prediction
    elif args.batch_file:
        output_file = args.output or OUTPUT_DIR / f"predictions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        batch_prediction(args.batch_file, output_file, model_loader)

    # Single prediction
    elif args.make and args.model and args.year:
        car_data = {
            'make': args.make,
            'model': args.model,
            'year': args.year,
            'mileage': args.mileage or 30000,
            'engine_size': args.engine_size,
            'cylinders': args.cylinders,
            'condition': args.condition,
            'fuel_type': args.fuel_type
        }

        result = predict_price(car_data, model_loader, args.image_path)

        if result['success']:
            display_prediction(result)
        else:
            print(f"\nError: {result.get('error', 'Unknown error')}")

    else:
        parser.print_help()
        sys.exit(1)

    logger.info(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
