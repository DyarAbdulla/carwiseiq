"""
IQCars Data Pipeline
Merges and cleans IQCars datasets for model training
"""

import pandas as pd
import numpy as np
import re
from pathlib import Path
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')


def load_and_merge_iqcars(input_paths):
    """
    Load and merge multiple IQCars CSV files
    
    Parameters:
    -----------
    input_paths : list of str or Path
        List of paths to IQCars CSV files
        
    Returns:
    --------
    df : pd.DataFrame
        Merged dataframe
    """
    dfs = []
    for path in input_paths:
        path = Path(path)
        if not path.exists():
            print(f"Warning: {path} not found, skipping")
            continue
        print(f"Loading {path}...")
        try:
            df = pd.read_csv(path, low_memory=False)
            print(f"  Loaded {len(df)} rows, {len(df.columns)} columns")
            dfs.append(df)
        except Exception as e:
            print(f"  Error loading {path}: {e}")
            continue
    
    if not dfs:
        raise ValueError("No valid datasets loaded!")
    
    # Merge all dataframes
    merged = pd.concat(dfs, ignore_index=True)
    print(f"\nMerged dataset: {len(merged)} rows, {len(merged.columns)} columns")
    
    # Remove duplicates based on listing_id if it exists
    if 'listing_id' in merged.columns:
        before_dedup = len(merged)
        merged = merged.drop_duplicates(subset=['listing_id'], keep='first')
        print(f"Removed {before_dedup - len(merged)} duplicate listings")
    
    return merged


def clean_schema(df):
    """
    Normalize column names and ensure required columns exist
    
    Parameters:
    -----------
    df : pd.DataFrame
        Raw dataframe
        
    Returns:
    --------
    df : pd.DataFrame
        Dataframe with normalized schema
    """
    # Normalize column names (lowercase, strip spaces)
    df.columns = df.columns.str.lower().str.strip()
    
    # Required columns
    required = ['make', 'model', 'year', 'mileage']
    
    # Check for price columns (prefer price_usd)
    if 'price_usd' in df.columns:
        df['price'] = df['price_usd']
    elif 'price' not in df.columns:
        raise ValueError("No price column found! Need 'price_usd' or 'price'")
    
    # Check missing required columns
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")
    
    # Drop unwanted columns
    columns_to_drop = ['listing_id', 'price_iqd', 'phone_number', 'showroom', 'description']
    columns_to_drop = [col for col in columns_to_drop if col in df.columns]
    if columns_to_drop:
        df = df.drop(columns=columns_to_drop)
        print(f"Dropped columns: {columns_to_drop}")
    
    return df


def parse_numbers(df):
    """
    Parse numeric columns robustly:
    - year: int (1990 to current_year+1)
    - mileage: strip "km", commas; convert to int
    - price: parse from price_usd or price column
    
    Parameters:
    -----------
    df : pd.DataFrame
        Dataframe with raw numeric columns
        
    Returns:
    --------
    df : pd.DataFrame
        Dataframe with parsed numeric columns
    """
    current_year = datetime.now().year
    
    # Parse year
    if 'year' in df.columns:
        df['year'] = pd.to_numeric(df['year'], errors='coerce')
        # Remove invalid years
        invalid_years = (df['year'] < 1990) | (df['year'] > current_year + 1)
        if invalid_years.sum() > 0:
            print(f"Removing {invalid_years.sum()} rows with invalid years")
            df = df[~invalid_years]
    
    # Parse mileage
    if 'mileage' in df.columns:
        def parse_mileage(val):
            if pd.isna(val):
                return np.nan
            # Convert to string and strip
            val_str = str(val).strip()
            # Remove "km", commas, spaces
            val_str = re.sub(r'[km,\s]', '', val_str, flags=re.IGNORECASE)
            try:
                return int(float(val_str))
            except:
                return np.nan
        
        df['mileage'] = df['mileage'].apply(parse_mileage)
        # Remove negative mileage
        if df['mileage'].notna().any():
            invalid_mileage = df['mileage'] < 0
            if invalid_mileage.sum() > 0:
                print(f"Removing {invalid_mileage.sum()} rows with negative mileage")
                df = df[~invalid_mileage]
    
    # Parse price
    def parse_price(val):
        if pd.isna(val):
            return np.nan
        val_str = str(val).strip()
        # Remove $, commas, spaces, "USD"
        val_str = re.sub(r'[\$,\s]', '', val_str, flags=re.IGNORECASE)
        val_str = re.sub(r'usd', '', val_str, flags=re.IGNORECASE)
        try:
            price = float(val_str)
            # If price looks like IQD (millions), skip it (we use price_usd)
            if price > 1000000:
                return np.nan
            return price
        except:
            return np.nan
    
    if 'price' in df.columns:
        df['price'] = df['price'].apply(parse_price)
    
    # Parse engine_size: extract float from "3.0L", "2.5 l", "1800cc" (convert cc to liters)
    if 'engine_size' in df.columns:
        def parse_engine_size(val):
            if pd.isna(val):
                return np.nan
            val_str = str(val).strip().upper()
            # Remove common units and spaces
            val_str = re.sub(r'[L\s]', '', val_str)
            # Check for cc (cubic centimeters)
            if 'CC' in val_str:
                val_str = re.sub(r'CC', '', val_str)
                try:
                    cc = float(re.search(r'[\d.]+', val_str).group())
                    return cc / 1000.0  # Convert cc to liters
                except:
                    return np.nan
            # Extract first number (handles "3.0", "2.5", etc.)
            match = re.search(r'[\d.]+', val_str)
            if match:
                try:
                    return float(match.group())
                except:
                    return np.nan
            return np.nan
        
        df['engine_size'] = df['engine_size'].apply(parse_engine_size)
        # Remove invalid engine sizes (< 0.5L or > 10L)
        if df['engine_size'].notna().any():
            invalid_engine = (df['engine_size'] < 0.5) | (df['engine_size'] > 10.0)
            if invalid_engine.sum() > 0:
                print(f"Removing {invalid_engine.sum()} rows with invalid engine_size")
                df = df[~invalid_engine]
    
    # Parse cylinders: extract integer from "V6", "6 cyl", "4", "I4", etc.
    if 'cylinders' in df.columns:
        def parse_cylinders(val):
            if pd.isna(val):
                return np.nan
            val_str = str(val).strip().upper()
            # Remove common words and spaces
            val_str = re.sub(r'[VICYL\s]', '', val_str)
            # Extract first integer
            match = re.search(r'\d+', val_str)
            if match:
                try:
                    cyl = int(match.group())
                    # Valid range: 2-12 cylinders
                    if 2 <= cyl <= 12:
                        return cyl
                except:
                    pass
            return np.nan
        
        df['cylinders'] = df['cylinders'].apply(parse_cylinders)
    
    # Ensure numeric columns are proper dtypes
    numeric_cols = ['year', 'mileage', 'price', 'engine_size', 'cylinders']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Remove rows with missing critical fields
    critical_fields = ['make', 'model', 'year', 'price', 'mileage']
    missing_mask = df[critical_fields].isna().any(axis=1)
    if missing_mask.sum() > 0:
        print(f"Removing {missing_mask.sum()} rows with missing critical fields")
        df = df[~missing_mask]
    
    return df


def remove_outliers(df):
    """
    Remove outliers:
    - price: 500 to 300000 USD
    - mileage: max 1,000,000 km
    - Optional: quantile-based trimming (1%-99%)
    
    Parameters:
    -----------
    df : pd.DataFrame
        Dataframe with parsed numbers
        
    Returns:
    --------
    df : pd.DataFrame
        Dataframe with outliers removed
    """
    initial_rows = len(df)
    
    # Price bounds
    if 'price' in df.columns:
        price_mask = (df['price'] >= 500) & (df['price'] <= 300000)
        removed = (~price_mask).sum()
        if removed > 0:
            print(f"Removing {removed} rows with price outside $500-$300,000")
            df = df[price_mask]
    
    # Mileage bounds
    if 'mileage' in df.columns:
        mileage_mask = df['mileage'] <= 1000000
        removed = (~mileage_mask).sum()
        if removed > 0:
            print(f"Removing {removed} rows with mileage > 1,000,000 km")
            df = df[mileage_mask]
    
    # Optional: quantile-based trimming per make
    if 'make' in df.columns and 'price' in df.columns:
        makes = df['make'].value_counts()
        # Only trim for makes with > 50 samples
        popular_makes = makes[makes > 50].index
        
        trimmed_count = 0
        for make in popular_makes:
            make_mask = df['make'] == make
            make_prices = df.loc[make_mask, 'price']
            if len(make_prices) > 100:  # Only trim if enough samples
                q1 = make_prices.quantile(0.01)
                q99 = make_prices.quantile(0.99)
                outliers = make_mask & ((df['price'] < q1) | (df['price'] > q99))
                trimmed_count += outliers.sum()
                df = df[~outliers]
        
        if trimmed_count > 0:
            print(f"Removed {trimmed_count} price outliers using quantile trimming (1%-99%)")
    
    final_rows = len(df)
    print(f"Outlier removal: {initial_rows} -> {final_rows} rows ({initial_rows - final_rows} removed)")
    
    return df


def feature_engineering(df):
    """
    Add engineered features:
    - age_of_car = current_year - year
    
    Parameters:
    -----------
    df : pd.DataFrame
        Cleaned dataframe
        
    Returns:
    --------
    df : pd.DataFrame
        Dataframe with engineered features
    """
    current_year = datetime.now().year
    
    if 'year' in df.columns:
        df['age_of_car'] = np.maximum(0, current_year - df['year'])
    
    return df


def process_iqcars_datasets(input_paths, output_dir='data'):
    """
    Complete pipeline: load, merge, clean, and save datasets
    
    Parameters:
    -----------
    input_paths : list of str or Path
        List of paths to IQCars CSV files
    output_dir : str or Path
        Output directory for cleaned datasets
        
    Returns:
    --------
    df_merged : pd.DataFrame
        Merged raw dataframe
    df_cleaned : pd.DataFrame
        Final cleaned dataframe
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 80)
    print("IQCARS DATA PIPELINE")
    print("=" * 80)
    
    # Step 1: Load and merge
    print("\n[1/5] Loading and merging datasets...")
    df_merged = load_and_merge_iqcars(input_paths)
    
    # Save merged raw
    merged_path = output_dir / 'iqcars_merged_raw.csv'
    df_merged.to_csv(merged_path, index=False)
    print(f"Saved merged raw dataset to {merged_path}")
    
    # Step 2: Clean schema
    print("\n[2/5] Cleaning schema...")
    df_cleaned = clean_schema(df_merged.copy())
    
    # Step 3: Parse numbers
    print("\n[3/5] Parsing numeric columns...")
    df_cleaned = parse_numbers(df_cleaned)
    
    # Step 4: Remove outliers
    print("\n[4/5] Removing outliers...")
    df_cleaned = remove_outliers(df_cleaned)
    
    # Step 5: Feature engineering
    print("\n[5/5] Feature engineering...")
    df_cleaned = feature_engineering(df_cleaned)
    
    # Save cleaned dataset
    cleaned_path = output_dir / 'iqcars_cleaned.csv'
    df_cleaned.to_csv(cleaned_path, index=False)
    print(f"\nSaved cleaned dataset to {cleaned_path}")
    
    # Print summary
    print("\n" + "=" * 80)
    print("DATASET SUMMARY")
    print("=" * 80)
    print(f"Final rows: {len(df_cleaned)}")
    print(f"Final columns: {len(df_cleaned.columns)}")
    print(f"\nMissing values:")
    missing = df_cleaned.isnull().sum()
    print(missing[missing > 0])
    
    print(f"\nPrice range: ${df_cleaned['price'].min():,.0f} - ${df_cleaned['price'].max():,.0f}")
    print(f"Year range: {int(df_cleaned['year'].min())} - {int(df_cleaned['year'].max())}")
    print(f"Mileage range: {int(df_cleaned['mileage'].min()):,} - {int(df_cleaned['mileage'].max()):,} km")
    
    print(f"\nTop 10 makes:")
    print(df_cleaned['make'].value_counts().head(10))
    
    print(f"\nTop 10 models:")
    print(df_cleaned['model'].value_counts().head(10))
    
    print("=" * 80)
    
    return df_merged, df_cleaned


if __name__ == "__main__":
    # Default paths
    data_dir = Path(__file__).parent.parent.parent / 'data'
    input_paths = [
        data_dir / 'iqcars1.csv',
        data_dir / 'iqcars2.csv',
        data_dir / 'iqcars3.csv',
    ]
    
    df_merged, df_cleaned = process_iqcars_datasets(input_paths)
    print("\n✅ Pipeline complete!")
