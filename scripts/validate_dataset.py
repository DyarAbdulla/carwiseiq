"""
Validate car classifier dataset and labels
Checks for label mismatches, missing images, and data consistency
"""

import pandas as pd
import numpy as np
from pathlib import Path
import logging
from collections import Counter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
LABELS_FILE = DATA_DIR / "image_labels.csv"

def validate_dataset():
    """Validate dataset and labels."""
    
    logger.info("=" * 80)
    logger.info("DATASET VALIDATION")
    logger.info("=" * 80)
    
    # 1. Check labels file exists
    if not LABELS_FILE.exists():
        logger.error(f"Labels file not found: {LABELS_FILE}")
        logger.info("Run create_image_labels.py first")
        return False
    
    # 2. Load labels
    logger.info(f"\n[1/5] Loading labels from {LABELS_FILE}")
    labels_df = pd.read_csv(LABELS_FILE)
    logger.info(f"Loaded {len(labels_df)} labeled images")
    
    # 3. Check for missing images
    logger.info(f"\n[2/5] Checking image files...")
    missing_images = 0
    existing_images = set()
    if IMAGES_DIR.exists():
        existing_images = set(IMAGES_DIR.glob("*.jpg")) | set(IMAGES_DIR.glob("*.png"))
        existing_images = {img.name for img in existing_images}
    
    for idx, row in labels_df.iterrows():
        if row['image_filename'] not in existing_images:
            missing_images += 1
    
    logger.info(f"Total images in labels: {len(labels_df)}")
    logger.info(f"Images found on disk: {len(existing_images)}")
    logger.info(f"Missing images: {missing_images}")
    
    if missing_images > len(labels_df) * 0.1:  # More than 10% missing
        logger.warning(f"WARNING: {missing_images} images missing ({missing_images/len(labels_df)*100:.1f}%)")
    
    # 4. Check label quality
    logger.info(f"\n[3/5] Checking label quality...")
    
    # Check for missing values
    missing_make = labels_df['make'].isna().sum()
    missing_model = labels_df['model'].isna().sum()
    logger.info(f"Missing make labels: {missing_make}")
    logger.info(f"Missing model labels: {missing_model}")
    
    # Check for empty strings
    empty_make = (labels_df['make'].astype(str).str.strip() == '').sum()
    empty_model = (labels_df['model'].astype(str).str.strip() == '').sum()
    logger.info(f"Empty make labels: {empty_make}")
    logger.info(f"Empty model labels: {empty_model}")
    
    # Check make distribution
    make_counts = labels_df['make'].value_counts()
    logger.info(f"\nTotal makes: {len(make_counts)}")
    logger.info(f"Makes with <10 samples: {(make_counts < 10).sum()}")
    logger.info(f"Makes with <5 samples: {(make_counts < 5).sum()}")
    
    logger.info(f"\nTop 20 Makes:")
    for make, count in make_counts.head(20).items():
        logger.info(f"  {make}: {count} images")
    
    logger.info(f"\nBottom 10 Makes:")
    for make, count in make_counts.tail(10).items():
        logger.info(f"  {make}: {count} images")
    
    # 5. Check for label inconsistencies
    logger.info(f"\n[4/5] Checking for label inconsistencies...")
    
    # Check for common typos/variations
    make_lower = labels_df['make'].str.lower().str.strip()
    unique_makes_lower = make_lower.unique()
    
    # Find potential duplicates (case-insensitive)
    make_variations = {}
    for make in labels_df['make'].unique():
        make_lower_key = str(make).lower().strip()
        if make_lower_key not in make_variations:
            make_variations[make_lower_key] = []
        make_variations[make_lower_key].append(make)
    
    duplicates = {k: v for k, v in make_variations.items() if len(v) > 1}
    if duplicates:
        logger.warning(f"\nFound {len(duplicates)} potential make name duplicates:")
        for key, variants in list(duplicates.items())[:10]:
            logger.warning(f"  '{key}': {variants}")
    
    # 6. Check train/val/test split consistency
    logger.info(f"\n[5/5] Checking train/val/test split...")
    
    from sklearn.model_selection import train_test_split
    
    labels_df_shuffled = labels_df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Filter makes with at least 2 samples for stratified split
    make_counts = labels_df_shuffled['make'].value_counts()
    valid_makes = make_counts[make_counts >= 2].index.tolist()
    labels_df_filtered = labels_df_shuffled[labels_df_shuffled['make'].isin(valid_makes)]
    
    logger.info(f"Filtered to {len(valid_makes)} makes with >=2 samples (for stratified split)")
    
    # First split: train+val (80%) vs test (20%)
    train_val_df, test_df = train_test_split(
        labels_df_filtered,
        test_size=0.2,
        random_state=42,
        stratify=labels_df_filtered['make']
    )
    
    # Second split: train (64%) vs val (16%)
    train_df, val_df = train_test_split(
        train_val_df,
        test_size=0.2,
        random_state=42,
        stratify=train_val_df['make']
    )
    
    logger.info(f"Train: {len(train_df)} ({len(train_df)/len(labels_df)*100:.1f}%)")
    logger.info(f"Validation: {len(val_df)} ({len(val_df)/len(labels_df)*100:.1f}%)")
    logger.info(f"Test: {len(test_df)} ({len(test_df)/len(labels_df)*100:.1f}%)")
    
    # Check make distribution in each split
    train_makes = set(train_df['make'].unique())
    val_makes = set(val_df['make'].unique())
    test_makes = set(test_df['make'].unique())
    
    logger.info(f"\nMake distribution:")
    logger.info(f"Train makes: {len(train_makes)}")
    logger.info(f"Val makes: {len(val_makes)}")
    logger.info(f"Test makes: {len(test_makes)}")
    
    missing_in_val = train_makes - val_makes
    missing_in_test = train_makes - test_makes
    
    if missing_in_val:
        logger.warning(f"Makes in train but not in val: {missing_in_val}")
    if missing_in_test:
        logger.warning(f"Makes in train but not in test: {missing_in_test}")
    
    # 7. Sample label checks
    logger.info(f"\n[6/6] Sample label checks...")
    logger.info(f"\nRandom sample of labels:")
    sample = labels_df.sample(min(10, len(labels_df)), random_state=42)
    for idx, row in sample.iterrows():
        logger.info(f"  {row['image_filename']}: {row['make']} {row['model']} ({row.get('year', 'N/A')})")
    
    # Summary
    logger.info("\n" + "=" * 80)
    logger.info("VALIDATION SUMMARY")
    logger.info("=" * 80)
    
    issues = []
    if missing_images > len(labels_df) * 0.1:
        issues.append(f"High missing image rate: {missing_images/len(labels_df)*100:.1f}%")
    if missing_make > 0:
        issues.append(f"Missing make labels: {missing_make}")
    if missing_model > 0:
        issues.append(f"Missing model labels: {missing_model}")
    if (make_counts < 10).sum() > len(make_counts) * 0.3:
        issues.append(f"Too many rare makes: {(make_counts < 10).sum()}/{len(make_counts)}")
    if duplicates:
        issues.append(f"Potential make name duplicates: {len(duplicates)}")
    
    if issues:
        logger.warning(f"\nIssues found: {len(issues)}")
        for issue in issues:
            logger.warning(f"  - {issue}")
        return False
    else:
        logger.info("\n✅ No major issues found!")
        return True

if __name__ == "__main__":
    validate_dataset()
