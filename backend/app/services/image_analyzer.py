"""
Image Analyzer Service - analyzes car images using CNN feature extraction
"""

import logging
import os
import sys
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from PIL import Image
import io
import warnings

warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

# Try to import TensorFlow/Keras for CNN
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras.applications import ResNet50
    from tensorflow.keras.applications.resnet50 import preprocess_input as resnet_preprocess
    from tensorflow.keras.preprocessing import image as keras_image
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.warning("TensorFlow not available - image analysis will be limited")

# Try to import torch for alternative
try:
    import torch
    import torchvision.transforms as transforms
    from torchvision.models import resnet50, ResNet50_Weights
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class ImageAnalyzer:
    """Service for analyzing car images"""

    _instance = None
    _feature_extractor = None
    _model_loaded = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ImageAnalyzer, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._model_loaded:
            self._load_model()

    def _load_model(self):
        """Load CNN feature extractor"""
        try:
            if TF_AVAILABLE:
                logger.info("Loading ResNet50 feature extractor (TensorFlow)")
                # Load pre-trained ResNet50 without top layer
                base_model = ResNet50(
                    weights='imagenet',
                    include_top=False,
                    pooling='avg',
                    input_shape=(224, 224, 3)
                )
                self._feature_extractor = base_model
                self._model_loaded = True
                logger.info("ResNet50 loaded successfully")
            elif TORCH_AVAILABLE:
                logger.info("Loading ResNet50 feature extractor (PyTorch)")
                model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)
                model.fc = torch.nn.Identity()  # Remove classification layer
                model.eval()
                self._feature_extractor = model
                self._model_loaded = True
                logger.info("ResNet50 (PyTorch) loaded successfully")
            else:
                logger.warning("No deep learning framework available - using basic image analysis")
                self._model_loaded = False
        except Exception as e:
            logger.error(f"Error loading feature extractor: {e}", exc_info=True)
            self._model_loaded = False

    def extract_features(self, image_path: str) -> Optional[np.ndarray]:
        """
        Extract CNN features from an image

        Args:
            image_path: Path to image file

        Returns:
            Feature vector (2048 dimensions) or None if failed
        """
        try:
            if not self._model_loaded:
                logger.warning("Feature extractor not loaded - cannot extract features")
                return None

            # Load and preprocess image
            img = Image.open(image_path)
            img = img.convert('RGB')
            img = img.resize((224, 224))

            if TF_AVAILABLE:
                # Convert to array
                img_array = keras_image.img_to_array(img)
                img_array = np.expand_dims(img_array, axis=0)
                img_array = resnet_preprocess(img_array)

                # Extract features
                features = self._feature_extractor.predict(img_array, verbose=0)
                return features.flatten()

            elif TORCH_AVAILABLE:
                # PyTorch preprocessing
                transform = transforms.Compose([
                    transforms.Resize((224, 224)),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                ])
                img_tensor = transform(img).unsqueeze(0)

                with torch.no_grad():
                    features = self._feature_extractor(img_tensor)
                    return features.numpy().flatten()

            return None

        except Exception as e:
            logger.error(f"Error extracting features from {image_path}: {e}")
            return None

    def analyze_images(self, image_paths: List[str]) -> Dict[str, Any]:
        """
        Analyze multiple car images and return AI description + guesses

        Args:
            image_paths: List of paths to image files

        Returns:
            Dictionary with analysis results:
            {
                "summary": "...",
                "bullets": ["...", "..."],
                "guessed_make": "...|null",
                "guessed_model": "...|null",
                "guessed_color": "...|null",
                "condition": "excellent|good|fair|poor|unknown",
                "confidence": 0-1,
                "image_features": np.ndarray (average of all images)
            }
        """
        if not image_paths:
            return self._default_response()

        try:
            # Extract features from all images
            features_list = []
            valid_images = []

            for img_path in image_paths:
                if not os.path.exists(img_path):
                    logger.warning(f"Image not found: {img_path}")
                    continue

                features = self.extract_features(img_path)
                if features is not None:
                    features_list.append(features)
                    valid_images.append(img_path)

            if not features_list:
                logger.warning("No valid images processed")
                return self._default_response()

            # Average features across all images
            avg_features = np.mean(features_list, axis=0)

            # Validate feature dimensions
            if len(avg_features) != 2048:
                logger.error(f"Invalid feature dimension: {len(avg_features)}, expected 2048")
                return self._default_response()

            # Analyze images (basic heuristics only - no make/model detection without classifier)
            analysis = self._analyze_image_content(image_paths[:3])  # Analyze first 3 images

            # Combine with feature extraction results
            # NOTE: guessed_make/model are null unless we have a trained classifier
            result = {
                "summary": analysis["summary"],
                "bullets": analysis["bullets"],
                "guessed_make": None,  # No classifier - set to null
                "guessed_model": None,  # No classifier - set to null
                "guessed_color": analysis.get("guessed_color"),
                "condition": analysis.get("condition", "unknown"),
                "confidence": 0.0 if not self._model_loaded else analysis.get("confidence", 0.5),
                "image_features": avg_features.tolist()  # Always return 2048-dim features if ResNet50 loaded
            }

            return result

        except Exception as e:
            logger.error(f"Error analyzing images: {e}", exc_info=True)
            return self._default_response()

    def _analyze_image_content(self, image_paths: List[str]) -> Dict[str, Any]:
        """
        Analyze image content using basic heuristics
        In production, this would use a trained classifier
        """
        try:
            # Basic analysis using PIL
            colors = []
            conditions = []

            for img_path in image_paths[:3]:  # Analyze first 3
                try:
                    img = Image.open(img_path)
                    img = img.convert('RGB')

                    # Get dominant color
                    colors.append(self._get_dominant_color(img))

                    # Basic condition assessment (simplified)
                    # In production, use a trained model
                    condition = self._assess_condition(img)
                    conditions.append(condition)

                except Exception as e:
                    logger.warning(f"Error analyzing {img_path}: {e}")
                    continue

            # Aggregate results
            dominant_color = self._most_common(colors) if colors else None
            avg_condition = self._most_common(conditions) if conditions else "unknown"

            # Generate summary
            summary = f"Car appears to be in {avg_condition} condition"
            if dominant_color:
                summary += f" with {dominant_color} exterior"

            bullets = []
            if dominant_color:
                bullets.append(f"Color: {dominant_color}")
            bullets.append(f"Condition: {avg_condition}")
            bullets.append(f"Analyzed {len(image_paths)} image(s)")

            return {
                "summary": summary,
                "bullets": bullets,
                "guessed_make": None,  # No classifier available - set to null
                "guessed_model": None,  # No classifier available - set to null
                "guessed_color": dominant_color,
                "condition": avg_condition,
                "confidence": 0.6 if dominant_color else 0.4
            }

        except Exception as e:
            logger.error(f"Error in image content analysis: {e}")
            return self._default_response()

    def _get_dominant_color(self, img: Image.Image) -> Optional[str]:
        """Get dominant color from image"""
        try:
            # Resize for faster processing
            img = img.resize((100, 100))
            pixels = list(img.getdata())

            # Simple color mapping
            color_counts = {}
            for r, g, b in pixels:
                # Map to color names
                if r > 200 and g > 200 and b > 200:
                    color = "White"
                elif r < 50 and g < 50 and b < 50:
                    color = "Black"
                elif r > g and r > b:
                    color = "Red"
                elif g > r and g > b:
                    color = "Green"
                elif b > r and b > g:
                    color = "Blue"
                elif r > 150 and g > 150:
                    color = "Yellow/Gold"
                elif r > g:
                    color = "Orange"
                else:
                    color = "Gray/Silver"

                color_counts[color] = color_counts.get(color, 0) + 1

            if color_counts:
                return max(color_counts, key=color_counts.get)
            return None

        except Exception as e:
            logger.warning(f"Error getting dominant color: {e}")
            return None

    def _assess_condition(self, img: Image.Image) -> str:
        """Assess car condition from image (simplified)"""
        # In production, use a trained model
        # For now, return a default
        return "good"

    def _most_common(self, items: List[Any]) -> Any:
        """Get most common item in list"""
        if not items:
            return None
        return max(set(items), key=items.count)

    def _default_response(self) -> Dict[str, Any]:
        """Return default response when analysis fails"""
        return {
            "summary": "Unable to analyze images - ResNet50 not available",
            "bullets": ["Image analysis unavailable - deep learning framework not installed"],
            "guessed_make": None,
            "guessed_model": None,
            "guessed_color": None,
            "condition": "unknown",
            "confidence": 0.0,
            "image_features": None  # None when ResNet50 not available
        }
