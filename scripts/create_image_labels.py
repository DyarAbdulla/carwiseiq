"""
Create Image Labels Mapping
Maps car images to their make/model/year labels from the dataset.
"""

import pandas as pd
from pathlib import Path
import os
import logging
from tqdm import tqdm
from PIL import Image

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
OUTPUT_FILE = DATA_DIR / "image_labels.csv"

# Dataset file
DATASET_FILE = DATA_DIR / "final_dataset_with_images.csv"


def create_image_labels():
    """Create mapping between images and labels."""
    
    logger.info(f"Loading dataset from {DATASET_FILE}")
    
    if not DATASET_FILE.exists():
        # Try alternative dataset
        alt_dataset = DATA_DIR / "iqcars_cleaned.csv"
        if alt_dataset.exists():
            logger.info(f"Using alternative dataset: {alt_dataset}")
            df = pd.read_csv(alt_dataset)
        else:
            raise FileNotFoundError(f"Dataset not found: {DATASET_FILE}")
    else:
        df = pd.read_csv(DATASET_FILE)
    
    logger.info(f"Loaded {len(df)} rows from dataset")
    
    # Check images directory
    if not IMAGES_DIR.exists():
        raise FileNotFoundError(f"Images directory not found: {IMAGES_DIR}")
    
    # Get list of existing images
    existing_images = set(os.listdir(IMAGES_DIR))
    logger.info(f"Found {len(existing_images)} images in {IMAGES_DIR}")
    
    # Create mapping
    records = []
    missing_images = 0
    missing_labels = 0
    
    corrupted_count = 0
    
    for idx, row in tqdm(df.iterrows(), total=len(df), desc="Creating mapping"):
        # Image filename based on index
        image_filename = f"car_{idx:06d}.jpg"
        image_path = IMAGES_DIR / image_filename
        
        # Check if image exists
        if image_filename not in existing_images:
            missing_images += 1
            continue
        
        # Check if image is corrupted
        try:
            from PIL import Image
            img = Image.open(image_path)
            img.verify()
            img = Image.open(image_path)  # Reopen after verify
            width, height = img.size
            if width < 32 or height < 32:
                corrupted_count += 1
                continue
            if img.mode != 'RGB':
                img = img.convert('RGB')  # Convert to RGB if needed
        except Exception as e:
            corrupted_count += 1
            logger.debug(f"Corrupted image {image_filename}: {e}")
            continue
        
        # Get labels
        make = row.get('make', None)
        model = row.get('model', None)
        year = row.get('year', None)
        
        # Skip if missing essential labels
        if pd.isna(make) or pd.isna(model):
            missing_labels += 1
            continue
        
        # Clean labels
        make = str(make).strip()
        model = str(model).strip()
        year = int(year) if pd.notna(year) else None
        
        # Skip empty labels
        if not make or not model:
            missing_labels += 1
            continue
        
        records.append({
            'image_path': f"car_images/{image_filename}",
            'image_filename': image_filename,
            'make': make,
            'model': model,
            'year': year,
            'index': idx
        })
    
    # Create DataFrame
    labels_df = pd.DataFrame(records)
    
    logger.info(f"\nMapping Statistics:")
    logger.info(f"  Total rows in dataset: {len(df)}")
    logger.info(f"  Missing images: {missing_images}")
    logger.info(f"  Missing labels: {missing_labels}")
    logger.info(f"  Corrupted images: {corrupted_count}")
    logger.info(f"  Valid records: {len(labels_df)}")
    
    # Filter rare makes (optional, can be disabled)
    min_samples_per_make = 10  # Minimum images per make
    make_counts = labels_df['make'].value_counts()
    valid_makes = make_counts[make_counts >= min_samples_per_make].index.tolist()
    rare_makes = make_counts[make_counts < min_samples_per_make].index.tolist()
    
    if rare_makes:
        logger.info(f"\n⚠️  Filtering rare makes (<{min_samples_per_make} samples): {len(rare_makes)}")
        logger.info(f"  Images to be removed: {make_counts[make_counts < min_samples_per_make].sum()}")
        labels_df = labels_df[labels_df['make'].isin(valid_makes)].reset_index(drop=True)
        logger.info(f"  Remaining images: {len(labels_df)}")
        logger.info(f"  Remaining makes: {len(valid_makes)}")
    
    # Statistics by make
    make_counts = labels_df['make'].value_counts()
    logger.info(f"\nTop 20 Makes:")
    for make, count in make_counts.head(20).items():
        logger.info(f"  {make}: {count}")
    
    # Save to CSV
    labels_df.to_csv(OUTPUT_FILE, index=False)
    logger.info(f"\nSaved mapping to {OUTPUT_FILE}")
    
    # Also create a make/model list for training
    make_list = sorted(labels_df['make'].unique().tolist())
    model_by_make = {}
    for make in make_list:
        models = sorted(labels_df[labels_df['make'] == make]['model'].unique().tolist())
        model_by_make[make] = models
    
    # Save make/model lists
    import json
    make_model_file = DATA_DIR / "make_model_lists.json"
    with open(make_model_file, 'w', encoding='utf-8') as f:
        json.dump({
            'makes': make_list,
            'models_by_make': model_by_make
        }, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved make/model lists to {make_model_file}")
    
    return labels_df


if __name__ == "__main__":
    create_image_labels()
