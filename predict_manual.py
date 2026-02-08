"""
Manual Prediction Script for Multi-Modal Car Price Model
Run this script to make predictions on new car data
"""

import pandas as pd
import numpy as np
import pickle
import torch
from pathlib import Path
from datetime import datetime
from PIL import Image
import torchvision.models as models
import torchvision.transforms as transforms
from torch import nn
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings('ignore')

# ============================================================================
# CONFIGURATION
# ============================================================================

MODELS_DIR = Path("models")
MODEL_FILE = MODELS_DIR / "best_model.pkl"
ENCODERS_FILE = MODELS_DIR / "encoders.pkl"
SCALER_FILE = MODELS_DIR / "scaler.pkl"
FEATURE_INFO_FILE = MODELS_DIR / "feature_info.pkl"
CNN_MODEL_FILE = MODELS_DIR / "cnn_feature_extractor.pt"

IMAGE_SIZE = (224, 224)
FEATURE_DIM = 2048
IMAGES_DIR = Path("car_images")

# Check for GPU
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {DEVICE}")

# ============================================================================
# LOAD MODEL AND COMPONENTS
# ============================================================================

def load_model_components():
    """Load all model components needed for prediction"""
    print("Loading model components...")

    # Load ensemble model
    with open(MODEL_FILE, 'rb') as f:
        ensemble_model = pickle.load(f)
    print(f"✓ Loaded ensemble model")

    # Load encoders
    with open(ENCODERS_FILE, 'rb') as f:
        encoders = pickle.load(f)
    print(f"✓ Loaded encoders: {list(encoders.keys())}")

    # Load scaler
    with open(SCALER_FILE, 'rb') as f:
        scaler = pickle.load(f)
    print(f"✓ Loaded scaler")

    # Load feature info
    with open(FEATURE_INFO_FILE, 'rb') as f:
        feature_info = pickle.load(f)
    print(f"✓ Loaded feature info")

    # Load CNN feature extractor
    cnn_model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
    cnn_model = nn.Sequential(*list(cnn_model.children())[:-1])
    cnn_model.load_state_dict(torch.load(CNN_MODEL_FILE, map_location=DEVICE))
    cnn_model = cnn_model.to(DEVICE)
    cnn_model.eval()
    print(f"✓ Loaded CNN feature extractor")

    # Preprocessing function
    preprocess_func = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    return ensemble_model, encoders, scaler, feature_info, cnn_model, preprocess_func

# ============================================================================
# FEATURE EXTRACTION
# ============================================================================

def load_image(image_path):
    """Load image from file path or URL"""
    try:
        if not image_path or pd.isna(image_path):
            return None

        # Check if URL
        if isinstance(image_path, str) and (image_path.startswith('http://') or image_path.startswith('https://')):
            import requests
            import io
            response = requests.get(image_path, timeout=10)
            img = Image.open(io.BytesIO(response.content))
        else:
            # Local file
            img_path = Path(image_path)
            if not img_path.exists():
                img_path = IMAGES_DIR / img_path.name
            if img_path.exists():
                img = Image.open(img_path)
            else:
                return None

        if img.mode != 'RGB':
            img = img.convert('RGB')
        return img
    except Exception as e:
        print(f"Warning: Could not load image {image_path}: {e}")
        return None

def extract_image_features(image_path, cnn_model, preprocess_func):
    """Extract features from a single image"""
    img = load_image(image_path)
    if img is None:
        return np.zeros(FEATURE_DIM)

    try:
        img_tensor = preprocess_func(img).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            features = cnn_model(img_tensor)
            features = features.view(features.size(0), -1)
            return features.cpu().numpy().flatten()
    except Exception as e:
        print(f"Warning: Feature extraction failed: {e}")
        return np.zeros(FEATURE_DIM)

def create_tabular_features(car_data, encoders):
    """Create tabular features from car data"""
    current_year = datetime.now().year

    # Age of car
    age_of_car = current_year - car_data['year']

    # Encode categorical variables
    make_encoded = encoders['make'].transform([car_data['make']])[0]
    model_encoded = encoders['model'].transform([car_data['model']])[0]
    condition_encoded = encoders['condition'].transform([car_data['condition']])[0]
    fuel_type_encoded = encoders['fuel_type'].transform([car_data['fuel_type']])[0]

    # Feature engineering
    year_mileage_interaction = car_data['year'] * car_data['mileage']
    engine_cylinders_interaction = car_data['engine_size'] * car_data['cylinders']
    mileage_per_year = car_data['mileage'] / (age_of_car + 1)

    # Brand popularity (simplified - you may need to load from training data)
    brand_popularity = 0.1  # Default value

    tabular_features = np.array([
        car_data['year'],
        car_data['mileage'],
        car_data['engine_size'],
        car_data['cylinders'],
        age_of_car,
        make_encoded,
        model_encoded,
        condition_encoded,
        fuel_type_encoded,
        year_mileage_interaction,
        engine_cylinders_interaction,
        mileage_per_year,
        brand_popularity
    ])

    return tabular_features

# ============================================================================
# PREDICTION FUNCTION
# ============================================================================

def predict_price(car_data, image_path=None):
    """
    Predict car price

    Parameters:
    -----------
    car_data : dict
        Dictionary with car features:
        {
            'year': int,
            'mileage': float,
            'engine_size': float,
            'cylinders': int,
            'make': str,
            'model': str,
            'condition': str,
            'fuel_type': str
        }
    image_path : str, optional
        Path to car image (file path or URL)

    Returns:
    --------
    predicted_price : float
        Predicted price in USD
    """
    # Load components (cached in real usage)
    ensemble_model, encoders, scaler, feature_info, cnn_model, preprocess_func = load_model_components()

    # Create tabular features
    tabular_features = create_tabular_features(car_data, encoders)

    # Extract image features
    if image_path:
        image_features = extract_image_features(image_path, cnn_model, preprocess_func)
    else:
        image_features = np.zeros(FEATURE_DIM)

    # Combine features
    combined_features = np.hstack([tabular_features, image_features])

    # Scale features
    combined_features_scaled = scaler.transform([combined_features])

    # Predict
    predicted_price = ensemble_model.predict(combined_features_scaled)[0]

    return max(0, predicted_price)  # Ensure non-negative

# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("CAR PRICE PREDICTION - MANUAL RUN")
    print("=" * 60)

    # Example 1: Prediction without image
    print("\n--- Example 1: Prediction without image ---")
    car_data = {
        'year': 2020,
        'mileage': 30000,
        'engine_size': 2.5,
        'cylinders': 4,
        'make': 'Toyota',
        'model': 'Camry',
        'condition': 'Good',
        'fuel_type': 'Gasoline'
    }

    try:
        price = predict_price(car_data)
        print(f"\nCar Details:")
        print(f"  Make: {car_data['make']} {car_data['model']}")
        print(f"  Year: {car_data['year']}")
        print(f"  Mileage: {car_data['mileage']:,} km")
        print(f"  Condition: {car_data['condition']}")
        print(f"\nPredicted Price: ${price:,.2f}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

    # Example 2: Prediction with image
    print("\n--- Example 2: Prediction with image ---")
    car_data2 = {
        'year': 2019,
        'mileage': 45000,
        'engine_size': 3.0,
        'cylinders': 6,
        'make': 'Honda',
        'model': 'Accord',
        'condition': 'Excellent',
        'fuel_type': 'Gasoline'
    }

    # You can provide an image path or URL here
    image_path = None  # Set to image path if available

    try:
        price2 = predict_price(car_data2, image_path=image_path)
        print(f"\nCar Details:")
        print(f"  Make: {car_data2['make']} {car_data2['model']}")
        print(f"  Year: {car_data2['year']}")
        print(f"  Mileage: {car_data2['mileage']:,} km")
        print(f"  Condition: {car_data2['condition']}")
        if image_path:
            print(f"  Image: {image_path}")
        print(f"\nPredicted Price: ${price2:,.2f}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)
