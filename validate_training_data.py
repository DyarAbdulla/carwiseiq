"""
Validate Training Data - Check if prices in dataset are realistic
This script analyzes the training dataset to identify potential price issues
"""

import pandas as pd
import numpy as np
from pathlib import Path
import sys

# Add paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

def validate_dataset_prices(csv_path: Path):
    """Validate prices in the dataset"""
    print("=" * 80)
    print("TRAINING DATA VALIDATION")
    print("=" * 80)
    print(f"Loading dataset: {csv_path}")
    
    if not csv_path.exists():
        print(f"ERROR: Dataset file not found: {csv_path}")
        return None
    
    df = pd.read_csv(csv_path)
    print(f"Dataset loaded: {len(df):,} rows, {len(df.columns)} columns")
    
    # Find price column
    price_col = None
    for col in ['price', 'Price', 'PRICE', 'predicted_price', 'target']:
        if col in df.columns:
            price_col = col
            break
    
    if not price_col:
        print("ERROR: No price column found!")
        return None
    
    print(f"\nPrice column found: '{price_col}'")
    
    # Price statistics
    prices = df[price_col].dropna()
    print("\n" + "=" * 80)
    print("PRICE STATISTICS")
    print("=" * 80)
    print(f"Total records with prices: {len(prices):,}")
    print(f"Mean price: ${prices.mean():,.2f}")
    print(f"Median price: ${prices.median():,.2f}")
    print(f"Standard deviation: ${prices.std():,.2f}")
    print(f"Minimum price: ${prices.min():,.2f}")
    print(f"Maximum price: ${prices.max():,.2f}")
    print(f"25th percentile: ${prices.quantile(0.25):,.2f}")
    print(f"75th percentile: ${prices.quantile(0.75):,.2f}")
    print(f"95th percentile: ${prices.quantile(0.95):,.2f}")
    print(f"99th percentile: ${prices.quantile(0.99):,.2f}")
    
    # Check for unrealistic prices
    print("\n" + "=" * 80)
    print("PRICE VALIDATION CHECKS")
    print("=" * 80)
    
    issues = []
    
    # Check for very low prices (< $100)
    very_low = prices[prices < 100]
    if len(very_low) > 0:
        issues.append(f"⚠️ {len(very_low)} records with prices < $100 (min: ${very_low.min():,.2f})")
        print(f"⚠️ {len(very_low)} records with prices < $100")
    
    # Check for very high prices (> $200,000)
    very_high = prices[prices > 200000]
    if len(very_high) > 0:
        issues.append(f"⚠️ {len(very_high)} records with prices > $200,000 (max: ${very_high.max():,.2f})")
        print(f"⚠️ {len(very_high)} records with prices > $200,000")
    
    # Check for zero prices
    zero_prices = prices[prices == 0]
    if len(zero_prices) > 0:
        issues.append(f"⚠️ {len(zero_prices)} records with price = $0")
        print(f"⚠️ {len(zero_prices)} records with price = $0")
    
    # Check for negative prices
    negative_prices = prices[prices < 0]
    if len(negative_prices) > 0:
        issues.append(f"⚠️ {len(negative_prices)} records with negative prices")
        print(f"⚠️ {len(negative_prices)} records with negative prices")
    
    # Check specific car (Chery Tiggo 7 Pro 2024)
    print("\n" + "=" * 80)
    print("CHERY TIGGO 7 PRO 2024 ANALYSIS")
    print("=" * 80)
    
    if 'make' in df.columns and 'model' in df.columns and 'year' in df.columns:
        chery_tiggo = df[
            (df['make'].str.lower().str.contains('chery', na=False)) &
            (df['model'].str.lower().str.contains('tiggo', na=False)) &
            (df['year'] == 2024)
        ]
        
        if len(chery_tiggo) > 0:
            chery_prices = chery_tiggo[price_col].dropna()
            print(f"Found {len(chery_tiggo)} Chery Tiggo 7 Pro 2024 records")
            print(f"Price range: ${chery_prices.min():,.2f} - ${chery_prices.max():,.2f}")
            print(f"Mean price: ${chery_prices.mean():,.2f}")
            print(f"Median price: ${chery_prices.median():,.2f}")
            
            if chery_prices.mean() > 50000:
                issues.append(f"⚠️ Chery Tiggo 7 Pro 2024 average price (${chery_prices.mean():,.2f}) seems too high!")
                print(f"⚠️ WARNING: Average price seems inflated!")
        else:
            print("No Chery Tiggo 7 Pro 2024 records found")
            print("Checking similar cars...")
            chery_2024 = df[
                (df['make'].str.lower().str.contains('chery', na=False)) &
                (df['year'] == 2024)
            ]
            if len(chery_2024) > 0:
                chery_prices = chery_2024[price_col].dropna()
                print(f"Found {len(chery_2024)} Chery 2024 records")
                print(f"Price range: ${chery_prices.min():,.2f} - ${chery_prices.max():,.2f}")
                print(f"Mean price: ${chery_prices.mean():,.2f}")
    
    # Summary
    print("\n" + "=" * 80)
    print("VALIDATION SUMMARY")
    print("=" * 80)
    
    if len(issues) == 0:
        print("✅ No major issues found in price data")
    else:
        print(f"⚠️ Found {len(issues)} potential issues:")
        for issue in issues:
            print(f"   {issue}")
    
    # Recommendations
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)
    
    if prices.mean() > 50000:
        print("⚠️ Average price seems high - check for currency conversion issues")
    if prices.median() < 5000:
        print("⚠️ Median price seems low - check for data quality issues")
    
    print("\nNext steps:")
    print("1. Review the price statistics above")
    print("2. Check if prices are in correct currency (USD)")
    print("3. Verify no data entry errors (e.g., missing decimal points)")
    print("4. If issues found, clean the data before retraining")
    print("5. Run retraining script: python core/model_training.py")
    
    return df

if __name__ == "__main__":
    # Try multiple dataset locations
    dataset_paths = [
        DATA_DIR / "final_dataset_with_images.csv",
        DATA_DIR / "cleaned_car_data.csv",
        BASE_DIR / "cleaned_car_data.csv",
        BASE_DIR / "data" / "cleaned_car_data.csv",
    ]
    
    df = None
    for path in dataset_paths:
        if path.exists():
            print(f"\nFound dataset at: {path}")
            df = validate_dataset_prices(path)
            break
    
    if df is None:
        print("\nERROR: Could not find dataset file!")
        print("Please ensure one of these files exists:")
        for path in dataset_paths:
            print(f"  - {path}")
