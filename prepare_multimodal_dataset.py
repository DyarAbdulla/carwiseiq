"""
============================================================================
MULTI-MODAL DATASET PREPARATION SCRIPT
============================================================================

This script prepares a clean, production-ready dataset for multi-modal car
price prediction by:
1. Merging multiple CSV files (iqcars1.csv, iqcars2.csv, iqcars3.csv)
2. Cleaning and validating data
3. Extracting image URLs from multiple columns
4. Handling missing values intelligently
5. Creating feature engineering
6. Saving final dataset with image URLs

Performance optimizations:
- Chunked reading for large files
- Parallel processing for data cleaning
- Efficient memory usage

Target: Maximum accuracy with robust error handling
"""

import pandas as pd
import numpy as np
import os
import sys
import logging
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import json
from pathlib import Path
import warnings
from multiprocessing import Pool, cpu_count
from functools import partial
import re

warnings.filterwarnings('ignore')

# ============================================================================
# CONFIGURATION
# ============================================================================

# File paths
DATA_DIR = Path("data")
OUTPUT_DIR = Path("data")
OUTPUT_FILE = OUTPUT_DIR / "final_dataset_with_images.csv"
LOG_FILE = "data_preparation.log"

# CSV files to merge
CSV_FILES = [
    DATA_DIR / "iqcars1.csv",
    DATA_DIR / "iqcars2.csv",
    DATA_DIR / "iqcars3.csv"
]

# Image URL columns to check
IMAGE_COLUMNS = ['image_1', 'image_2', 'image_3', 'all_images']

# Required columns for price prediction
REQUIRED_COLUMNS = [
    'make', 'model', 'year', 'price', 'mileage', 'engine_size',
    'cylinders', 'condition', 'fuel_type', 'location'
]

# Price column priority (use first available)
PRICE_COLUMNS = ['price_usd', 'price', 'price_iqd']

# Valid conditions
VALID_CONDITIONS = ['New', 'Used', 'Excellent', 'Good', 'Fair', 'Poor']

# Valid fuel types
VALID_FUEL_TYPES = ['Gasoline', 'Diesel', 'Hybrid', 'EV', 'Electric', 'Plug-in Hybrid']

# Numeric columns that should be positive
POSITIVE_NUMERIC_COLUMNS = ['year', 'price', 'mileage', 'engine_size', 'cylinders']

# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging(log_file: str = LOG_FILE) -> logging.Logger:
    """
    Set up detailed logging for data preparation process.

    Parameters:
    -----------
    log_file : str
        Path to log file

    Returns:
    --------
    logger : logging.Logger
        Configured logger instance
    """
    logger = logging.getLogger('data_preparation')
    logger.setLevel(logging.DEBUG)

    # Remove existing handlers
    logger.handlers = []

    # File handler
    file_handler = logging.FileHandler(log_file, mode='w', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(file_formatter)

    # Console handler
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

def extract_image_urls(row: pd.Series) -> List[str]:
    """
    Extract all image URLs from a row, checking multiple columns.

    Parameters:
    -----------
    row : pd.Series
        DataFrame row containing image columns

    Returns:
    --------
    image_urls : List[str]
        List of valid image URLs
    """
    image_urls = []

    # Check individual image columns
    for col in ['image_1', 'image_2', 'image_3']:
        if col in row.index and pd.notna(row[col]):
            url = str(row[col]).strip()
            if url and url.lower() not in ['nan', 'none', '']:
                # Validate URL format
                if url.startswith(('http://', 'https://')):
                    image_urls.append(url)

    # Check all_images column (might contain multiple URLs)
    if 'all_images' in row.index and pd.notna(row['all_images']):
        all_images = str(row['all_images']).strip()
        if all_images and all_images.lower() not in ['nan', 'none', '']:
            # Try to split by common delimiters
            urls = re.split(r'[,;|\n\r]+', all_images)
            for url in urls:
                url = url.strip()
                if url and url.startswith(('http://', 'https://')):
                    image_urls.append(url)

    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in image_urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)

    return unique_urls[:5]  # Limit to 5 images max


def validate_numeric(value: float, col_name: str, min_val: float = 0,
                     max_val: Optional[float] = None) -> Optional[float]:
    """
    Validate and clean numeric values.

    Parameters:
    -----------
    value : float
        Value to validate
    col_name : str
        Column name for error messages
    min_val : float
        Minimum allowed value
    max_val : Optional[float]
        Maximum allowed value (None = no limit)

    Returns:
    --------
    cleaned_value : Optional[float]
        Validated value or None if invalid
    """
    if pd.isna(value):
        return None

    try:
        val = float(value)

        # Check for negative values for positive columns
        if val < min_val:
            logger.debug(f"Invalid {col_name}: {val} < {min_val}, setting to None")
            return None

        # Check for maximum
        if max_val is not None and val > max_val:
            logger.debug(f"Invalid {col_name}: {val} > {max_val}, setting to None")
            return None

        return val
    except (ValueError, TypeError):
        logger.debug(f"Could not convert {col_name} to float: {value}")
        return None


def clean_text(value: str) -> Optional[str]:
    """
    Clean and normalize text values.

    Parameters:
    -----------
    value : str
        Text value to clean

    Returns:
    --------
    cleaned_text : Optional[str]
        Cleaned text or None if invalid
    """
    if pd.isna(value):
        return None

    text = str(value).strip()

    if not text or text.lower() in ['nan', 'none', 'null', '']:
        return None

    return text


def normalize_condition(condition: str) -> Optional[str]:
    """
    Normalize condition values to standard format.

    Parameters:
    -----------
    condition : str
        Raw condition value

    Returns:
    --------
    normalized : Optional[str]
        Normalized condition or None if invalid
    """
    if pd.isna(condition):
        return None

    cond = str(condition).strip().title()

    # Map variations to standard values
    condition_map = {
        'New': 'New',
        'Used': 'Used',
        'Excellent': 'Excellent',
        'Good': 'Good',
        'Fair': 'Fair',
        'Poor': 'Poor',
        'Like New': 'Excellent',
        'Very Good': 'Good',
        'Average': 'Fair'
    }

    return condition_map.get(cond, cond if cond in VALID_CONDITIONS else None)


def normalize_fuel_type(fuel_type: str) -> Optional[str]:
    """
    Normalize fuel type values to standard format.

    Parameters:
    -----------
    fuel_type : str
        Raw fuel type value

    Returns:
    --------
    normalized : Optional[str]
        Normalized fuel type or None if invalid
    """
    if pd.isna(fuel_type):
        return None

    fuel = str(fuel_type).strip().title()

    # Map variations to standard values
    fuel_map = {
        'Gasoline': 'Gasoline',
        'Petrol': 'Gasoline',
        'Diesel': 'Diesel',
        'Hybrid': 'Hybrid',
        'Electric': 'EV',
        'Ev': 'EV',
        'Plug-In Hybrid': 'Plug-in Hybrid',
        'Plug In Hybrid': 'Plug-in Hybrid'
    }

    return fuel_map.get(fuel, fuel if fuel in VALID_FUEL_TYPES else None)


def process_chunk(chunk: pd.DataFrame, chunk_num: int) -> pd.DataFrame:
    """
    Process a chunk of data with cleaning and validation.

    Parameters:
    -----------
    chunk : pd.DataFrame
        Data chunk to process
    chunk_num : int
        Chunk number for logging

    Returns:
    --------
    cleaned_chunk : pd.DataFrame
        Cleaned and validated chunk
    """
    logger.info(f"Processing chunk {chunk_num} ({len(chunk)} rows)...")

    # Create a copy to avoid SettingWithCopyWarning
    df = chunk.copy()

    # Select price column (priority: price_usd > price > price_iqd)
    price_col = None
    for col in PRICE_COLUMNS:
        if col in df.columns:
            price_col = col
            break

    if price_col is None:
        logger.warning(f"Chunk {chunk_num}: No price column found, skipping")
        return pd.DataFrame()

    # Rename price column to standard 'price'
    if price_col != 'price':
        df['price'] = df[price_col]

    # Convert price_iqd to USD if needed (approximate conversion: 1 USD = 1300 IQD)
    if price_col == 'price_iqd' and 'price_iqd' in df.columns:
        df['price'] = df['price_iqd'] / 1300.0

    # Clean numeric columns
    for col in POSITIVE_NUMERIC_COLUMNS:
        if col in df.columns:
            if col == 'year':
                df[col] = df[col].apply(lambda x: validate_numeric(x, col, min_val=1900, max_val=2025))
            elif col == 'price':
                df[col] = df[col].apply(lambda x: validate_numeric(x, col, min_val=0, max_val=1000000))
            elif col == 'mileage':
                df[col] = df[col].apply(lambda x: validate_numeric(x, col, min_val=0, max_val=1000000))
            elif col == 'engine_size':
                df[col] = df[col].apply(lambda x: validate_numeric(x, col, min_val=0.5, max_val=10.0))
            elif col == 'cylinders':
                df[col] = df[col].apply(lambda x: validate_numeric(x, col, min_val=2, max_val=16))

    # Clean text columns
    text_columns = ['make', 'model', 'condition', 'fuel_type', 'location']
    for col in text_columns:
        if col in df.columns:
            df[col] = df[col].apply(clean_text)

    # Normalize condition and fuel_type
    if 'condition' in df.columns:
        df['condition'] = df['condition'].apply(normalize_condition)

    if 'fuel_type' in df.columns:
        df['fuel_type'] = df['fuel_type'].apply(normalize_fuel_type)

    # Extract image URLs
    logger.debug(f"Chunk {chunk_num}: Extracting image URLs...")
    df['image_urls'] = df.apply(extract_image_urls, axis=1)
    df['image_count'] = df['image_urls'].apply(len)
    df['primary_image_url'] = df['image_urls'].apply(lambda x: x[0] if x else None)

    # Remove rows with missing critical data
    critical_cols = ['make', 'model', 'year', 'price']
    before_count = len(df)
    df = df.dropna(subset=critical_cols)
    after_count = len(df)

    if before_count != after_count:
        logger.info(f"Chunk {chunk_num}: Removed {before_count - after_count} rows with missing critical data")

    # Remove rows with invalid prices
    df = df[df['price'] > 0]

    # Feature engineering
    current_year = datetime.now().year
    df['age_of_car'] = current_year - df['year']

    # Remove unrealistic ages
    df = df[(df['age_of_car'] >= 0) & (df['age_of_car'] <= 50)]

    logger.info(f"Chunk {chunk_num}: Processed {len(df)} valid rows")

    return df


# ============================================================================
# MAIN DATA PREPARATION FUNCTION
# ============================================================================

def load_and_merge_csvs(csv_files: List[Path], chunk_size: int = 10000) -> pd.DataFrame:
    """
    Load and merge multiple CSV files with chunked processing.

    Parameters:
    -----------
    csv_files : List[Path]
        List of CSV file paths to merge
    chunk_size : int
        Number of rows to process at a time

    Returns:
    --------
    merged_df : pd.DataFrame
        Merged and cleaned DataFrame
    """
    all_chunks = []
    total_files = len(csv_files)

    logger.info(f"Starting to load {total_files} CSV files...")

    for file_idx, csv_file in enumerate(csv_files, 1):
        if not csv_file.exists():
            logger.warning(f"File not found: {csv_file}, skipping...")
            continue

        logger.info(f"Loading file {file_idx}/{total_files}: {csv_file.name}")

        try:
            # Read in chunks to handle large files
            chunk_list = []
            chunk_num = 0

            for chunk in pd.read_csv(csv_file, chunksize=chunk_size, low_memory=False):
                chunk_num += 1
                processed_chunk = process_chunk(chunk, chunk_num)

                if len(processed_chunk) > 0:
                    chunk_list.append(processed_chunk)

            if chunk_list:
                file_df = pd.concat(chunk_list, ignore_index=True)
                logger.info(f"Loaded {len(file_df)} rows from {csv_file.name}")
                all_chunks.append(file_df)
            else:
                logger.warning(f"No valid data found in {csv_file.name}")

        except Exception as e:
            logger.error(f"Error loading {csv_file.name}: {str(e)}", exc_info=True)
            continue

    if not all_chunks:
        raise ValueError("No valid data loaded from any CSV files!")

    logger.info("Merging all chunks...")
    merged_df = pd.concat(all_chunks, ignore_index=True)

    logger.info(f"Total merged rows: {len(merged_df)}")

    # Remove duplicates based on key columns
    before_dedup = len(merged_df)
    merged_df = merged_df.drop_duplicates(
        subset=['make', 'model', 'year', 'mileage', 'price'],
        keep='first'
    )
    after_dedup = len(merged_df)

    logger.info(f"Removed {before_dedup - after_dedup} duplicate rows")

    return merged_df


def create_final_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create final dataset with all required columns and features.

    Parameters:
    -----------
    df : pd.DataFrame
        Cleaned DataFrame

    Returns:
    --------
    final_df : pd.DataFrame
        Final dataset ready for training
    """
    logger.info("Creating final dataset...")

    # Select and order columns
    output_columns = [
        'make', 'model', 'trim', 'year', 'price', 'mileage',
        'engine_size', 'cylinders', 'condition', 'fuel_type',
        'location', 'age_of_car', 'image_urls', 'image_count',
        'primary_image_url', 'description'
    ]

    # Only include columns that exist
    available_columns = [col for col in output_columns if col in df.columns]
    final_df = df[available_columns].copy()

    # Fill missing values intelligently
    if 'trim' in final_df.columns:
        final_df['trim'] = final_df['trim'].fillna('Unknown')

    if 'description' in final_df.columns:
        final_df['description'] = final_df['description'].fillna('')

    # Ensure image_urls is a list (not string)
    if 'image_urls' in final_df.columns:
        final_df['image_urls'] = final_df['image_urls'].apply(
            lambda x: x if isinstance(x, list) else []
        )

    # Final validation
    logger.info("Performing final validation...")

    # Remove rows with missing critical features
    critical_features = ['make', 'model', 'year', 'price']
    before_validation = len(final_df)
    final_df = final_df.dropna(subset=critical_features)
    after_validation = len(final_df)

    if before_validation != after_validation:
        logger.info(f"Removed {before_validation - after_validation} rows during final validation")

    # Statistics
    logger.info(f"\nFinal Dataset Statistics:")
    logger.info(f"  Total rows: {len(final_df):,}")
    logger.info(f"  Total columns: {len(final_df.columns)}")
    logger.info(f"  Rows with images: {(final_df['image_count'] > 0).sum():,}")
    logger.info(f"  Average images per car: {final_df['image_count'].mean():.2f}")
    logger.info(f"  Price range: ${final_df['price'].min():,.0f} - ${final_df['price'].max():,.0f}")
    logger.info(f"  Year range: {final_df['year'].min():.0f} - {final_df['year'].max():.0f}")
    logger.info(f"  Unique makes: {final_df['make'].nunique()}")
    logger.info(f"  Unique models: {final_df['model'].nunique()}")

    return final_df


def save_dataset(df: pd.DataFrame, output_file: Path) -> None:
    """
    Save final dataset to CSV file.

    Parameters:
    -----------
    df : pd.DataFrame
        Dataset to save
    output_file : Path
        Output file path
    """
    logger.info(f"Saving dataset to {output_file}...")

    # Ensure output directory exists
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Convert image_urls list to string for CSV compatibility
    df_save = df.copy()
    if 'image_urls' in df_save.columns:
        df_save['image_urls'] = df_save['image_urls'].apply(
            lambda x: '|'.join(x) if isinstance(x, list) and x else ''
        )

    # Save to CSV
    df_save.to_csv(output_file, index=False, encoding='utf-8')

    logger.info(f"Dataset saved successfully! ({len(df):,} rows)")

    # Save metadata
    metadata = {
        'created_at': datetime.now().isoformat(),
        'total_rows': len(df),
        'total_columns': len(df.columns),
        'columns': list(df.columns),
        'rows_with_images': int((df['image_count'] > 0).sum()),
        'avg_images_per_car': float(df['image_count'].mean()),
        'price_stats': {
            'min': float(df['price'].min()),
            'max': float(df['price'].max()),
            'mean': float(df['price'].mean()),
            'median': float(df['price'].median())
        },
        'year_range': {
            'min': int(df['year'].min()),
            'max': int(df['year'].max())
        },
        'unique_makes': int(df['make'].nunique()),
        'unique_models': int(df['model'].nunique())
    }

    metadata_file = output_file.parent / f"{output_file.stem}_metadata.json"
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Metadata saved to {metadata_file}")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main execution function."""
    logger.info("=" * 80)
    logger.info("MULTI-MODAL DATASET PREPARATION")
    logger.info("=" * 80)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        # Load and merge CSV files
        merged_df = load_and_merge_csvs(CSV_FILES)

        # Create final dataset
        final_df = create_final_dataset(merged_df)

        # Save dataset
        save_dataset(final_df, OUTPUT_FILE)

        logger.info("=" * 80)
        logger.info("DATASET PREPARATION COMPLETE!")
        logger.info("=" * 80)
        logger.info(f"Output file: {OUTPUT_FILE}")
        logger.info(f"Total rows: {len(final_df):,}")
        logger.info(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        return final_df

    except Exception as e:
        logger.error(f"Fatal error during dataset preparation: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    main()
