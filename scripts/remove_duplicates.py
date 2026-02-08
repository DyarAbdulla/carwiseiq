"""
Remove duplicate images from dataset
Handles cases where same image has different labels
"""

import pandas as pd
import hashlib
from pathlib import Path
import logging
from collections import defaultdict
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
LABELS_FILE = DATA_DIR / "image_labels.csv"

def calculate_image_hash(image_path: Path) -> str:
    """Calculate MD5 hash of image file."""
    try:
        with open(image_path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception as e:
        logger.warning(f"Failed to hash {image_path}: {e}")
        return None

def remove_duplicates(dry_run: bool = True):
    """Remove duplicate images from dataset."""
    
    logger.info("=" * 80)
    logger.info("REMOVE DUPLICATE IMAGES")
    logger.info("=" * 80)
    
    if not LABELS_FILE.exists():
        logger.error(f"Labels file not found: {LABELS_FILE}")
        return
    
    labels_df = pd.read_csv(LABELS_FILE)
    logger.info(f"Loaded {len(labels_df)} labeled images")
    
    # Calculate hashes
    logger.info("Calculating image hashes...")
    image_hashes = {}
    hash_to_images = defaultdict(list)
    
    for idx, row in tqdm(labels_df.iterrows(), total=len(labels_df), desc="Hashing images"):
        image_path = IMAGES_DIR / row['image_filename']
        if image_path.exists():
            img_hash = calculate_image_hash(image_path)
            if img_hash:
                image_hashes[row['image_filename']] = img_hash
                hash_to_images[img_hash].append({
                    'index': idx,
                    'filename': row['image_filename'],
                    'make': row['make'],
                    'model': row['model']
                })
    
    # Find duplicates
    duplicates = {h: imgs for h, imgs in hash_to_images.items() if len(imgs) > 1}
    
    logger.info(f"\nFound {len(duplicates)} duplicate groups")
    
    # Identify images to remove
    indices_to_remove = set()
    inconsistent_labels = []
    
    for hash_val, imgs in duplicates.items():
        # Keep first occurrence, mark others for removal
        keep_idx = imgs[0]['index']
        makes = [img['make'] for img in imgs]
        
        # Check for label inconsistency
        if len(set(makes)) > 1:
            inconsistent_labels.append({
                'hash': hash_val,
                'images': imgs,
                'makes': makes,
                'keep': imgs[0]
            })
            logger.warning(f"\n⚠️  Duplicate with inconsistent labels:")
            logger.warning(f"  Keeping: {imgs[0]['filename']} ({imgs[0]['make']})")
            for img in imgs[1:]:
                logger.warning(f"  Removing: {img['filename']} ({img['make']})")
                indices_to_remove.add(img['index'])
        else:
            # Same labels, just remove duplicates
            for img in imgs[1:]:
                indices_to_remove.add(img['index'])
    
    logger.info(f"\nImages to remove: {len(indices_to_remove)}")
    logger.info(f"Inconsistent labels: {len(inconsistent_labels)}")
    
    if dry_run:
        logger.info("\n🔍 DRY RUN - No changes made")
        logger.info(f"Would remove {len(indices_to_remove)} duplicate images")
        return
    
    # Remove duplicates
    logger.info("\nRemoving duplicates...")
    labels_df_cleaned = labels_df.drop(indices_to_remove).reset_index(drop=True)
    
    # Save cleaned dataset
    output_file = DATA_DIR / "image_labels_cleaned.csv"
    labels_df_cleaned.to_csv(output_file, index=False)
    logger.info(f"Saved cleaned labels to {output_file}")
    logger.info(f"Removed {len(indices_to_remove)} duplicate images")
    logger.info(f"Remaining images: {len(labels_df_cleaned)}")
    
    # Backup original
    backup_file = DATA_DIR / "image_labels_backup.csv"
    labels_df.to_csv(backup_file, index=False)
    logger.info(f"Backed up original to {backup_file}")
    
    return labels_df_cleaned

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Remove duplicate images")
    parser.add_argument('--apply', action='store_true', help='Actually remove duplicates (default: dry run)')
    args = parser.parse_args()
    
    remove_duplicates(dry_run=not args.apply)
