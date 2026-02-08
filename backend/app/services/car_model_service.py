"""
Local car make/model classifier inference.

Uses a trained EfficientNetB4 two-headed model (make + model).
Loads from models/car_classifier.keras and models/car_classifier_label_maps.json.
Expects 4-10 images; returns make, model, confidence. If confidence < 0.6, returns null for that field.
"""

from __future__ import annotations

import io
import json
import logging
from pathlib import Path
from statistics import mode
from typing import List

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

# Paths: project root / models (backend/app/services -> backend -> project)
_APP_DIR = Path(__file__).resolve().parent.parent  # app
_BACKEND_DIR = _APP_DIR.parent
_ROOT = _BACKEND_DIR.parent
_MODEL_DIR = _ROOT / "models"

DEFAULT_MODEL_PATH = _MODEL_DIR / "car_classifier.keras"
DEFAULT_LABEL_MAPS_PATH = _MODEL_DIR / "car_classifier_label_maps.json"

# Also support .h5 for legacy
_MODEL_PATHS = [
    getattr(settings, "CAR_CLASSIFIER_MODEL", None) and Path(settings.CAR_CLASSIFIER_MODEL),
    DEFAULT_MODEL_PATH,
    _MODEL_DIR / "car_classifier.h5",
]
_LABEL_PATHS = [
    getattr(settings, "CAR_CLASSIFIER_LABEL_MAPS", None) and Path(settings.CAR_CLASSIFIER_LABEL_MAPS),
    DEFAULT_LABEL_MAPS_PATH,
]

_model = None
_label_maps = None
_CONFIDENCE_THRESHOLD = 0.6


def _resolve_paths() -> tuple[Path | None, Path | None]:
    model_path, maps_path = None, None
    for p in _MODEL_PATHS:
        if p and Path(p).exists():
            model_path = Path(p)
            break
    for p in _LABEL_PATHS:
        if p and Path(p).exists():
            maps_path = Path(p)
            break
    return model_path, maps_path


def _load_model() -> bool:
    global _model, _label_maps
    if _model is not None and _label_maps is not None:
        return True

    model_path, maps_path = _resolve_paths()
    if not model_path or not maps_path:
        logger.warning("Car classifier not found: model=%s, label_maps=%s", model_path, maps_path)
        return False

    try:
        import tensorflow as tf

        _model = tf.keras.models.load_model(str(model_path))
        with open(maps_path, encoding="utf-8") as f:
            _label_maps = json.load(f)
        logger.info("Loaded car classifier from %s", model_path)
        return True
    except Exception as e:
        logger.exception("Failed to load car classifier: %s", e)
        return False


def detect_car_from_images(images: List[bytes]) -> dict:
    """
    Run inference on 4-10 raw image bytes (jpeg/png).

    Returns:
        { make: str|None, model: str|None, confidence: float, error: str|None }
    """
    if not images or len(images) < 4 or len(images) > 10:
        return {
            "make": None,
            "model": None,
            "confidence": 0.0,
            "error": "Between 4 and 10 images are required",
        }

    if not _load_model():
        return {
            "make": None,
            "model": None,
            "confidence": 0.0,
            "error": "Car classifier model not loaded. Run training (03_train_model.py) first.",
        }

    try:
        from PIL import Image
        from tensorflow.keras.applications.efficientnet import preprocess_input

        target = (224, 224)
        make_list = _label_maps.get("make_list") or []
        model_list = _label_maps.get("model_list") or []
        num_makes = len(make_list)
        num_models = len(model_list)
        if num_makes == 0 or num_models == 0:
            return {"make": None, "model": None, "confidence": 0.0, "error": "Invalid label_maps"}

        arrs = []
        for raw in images:
            try:
                img = Image.open(io.BytesIO(raw)).convert("RGB")
                img = img.resize(target, Image.Resampling.BILINEAR)
                a = np.array(img, dtype=np.float32)
                a = preprocess_input(a)
                arrs.append(a)
            except Exception as e:
                logger.debug("Skip image: %s", e)
                continue

        if not arrs:
            return {"make": None, "model": None, "confidence": 0.0, "error": "No valid images"}

        batch = np.stack(arrs)
        pred = _model.predict(batch, verbose=0)
        make_probs = pred[0]  # (N, num_makes)
        model_probs = pred[1]  # (N, num_models)

        # Majority vote for make
        make_preds = np.argmax(make_probs, axis=1).tolist()
        try:
            make_idx = mode(make_preds)
        except Exception:
            make_idx = int(np.argmax(np.mean(make_probs, axis=0)))
        make_confidence = float(np.mean(make_probs[:, make_idx]))
        make_str = make_list[make_idx] if 0 <= make_idx < num_makes else None
        if make_str == "Unknown" or make_confidence < _CONFIDENCE_THRESHOLD:
            make_str = None

        # Majority vote for model
        model_preds = np.argmax(model_probs, axis=1).tolist()
        try:
            model_idx = mode(model_preds)
        except Exception:
            model_idx = int(np.argmax(np.mean(model_probs, axis=0)))
        model_confidence = float(np.mean(model_probs[:, model_idx]))
        model_str = model_list[model_idx] if 0 <= model_idx < num_models else None
        if model_str == "Unknown" or model_confidence < _CONFIDENCE_THRESHOLD:
            model_str = None

        # Overall confidence
        parts = [make_confidence if make_str else 0.0, model_confidence if model_str else 0.0]
        confidence = sum(parts) / len([p for p in parts if p > 0]) if any(p > 0 for p in parts) else 0.0

        return {
            "make": make_str,
            "model": model_str,
            "confidence": round(confidence, 4),
            "error": None,
        }
    except Exception as e:
        logger.exception("Car classifier inference failed: %s", e)
        return {
            "make": None,
            "model": None,
            "confidence": 0.0,
            "error": str(e),
        }
