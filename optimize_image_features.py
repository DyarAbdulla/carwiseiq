"""
Optimized Image Feature Extraction Pipeline
- Better models (EfficientNet/ViT)
- Image-to-car mapping verification
- PCA for feature reduction
- Failed extraction handling
- Feature caching
- Performance optimization
"""

import pandas as pd
import numpy as np
import os
import sys
import logging
import pickle
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

# PyTorch imports
try:
    import torch
    import torchvision.models as models
    import torchvision.transforms as transforms
    from torch import nn
    import torch.nn.functional as F
    PYTORCH_AVAILABLE = True
    DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
except ImportError:
    PYTORCH_AVAILABLE = False
    DEVICE = None
    print("ERROR: PyTorch not available! Install: pip install torch torchvision")

# PIL for image processing
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("ERROR: PIL not available! Install: pip install Pillow")

# Sklearn for PCA
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# Configuration
DATA_DIR = Path("data")
MODELS_DIR = Path("models")
IMAGES_DIR = Path("car_images")
CACHE_DIR = Path("cache")
METADATA_FILE = Path("image_metadata.csv")
FEATURES_CACHE_FILE = CACHE_DIR / "image_features_cache.pkl"
FEATURES_METADATA_FILE = CACHE_DIR / "image_features_metadata.json"

# Feature extraction settings
BATCH_SIZE = 32
FEATURE_DIM_ORIGINAL = 2048  # ResNet50/EfficientNet output
FEATURE_DIM_REDUCED = 512  # After PCA
USE_PCA = True
USE_EFFICIENTNET = True  # Set to False to use ResNet50
USE_VIT = False  # Vision Transformer (slower but better)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('image_feature_extraction.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Create directories
MODELS_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================================
# IMAGE-TO-CAR MAPPING VERIFICATION
# ============================================================================

def verify_image_mapping(df: pd.DataFrame, metadata_file: Path = METADATA_FILE) -> pd.DataFrame:
    """
    Verify and create image-to-car mapping.
    Creates/updates image_metadata.csv with correct mappings.
    """
    logger.info("=" * 80)
    logger.info("VERIFYING IMAGE-TO-CAR MAPPING")
    logger.info("=" * 80)

    # Load existing metadata if available
    if metadata_file.exists():
        logger.info(f"Loading existing metadata from {metadata_file}...")
        try:
            metadata_df = pd.read_csv(metadata_file)
            logger.info(f"Loaded {len(metadata_df)} image mappings")
        except Exception as e:
            logger.warning(f"Failed to load metadata: {e}. Creating new mapping...")
            metadata_df = None
    else:
        metadata_df = None

    # Create mapping from dataset
    logger.info("Creating image-to-car mapping from dataset...")
    mapping_data = []

    for idx, row in df.iterrows():
        # Try to find image filename
        image_filename = None

        # Check various possible image path columns
        for col in ['image_path', 'image_filename', 'image_1', 'image_url']:
            if col in row and pd.notna(row[col]):
                path = str(row[col])
                # Extract filename
                if '/' in path:
                    image_filename = path.split('/')[-1]
                elif '\\' in path:
                    image_filename = path.split('\\')[-1]
                else:
                    image_filename = path
                break

        # Always use car_XXXXXX.jpg format (actual image naming)
        # The metadata filenames don't match actual files
        image_filename = f"car_{idx:06d}.jpg"

        # Try multiple possible locations
        possible_paths = [
            IMAGES_DIR / image_filename,
            Path(image_filename),  # Absolute path
            Path(f"car_images/{image_filename}"),
            Path(f"./car_images/{image_filename}"),
        ]

        image_path = None
        image_exists = False

        for path in possible_paths:
            if path.exists():
                image_path = path
                image_exists = True
                break

        if not image_exists:
            # Try to find image by pattern matching
            if IMAGES_DIR.exists():
                # Look for files matching pattern (car_XXXXXX.*)
                pattern_files = list(IMAGES_DIR.glob(f"car_{idx:06d}.*"))
                if not pattern_files:
                    # Try without leading zeros
                    pattern_files = list(IMAGES_DIR.glob(f"car_{idx}.*"))

                if pattern_files:
                    image_path = pattern_files[0]
                    image_exists = True
                    image_filename = image_path.name
                    logger.debug(f"Found image for index {idx}: {image_filename}")

        mapping_data.append({
            'index': idx,
            'filename': image_filename,
            'make': row.get('make', 'Unknown'),
            'model': row.get('model', 'Unknown'),
            'year': row.get('year', 0),
            'trim': row.get('trim', 'Unknown'),
            'condition': row.get('condition', 'Unknown'),
            'price': row.get('price', row.get('price_usd', 0)),
            'image_exists': image_exists,
            'image_path': str(image_path) if image_exists else None
        })

    mapping_df = pd.DataFrame(mapping_data)

    # Statistics
    total_images = len(mapping_df)
    existing_images = mapping_df['image_exists'].sum()
    missing_images = total_images - existing_images

    logger.info(f"Image Mapping Statistics:")
    logger.info(f"  Total records: {total_images:,}")
    logger.info(f"  Images found: {existing_images:,}")
    logger.info(f"  Images missing: {missing_images:,}")

    # Save mapping
    mapping_df.to_csv(metadata_file, index=False)
    logger.info(f"[OK] Image metadata saved to {metadata_file}")

    return mapping_df

# ============================================================================
# IMPROVED FEATURE EXTRACTION MODELS
# ============================================================================

def create_efficientnet_extractor():
    """Create EfficientNet-B3 feature extractor (better than ResNet50)."""
    if not PYTORCH_AVAILABLE:
        raise ImportError("PyTorch required!")

    logger.info("Creating EfficientNet-B3 feature extractor...")

    try:
        # Try EfficientNet-B3 (better accuracy than ResNet50)
        model = models.efficientnet_b3(weights=models.EfficientNet_B3_Weights.IMAGENET1K_V1)
        # Remove classifier, keep feature extractor
        model = nn.Sequential(*list(model.children())[:-1])
        model = model.to(DEVICE)
        model.eval()

        preprocess = transforms.Compose([
            transforms.Resize(300),  # EfficientNet-B3 uses 300x300
            transforms.CenterCrop(300),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        feature_dim = 1536  # EfficientNet-B3 feature dimension
        logger.info(f"EfficientNet-B3 loaded on {DEVICE} (feature dim: {feature_dim})")
        return model, preprocess, feature_dim

    except Exception as e:
        logger.warning(f"Failed to load EfficientNet: {e}. Falling back to ResNet50...")
        return create_resnet50_extractor()

def create_resnet50_extractor():
    """Create ResNet50 feature extractor (fallback)."""
    if not PYTORCH_AVAILABLE:
        raise ImportError("PyTorch required!")

    logger.info("Creating ResNet50 feature extractor...")

    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
    # Remove classifier, keep feature extractor
    model = nn.Sequential(*list(model.children())[:-1])
    model = model.to(DEVICE)
    model.eval()

    preprocess = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    feature_dim = 2048  # ResNet50 feature dimension
    logger.info(f"ResNet50 loaded on {DEVICE} (feature dim: {feature_dim})")
    return model, preprocess, feature_dim

def create_feature_extractor():
    """Create the best available feature extractor."""
    if USE_EFFICIENTNET:
        try:
            return create_efficientnet_extractor()
        except Exception as e:
            logger.warning(f"EfficientNet failed: {e}. Using ResNet50...")
            return create_resnet50_extractor()
    else:
        return create_resnet50_extractor()

# ============================================================================
# IMAGE LOADING AND PREPROCESSING
# ============================================================================

def load_image_safe(image_path: Path) -> Optional[Image.Image]:
    """Load image with error handling."""
    if not image_path.exists():
        return None

    try:
        img = Image.open(image_path)
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        return img
    except Exception as e:
        logger.debug(f"Failed to load {image_path}: {e}")
        return None

# ============================================================================
# BATCH FEATURE EXTRACTION
# ============================================================================

def extract_features_batch_optimized(
    mapping_df: pd.DataFrame,
    model,
    preprocess_func,
    feature_dim: int,
    batch_size: int = BATCH_SIZE
) -> Tuple[np.ndarray, Dict]:
    """
    Extract image features with optimizations:
    - Batch processing
    - Error handling
    - Progress tracking
    - Failed extraction tracking
    """
    logger.info("=" * 80)
    logger.info("EXTRACTING IMAGE FEATURES (OPTIMIZED)")
    logger.info("=" * 80)

    total_images = len(mapping_df)
    logger.info(f"Processing {total_images:,} images...")
    logger.info(f"Batch size: {batch_size}")
    logger.info(f"Device: {DEVICE}")

    # Check for cached features
    if FEATURES_CACHE_FILE.exists():
        logger.info(f"Found cached features at {FEATURES_CACHE_FILE}")
        try:
            with open(FEATURES_CACHE_FILE, 'rb') as f:
                cached_data = pickle.load(f)
                cached_features = cached_data.get('features')
                cached_indices = cached_data.get('indices', [])

                if cached_features is not None and len(cached_features) == total_images:
                    logger.info("[OK] Using cached features!")
                    return cached_features, cached_data.get('failed_extractions', {})
        except Exception as e:
            logger.warning(f"Failed to load cache: {e}. Re-extracting...")

    # Initialize
    all_features = np.zeros((total_images, feature_dim), dtype=np.float32)
    failed_extractions = {}
    processed_count = 0

    # Process in batches
    for batch_start in range(0, total_images, batch_size):
        batch_end = min(batch_start + batch_size, total_images)
        batch_indices = mapping_df.iloc[batch_start:batch_end].index.tolist()
        batch_rows = mapping_df.iloc[batch_start:batch_end]

        # Load images for this batch
        batch_images = []
        valid_indices = []

        for idx, row in batch_rows.iterrows():
            # Try multiple ways to get image path
            image_path = None

            # Method 1: Direct path from metadata (if it's a valid path)
            if pd.notna(row.get('image_path')):
                path_str = str(row['image_path'])
                if path_str and path_str != 'None':
                    image_path = Path(path_str)
                    if not image_path.exists():
                        image_path = None

            # Method 2: Construct from filename in metadata
            if (not image_path or not image_path.exists()) and pd.notna(row.get('filename')):
                filename = str(row['filename'])
                if filename and filename != 'None':
                    # Try multiple possible locations
                    possible_paths = [
                        IMAGES_DIR / filename,
                        Path(filename),
                        Path(f"car_images/{filename}"),
                    ]
                    for path in possible_paths:
                        if path.exists():
                            image_path = path
                            break

            # Method 3: Construct from index (most reliable - actual image naming)
            if not image_path or not image_path.exists():
                # Use car_XXXXXX.jpg format (actual naming convention)
                image_filename = f"car_{idx:06d}.jpg"
                image_path = IMAGES_DIR / image_filename

            # Also try with different index formats
            if not image_path.exists():
                # Try without leading zeros
                image_filename = f"car_{idx}.jpg"
                test_path = IMAGES_DIR / image_filename
                if test_path.exists():
                    image_path = test_path

            # Try pattern matching as last resort
            if not image_path.exists() and IMAGES_DIR.exists():
                pattern_files = list(IMAGES_DIR.glob(f"car_{idx:06d}.*"))
                if not pattern_files:
                    pattern_files = list(IMAGES_DIR.glob(f"car_{idx}.*"))
                if pattern_files:
                    image_path = pattern_files[0]

            # Try to load image
            if image_path.exists():
                img = load_image_safe(image_path)
                if img is not None:
                    batch_images.append(img)
                    valid_indices.append(idx)
                else:
                    failed_extractions[idx] = 'load_failed'
            else:
                failed_extractions[idx] = f'not_found: {image_path}'

        if not batch_images:
            # All failed - use zero vectors
            for idx in batch_indices:
                if idx not in failed_extractions:
                    failed_extractions[idx] = 'batch_failed'
            continue

        # Preprocess batch
        try:
            batch_tensors = torch.stack([preprocess_func(img) for img in batch_images]).to(DEVICE)

            # Extract features
            with torch.no_grad():
                features = model(batch_tensors)

                # Global average pooling if needed
                if features.dim() > 2:
                    features = F.adaptive_avg_pool2d(features, (1, 1))
                features = features.view(features.size(0), -1)

            # Move to CPU and store
            features_cpu = features.cpu().numpy().astype(np.float32)

            for i, idx in enumerate(valid_indices):
                all_features[idx] = features_cpu[i]
                processed_count += 1

            # Cleanup
            del batch_tensors, features, features_cpu, batch_images
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        except Exception as e:
            logger.error(f"Error processing batch {batch_start}-{batch_end}: {e}")
            for idx in batch_indices:
                if idx not in failed_extractions:
                    failed_extractions[idx] = f'extraction_error: {str(e)[:50]}'

        # Progress update
        if (batch_start // batch_size + 1) % 10 == 0:
            progress = (processed_count / total_images) * 100
            logger.info(f"Progress: {processed_count}/{total_images} ({progress:.1f}%)")

    # Final statistics
    successful = processed_count
    failed = len(failed_extractions)

    logger.info(f"Feature Extraction Complete:")
    logger.info(f"  Successful: {successful:,}")
    logger.info(f"  Failed: {failed:,}")
    logger.info(f"  Feature shape: {all_features.shape}")

    # Cache features
    cache_data = {
        'features': all_features,
        'indices': list(range(total_images)),
        'failed_extractions': failed_extractions,
        'feature_dim': feature_dim,
        'extraction_date': datetime.now().isoformat()
    }

    try:
        with open(FEATURES_CACHE_FILE, 'wb') as f:
            pickle.dump(cache_data, f)
        logger.info(f"[OK] Features cached to {FEATURES_CACHE_FILE}")
    except Exception as e:
        logger.warning(f"Failed to cache features: {e}")

    return all_features, failed_extractions

# ============================================================================
# PCA FEATURE REDUCTION
# ============================================================================

def apply_pca_reduction(
    features: np.ndarray,
    target_dim: int = FEATURE_DIM_REDUCED,
    fit_on_subset: bool = True
) -> Tuple[np.ndarray, PCA]:
    """
    Apply PCA to reduce feature dimensions.

    Args:
        features: Original features (n_samples, n_features)
        target_dim: Target dimension after PCA
        fit_on_subset: If True, fit PCA on subset for speed

    Returns:
        Reduced features, PCA transformer
    """
    logger.info("=" * 80)
    logger.info("APPLYING PCA FEATURE REDUCTION")
    logger.info("=" * 80)

    original_dim = features.shape[1]
    logger.info(f"Original dimension: {original_dim}")
    logger.info(f"Target dimension: {target_dim}")
    logger.info(f"Reduction ratio: {target_dim/original_dim:.2%}")

    # Remove zero vectors (failed extractions) for PCA fitting
    non_zero_mask = ~np.all(features == 0, axis=1)
    non_zero_features = features[non_zero_mask]

    logger.info(f"Non-zero features: {len(non_zero_features):,} / {len(features):,}")

    if len(non_zero_features) == 0:
        logger.warning("=" * 80)
        logger.warning("WARNING: No non-zero features found! Cannot apply PCA.")
        logger.warning("This means all image extractions failed.")
        logger.warning("Returning original features without PCA reduction.")
        logger.warning("=" * 80)
        # Return identity transformer (no change)
        from sklearn.preprocessing import FunctionTransformer
        pca = FunctionTransformer(func=lambda x: x, inverse_func=lambda x: x)
        return features, pca

    if len(non_zero_features) < target_dim:
        logger.warning(f"Warning: Only {len(non_zero_features)} non-zero features, but target_dim is {target_dim}.")
        logger.warning(f"Reducing target_dim to {len(non_zero_features)}.")
        target_dim = min(target_dim, len(non_zero_features))

    # Fit PCA
    if fit_on_subset and len(non_zero_features) > 10000:
        # Use subset for faster fitting
        subset_size = min(10000, len(non_zero_features))
        subset_indices = np.random.choice(len(non_zero_features), subset_size, replace=False)
        fit_features = non_zero_features[subset_indices]
        logger.info(f"Fitting PCA on {subset_size:,} samples for speed...")
    else:
        fit_features = non_zero_features
        logger.info(f"Fitting PCA on all {len(non_zero_features):,} samples...")

    pca = PCA(n_components=target_dim, random_state=42)
    pca.fit(fit_features)

    # Transform all features
    logger.info("Transforming features...")
    reduced_features = pca.transform(features)

    # Explained variance
    explained_variance = pca.explained_variance_ratio_.sum()
    logger.info(f"Explained variance: {explained_variance:.2%}")

    logger.info(f"[OK] PCA reduction complete: {original_dim} -> {target_dim}")

    return reduced_features.astype(np.float32), pca

# ============================================================================
# MAIN PIPELINE
# ============================================================================

def main():
    """Main pipeline for optimized image feature extraction."""
    logger.info("=" * 80)
    logger.info("OPTIMIZED IMAGE FEATURE EXTRACTION PIPELINE")
    logger.info("=" * 80)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Step 1: Load dataset
    logger.info("\n" + "=" * 80)
    logger.info("STEP 1: LOADING DATASET")
    logger.info("=" * 80)

    dataset_file = DATA_DIR / "final_dataset_with_images.csv"
    if not dataset_file.exists():
        dataset_file = Path("cleaned_car_data.csv")

    if not dataset_file.exists():
        logger.error(f"Dataset file not found: {dataset_file}")
        return

    logger.info(f"Loading dataset from {dataset_file}...")
    df = pd.read_csv(dataset_file)
    logger.info(f"Loaded {len(df):,} rows")

    # Step 2: Verify image mapping
    logger.info("\n" + "=" * 80)
    logger.info("STEP 2: VERIFYING IMAGE-TO-CAR MAPPING")
    logger.info("=" * 80)

    mapping_df = verify_image_mapping(df)

    # Step 3: Create feature extractor
    logger.info("\n" + "=" * 80)
    logger.info("STEP 3: CREATING FEATURE EXTRACTOR")
    logger.info("=" * 80)

    if not PYTORCH_AVAILABLE:
        logger.error("PyTorch not available! Cannot extract features.")
        return

    model, preprocess_func, feature_dim = create_feature_extractor()

    # Step 4: Extract features
    logger.info("\n" + "=" * 80)
    logger.info("STEP 4: EXTRACTING IMAGE FEATURES")
    logger.info("=" * 80)

    features, failed_extractions = extract_features_batch_optimized(
        mapping_df, model, preprocess_func, feature_dim, BATCH_SIZE
    )

    # Step 5: Apply PCA reduction (only if we have non-zero features)
    non_zero_count = np.sum(~np.all(features == 0, axis=1))

    if USE_PCA and feature_dim > FEATURE_DIM_REDUCED and non_zero_count > 0:
        logger.info("\n" + "=" * 80)
        logger.info("STEP 5: APPLYING PCA REDUCTION")
        logger.info("=" * 80)

        features, pca_transformer = apply_pca_reduction(features, FEATURE_DIM_REDUCED)

        # Save PCA transformer
        pca_file = MODELS_DIR / "image_pca_transformer.pkl"
        with open(pca_file, 'wb') as f:
            pickle.dump(pca_transformer, f)
        logger.info(f"[OK] PCA transformer saved to {pca_file}")
    else:
        pca_transformer = None

    # Step 6: Save features and metadata
    logger.info("\n" + "=" * 80)
    logger.info("STEP 6: SAVING FEATURES AND METADATA")
    logger.info("=" * 80)

    # Save features
    features_file = DATA_DIR / "image_features_optimized.npy"
    np.save(features_file, features)
    logger.info(f"[OK] Features saved to {features_file}")
    logger.info(f"  Shape: {features.shape}")
    logger.info(f"  Size: {features.nbytes / 1e6:.2f} MB")

    # Save metadata
    metadata_info = {
        'extraction_date': datetime.now().isoformat(),
        'total_images': len(mapping_df),
        'successful_extractions': len(mapping_df) - len(failed_extractions),
        'failed_extractions': len(failed_extractions),
        'feature_dim_original': feature_dim,
        'feature_dim_final': features.shape[1],
        'pca_applied': USE_PCA and pca_transformer is not None,
        'model_used': 'EfficientNet-B3' if USE_EFFICIENTNET else 'ResNet50',
        'batch_size': BATCH_SIZE,
        'failed_indices': list(failed_extractions.keys())[:100]  # First 100 for reference
    }

    with open(FEATURES_METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata_info, f, indent=2, ensure_ascii=False)
    logger.info(f"[OK] Metadata saved to {FEATURES_METADATA_FILE}")

    # Step 7: Summary
    logger.info("\n" + "=" * 80)
    logger.info("EXTRACTION COMPLETE!")
    logger.info("=" * 80)
    logger.info(f"Total images: {len(mapping_df):,}")
    logger.info(f"Successful: {len(mapping_df) - len(failed_extractions):,}")
    logger.info(f"Failed: {len(failed_extractions):,}")
    logger.info(f"Feature dimension: {features.shape[1]}")
    logger.info(f"Features saved: {features_file}")
    logger.info(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 80)

    # Print failed extraction reasons
    if failed_extractions:
        logger.info("\nFailed Extraction Reasons:")
        reasons = {}
        for idx, reason in failed_extractions.items():
            reason_type = reason.split(':')[0] if ':' in reason else reason
            reasons[reason_type] = reasons.get(reason_type, 0) + 1

        for reason, count in sorted(reasons.items(), key=lambda x: x[1], reverse=True):
            logger.info(f"  {reason}: {count}")

if __name__ == "__main__":
    main()
