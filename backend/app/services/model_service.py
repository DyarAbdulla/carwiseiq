"""
Model Service - handles loading and prediction with tabular and multimodal models
"""

import logging
import os
import sys
import pickle
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional, Dict, Any, List
from glob import glob
import warnings

warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

# Add parent directories to path
CURRENT_DIR = Path(__file__).parent  # backend/app/services
BACKEND_DIR = CURRENT_DIR.parent.parent  # backend (go up 2 levels: services -> app -> backend)
ROOT_DIR = BACKEND_DIR.parent  # Root of project (parent of backend)

# Model paths - search in multiple locations
POSSIBLE_MODEL_DIRS = [
    ROOT_DIR / "models",  # Primary location: root/models/
    BACKEND_DIR / "models",  # Alternative: backend/models/
    ROOT_DIR,  # Root directory itself
]

# Log paths for debugging
logger.debug(f"Model search paths: CURRENT_DIR={CURRENT_DIR}, BACKEND_DIR={BACKEND_DIR}, ROOT_DIR={ROOT_DIR}")
logger.debug(f"Searching in directories: {[str(d) for d in POSSIBLE_MODEL_DIRS]}")

# Model file names to try (in priority order)
TABULAR_MODEL_NAMES = [
    "production_model_v1.0.pkl",
    "best_model_v2.pkl",
    "best_model.pkl",
    "car_price_model.pkl",
]

MULTIMODAL_MODEL_FILE = None  # Will be set if found
FEATURE_INFO_FILE = None  # Will be set if found
SCALER_FILE = None  # Will be set if found
ENCODERS_FILE = None  # Will be set if found

# Helper function to find model files
def _find_model_file(filename: str, dirs: List[Path]) -> Optional[Path]:
    """Find a model file in multiple directories"""
    for model_dir in dirs:
        if model_dir.exists():
            model_path = model_dir / filename
            if model_path.exists():
                return model_path
    return None

# Find tabular model
TABULAR_MODEL_FILE = None
for model_name in TABULAR_MODEL_NAMES:
    found = _find_model_file(model_name, POSSIBLE_MODEL_DIRS)
    if found:
        TABULAR_MODEL_FILE = found
        break

# Find other files
MULTIMODAL_MODEL_FILE = _find_model_file("multimodal_model.pkl", POSSIBLE_MODEL_DIRS)
FEATURE_INFO_FILE = _find_model_file("feature_info.pkl", POSSIBLE_MODEL_DIRS)
SCALER_FILE = _find_model_file("scaler.pkl", POSSIBLE_MODEL_DIRS)
ENCODERS_FILE = _find_model_file("encoders.pkl", POSSIBLE_MODEL_DIRS)


class ModelService:
    """Service for loading and using prediction models"""

    _instance = None
    _tabular_model = None
    _multimodal_model = None
    _feature_info = None
    _scaler = None
    _encoders = None
    _multimodal_available = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if self._tabular_model is None:
            self._load_models()

    def _load_models(self):
        """Load tabular and multimodal models with robust search"""
        try:
            # Load tabular model - search comprehensively
            tabular_model_loaded = False

            if TABULAR_MODEL_FILE and TABULAR_MODEL_FILE.exists():
                try:
                    logger.info(f"Attempting to load tabular model from: {TABULAR_MODEL_FILE}")
                    logger.info(f"Full path: {TABULAR_MODEL_FILE.resolve()}")

                    # Try pickle first (models are pickle dict format)
                    try:
                        with open(TABULAR_MODEL_FILE, 'rb') as f:
                            model_data = pickle.load(f)
                        # Check if it's a dict with 'model' key (format from core/predict_price.py)
                        if isinstance(model_data, dict) and 'model' in model_data:
                            self._tabular_model = model_data['model']
                            logger.info(f"SUCCESS: Tabular model loaded from {TABULAR_MODEL_FILE} (pickle dict format)")
                            tabular_model_loaded = True
                        elif hasattr(model_data, 'predict'):
                            # Direct model object
                            self._tabular_model = model_data
                            logger.info(f"SUCCESS: Tabular model loaded from {TABULAR_MODEL_FILE} (pickle model format)")
                            tabular_model_loaded = True
                    except Exception as pickle_error:
                        # Try joblib as fallback
                        try:
                            self._tabular_model = joblib.load(TABULAR_MODEL_FILE)
                            logger.info(f"SUCCESS: Tabular model loaded from {TABULAR_MODEL_FILE} (joblib format)")
                            tabular_model_loaded = True
                        except Exception as joblib_error:
                            logger.warning(f"Failed to load {TABULAR_MODEL_FILE} with pickle or joblib")
                            logger.warning(f"  Pickle error: {pickle_error}")
                            logger.warning(f"  Joblib error: {joblib_error}")
                except Exception as e:
                    logger.warning(f"Failed to load {TABULAR_MODEL_FILE}: {e}")

            # If primary model failed, search all directories for any .pkl file
            if not tabular_model_loaded:
                logger.info("Searching for tabular model in all known directories...")
                search_paths = []

                # Search in all possible directories
                for model_dir in POSSIBLE_MODEL_DIRS:
                    if model_dir.exists():
                        # Try each model name
                        for model_name in TABULAR_MODEL_NAMES:
                            model_path = model_dir / model_name
                            if model_path.exists():
                                search_paths.append(model_path)

                # Also search for any .pkl files (excluding cache and multimodal)
                for model_dir in POSSIBLE_MODEL_DIRS:
                    if model_dir.exists():
                        for pkl_file in model_dir.glob("*.pkl"):
                            if pkl_file.name not in ["multimodal_model.pkl"] and "cache" not in str(pkl_file):
                                if pkl_file not in search_paths:
                                    search_paths.append(pkl_file)

                # Try loading from found paths
                for model_path in search_paths:
                    try:
                        logger.info(f"Trying to load model from: {model_path}")
                        logger.info(f"Full path: {model_path.resolve()}")

                        # Try pickle first (models may be pickle format)
                        try:
                            with open(model_path, 'rb') as f:
                                model_data = pickle.load(f)
                            # Check if it's a dict with 'model' key (format from core/predict_price.py)
                            if isinstance(model_data, dict) and 'model' in model_data:
                                self._tabular_model = model_data['model']
                                logger.info(f"SUCCESS: Tabular model loaded from {model_path} (pickle dict format)")
                                tabular_model_loaded = True
                                break
                            elif hasattr(model_data, 'predict'):
                                # Direct model object
                                self._tabular_model = model_data
                                logger.info(f"SUCCESS: Tabular model loaded from {model_path} (pickle model format)")
                                tabular_model_loaded = True
                                break
                        except Exception as pickle_error:
                            # Try joblib as fallback
                            try:
                                self._tabular_model = joblib.load(model_path)
                                logger.info(f"SUCCESS: Tabular model loaded from {model_path} (joblib format)")
                                tabular_model_loaded = True
                                break
                            except Exception as joblib_error:
                                logger.warning(f"Failed to load {model_path} with pickle or joblib")
                                logger.warning(f"  Pickle error: {pickle_error}")
                                logger.warning(f"  Joblib error: {joblib_error}")
                                continue
                    except Exception as e:
                        logger.warning(f"Failed to load {model_path}: {e}")
                        continue

                if not tabular_model_loaded:
                    # Last resort: use Predictor service (which uses core/predict_price.py)
                    logger.warning("Could not load model directly. Will use Predictor service fallback.")
                    # Don't raise error - let _predict_tabular handle it

            # Load multimodal model (optional)
            if MULTIMODAL_MODEL_FILE and MULTIMODAL_MODEL_FILE.exists():
                try:
                    logger.info(f"Loading multimodal model from {MULTIMODAL_MODEL_FILE}")
                    self._multimodal_model = joblib.load(MULTIMODAL_MODEL_FILE)
                    self._multimodal_available = True
                    logger.info("Multimodal model loaded successfully")
                except Exception as e:
                    logger.warning(f"Failed to load multimodal model: {e}")
                    self._multimodal_available = False
            else:
                logger.info("Multimodal model not found - will use tabular-only predictions")
                self._multimodal_available = False

            # Load feature info if available
            if FEATURE_INFO_FILE and FEATURE_INFO_FILE.exists():
                try:
                    with open(FEATURE_INFO_FILE, 'rb') as f:
                        self._feature_info = pickle.load(f)
                    logger.info(f"Feature info loaded from {FEATURE_INFO_FILE}")
                except Exception as e:
                    logger.warning(f"Failed to load feature info: {e}")

            # Load scaler if available
            if SCALER_FILE and SCALER_FILE.exists():
                try:
                    self._scaler = joblib.load(SCALER_FILE)
                    logger.info(f"Scaler loaded from {SCALER_FILE}")
                except Exception as e:
                    logger.warning(f"Failed to load scaler: {e}")

            # Load encoders if available
            if ENCODERS_FILE and ENCODERS_FILE.exists():
                try:
                    self._encoders = joblib.load(ENCODERS_FILE)
                    logger.info(f"Encoders loaded from {ENCODERS_FILE}")
                except Exception as e:
                    logger.warning(f"Failed to load encoders: {e}")

            # Final check: if tabular model not loaded directly, that's OK - we'll use Predictor
            if not tabular_model_loaded:
                logger.info("Note: Tabular model will be loaded via Predictor service when needed")

        except Exception as e:
            logger.error(f"Error loading models: {e}", exc_info=True)
            # Don't raise - allow fallback to Predictor service
            logger.warning("Model loading had errors, but will attempt to use Predictor service fallback")

    @property
    def tabular_model(self):
        """Get tabular model (may be None if using Predictor fallback)"""
        return self._tabular_model

    @property
    def multimodal_model(self):
        """Get multimodal model (may be None)"""
        return self._multimodal_model

    @property
    def is_multimodal_available(self) -> bool:
        """Check if multimodal model is available"""
        return self._multimodal_available

    def predict(self, car_data: Dict[str, Any], image_features: Optional[np.ndarray] = None) -> float:
        """
        Predict price using tabular or multimodal model

        Args:
            car_data: Dictionary with car features
            image_features: Optional numpy array of image features (2048 dims from ResNet50)

        Returns:
            Predicted price as float
        """
        try:
            # If multimodal model available and image features provided, use multimodal
            if self._multimodal_available and image_features is not None:
                return self._predict_multimodal(car_data, image_features)
            else:
                # Use tabular model (fallback to existing predictor)
                return self._predict_tabular(car_data)
        except Exception as e:
            logger.error(f"Prediction error: {e}", exc_info=True)
            raise RuntimeError(f"Prediction failed: {str(e)}")

    def _predict_tabular(self, car_data: Dict[str, Any]) -> float:
        """Predict using tabular model only"""
        # Always use Predictor service (which loads models via core/predict_price.py)
        # This ensures compatibility with existing model loading logic
        from app.services.predictor import Predictor
        try:
            predictor = Predictor()
            return predictor.predict(car_data)
        except Exception as e:
            logger.error(f"Tabular prediction failed: {e}", exc_info=True)
            raise RuntimeError(f"Failed to predict price: {str(e)}")

    def _predict_multimodal(self, car_data: Dict[str, Any], image_features: np.ndarray) -> float:
        """Predict using multimodal model (tabular + image features)"""
        try:
            # Prepare tabular features
            tabular_features = self._prepare_tabular_features(car_data)

            # Combine tabular and image features
            # Assuming image_features is (2048,) and tabular_features is (13,)
            # Combined should be (2061,)
            if len(image_features.shape) == 1:
                image_features = image_features.reshape(1, -1)

            # Flatten image features
            image_flat = image_features.flatten()

            # Combine features
            combined_features = np.concatenate([tabular_features, image_flat])

            # Reshape for model input
            combined_features = combined_features.reshape(1, -1)

            # Predict
            prediction = self._multimodal_model.predict(combined_features)

            # Handle different output formats
            if isinstance(prediction, np.ndarray):
                if prediction.size == 1:
                    return float(prediction.item())
                return float(prediction[0])
            return float(prediction)

        except Exception as e:
            logger.error(f"Multimodal prediction error: {e}", exc_info=True)
            # Fallback to tabular
            logger.warning("Falling back to tabular prediction")
            return self._predict_tabular(car_data)

    def _prepare_tabular_features(self, car_data: Dict[str, Any]) -> np.ndarray:
        """Prepare tabular features for multimodal model"""
        # This should match the training feature order
        # Default feature order: year, mileage, engine_size, cylinders, condition_encoded,
        # fuel_type_encoded, location_encoded, make_encoded, model_encoded, etc.

        # Use existing predictor to get feature preparation
        # For now, return a simple feature vector
        # In production, this should match the exact feature order from training

        features = []

        # Numeric features
        features.append(float(car_data.get('year', 2020)))
        features.append(float(car_data.get('mileage', 50000)))
        features.append(float(car_data.get('engine_size', 2.0)))
        features.append(float(car_data.get('cylinders', 4)))

        # Encoded categorical features (simplified - should use actual encoders)
        condition_map = {'New': 0, 'Like New': 1, 'Excellent': 2, 'Good': 3, 'Fair': 4, 'Poor': 5, 'Salvage': 6}
        fuel_map = {'Gasoline': 0, 'Diesel': 1, 'Electric': 2, 'Hybrid': 3, 'Plug-in Hybrid': 4, 'Other': 5}

        features.append(float(condition_map.get(car_data.get('condition', 'Good'), 3)))
        features.append(float(fuel_map.get(car_data.get('fuel_type', 'Gasoline'), 0)))

        # Location, make, model encoding (simplified - should use actual encoders)
        features.append(0.0)  # location_encoded
        features.append(0.0)  # make_encoded
        features.append(0.0)  # model_encoded

        # Additional features if needed
        features.append(float(car_data.get('year', 2020)) * float(car_data.get('mileage', 50000)))  # interaction

        return np.array(features)
