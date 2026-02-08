"""
Filter out rare car brands with insufficient samples
Reads from cleaned dataset and filters brands with <min_samples images
"""

import pandas as pd
from pathlib import Path
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
INPUT_FILE = DATA_DIR / "image_labels_cleaned.csv"
OUTPUT_FILE = DATA_DIR / "image_labels_filtered.csv"

def filter_rare_makes(min_samples: int = 50, dry_run: bool = True):
    """Filter out makes with less than min_samples images."""
    
    logger.info("=" * 80)
    logger.info("FILTER RARE CAR BRANDS")
    logger.info("=" * 80)
    
    # Check input file exists
    if not INPUT_FILE.exists():
        logger.error(f"Input file not found: {INPUT_FILE}")
        logger.info("Expected input: data/image_labels_cleaned.csv")
        logger.info("Make sure you've run remove_duplicates.py first")
        return None
    
    # Load dataset
    logger.info(f"\nLoading dataset from {INPUT_FILE}")
    labels_df = pd.read_csv(INPUT_FILE)
    logger.info(f"Loaded {len(labels_df)} labeled images")
    
    # Count makes
    make_counts = labels_df['make'].value_counts().sort_values(ascending=False)
    total_makes_before = len(make_counts)
    total_images_before = len(labels_df)
    
    logger.info(f"\nBEFORE FILTERING:")
    logger.info(f"  Total makes: {total_makes_before}")
    logger.info(f"  Total images: {total_images_before:,}")
    logger.info(f"  Mean images per make: {make_counts.mean():.1f}")
    logger.info(f"  Median images per make: {make_counts.median():.1f}")
    logger.info(f"  Min images per make: {make_counts.min()}")
    logger.info(f"  Max images per make: {make_counts.max()}")
    
    # Find rare makes
    rare_makes = make_counts[make_counts < min_samples].index.tolist()
    rare_count = make_counts[make_counts < min_samples].sum()
    valid_makes = make_counts[make_counts >= min_samples].index.tolist()
    
    logger.info(f"\nFILTERING CRITERIA:")
    logger.info(f"  Minimum samples per brand: {min_samples}")
    logger.info(f"  Brands to be removed: {len(rare_makes)}")
    logger.info(f"  Images to be removed: {rare_count:,}")
    logger.info(f"  Brands to keep: {len(valid_makes)}")
    logger.info(f"  Images to keep: {total_images_before - rare_count:,}")
    
    if rare_makes:
        logger.info(f"\n📉 RARE BRANDS TO BE REMOVED (<{min_samples} images):")
        # Sort by count for better readability
        rare_sorted = sorted([(make, make_counts[make]) for make in rare_makes], 
                           key=lambda x: x[1], reverse=True)
        for make, count in rare_sorted:
            logger.info(f"  {make}: {count} images")
    
    logger.info(f"\n✅ BRANDS TO KEEP (≥{min_samples} images):")
    for make, count in make_counts[make_counts >= min_samples].head(20).items():
        logger.info(f"  {make}: {count} images")
    if len(valid_makes) > 20:
        logger.info(f"  ... and {len(valid_makes) - 20} more brands")
    
    if dry_run:
        logger.info("\n" + "=" * 80)
        logger.info("🔍 DRY RUN - No changes made")
        logger.info("=" * 80)
        logger.info(f"Would remove {len(rare_makes)} brands ({rare_count:,} images)")
        logger.info(f"Would keep {len(valid_makes)} brands ({total_images_before - rare_count:,} images)")
        logger.info("\nTo apply changes, run with --apply flag:")
        logger.info(f"  python scripts/filter_rare_makes.py --min_samples {min_samples} --apply")
        return None
    
    # Filter dataset
    logger.info("\n" + "=" * 80)
    logger.info("APPLYING FILTER")
    logger.info("=" * 80)
    
    logger.info("Filtering dataset...")
    labels_df_filtered = labels_df[labels_df['make'].isin(valid_makes)].reset_index(drop=True)
    
    total_makes_after = len(valid_makes)
    total_images_after = len(labels_df_filtered)
    
    logger.info(f"\nAFTER FILTERING:")
    logger.info(f"  Removed brands: {total_makes_before - total_makes_after}")
    logger.info(f"  Removed images: {total_images_before - total_images_after:,}")
    logger.info(f"  Remaining brands: {total_makes_after}")
    logger.info(f"  Remaining images: {total_images_after:,}")
    logger.info(f"  Reduction: {(total_images_before - total_images_after) / total_images_before * 100:.1f}%")
    
    # Backup original file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = DATA_DIR / f"image_labels_cleaned_backup_{timestamp}.csv"
    labels_df.to_csv(backup_file, index=False)
    logger.info(f"\n💾 Backed up original to: {backup_file}")
    
    # Save filtered dataset
    logger.info(f"\nSaving filtered dataset...")
    labels_df_filtered.to_csv(OUTPUT_FILE, index=False)
    logger.info(f"✅ Saved filtered labels to: {OUTPUT_FILE}")
    
    # Show final distribution
    make_counts_after = labels_df_filtered['make'].value_counts()
    logger.info(f"\nFINAL DISTRIBUTION:")
    logger.info(f"  Mean images per brand: {make_counts_after.mean():.1f}")
    logger.info(f"  Median images per brand: {make_counts_after.median():.1f}")
    logger.info(f"  Min images per brand: {make_counts_after.min()}")
    logger.info(f"  Max images per brand: {make_counts_after.max()}")
    
    logger.info("\n" + "=" * 80)
    logger.info("✅ FILTERING COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Filtered dataset saved to: {OUTPUT_FILE}")
    logger.info(f"Next step: Use this filtered dataset for training")
    
    return labels_df_filtered

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(
        description="Filter rare car brands from cleaned dataset",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (default, shows what would be removed)
  python scripts/filter_rare_makes.py
  
  # Dry run with custom threshold
  python scripts/filter_rare_makes.py --min_samples 30
  
  # Apply filtering (removes brands with <50 images)
  python scripts/filter_rare_makes.py --apply
  
  # Apply filtering with custom threshold
  python scripts/filter_rare_makes.py --min_samples 30 --apply
        """
    )
    parser.add_argument(
        '--min_samples', 
        type=int, 
        default=50, 
        help='Minimum images per brand (default: 50)'
    )
    parser.add_argument(
        '--apply', 
        action='store_true', 
        help='Actually apply filtering (default: dry run)'
    )
    
    args = parser.parse_args()
    
    filter_rare_makes(min_samples=args.min_samples, dry_run=not args.apply)
