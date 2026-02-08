"""
Comprehensive Dataset Diagnostic Script
Identifies all issues with the car classifier dataset
"""

import pandas as pd
import numpy as np
from pathlib import Path
import hashlib
from collections import Counter
from PIL import Image
import json
from datetime import datetime
from tqdm import tqdm
import multiprocessing
import sys
from functools import partial

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
OUTPUT_DIR = PROJECT_ROOT / "diagnostics"
OUTPUT_DIR.mkdir(exist_ok=True)

def calculate_image_hash_wrapper(args):
    """Wrapper for multiprocessing."""
    image_path = args
    try:
        with open(image_path, 'rb') as f:
            return (str(image_path), hashlib.md5(f.read()).hexdigest())
    except Exception as e:
        return (str(image_path), None)

def calculate_hashes_parallel(image_files, num_workers=None):
    """Calculate image hashes in parallel using all CPU cores."""
    if num_workers is None:
        num_workers = min(multiprocessing.cpu_count(), 12)  # Limit to 12 for stability
    
    print(f"   Using {num_workers} CPU cores for parallel hashing...")
    
    # Use multiprocessing with proper Windows support
    if sys.platform == 'win32':
        multiprocessing.freeze_support()
    
    with multiprocessing.Pool(processes=num_workers) as pool:
        results = list(tqdm(
            pool.imap(calculate_image_hash_wrapper, image_files),
            total=len(image_files),
            desc="   Hashing images"
        ))
    
    return results

def diagnose_dataset():
    """Run comprehensive dataset diagnostics."""
    
    print("=" * 80)
    print("CAR CLASSIFIER DATASET DIAGNOSTICS")
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    results = {
        'timestamp': datetime.now().isoformat(),
        'issues': [],
        'statistics': {},
        'recommendations': []
    }
    
    # 1. Count total images in car_images/
    print("1. COUNTING IMAGES IN car_images/ FOLDER...")
    if IMAGES_DIR.exists():
        image_files = [f for f in IMAGES_DIR.iterdir() if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
        total_images = len(image_files)
        print(f"   ✅ Found {total_images:,} images in car_images/")
        results['statistics']['total_images'] = total_images
    else:
        print(f"   ❌ ERROR: car_images/ folder not found!")
        results['issues'].append("car_images/ folder not found")
        return results
    
    # 2. Count labeled images in CSV files
    print("\n2. COUNTING LABELED IMAGES IN CSV FILES...")
    csv_files = {
        'filtered': DATA_DIR / "image_labels_filtered.csv",
        'cleaned': DATA_DIR / "image_labels_cleaned.csv",
        'standard': DATA_DIR / "image_labels.csv"
    }
    
    labeled_count = 0
    active_csv = None
    
    for name, csv_file in csv_files.items():
        if csv_file.exists():
            df = pd.read_csv(csv_file)
            print(f"   ✅ {name}: {len(df):,} labeled images")
            if name == 'filtered' or (name == 'cleaned' and active_csv is None) or (name == 'standard' and active_csv is None):
                labeled_count = len(df)
                active_csv = csv_file
                print(f"   📌 Using: {csv_file.name}")
    
    if active_csv is None:
        print("   ❌ ERROR: No CSV file found!")
        results['issues'].append("No image_labels CSV file found")
        return results
    
    results['statistics']['labeled_images'] = labeled_count
    results['statistics']['active_csv'] = str(active_csv)
    
    # 3. Find missing/unlabeled images
    print("\n3. FINDING MISSING/UNLABELED IMAGES...")
    df = pd.read_csv(active_csv)
    
    # Get image filenames from CSV
    csv_image_names = set(df['image_filename'].tolist())
    
    # Get actual image files
    actual_image_names = {f.name for f in image_files}
    
    # Find missing
    unlabeled_images = actual_image_names - csv_image_names
    missing_files = csv_image_names - actual_image_names
    
    print(f"   📊 Images in folder but NOT in CSV: {len(unlabeled_images):,}")
    print(f"   📊 Images in CSV but NOT in folder: {len(missing_files):,}")
    
    if len(unlabeled_images) > 0:
        print(f"   ⚠️  WARNING: {len(unlabeled_images):,} images are not labeled!")
        results['issues'].append(f"{len(unlabeled_images)} unlabeled images found")
        results['statistics']['unlabeled_images'] = len(unlabeled_images)
        results['statistics']['unlabeled_sample'] = list(unlabeled_images)[:10]
    
    if len(missing_files) > 0:
        print(f"   ⚠️  WARNING: {len(missing_files):,} CSV entries point to missing files!")
        results['issues'].append(f"{len(missing_files)} missing image files")
        results['statistics']['missing_files'] = len(missing_files)
    
    # 4. Check for duplicate image hashes (PARALLEL)
    print("\n4. CHECKING FOR DUPLICATE IMAGES (by hash)...")
    print("   Using ALL CPU cores for parallel processing...")
    
    # Use parallel hashing for faster processing
    hash_results = calculate_hashes_parallel(image_files[:20000], num_workers=multiprocessing.cpu_count())  # Sample 20k
    
    image_hashes = {}
    duplicate_groups = {}
    
    for img_path, img_hash in hash_results:
        if img_hash:
            if img_hash in image_hashes:
                if img_hash not in duplicate_groups:
                    duplicate_groups[img_hash] = [image_hashes[img_hash]]
                duplicate_groups[img_hash].append(img_path)
            else:
                image_hashes[img_hash] = img_path
    
    print(f"   📊 Found {len(duplicate_groups)} duplicate groups")
    if len(duplicate_groups) > 0:
        total_duplicates = sum(len(group) - 1 for group in duplicate_groups.values())
        print(f"   ⚠️  WARNING: {total_duplicates} duplicate images found!")
        results['issues'].append(f"{total_duplicates} duplicate images found")
        results['statistics']['duplicate_groups'] = len(duplicate_groups)
        results['statistics']['total_duplicates'] = total_duplicates
    
    # 5. Verify label quality
    print("\n5. VERIFYING LABEL QUALITY...")
    
    # Check for missing makes/models
    missing_makes = df[df['make'].isna() | (df['make'] == '')]
    missing_models = df[df['model'].isna() | (df['model'] == '')]
    
    print(f"   📊 Rows with missing 'make': {len(missing_makes)}")
    print(f"   📊 Rows with missing 'model': {len(missing_models)}")
    
    if len(missing_makes) > 0 or len(missing_models) > 0:
        results['issues'].append(f"{len(missing_makes)} missing makes, {len(missing_models)} missing models")
    
    # Check for invalid image paths
    invalid_paths = 0
    for idx, row in df.head(1000).iterrows():  # Sample check
        img_path = IMAGES_DIR / row['image_filename']
        if not img_path.exists():
            invalid_paths += 1
    
    if invalid_paths > 0:
        print(f"   ⚠️  WARNING: Found {invalid_paths} invalid paths in sample")
        results['issues'].append(f"Invalid image paths detected")
    
    # 6. Class distribution
    print("\n6. ANALYZING CLASS DISTRIBUTION...")
    
    make_counts = df['make'].value_counts()
    total_makes = len(make_counts)
    
    print(f"   📊 Total brands: {total_makes}")
    print(f"   📊 Mean images per brand: {make_counts.mean():.1f}")
    print(f"   📊 Median images per brand: {make_counts.median():.1f}")
    print(f"   📊 Min images per brand: {make_counts.min()}")
    print(f"   📊 Max images per brand: {make_counts.max()}")
    
    # Brands with too few images
    rare_brands = make_counts[make_counts < 100]
    print(f"\n   ⚠️  Brands with <100 images: {len(rare_brands)}")
    if len(rare_brands) > 0:
        print(f"   Top 10 rare brands:")
        for make, count in rare_brands.head(10).items():
            print(f"      - {make}: {count} images")
        results['issues'].append(f"{len(rare_brands)} brands have <100 images")
    
    # Brands with too many images
    common_brands = make_counts[make_counts > 2000]
    print(f"\n   📊 Brands with >2000 images: {len(common_brands)}")
    if len(common_brands) > 0:
        print(f"   Top brands:")
        for make, count in common_brands.head(10).items():
            print(f"      - {make}: {count} images")
        results['issues'].append(f"{len(common_brands)} brands have >2000 images (imbalanced)")
    
    results['statistics']['total_brands'] = total_makes
    results['statistics']['rare_brands'] = len(rare_brands)
    results['statistics']['common_brands'] = len(common_brands)
    results['statistics']['make_distribution'] = make_counts.to_dict()
    
    # 7. Summary and recommendations
    print("\n" + "=" * 80)
    print("DIAGNOSTIC SUMMARY")
    print("=" * 80)
    
    print(f"\n📊 STATISTICS:")
    print(f"   Total images in folder: {total_images:,}")
    print(f"   Labeled images in CSV: {labeled_count:,}")
    print(f"   Unlabeled images: {len(unlabeled_images):,}")
    print(f"   Missing files: {len(missing_files):,}")
    print(f"   Duplicate groups: {len(duplicate_groups)}")
    print(f"   Total brands: {total_makes}")
    print(f"   Brands with <100 images: {len(rare_brands)}")
    print(f"   Brands with >2000 images: {len(common_brands)}")
    
    print(f"\n⚠️  ISSUES FOUND: {len(results['issues'])}")
    for issue in results['issues']:
        print(f"   - {issue}")
    
    print(f"\n💡 RECOMMENDATIONS:")
    
    if len(unlabeled_images) > 0:
        print(f"   1. Create labels for {len(unlabeled_images):,} unlabeled images")
        results['recommendations'].append(f"Label {len(unlabeled_images)} unlabeled images")
    
    if len(duplicate_groups) > 0:
        print(f"   2. Remove {sum(len(g)-1 for g in duplicate_groups.values())} duplicate images")
        results['recommendations'].append("Remove duplicate images")
    
    if len(rare_brands) > 0:
        print(f"   3. Remove or collect more data for {len(rare_brands)} rare brands (<100 images)")
        results['recommendations'].append(f"Remove {len(rare_brands)} rare brands")
    
    if len(common_brands) > 0:
        print(f"   4. Balance dataset by limiting brands to max 2000 images")
        results['recommendations'].append("Balance dataset (max 2000 per brand)")
    
    if len(missing_files) > 0:
        print(f"   5. Remove {len(missing_files)} CSV entries pointing to missing files")
        results['recommendations'].append(f"Remove {len(missing_files)} invalid CSV entries")
    
    # Save results
    output_file = OUTPUT_DIR / f"diagnostic_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✅ Diagnostic report saved to: {output_file}")
    
    return results

if __name__ == "__main__":
    # Windows multiprocessing support
    if sys.platform == 'win32':
        multiprocessing.freeze_support()
    diagnose_dataset()
