"""
Filter out rare makes with insufficient samples
"""

import pandas as pd
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
LABELS_FILE = DATA_DIR / "image_labels.csv"

def filter_rare_makes(min_samples: int = 10, dry_run: bool = True):
    """Filter out makes with less than min_samples images."""
    
    logger.info("=" * 80)
    logger.info("FILTER RARE MAKES")
    logger.info("=" * 80)
    
    if not LABELS_FILE.exists():
        logger.error(f"Labels file not found: {LABELS_FILE}")
        return
    
    labels_df = pd.read_csv(LABELS_FILE)
    logger.info(f"Loaded {len(labels_df)} labeled images")
    
    # Count makes
    make_counts = labels_df['make'].value_counts()
    logger.info(f"Total makes: {len(make_counts)}")
    
    # Find rare makes
    rare_makes = make_counts[make_counts < min_samples].index.tolist()
    rare_count = make_counts[make_counts < min_samples].sum()
    
    logger.info(f"\nMakes with <{min_samples} samples: {len(rare_makes)}")
    logger.info(f"Total images in rare makes: {rare_count}")
    
    if rare_makes:
        logger.info("\nRare makes to be removed:")
        for make in rare_makes:
            count = make_counts[make]
            logger.info(f"  {make}: {count} images")
    
    if dry_run:
        logger.info("\n🔍 DRY RUN - No changes made")
        logger.info(f"Would remove {len(rare_makes)} makes ({rare_count} images)")
        return
    
    # Filter dataset
    logger.info("\nFiltering dataset...")
    labels_df_filtered = labels_df[~labels_df['make'].isin(rare_makes)].reset_index(drop=True)
    
    logger.info(f"Removed {len(rare_makes)} makes")
    logger.info(f"Remaining images: {len(labels_df_filtered)}")
    logger.info(f"Remaining makes: {labels_df_filtered['make'].nunique()}")
    
    # Save filtered dataset
    output_file = DATA_DIR / "image_labels_filtered.csv"
    labels_df_filtered.to_csv(output_file, index=False)
    logger.info(f"\nSaved filtered labels to {output_file}")
    
    # Backup original
    backup_file = DATA_DIR / "image_labels_backup.csv"
    if not backup_file.exists():
        labels_df.to_csv(backup_file, index=False)
        logger.info(f"Backed up original to {backup_file}")
    
    return labels_df_filtered

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Filter rare makes")
    parser.add_argument('--min_samples', type=int, default=10, help='Minimum samples per make')
    parser.add_argument('--apply', action='store_true', help='Actually filter (default: dry run)')
    args = parser.parse_args()
    
    filter_rare_makes(min_samples=args.min_samples, dry_run=not args.apply)
