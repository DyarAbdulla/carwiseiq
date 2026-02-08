"""
Car Detection Service - Real CLIP-based car detection from images
Uses OpenAI CLIP for zero-shot classification
Supports fine-tuned models when available
"""

import logging
import numpy as np
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import hashlib
import json
import os
import time
import re
from datetime import datetime
from PIL import Image
import difflib

try:
    import torch
    from transformers import CLIPProcessor, CLIPModel
    ML_AVAILABLE = True
except ImportError:
    torch = None
    CLIPProcessor = None
    CLIPModel = None
    ML_AVAILABLE = False

logger = logging.getLogger(__name__)
if not ML_AVAILABLE:
    logger.warning("torch/transformers not available - car detection will return not available")

# Global model cache
_clip_model = None
_clip_processor = None
_make_classifier = None  # Trained classifier head
_finetuned_mappings = None  # make_to_idx, idx_to_make
_device = None
_labels_cache = None
_labels_version = None
_is_finetuned = False  # Track if using fine-tuned model

# Path to fine-tuned model
FINETUNED_MODEL_DIR = Path(__file__).parent.parent.parent.parent / "models" / "car_clip_finetuned"

# Color labels (fixed - must match Step 4 dropdown)
COLOR_LABELS = ["Black", "White", "Silver", "Gray", "Blue", "Red", "Green", "Yellow", "Brown", "Beige", "Gold", "Orange"]

# Year range labels
YEAR_RANGE_LABELS = ["1990s", "2000s", "2010-2014", "2015-2018", "2019-2021", "2022-2026"]

# Config
MIN_MODEL_COUNT = 10  # Drop models with count < this in dataset
MAX_MODEL_LENGTH = 25  # Max model name length


def _get_device():
    """Get device (cuda if available, else cpu)"""
    global _device
    if not ML_AVAILABLE:
        return "none"
    if _device is None:
        _device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {_device}")
    return _device


def _load_clip_model():
    """Load CLIP model and processor (cached globally)
    
    Tries to load fine-tuned model with classifier head first, falls back to base CLIP if not available.
    """
    global _clip_model, _clip_processor, _make_classifier, _finetuned_mappings, _is_finetuned
    
    if not ML_AVAILABLE:
        raise RuntimeError("Car detection is not available (torch/transformers not installed)")
    if _clip_model is not None and _clip_processor is not None:
        return _clip_model, _clip_processor
    
    device = _get_device()
    
    # Try to load fine-tuned model first
    finetuned_checkpoint = FINETUNED_MODEL_DIR / "best_model.pt"
    if finetuned_checkpoint.exists():
        try:
            logger.info(f"Loading fine-tuned CLIP model from {finetuned_checkpoint}")
            
            checkpoint = torch.load(finetuned_checkpoint, map_location='cpu')
            
            # Load base model
            _clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            
            # Load fine-tuned weights
            if 'clip_state_dict' in checkpoint:
                _clip_model.load_state_dict(checkpoint['clip_state_dict'])
                logger.info("Loaded fine-tuned CLIP weights")
            
            # Load classifier head
            if 'classifier_state_dict' in checkpoint:
                num_makes = len(checkpoint.get('mappings', {}).get('make_to_idx', {}))
                if num_makes > 0:
                    _make_classifier = torch.nn.Linear(_clip_model.config.projection_dim, num_makes)
                    _make_classifier.load_state_dict(checkpoint['classifier_state_dict'])
                    _make_classifier.to(device)
                    _make_classifier.eval()
                    logger.info(f"Loaded trained classifier head for {num_makes} makes")
            
            # Load mappings
            if 'mappings' in checkpoint:
                _finetuned_mappings = checkpoint['mappings']
                logger.info(f"Loaded mappings: {len(_finetuned_mappings.get('make_to_idx', {}))} makes")
            
            # Load processor
            processor_path = FINETUNED_MODEL_DIR / "processor"
            if processor_path.exists():
                _clip_processor = CLIPProcessor.from_pretrained(processor_path)
            else:
                _clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            
            _clip_model.to(device)
            _clip_model.eval()
            _is_finetuned = True
            
            logger.info(f"Fine-tuned CLIP model loaded successfully on {device}")
            return _clip_model, _clip_processor
            
        except Exception as e:
            logger.warning(f"Failed to load fine-tuned model, falling back to base CLIP: {e}")
    
    # Fall back to base CLIP model
    try:
        logger.info("Loading base CLIP model: openai/clip-vit-base-patch32")
        
        _clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        _clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        
        _clip_model.to(device)
        _clip_model.eval()
        _is_finetuned = False
        
        logger.info(f"Base CLIP model loaded successfully on {device}")
        return _clip_model, _clip_processor
        
    except Exception as e:
        logger.error(f"Failed to load CLIP model: {e}", exc_info=True)
        raise


def is_using_finetuned_model() -> bool:
    """Check if using fine-tuned model."""
    return _is_finetuned


def _predict_make_with_classifier(image: Image.Image) -> Optional[Dict]:
    """
    Predict car make using the trained classifier head.
    Returns dict with make predictions and confidence scores.
    """
    global _clip_model, _clip_processor, _make_classifier, _finetuned_mappings
    
    if _make_classifier is None or _finetuned_mappings is None:
        return None
    
    device = _get_device()
    
    try:
        # Process image
        inputs = _clip_processor(images=image, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        with torch.no_grad():
            # Get image embeddings from CLIP
            image_features = _clip_model.get_image_features(**inputs)
            
            # Normalize embeddings
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
            # Get make predictions from classifier
            logits = _make_classifier(image_features)
            probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]
        
        # Get idx_to_make mapping
        idx_to_make = _finetuned_mappings.get('idx_to_make', {})
        
        # Create predictions dict
        make_probs = {}
        for idx, prob in enumerate(probs):
            make_name = idx_to_make.get(str(idx), f"Unknown_{idx}")
            make_probs[make_name] = float(prob)
        
        # Get top predictions
        top_indices = np.argsort(probs)[::-1][:10]
        top_predictions = []
        for idx in top_indices:
            make_name = idx_to_make.get(str(idx), f"Unknown_{idx}")
            top_predictions.append({
                'make': make_name,
                'confidence': float(probs[idx])
            })
        
        logger.debug(f"Classifier predictions: top={top_predictions[0]['make']} ({top_predictions[0]['confidence']:.2%})")
        
        return {
            'make_probs': make_probs,
            'top_predictions': top_predictions,
            'best_make': top_predictions[0]['make'],
            'best_confidence': top_predictions[0]['confidence']
        }
        
    except Exception as e:
        logger.error(f"Classifier prediction failed: {e}", exc_info=True)
        return None


def warmup_clip_model():
    """
    Warmup function to pre-load CLIP model and run a dummy inference
    Call this during server startup to avoid first-request delay
    """
    if not ML_AVAILABLE:
        logger.warning("CLIP warmup skipped (torch/transformers not installed)")
        return
    try:
        logger.info("Warming up CLIP model...")
        
        # Load model
        model, processor = _load_clip_model()
        device = _get_device()
        
        # Load labels (this also validates dataset is available)
        labels = _load_labels_from_dataset()
        makes = labels.get("makes", [])
        
        if not makes:
            logger.warning("No makes found in labels, skipping warmup inference")
            return
        
        # Run a dummy inference with a simple test image
        # Create a small test image (1x1 pixel RGB)
        test_image = Image.new('RGB', (224, 224), color='red')
        test_labels = [f"a photo of a {makes[0]} vehicle"] if makes else ["a photo of a car"]
        
        with torch.no_grad():
            inputs = processor(text=test_labels, images=test_image, return_tensors="pt", padding=True)
            inputs = {k: v.to(device) for k, v in inputs.items()}
            outputs = model(**inputs)
            _ = outputs.logits_per_image.softmax(dim=1)
        
        logger.info("CLIP model warmup completed successfully")
        
    except Exception as e:
        logger.error(f"CLIP model warmup failed: {e}", exc_info=True)
        # Don't raise - allow server to start even if warmup fails
        # The model will load on first request instead


def _normalize_model_name(model: str) -> str:
    """Normalize model name for deduplication"""
    # Trim, lowercase, collapse spaces, remove extra symbols
    normalized = str(model).strip().lower()
    normalized = re.sub(r'\s+', ' ', normalized)  # Collapse spaces
    normalized = re.sub(r'[^\w\s-]', '', normalized)  # Remove special chars except dash
    return normalized


def get_labels_version() -> str:
    """Get version hash for labels (based on dataset file mtime + size)"""
    global _labels_version
    
    if _labels_version is not None:
        return _labels_version
    
    try:
        from app.config import settings
        dataset_path = settings.DATA_FILE
        
        if dataset_path.exists():
            stat = dataset_path.stat()
            _labels_version = hashlib.md5(f"{dataset_path}:{stat.st_size}:{stat.st_mtime}".encode()).hexdigest()[:8]
        else:
            _labels_version = "fallback"
        
        return _labels_version
    except:
        return "unknown"


def _load_labels_from_dataset():
    """Load makes and models from iqcars_cleaned.csv with filtering"""
    global _labels_cache
    
    if _labels_cache is not None:
        return _labels_cache
    
    try:
        from app.services.dataset_loader import DatasetLoader
        from app.config import settings
        
        logger.info("Loading labels from dataset...")
        
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset
        
        if df is None or len(df) == 0:
            error_msg = "Dataset not available or empty. Cannot perform detection without labels."
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.info(f"Dataset loaded: {len(df)} rows")
        
        # Verify required columns exist
        required_cols = ['make', 'model']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            error_msg = f"Dataset missing required columns: {missing_cols}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Get unique makes
        makes = df['make'].dropna().unique().tolist()
        makes = [str(m).strip() for m in makes if str(m).strip()]
        makes = sorted(list(set(makes)))
        
        if len(makes) == 0:
            error_msg = "No makes found in dataset. Dataset may be corrupted or empty."
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.info(f"Found {len(makes)} unique makes in dataset")
        
        # Get models by make (with filtering)
        models_by_make = {}
        models_by_make_filtered = {}  # Filtered version for "best" prediction
        
        for make in makes:
            make_df = df[df['make'].str.lower() == str(make).lower()]
            
            # Count model occurrences
            model_counts = make_df['model'].value_counts()
            
            # Get all models (for topk)
            all_models = make_df['model'].dropna().unique().tolist()
            all_models = [str(m).strip() for m in all_models if str(m).strip()]
            all_models = sorted(list(set(all_models)))
            models_by_make[make] = all_models
            
            # Filtered models (for best prediction)
            filtered_models = []
            seen_normalized = set()
            
            for model in all_models:
                # Filter: length <= MAX_MODEL_LENGTH
                if len(model) > MAX_MODEL_LENGTH:
                    continue
                
                # Filter: count >= MIN_MODEL_COUNT
                if model_counts.get(model, 0) < MIN_MODEL_COUNT:
                    continue
                
                # Deduplicate by normalization
                normalized = _normalize_model_name(model)
                if normalized in seen_normalized:
                    continue
                seen_normalized.add(normalized)
                
                filtered_models.append(model)
            
            models_by_make_filtered[make] = sorted(filtered_models)
        
        _labels_cache = {
            "makes": makes,
            "models_by_make": models_by_make,  # Full list for topk
            "models_by_make_filtered": models_by_make_filtered  # Filtered for best
        }
        logger.info(f"Loaded {len(makes)} makes, filtered models for quality")
        
        return _labels_cache
        
    except Exception as e:
        logger.error(f"Error loading labels from dataset: {e}", exc_info=True)
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Don't use fallback - raise error instead
        raise ValueError(f"Failed to load labels from dataset: {str(e)}")


def _normalize_prediction(value: str, valid_options: List[str]) -> Optional[str]:
    """
    Map predicted value to exact dropdown value
    
    Returns: Matched value from valid_options or None
    """
    if not value or not valid_options:
        return None
    
    value_str = str(value).strip()
    
    # 1. Exact match
    if value_str in valid_options:
        return value_str
    
    # 2. Case-insensitive match
    value_lower = value_str.lower()
    for option in valid_options:
        if option.lower() == value_lower:
            return option
    
    # 3. Similarity match (difflib)
    matches = difflib.get_close_matches(value_str, valid_options, n=1, cutoff=0.8)
    if matches:
        return matches[0]
    
    return None


def _crop_car_bbox(image_path: str) -> Optional[Image.Image]:
    """
    Optional: Crop car bounding box using YOLO
    Returns cropped image or None if YOLO not available or no car detected
    """
    try:
        from ultralytics import YOLO
        
        # Load YOLO model (COCO pretrained)
        yolo_model = YOLO('yolov8n.pt')  # nano model for speed
        
        # Run detection
        results = yolo_model(image_path, verbose=False)
        
        # Find car class (COCO class 2 = car, 3 = motorcycle, 5 = bus, 7 = truck)
        car_classes = [2, 3, 5, 7]
        car_boxes = []
        
        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls = int(box.cls[0])
                if cls in car_classes:
                    car_boxes.append(box.xyxy[0].cpu().numpy())
        
        if not car_boxes:
            return None
        
        # Use the largest car bbox
        largest_box = max(car_boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
        
        # Load and crop image
        img = Image.open(image_path).convert('RGB')
        x1, y1, x2, y2 = map(int, largest_box)
        cropped = img.crop((x1, y1, x2, y2))
        
        logger.debug(f"Cropped car bbox: {x1},{y1},{x2},{y2}")
        return cropped
        
    except ImportError:
        # YOLO not installed, skip cropping
        return None
    except Exception as e:
        logger.warning(f"YOLO crop failed: {e}, using full image")
        return None


def _clip_classify(image: Image.Image, text_labels: List[str], model, processor, device: str, return_logits: bool = False) -> Tuple[np.ndarray, Optional[np.ndarray]]:
    """
    Run CLIP zero-shot classification
    
    Args:
        image: PIL Image
        text_labels: List of text prompts
        model: CLIP model
        processor: CLIP processor
        device: Device string
        return_logits: If True, also return raw logits
    
    Returns:
        (probabilities array, logits array or None)
    """
    with torch.no_grad():
        # Process inputs
        inputs = processor(text=text_labels, images=image, return_tensors="pt", padding=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Get embeddings
        outputs = model(**inputs)
        
        # Compute similarity (cosine similarity)
        logits_per_image = outputs.logits_per_image
        probs = logits_per_image.softmax(dim=1).cpu().numpy()[0]
        logits = logits_per_image.cpu().numpy()[0] if return_logits else None
        
        return probs, logits


def _detect_from_single_image(
    image_path: str,
    makes: List[str],
    models_by_make: Dict[str, List[str]],
    models_by_make_filtered: Dict[str, List[str]],
    colors: List[str],
    year_ranges: List[str],
    debug_mode: bool = False
) -> Dict:
    """
    Detect car attributes from single image using CLIP
    Uses trained classifier head when available for better make detection.
    """
    try:
        clip_model, processor = _load_clip_model()
        device = _get_device()
        
        # Load image
        try:
            img = Image.open(image_path).convert('RGB')
            logger.debug(f"Loaded image: {image_path}, size: {img.size}")
        except Exception as e:
            logger.error(f"Failed to load PIL image from {image_path}: {e}", exc_info=True)
            raise ValueError(f"Cannot load image {image_path}: {str(e)}")
        
        # Optional: Crop car bbox
        cropped = _crop_car_bbox(image_path)
        if cropped is not None:
            img = cropped
        
        # 1. Detect Make - Use trained classifier if available
        classifier_result = _predict_make_with_classifier(img)
        
        if classifier_result is not None and _is_finetuned:
            # Use trained classifier predictions
            logger.debug("Using trained classifier for make detection")
            make_probs_dict = classifier_result['make_probs']
            
            # Filter to only makes in the provided list (merge with dataset makes)
            filtered_make_probs = {}
            for make in makes:
                if make in make_probs_dict:
                    filtered_make_probs[make] = make_probs_dict[make]
                else:
                    # Check for close matches
                    best_match = None
                    for trained_make in make_probs_dict:
                        if trained_make.lower() == make.lower():
                            best_match = trained_make
                            break
                    if best_match:
                        filtered_make_probs[make] = make_probs_dict[best_match]
                    else:
                        filtered_make_probs[make] = 0.0
            
            # Normalize
            total_prob = sum(filtered_make_probs.values())
            if total_prob > 0:
                make_probs_dict = {k: v/total_prob for k, v in filtered_make_probs.items()}
            else:
                make_probs_dict = filtered_make_probs
        else:
            # Fall back to zero-shot CLIP
            logger.debug("Using zero-shot CLIP for make detection")
            make_labels = [f"a photo of a {make} vehicle" for make in makes]
            make_probs, make_logits = _clip_classify(img, make_labels, clip_model, processor, device, return_logits=debug_mode)
            make_probs_dict = {make: float(prob) for make, prob in zip(makes, make_probs)}
        
        # 2. Detect Model (for top-5 makes, use filtered models for best, full for topk)
        top5_makes = sorted(make_probs_dict.items(), key=lambda x: x[1], reverse=True)[:5]
        model_probs_dict = {}
        model_probs_dict_full = {}  # For topk (all models)
        
        for make, make_prob in top5_makes:
            # Use filtered models for best prediction
            if make in models_by_make_filtered and models_by_make_filtered[make]:
                models_filtered = models_by_make_filtered[make]
                model_labels = [f"a photo of a {make} {model} vehicle" for model in models_filtered]
                
                if model_labels:
                    model_probs, _ = _clip_classify(img, model_labels, clip_model, processor, device)
                    # Weight by make confidence
                    for model, prob in zip(models_filtered, model_probs):
                        weighted_prob = float(prob) * make_prob
                        model_probs_dict[model] = max(model_probs_dict.get(model, 0), weighted_prob)
            
            # Use full models for topk
            if make in models_by_make and models_by_make[make]:
                models_full = models_by_make[make]
                model_labels_full = [f"a photo of a {make} {model} vehicle" for model in models_full]
                
                if model_labels_full:
                    model_probs_full, _ = _clip_classify(img, model_labels_full, clip_model, processor, device)
                    for model, prob in zip(models_full, model_probs_full):
                        weighted_prob = float(prob) * make_prob
                        model_probs_dict_full[model] = max(model_probs_dict_full.get(model, 0), weighted_prob)
        
        # Normalize model probs
        model_sum = sum(model_probs_dict.values())
        if model_sum > 0:
            model_probs_dict = {k: v / model_sum for k, v in model_probs_dict.items()}
        
        model_sum_full = sum(model_probs_dict_full.values())
        if model_sum_full > 0:
            model_probs_dict_full = {k: v / model_sum_full for k, v in model_probs_dict_full.items()}
        
        # 3. Detect Color (better prompt)
        color_labels = [f"a photo of a {color} car in daylight" for color in colors]
        color_probs, color_logits = _clip_classify(img, color_labels, clip_model, processor, device, return_logits=debug_mode)
        color_probs_dict = {color: float(prob) for color, prob in zip(colors, color_probs)}
        
        # 4. Detect Year Range (better prompt)
        year_range_labels = [f"a photo of a car from the {range_str}" for range_str in year_ranges]
        year_range_probs, year_logits = _clip_classify(img, year_range_labels, clip_model, processor, device, return_logits=debug_mode)
        year_range_probs_dict = {range_str: float(prob) for range_str, prob in zip(year_ranges, year_range_probs)}
        
        result = {
            "make": make_probs_dict,
            "model": model_probs_dict,  # Filtered for best
            "model_full": model_probs_dict_full,  # Full for topk
            "color": color_probs_dict,
            "year_range": year_range_probs_dict
        }
        
        if debug_mode:
            result["debug"] = {
                "make_logits": make_logits.tolist() if make_logits is not None else None,
                "color_logits": color_logits.tolist() if color_logits is not None else None,
                "year_logits": year_logits.tolist() if year_logits is not None else None,
            }
        
        return result
        
    except Exception as e:
        logger.error(f"Error detecting from image {image_path}: {e}", exc_info=True)
        return {
            "make": {},
            "model": {},
            "model_full": {},
            "color": {},
            "year_range": {}
        }


def _year_range_to_years(range_str: str, confidence: float) -> List[Tuple[int, float]]:
    """
    Convert year range to specific year suggestions
    
    Returns: List of (year, confidence) tuples
    """
    range_map = {
        "1990s": list(range(1990, 2000)),
        "2000s": list(range(2000, 2010)),
        "2010-2014": list(range(2010, 2015)),
        "2015-2018": list(range(2015, 2019)),
        "2019-2021": list(range(2019, 2022)),
        "2022-2026": list(range(2022, 2027)),
    }
    
    years = range_map.get(range_str, [])
    if not years:
        return []
    
    # Return 5 years centered in range
    center_idx = len(years) // 2
    start_idx = max(0, center_idx - 2)
    end_idx = min(len(years), center_idx + 3)
    selected_years = years[start_idx:end_idx]
    
    # Distribute confidence (slightly higher for center years)
    result = []
    for i, year in enumerate(selected_years):
        # Center years get slightly higher confidence
        offset = abs(i - len(selected_years) // 2)
        year_conf = confidence * (1.0 - offset * 0.1)
        result.append((year, max(0.0, year_conf)))
    
    return result


def get_image_hash(image_paths: List[str]) -> str:
    """Generate hash for list of images (filenames + size + mtime)"""
    hash_str = ""
    for img_path in sorted(image_paths):
        try:
            stat = os.stat(img_path)
            hash_str += f"{img_path}:{stat.st_size}:{stat.st_mtime}:"
        except:
            hash_str += f"{img_path}:"
    return hashlib.md5(hash_str.encode()).hexdigest()


def detect_car_from_images(
    image_paths: List[str],
    makes: Optional[List[str]] = None,
    models: Optional[List[str]] = None,
    colors: Optional[List[str]] = None,
    years: Optional[List[int]] = None,
    valid_makes: Optional[List[str]] = None,
    valid_models_by_make: Optional[Dict[str, List[str]]] = None
) -> Dict:
    """
    Detect car make, model, color, and year from images using CLIP
    
    Args:
        image_paths: List of image file paths
        makes: Optional list of makes (if None, loads from dataset)
        models: Optional list of models (ignored, uses dataset)
        colors: Optional list of colors (if None, uses default)
        years: Optional list of years (ignored, uses year ranges)
        valid_makes: Valid makes from frontend dropdown (for normalization)
        valid_models_by_make: Valid models by make from frontend (for normalization)
    
    Returns:
        Dict with:
        - best: {make: {...}, model: {...}, color: {...}, year: {...}}
        - topk: {make: [...], model: [...], color: [...], year: [...]}
        - meta: {confidence_level, num_images, image_hash, labels_version, runtime_ms, device, created_at, status}
    """
    start_time = time.time()
    if not ML_AVAILABLE:
        return {
            "best": {},
            "topk": {},
            "meta": {
                "confidence_level": "low",
                "status": "not_available",
                "error": "Car detection is not available (torch/transformers not installed)",
                "num_images": len(image_paths),
                "image_hash": get_image_hash(image_paths),
                "labels_version": get_labels_version(),
                "runtime_ms": 0,
                "device": "none",
                "created_at": datetime.utcnow().isoformat(),
            },
        }
    device = _get_device()
    debug_mode = os.getenv("AUTO_DETECT_DEBUG", "0") == "1"
    
    if colors is None:
        colors = COLOR_LABELS
    
    # Load labels from dataset
    labels = _load_labels_from_dataset()
    if makes is None:
        makes = labels["makes"]
    
    models_by_make = labels["models_by_make"]
    models_by_make_filtered = labels["models_by_make_filtered"]
    
    # Get labels version for cache key
    labels_version = get_labels_version()
    
    # Compute image hash
    image_hash = get_image_hash(image_paths)
    
    try:
        logger.info(f"Detecting car from {len(image_paths)} images using CLIP on {device}")
        
        # Aggregate results from all images
        make_votes: Dict[str, float] = {}
        model_votes: Dict[str, float] = {}  # Filtered for best
        model_votes_full: Dict[str, float] = {}  # Full for topk
        color_votes: Dict[str, float] = {}
        year_range_votes: Dict[str, float] = {}
        
        per_image_results = []  # For debug mode
        
        # Process each image
        logger.info(f"Processing {len(image_paths)} images...")
        for idx, img_path in enumerate(image_paths):
            logger.info(f"Processing image {idx+1}/{len(image_paths)}: {img_path}")
            
            if not os.path.exists(img_path):
                logger.warning(f"Image not found: {img_path}")
                continue
            
            try:
                img_results = _detect_from_single_image(
                    img_path, makes, models_by_make, models_by_make_filtered,
                    colors, YEAR_RANGE_LABELS, debug_mode=debug_mode
                )
            except Exception as e:
                logger.error(f"Error processing image {img_path}: {e}", exc_info=True)
                continue
            
            if debug_mode:
                per_image_results.append({
                    "image_idx": idx,
                    "image_path": img_path,
                    "top1_make": max(img_results.get('make', {}).items(), key=lambda x: x[1]) if img_results.get('make') else None,
                    "top1_model": max(img_results.get('model', {}).items(), key=lambda x: x[1]) if img_results.get('model') else None,
                    "top1_color": max(img_results.get('color', {}).items(), key=lambda x: x[1]) if img_results.get('color') else None,
                    "debug": img_results.get('debug')
                })
            
            # Aggregate votes
            for make, conf in img_results.get('make', {}).items():
                make_votes[make] = make_votes.get(make, 0) + conf
            for model, conf in img_results.get('model', {}).items():
                model_votes[model] = model_votes.get(model, 0) + conf
            for model, conf in img_results.get('model_full', {}).items():
                model_votes_full[model] = model_votes_full.get(model, 0) + conf
            for color, conf in img_results.get('color', {}).items():
                color_votes[color] = color_votes.get(color, 0) + conf
            for year_range, conf in img_results.get('year_range', {}).items():
                year_range_votes[year_range] = year_range_votes.get(year_range, 0) + conf
        
        # Normalize votes (mean across images)
        num_images = len([p for p in image_paths if os.path.exists(p)])
        if num_images == 0:
            raise ValueError("No valid images found")
        
        make_probs = {k: v / num_images for k, v in make_votes.items()}
        model_probs = {k: v / num_images for k, v in model_votes.items()}  # Filtered
        model_probs_full = {k: v / num_images for k, v in model_votes_full.items()}  # Full
        color_probs = {k: v / num_images for k, v in color_votes.items()}
        year_range_probs = {k: v / num_images for k, v in year_range_votes.items()}
        
        # Get best predictions (from filtered models)
        best_make = max(make_probs.items(), key=lambda x: x[1]) if make_probs else (None, 0.0)
        best_model = max(model_probs.items(), key=lambda x: x[1]) if model_probs else (None, 0.0)
        best_color = max(color_probs.items(), key=lambda x: x[1]) if color_probs else (None, 0.0)
        best_year_range = max(year_range_probs.items(), key=lambda x: x[1]) if year_range_probs else (None, 0.0)
        
        # Normalize predictions to match dropdown values
        best_make_normalized = None
        best_model_normalized = None
        best_color_normalized = None
        
        if best_make[0] and valid_makes:
            best_make_normalized = _normalize_prediction(best_make[0], valid_makes)
            if not best_make_normalized:
                logger.warning(f"Could not normalize make '{best_make[0]}' to valid options")
        
        if best_model[0] and best_make_normalized and valid_models_by_make:
            valid_models = valid_models_by_make.get(best_make_normalized, [])
            if valid_models:
                best_model_normalized = _normalize_prediction(best_model[0], valid_models)
                if not best_model_normalized:
                    logger.warning(f"Could not normalize model '{best_model[0]}' to valid options for make '{best_make_normalized}'")
        
        if best_color[0]:
            best_color_normalized = _normalize_prediction(best_color[0], COLOR_LABELS)
        
        # Check if CLIP is uncertain (fallback)
        status = "ok"
        if best_make[1] < 0.55:
            status = "low_confidence"
            logger.warning(f"Low confidence detection: make={best_make[1]:.2f}")
        
        # Convert year range to specific years
        year_suggestions = []
        if best_year_range[0] and best_year_range[1] >= 0.55:
            year_suggestions = _year_range_to_years(best_year_range[0], best_year_range[1])
        
        # Get top-5 for each (use full models for topk)
        top5_make = sorted(make_probs.items(), key=lambda x: x[1], reverse=True)[:5]
        top5_model = sorted(model_probs_full.items(), key=lambda x: x[1], reverse=True)[:5]  # Use full for topk
        top5_color = sorted(color_probs.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Top-5 years from all ranges
        all_year_suggestions = []
        for range_str, conf in sorted(year_range_probs.items(), key=lambda x: x[1], reverse=True)[:3]:
            if conf >= 0.3:  # Only include reasonable ranges
                years = _year_range_to_years(range_str, conf)
                all_year_suggestions.extend(years)
        
        # Sort by confidence and take top-5
        all_year_suggestions.sort(key=lambda x: x[1], reverse=True)
        top5_years = all_year_suggestions[:5]
        
        # Determine confidence level
        make_conf = best_make[1] if best_make[0] else 0.0
        model_conf = best_model[1] if best_model[0] else 0.0
        year_conf = best_year_range[1] if best_year_range[0] else 0.0
        
        min_confidence = min(make_conf, model_conf, year_conf)
        if min_confidence >= 0.75:
            confidence_level = "high"
        elif min_confidence >= 0.55:
            confidence_level = "medium"
        else:
            confidence_level = "low"
        
        # Best year (from top suggestion if confidence >= 0.55)
        best_year_value = None
        best_year_conf = 0.0
        if year_suggestions:
            best_year_value = year_suggestions[0][0]
            best_year_conf = year_suggestions[0][1]
        
        runtime_ms = int((time.time() - start_time) * 1000)
        
        # Build result
        result = {
            "best": {
                "make": {
                    "value": best_make_normalized or best_make[0],
                    "confidence": float(best_make[1]),
                    "original": best_make[0] if best_make_normalized != best_make[0] else None
                } if best_make[0] else None,
                "model": {
                    "value": best_model_normalized or best_model[0],
                    "confidence": float(best_model[1]),
                    "original": best_model[0] if best_model_normalized != best_model[0] else None
                } if best_model[0] else None,
                "color": {
                    "value": best_color_normalized or best_color[0],
                    "confidence": float(best_color[1]),
                    "original": best_color[0] if best_color_normalized != best_color[0] else None
                } if best_color[0] else None,
                "year": {
                    "value": int(best_year_value) if best_year_value else None,
                    "confidence": float(best_year_conf)
                } if best_year_value else None,
            },
            "topk": {
                "make": [{"value": m, "confidence": float(c)} for m, c in top5_make],
                "model": [{"value": m, "confidence": float(c)} for m, c in top5_model],
                "color": [{"value": c, "confidence": float(conf)} for c, conf in top5_color],
                "year": [{"value": int(y), "confidence": float(c)} for y, c in top5_years],
            },
            "meta": {
                "confidence_level": confidence_level,
                "num_images": num_images,
                "image_hash": image_hash,
                "labels_version": labels_version,
                "runtime_ms": runtime_ms,
                "device": device,
                "status": status,
                "created_at": datetime.utcnow().isoformat()
            }
        }
        
        # Add debug info if enabled
        if debug_mode:
            result["meta"]["debug"] = {
                "per_image_results": per_image_results,
                "aggregated_logits": {
                    "make_probs": {k: float(v) for k, v in make_probs.items()},
                    "model_probs": {k: float(v) for k, v in model_probs.items()},
                    "color_probs": {k: float(v) for k, v in color_probs.items()},
                    "year_range_probs": {k: float(v) for k, v in year_range_probs.items()},
                }
            }
        
        logger.info(f"Detection completed: {best_make_normalized or best_make[0]} {best_model_normalized or best_model[0]} ({confidence_level} confidence, {runtime_ms}ms)")
        
        return result
        
    except Exception as e:
        logger.error(f"Error detecting car from images: {e}", exc_info=True)
        runtime_ms = int((time.time() - start_time) * 1000)
        return {
            "best": {},
            "topk": {},
            "meta": {
                "confidence_level": "low",
                "status": "error",
                "error": str(e),
                "num_images": len(image_paths),
                "image_hash": image_hash,
                "labels_version": labels_version,
                "runtime_ms": runtime_ms,
                "device": device,
                "created_at": datetime.utcnow().isoformat()
            }
        }
