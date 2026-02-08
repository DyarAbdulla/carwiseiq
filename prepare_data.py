"""
============================================================================
DATA PREPARATION SCRIPT
============================================================================

This script prepares the multi-modal car price prediction dataset by:
1. Merging 3 CSV files (iqcars1.csv, iqcars2.csv, iqcars3.csv)
2. Removing rows where price_usd is empty/null/zero
3. Removing rows without image_1 URL
4. Cleaning price data (remove $, commas)
5. Removing outliers (price < $500 or > $500,000)
6. Downloading car images from image_1 URLs
7. Saving final dataset: final_dataset_with_images.csv

"""

import pandas as pd
import numpy as np
import os
import sys
import logging
from typing import List, Optional
from datetime import datetime
from pathlib import Path
import requests
from PIL import Image
import io
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
import warnings
import re

warnings.filterwarnings('ignore')

# ============================================================================
# CONFIGURATION
# ============================================================================

DATA_DIR = Path("data")
OUTPUT_DIR = Path("data")
IMAGES_DIR = Path("car_images")
OUTPUT_FILE = OUTPUT_DIR / "final_dataset_with_images.csv"
LOG_FILE = "data_preparation.log"

# CSV files to merge
CSV_FILES = [
    DATA_DIR / "iqcars1.csv",
    DATA_DIR / "iqcars2.csv",
    DATA_DIR / "iqcars3.csv"
]

# Price limits
MIN_PRICE = 500
MAX_PRICE = 500000

# Image download settings
DOWNLOAD_TIMEOUT = 10
MAX_WORKERS = 4

# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging(log_file: str = LOG_FILE) -> logging.Logger:
    """Set up detailed logging."""
    logger = logging.getLogger('data_preparation')
    logger.setLevel(logging.DEBUG)

    logger.handlers = []

    file_handler = logging.FileHandler(log_file, mode='w', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(file_formatter)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('%(levelname)s: %(message)s')
    console_handler.setFormatter(console_formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger

logger = setup_logging()

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def clean_price(price_str: str) -> Optional[float]:
    """
    Clean price string and convert to float.
    Removes $, commas, and whitespace.

    Parameters:
    -----------
    price_str : str
        Price string to clean

    Returns:
    --------
    price : Optional[float]
        Cleaned price or None if invalid
    """
    if pd.isna(price_str):
        return None

    try:
        # Convert to string and clean
        price_str = str(price_str).strip()

        # Remove $, commas, and whitespace
        price_str = re.sub(r'[\$,\s]', '', price_str)

        # Convert to float
        price = float(price_str)

        return price if price > 0 else None
    except (ValueError, TypeError):
        return None


def download_image(url: str, image_path: Path, timeout: int = DOWNLOAD_TIMEOUT) -> bool:
    """
    Download image from URL and save to disk.

    Parameters:
    -----------
    url : str
        Image URL
    image_path : Path
        Path to save image
    timeout : int
        Request timeout in seconds

    Returns:
    --------
    success : bool
        True if download successful, False otherwise
    """
    try:
        response = requests.get(url, timeout=timeout, stream=True)
        response.raise_for_status()

        # Verify it's an image
        img = Image.open(io.BytesIO(response.content))
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # Save image
        image_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(image_path, 'JPEG', quality=95)

        return True
    except Exception as e:
        logger.debug(f"Failed to download image {url}: {str(e)}")
        return False


def download_images_batch(df: pd.DataFrame, images_dir: Path) -> pd.DataFrame:
    """
    Download images for all rows in DataFrame.

    Parameters:
    -----------
    df : pd.DataFrame
        DataFrame with image_1 URLs
    images_dir : Path
        Directory to save images

    Returns:
    --------
    df : pd.DataFrame
        DataFrame with image_path column added
    """
    logger.info(f"Downloading images for {len(df)} cars...")

    images_dir.mkdir(parents=True, exist_ok=True)

    def download_single(row):
        """Download single image."""
        idx = row.name
        url = row['image_1']

        if pd.isna(url) or not url or url.strip() == '':
            return None

        # Create image filename
        image_filename = f"car_{idx:06d}.jpg"
        image_path = images_dir / image_filename

        # Download if not exists
        if not image_path.exists():
            success = download_image(url, image_path)
            if not success:
                return None

        return str(image_path)

    # Download images with progress bar
    image_paths = []
    for idx, row in tqdm(df.iterrows(), total=len(df), desc="Downloading images"):
        image_path = download_single(row)
        image_paths.append(image_path)

    df['image_path'] = image_paths

    # Count successful downloads
    successful_downloads = df['image_path'].notna().sum()
    logger.info(f"Successfully downloaded {successful_downloads}/{len(df)} images")

    return df


# ============================================================================
# DATA PREPARATION FUNCTIONS
# ============================================================================

def load_and_merge_csvs(csv_files: List[Path]) -> pd.DataFrame:
    """
    Load and merge multiple CSV files.

    Parameters:
    -----------
    csv_files : List[Path]
        List of CSV file paths

    Returns:
    --------
    merged_df : pd.DataFrame
        Merged DataFrame
    """
    logger.info("Loading and merging CSV files...")

    all_dfs = []

    for csv_file in csv_files:
        if not csv_file.exists():
            logger.warning(f"File not found: {csv_file}, skipping...")
            continue

        logger.info(f"Loading {csv_file.name}...")
        try:
            df = pd.read_csv(csv_file, low_memory=False)
            logger.info(f"  Loaded {len(df)} rows from {csv_file.name}")
            all_dfs.append(df)
        except Exception as e:
            logger.error(f"Error loading {csv_file.name}: {str(e)}")
            continue

    if not all_dfs:
        raise ValueError("No CSV files could be loaded!")

    # Merge all DataFrames
    merged_df = pd.concat(all_dfs, ignore_index=True)
    logger.info(f"Merged {len(merged_df)} total rows")

    return merged_df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and filter data according to requirements.

    Parameters:
    -----------
    df : pd.DataFrame
        Raw DataFrame

    Returns:
    --------
    cleaned_df : pd.DataFrame
        Cleaned DataFrame
    """
    logger.info("Cleaning data...")

    initial_count = len(df)
    logger.info(f"Initial row count: {initial_count:,}")

    # Convert numeric columns
    numeric_cols = ['engine_size', 'cylinders', 'mileage', 'year', 'price_usd']
    for col in numeric_cols:
        if col in df.columns:
            # Remove non-numeric characters
            df[col] = df[col].astype(str).str.replace(r'[^\d.]', '', regex=True)
            # Convert to numeric
            df[col] = pd.to_numeric(df[col], errors='coerce')
            # Fill missing with median
            df[col].fillna(df[col].median(), inplace=True)

    # Step 1: Remove rows where price_usd is empty/null/zero
    if 'price_usd' in df.columns:
        before_price = len(df)
        df = df[df['price_usd'].notna()]
        df = df[df['price_usd'] != 0]
        after_price = len(df)
        logger.info(f"Removed {before_price - after_price} rows with empty/null/zero price_usd")
    elif 'price' in df.columns:
        # Fallback to 'price' column if price_usd doesn't exist
        before_price = len(df)
        df = df[df['price'].notna()]
        df = df[df['price'] != 0]
        after_price = len(df)
        logger.info(f"Removed {before_price - after_price} rows with empty/null/zero price")

    # Step 2: Remove rows without image_1 URL
    before_image = len(df)
    df = df[df['image_1'].notna()]
    df = df[df['image_1'] != '']
    df = df[df['image_1'].str.strip() != '']
    after_image = len(df)
    logger.info(f"Removed {before_image - after_image} rows without image_1 URL")

    # Step 3: Clean price data
    if 'price_usd' in df.columns:
        df['price_usd_cleaned'] = df['price_usd'].apply(clean_price)
        df = df[df['price_usd_cleaned'].notna()]
        df['price'] = df['price_usd_cleaned']
        df = df.drop(columns=['price_usd_cleaned'])
    elif 'price' in df.columns:
        df['price_cleaned'] = df['price'].apply(clean_price)
        df = df[df['price_cleaned'].notna()]
        df['price'] = df['price_cleaned']
        df = df.drop(columns=['price_cleaned'])

    logger.info(f"Cleaned price data: {len(df)} rows remaining")

    # Step 4: Remove outliers (price < $500 or > $500,000)
    before_outliers = len(df)
    df = df[(df['price'] >= MIN_PRICE) & (df['price'] <= MAX_PRICE)]
    after_outliers = len(df)
    logger.info(f"Removed {before_outliers - after_outliers} outliers (price < ${MIN_PRICE} or > ${MAX_PRICE:,})")

    final_count = len(df)
    logger.info(f"Final row count: {final_count:,} ({final_count/initial_count*100:.1f}% retained)")

    return df


def prepare_final_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Prepare final dataset with required columns.

    Parameters:
    -----------
    df : pd.DataFrame
        Cleaned DataFrame

    Returns:
    --------
    final_df : pd.DataFrame
        Final dataset ready for training
    """
    logger.info("Preparing final dataset...")

    # Select required columns
    required_columns = [
        'make', 'model', 'year', 'mileage', 'condition',
        'fuel_type', 'engine_size', 'cylinders', 'price', 'image_1'
    ]

    # Only include columns that exist
    available_columns = [col for col in required_columns if col in df.columns]

    # Add any additional useful columns
    additional_columns = ['trim', 'location', 'description']
    for col in additional_columns:
        if col in df.columns and col not in available_columns:
            available_columns.append(col)

    final_df = df[available_columns].copy()

    # Ensure price is numeric
    final_df['price'] = pd.to_numeric(final_df['price'], errors='coerce')
    final_df = final_df[final_df['price'].notna()]

    # Fill missing values for optional columns
    if 'trim' in final_df.columns:
        final_df['trim'] = final_df['trim'].fillna('Unknown')

    # Statistics
    logger.info(f"\nFinal Dataset Statistics:")
    logger.info(f"  Total rows: {len(final_df):,}")
    logger.info(f"  Total columns: {len(final_df.columns)}")
    logger.info(f"  Price range: ${final_df['price'].min():,.0f} - ${final_df['price'].max():,.0f}")
    logger.info(f"  Average price: ${final_df['price'].mean():,.0f}")
    logger.info(f"  Median price: ${final_df['price'].median():,.0f}")
    logger.info(f"  Year range: {final_df['year'].min():.0f} - {final_df['year'].max():.0f}")
    logger.info(f"  Unique makes: {final_df['make'].nunique()}")
    logger.info(f"  Unique models: {final_df['model'].nunique()}")

    return final_df


def save_dataset(df: pd.DataFrame, output_file: Path) -> None:
    """
    Save final dataset to CSV.

    Parameters:
    -----------
    df : pd.DataFrame
        Dataset to save
    output_file : Path
        Output file path
    """
    logger.info(f"Saving dataset to {output_file}...")

    output_file.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_file, index=False, encoding='utf-8')

    logger.info(f"Dataset saved successfully! ({len(df):,} rows)")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main execution function."""
    logger.info("=" * 80)
    logger.info("DATA PREPARATION FOR MULTI-MODAL CAR PRICE PREDICTION")
    logger.info("=" * 80)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        # Create directories
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)

        # Step 1: Load and merge CSV files
        merged_df = load_and_merge_csvs(CSV_FILES)

        # Step 2: Clean data
        cleaned_df = clean_data(merged_df)

        # Step 3: Download images
        logger.info("\n" + "=" * 80)
        logger.info("DOWNLOADING CAR IMAGES")
        logger.info("=" * 80)
        df_with_images = download_images_batch(cleaned_df, IMAGES_DIR)

        # Step 4: Prepare final dataset
        final_df = prepare_final_dataset(df_with_images)

        # Step 5: Save dataset
        save_dataset(final_df, OUTPUT_FILE)

        logger.info("=" * 80)
        logger.info("DATA PREPARATION COMPLETE!")
        logger.info("=" * 80)
        logger.info(f"Output file: {OUTPUT_FILE}")
        logger.info(f"Images directory: {IMAGES_DIR}")
        logger.info(f"Total rows: {len(final_df):,}")
        logger.info(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        return final_df

    except Exception as e:
        logger.error(f"Fatal error during data preparation: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    main()
