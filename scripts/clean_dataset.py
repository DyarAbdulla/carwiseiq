"""
Dataset Cleaning Pipeline
Removes duplicates, balances classes, ensures all images are labeled
"""

import pandas as pd
import numpy as np
from pathlib import Path
import hashlib
from collections import Counter
from PIL import Image
import shutil
from datetime import datetime
from tqdm import tqdm
import json
import multiprocessing
import sys
from functools import partial

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
BACKUP_DIR = DATA_DIR / "backups"
BACKUP_DIR.mkdir(exist_ok=True)

def calculate_image_hash_wrapper(args):
    """Wrapper for multiprocessing."""
    image_path = args
    try:
        with open(image_path, 'rb') as f:
            return (str(image_path), hashlib.md5(f.read()).hexdigest())
    except Exception:
        return (str(image_path), None)

def calculate_hashes_parallel(image_files, num_workers=None):
    """Calculate image hashes in parallel using all CPU cores."""
    if num_workers is None:
        num_workers = min(multiprocessing.cpu_count(), 12)  # Limit to 12 for stability
    
    print(f"   Using {num_workers} CPU cores for parallel hashing...")
    
    # Use multiprocessing with proper Windows support
    import sys
    if sys.platform == 'win32':
        multiprocessing.freeze_support()
    
    with multiprocessing.Pool(processes=num_workers) as pool:
        results = list(tqdm(
            pool.imap(calculate_image_hash_wrapper, image_files),
            total=len(image_files),
            desc="   Hashing images"
        ))
    
    return results

def clean_dataset(min_samples_per_brand=100, max_samples_per_brand=2000, apply_changes=False):
    """
    Clean the dataset:
    1. Remove duplicate images
    2. Ensure all images have labels
    3. Remove brands with <min_samples_per_brand images
    4. Balance dataset (limit to max_samples_per_brand per brand)
    5. Validate all image files exist
    """
    
    print("=" * 80)
    print("DATASET CLEANING PIPELINE")
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    if not apply_changes:
        print("⚠️  DRY RUN MODE - No changes will be applied")
        print("   Use --apply flag to actually make changes\n")
    
    # Load CSV
    csv_files = [
        DATA_DIR / "image_labels_filtered.csv",
        DATA_DIR / "image_labels_cleaned.csv",
        DATA_DIR / "image_labels.csv"
    ]
    
    df = None
    source_file = None
    for csv_file in csv_files:
        if csv_file.exists():
            df = pd.read_csv(csv_file)
            source_file = csv_file
            print(f"✅ Loaded {len(df):,} images from {csv_file.name}")
            break
    
    if df is None:
        print("❌ ERROR: No CSV file found!")
        return
    
    original_count = len(df)
    print(f"\n📊 Starting with {original_count:,} labeled images\n")
    
    # Backup original
    if apply_changes:
        backup_file = BACKUP_DIR / f"{source_file.stem}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        df.to_csv(backup_file, index=False)
        print(f"✅ Backup created: {backup_file.name}\n")
    
    # Step 1: Remove entries with missing image files
    print("1. REMOVING ENTRIES WITH MISSING IMAGE FILES...")
    valid_indices = []
    missing_count = 0
    
    for idx, row in tqdm(df.iterrows(), total=len(df), desc="   Checking files"):
        img_path = IMAGES_DIR / row['image_filename']
        if img_path.exists():
            valid_indices.append(idx)
        else:
            missing_count += 1
    
    df = df.loc[valid_indices].reset_index(drop=True)
    print(f"   ✅ Removed {missing_count:,} entries with missing files")
    print(f"   📊 Remaining: {len(df):,} images\n")
    
    # Step 2: Remove duplicate images (by hash) - PARALLEL
    print("2. REMOVING DUPLICATE IMAGES (by hash)...")
    print("   Using ALL CPU cores for parallel processing...")
    
    # Get all image files to hash
    image_files = [IMAGES_DIR / row['image_filename'] for _, row in df.iterrows()]
    
    # Parallel hashing
    hash_results = calculate_hashes_parallel(image_files, num_workers=multiprocessing.cpu_count())
    
    # Build hash map and find duplicates
    image_hashes = {}
    duplicate_indices = set()
    
    for idx, (img_path, img_hash) in enumerate(hash_results):
        if img_hash:
            if img_hash in image_hashes:
                # Keep first occurrence, mark rest as duplicates
                duplicate_indices.add(idx)
            else:
                image_hashes[img_hash] = idx
    
    df = df.drop(index=duplicate_indices).reset_index(drop=True)
    print(f"   ✅ Removed {len(duplicate_indices):,} duplicate images")
    print(f"   📊 Remaining: {len(df):,} images\n")
    
    # Step 3: Remove brands with <min_samples_per_brand images
    print(f"3. REMOVING BRANDS WITH <{min_samples_per_brand} IMAGES...")
    make_counts = df['make'].value_counts()
    valid_makes = make_counts[make_counts >= min_samples_per_brand].index.tolist()
    
    removed_brands = set(df['make'].unique()) - set(valid_makes)
    removed_count = len(df[~df['make'].isin(valid_makes)])
    
    df = df[df['make'].isin(valid_makes)].reset_index(drop=True)
    
    print(f"   ✅ Removed {len(removed_brands)} brands: {', '.join(sorted(removed_brands)[:10])}")
    if len(removed_brands) > 10:
        print(f"      ... and {len(removed_brands) - 10} more")
    print(f"   ✅ Removed {removed_count:,} images from rare brands")
    print(f"   📊 Remaining: {len(df):,} images, {len(valid_makes)} brands\n")
    
    # Step 4: Balance dataset (limit max_samples_per_brand)
    print(f"4. BALANCING DATASET (max {max_samples_per_brand} images per brand)...")
    
    balanced_dfs = []
    removed_by_balance = 0
    
    for make in valid_makes:
        make_df = df[df['make'] == make].copy()
        if len(make_df) > max_samples_per_brand:
            # Randomly sample to max_samples_per_brand
            make_df = make_df.sample(n=max_samples_per_brand, random_state=42).reset_index(drop=True)
            removed_by_balance += len(df[df['make'] == make]) - max_samples_per_brand
        balanced_dfs.append(make_df)
    
    df = pd.concat(balanced_dfs, ignore_index=True)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)  # Shuffle
    
    print(f"   ✅ Removed {removed_by_balance:,} images to balance dataset")
    print(f"   📊 Final count: {len(df):,} images\n")
    
    # Step 5: Ensure all images in folder have labels (create labels for unlabeled)
    print("5. CHECKING FOR UNLABELED IMAGES...")
    
    # Get all image files
    image_files = [f for f in IMAGES_DIR.iterdir() if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
    csv_image_names = set(df['image_filename'].tolist())
    actual_image_names = {f.name for f in image_files}
    
    unlabeled_images = actual_image_names - csv_image_names
    
    print(f"   📊 Unlabeled images found: {len(unlabeled_images):,}")
    
    if len(unlabeled_images) > 0 and apply_changes:
        print(f"   ⚠️  Note: {len(unlabeled_images)} images are unlabeled")
        print(f"      These will be excluded from training")
        print(f"      Run create_image_labels.py to label them\n")
    
    # Step 6: Validate data quality
    print("6. VALIDATING DATA QUALITY...")
    
    # Check for missing makes/models
    missing_makes = df[df['make'].isna() | (df['make'] == '')]
    missing_models = df[df['model'].isna() | (df['model'] == '')]
    
    if len(missing_makes) > 0 or len(missing_models) > 0:
        df = df[~(df['make'].isna() | (df['make'] == ''))]
        df = df[~(df['model'].isna() | (df['model'] == ''))]
        print(f"   ✅ Removed {len(missing_makes) + len(missing_models)} rows with missing labels")
    
    # Final statistics
    print("\n" + "=" * 80)
    print("CLEANING SUMMARY")
    print("=" * 80)
    
    print(f"\n📊 BEFORE CLEANING:")
    print(f"   Total images: {original_count:,}")
    
    print(f"\n📊 AFTER CLEANING:")
    print(f"   Total images: {len(df):,}")
    print(f"   Total brands: {df['make'].nunique()}")
    print(f"   Images removed: {original_count - len(df):,}")
    
    print(f"\n📊 BRAND DISTRIBUTION:")
    make_counts = df['make'].value_counts()
    print(f"   Min images per brand: {make_counts.min()}")
    print(f"   Max images per brand: {make_counts.max()}")
    print(f"   Mean images per brand: {make_counts.mean():.1f}")
    print(f"   Median images per brand: {make_counts.median():.1f}")
    
    # Save cleaned dataset
    if apply_changes:
        output_file = DATA_DIR / "image_labels_cleaned_final.csv"
        df.to_csv(output_file, index=False)
        print(f"\n✅ Cleaned dataset saved to: {output_file}")
        print(f"   Use this file for training!")
    else:
        print(f"\n⚠️  DRY RUN - No file saved. Use --apply to save changes.")
    
    return df

if __name__ == "__main__":
    # Windows multiprocessing support
    if sys.platform == 'win32':
        multiprocessing.freeze_support()
    
    import argparse
    
    parser = argparse.ArgumentParser(description="Clean car classifier dataset")
    parser.add_argument('--apply', action='store_true', help='Actually apply changes (default: dry run)')
    parser.add_argument('--min_samples', type=int, default=100, help='Minimum samples per brand')
    parser.add_argument('--max_samples', type=int, default=2000, help='Maximum samples per brand')
    
    args = parser.parse_args()
    
    clean_dataset(
        min_samples_per_brand=args.min_samples,
        max_samples_per_brand=args.max_samples,
        apply_changes=args.apply
    )
