"""
Car Price Dataset Cleaning Script
Dataset: 62,576 rows with car listing information
Author: Data Cleaning Pipeline
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings('ignore')

# ============================================================================
# STEP 1: Load Dataset from CSV or Excel
# ============================================================================
print("=" * 80)
print("STEP 1: Loading dataset...")
print("=" * 80)

# Try to load from CSV first, then Excel
import os
import sys
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

# Setup paths
raw_data_path = os.path.join(BASE_DIR, 'data', 'iqcars60000data.xlsx')
cleaned_data_path = os.path.join(BASE_DIR, 'data', 'cleaned_car_data.csv')
car_data_csv = os.path.join(BASE_DIR, 'data', 'car_data.csv')

if os.path.exists(car_data_csv):
    df = pd.read_csv(car_data_csv)
    print(f"Loaded from CSV: {car_data_csv}")
elif os.path.exists(raw_data_path):
    df = pd.read_excel(raw_data_path)
    print(f"Loaded from Excel: {raw_data_path}")
elif os.path.exists('iqcars60000data.xlsx'):
    df = pd.read_excel('iqcars60000data.xlsx')
    print("Loaded from Excel: iqcars60000data.xlsx (current directory)")
else:
    print(f"ERROR: Data file not found. Please ensure data file exists at: {raw_data_path}")
    exit(1)

print(f"Dataset loaded: {df.shape[0]} rows, {df.shape[1]} columns")
print(f"Columns: {list(df.columns)}")

# Store original shape for reporting
original_shape = df.shape
original_missing = df.isnull().sum()

# ============================================================================
# STEP 2: Fix Data Types (year, price, mileage as numeric) - DO THIS FIRST
# ============================================================================
print("\n" + "=" * 80)
print("STEP 2: Fixing data types...")
print("=" * 80)

# Convert year to integer
if 'year' in df.columns:
    # Remove any non-numeric characters and convert
    df['year'] = pd.to_numeric(df['year'], errors='coerce')
    print(f"  Converted 'year' to numeric (NaN values will be handled later)")

# Convert price to numeric
if 'price' in df.columns:
    # Remove currency symbols, commas, and convert to numeric
    if df['price'].dtype == 'object':
        df['price'] = df['price'].astype(str).str.replace('$', '').str.replace(',', '').str.replace('€', '').str.replace('£', '')
    df['price'] = pd.to_numeric(df['price'], errors='coerce')
    print(f"  Converted 'price' to numeric (NaN values will be handled later)")

# Convert mileage to numeric
if 'mileage' in df.columns:
    # Remove any non-numeric characters
    if df['mileage'].dtype == 'object':
        df['mileage'] = df['mileage'].astype(str).str.replace(',', '').str.replace('km', '').str.replace('mi', '').str.replace('miles', '')
    df['mileage'] = pd.to_numeric(df['mileage'], errors='coerce')
    print(f"  Converted 'mileage' to numeric (NaN values will be handled later)")

# Convert engine_size to numeric if it exists
if 'engine_size' in df.columns:
    if df['engine_size'].dtype == 'object':
        # Remove 'L', 'l', 'T' (turbo), and other non-numeric characters
        df['engine_size'] = df['engine_size'].astype(str).str.replace('L', '').str.replace('l', '').str.replace('T', '').str.replace('t', '')
    df['engine_size'] = pd.to_numeric(df['engine_size'], errors='coerce')
    print(f"  Converted 'engine_size' to numeric (NaN values will be handled later)")

# Convert cylinders to numeric if it exists
if 'cylinders' in df.columns:
    df['cylinders'] = pd.to_numeric(df['cylinders'], errors='coerce')
    print(f"  Converted 'cylinders' to numeric (NaN values will be handled later)")

# ============================================================================
# STEP 3: Handle Missing Values Intelligently
# ============================================================================
print("\n" + "=" * 80)
print("STEP 3: Handling missing values...")
print("=" * 80)

# Identify numeric and categorical columns
numeric_cols = ['year', 'price', 'mileage', 'engine_size', 'cylinders']
categorical_cols = ['make', 'model', 'trim', 'condition', 'fuel_type', 'location', 'mileage_unit']

# Fill numeric columns with median (now that they're converted to numeric)
for col in numeric_cols:
    if col in df.columns:
        # Replace infinite values first
        inf_count = np.isinf(df[col]).sum()
        if inf_count > 0:
            df[col] = df[col].replace([np.inf, -np.inf], np.nan)
        
        missing_count = df[col].isnull().sum()
        
        if missing_count > 0 or inf_count > 0:
            # Calculate median, handle case where all values might be NaN
            median_value = df[col].median()
            
            # If median is NaN or inf, use a default value
            if pd.isna(median_value) or np.isinf(median_value):
                if col == 'year':
                    median_value = 2020  # Default year
                elif col == 'cylinders':
                    median_value = 4  # Default cylinders
                elif col == 'price':
                    median_value = 0  # Default price
                elif col == 'mileage':
                    median_value = 0  # Default mileage
                elif col == 'engine_size':
                    median_value = 2.0  # Default engine size
                else:
                    median_value = 0
            
            # Fill missing and infinite values
            df[col].fillna(median_value, inplace=True)
            
            # Convert to int for year and cylinders after ensuring all values are finite
            if col == 'year' or col == 'cylinders':
                # Ensure all values are finite and numeric before converting
                df[col] = pd.to_numeric(df[col], errors='coerce')
                df[col] = df[col].fillna(median_value)
                # Round to nearest integer before converting
                df[col] = df[col].round().astype(int)
                total_fixed = missing_count + inf_count
                print(f"  Filled {total_fixed} missing/infinite values in '{col}' with median: {int(median_value)}")
            else:
                print(f"  Filled {missing_count + inf_count} missing/infinite values in '{col}' with median: {median_value:.2f}")
        
        # Ensure year and cylinders are integers even if no missing values
        if col == 'year' or col == 'cylinders':
            if df[col].dtype not in ['int64', 'int32', 'int']:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                df[col] = df[col].fillna(df[col].median() if not pd.isna(df[col].median()) else (2020 if col == 'year' else 4))
                df[col] = df[col].round().astype(int)

# Fill categorical columns with mode
for col in categorical_cols:
    if col in df.columns:
        missing_count = df[col].isnull().sum()
        if missing_count > 0:
            mode_value = df[col].mode()[0] if not df[col].mode().empty else 'Unknown'
            df[col].fillna(mode_value, inplace=True)
            print(f"  Filled {missing_count} missing values in '{col}' with mode: {mode_value}")

# Handle other columns (text columns like title, scraped_date)
if 'title' in df.columns:
    df['title'].fillna('Unknown', inplace=True)
if 'scraped_date' in df.columns:
    df['scraped_date'].fillna(df['scraped_date'].mode()[0] if not df['scraped_date'].mode().empty else 'Unknown', inplace=True)

print(f"Missing values after filling: {df.isnull().sum().sum()}")

# ============================================================================
# STEP 4: Remove Duplicates
# ============================================================================
print("\n" + "=" * 80)
print("STEP 4: Removing duplicates...")
print("=" * 80)

duplicates_before = df.duplicated().sum()
print(f"Duplicates found: {duplicates_before}")

# Remove duplicate rows
df = df.drop_duplicates()
print(f"Rows after removing duplicates: {df.shape[0]} (removed {duplicates_before} duplicates)")

# ============================================================================
# STEP 5: Standardize Mileage to km
# ============================================================================
print("\n" + "=" * 80)
print("STEP 5: Standardizing mileage to km...")
print("=" * 80)

if 'mileage' in df.columns and 'mileage_unit' in df.columns:
    # Convert miles to km (1 mile = 1.60934 km)
    miles_mask = df['mileage_unit'].str.lower().isin(['mi', 'miles', 'mile', 'm'])
    df.loc[miles_mask, 'mileage'] = df.loc[miles_mask, 'mileage'] * 1.60934
    print(f"  Converted {miles_mask.sum()} records from miles to km")
    
    # Update mileage_unit to 'km' for all records
    df['mileage_unit'] = 'km'
    print(f"  Standardized all mileage units to 'km'")
elif 'mileage' in df.columns:
    # If no mileage_unit column, assume all are in km (or handle based on typical values)
    print("  No mileage_unit column found. Assuming all values are in km.")

# ============================================================================
# STEP 6: Clean Text Columns (make, model, trim)
# ============================================================================
print("\n" + "=" * 80)
print("STEP 6: Cleaning text columns...")
print("=" * 80)

# Clean make column
if 'make' in df.columns:
    df['make'] = df['make'].astype(str).str.strip()
    df['make'] = df['make'].str.replace(r'\s+', ' ', regex=True)  # Remove extra spaces
    df['make'] = df['make'].str.title()  # Title case (e.g., "Toyota", "Ford")
    print(f"  Cleaned 'make' column")

# Clean model column
if 'model' in df.columns:
    df['model'] = df['model'].astype(str).str.strip()
    df['model'] = df['model'].str.replace(r'\s+', ' ', regex=True)  # Remove extra spaces
    df['model'] = df['model'].str.title()  # Title case
    print(f"  Cleaned 'model' column")

# Clean trim column
if 'trim' in df.columns:
    df['trim'] = df['trim'].astype(str).str.strip()
    df['trim'] = df['trim'].str.replace(r'\s+', ' ', regex=True)  # Remove extra spaces
    df['trim'] = df['trim'].str.title()  # Title case
    print(f"  Cleaned 'trim' column")

# Clean title column if it exists
if 'title' in df.columns:
    df['title'] = df['title'].astype(str).str.strip()
    df['title'] = df['title'].str.replace(r'\s+', ' ', regex=True)
    print(f"  Cleaned 'title' column")

# ============================================================================
# STEP 7: Detect and Handle Outliers in price, mileage, year
# ============================================================================
print("\n" + "=" * 80)
print("STEP 7: Detecting and handling outliers...")
print("=" * 80)

def detect_outliers_iqr(series):
    """Detect outliers using IQR method"""
    Q1 = series.quantile(0.25)
    Q3 = series.quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    return (series < lower_bound) | (series > upper_bound)

# Handle price outliers
if 'price' in df.columns:
    outliers_price = detect_outliers_iqr(df['price'])
    outliers_count = outliers_price.sum()
    print(f"  Price outliers detected: {outliers_count} ({outliers_count/len(df)*100:.2f}%)")
    
    # Cap outliers at 1st and 99th percentile instead of removing
    price_lower = df['price'].quantile(0.01)
    price_upper = df['price'].quantile(0.99)
    df.loc[df['price'] < price_lower, 'price'] = price_lower
    df.loc[df['price'] > price_upper, 'price'] = price_upper
    print(f"  Capped price outliers to range: [{price_lower:.2f}, {price_upper:.2f}]")

# Handle mileage outliers
if 'mileage' in df.columns:
    outliers_mileage = detect_outliers_iqr(df['mileage'])
    outliers_count = outliers_mileage.sum()
    print(f"  Mileage outliers detected: {outliers_count} ({outliers_count/len(df)*100:.2f}%)")
    
    # Cap outliers at 1st and 99th percentile
    mileage_lower = df['mileage'].quantile(0.01)
    mileage_upper = df['mileage'].quantile(0.99)
    df.loc[df['mileage'] < mileage_lower, 'mileage'] = mileage_lower
    df.loc[df['mileage'] > mileage_upper, 'mileage'] = mileage_upper
    print(f"  Capped mileage outliers to range: [{mileage_lower:.2f}, {mileage_upper:.2f}]")

# Handle year outliers (remove unrealistic years)
if 'year' in df.columns:
    current_year = 2025
    # Remove years before 1900 or after current year
    invalid_years = (df['year'] < 1900) | (df['year'] > current_year)
    invalid_count = invalid_years.sum()
    if invalid_count > 0:
        # Replace with median year instead of removing
        median_year = df['year'].median()
        df.loc[invalid_years, 'year'] = int(median_year)
        print(f"  Fixed {invalid_count} invalid years (replaced with median: {int(median_year)})")
    else:
        print(f"  No invalid years detected")

# ============================================================================
# STEP 8: Encode Categorical Variables (condition, fuel_type, location)
# ============================================================================
print("\n" + "=" * 80)
print("STEP 8: Encoding categorical variables...")
print("=" * 80)

# Create LabelEncoders for each categorical variable
label_encoders = {}

# Encode condition
if 'condition' in df.columns:
    le_condition = LabelEncoder()
    df['condition_encoded'] = le_condition.fit_transform(df['condition'])
    label_encoders['condition'] = le_condition
    print(f"  Encoded 'condition': {len(le_condition.classes_)} unique values")
    print(f"    Classes: {list(le_condition.classes_)}")

# Encode fuel_type
if 'fuel_type' in df.columns:
    le_fuel = LabelEncoder()
    df['fuel_type_encoded'] = le_fuel.fit_transform(df['fuel_type'])
    label_encoders['fuel_type'] = le_fuel
    print(f"  Encoded 'fuel_type': {len(le_fuel.classes_)} unique values")
    print(f"    Classes: {list(le_fuel.classes_)}")

# Encode location
if 'location' in df.columns:
    le_location = LabelEncoder()
    df['location_encoded'] = le_location.fit_transform(df['location'])
    label_encoders['location'] = le_location
    print(f"  Encoded 'location': {len(le_location.classes_)} unique values")

# Keep original columns for reference, encoded columns are added

# ============================================================================
# STEP 9: Feature Engineering - Create age_of_car
# ============================================================================
print("\n" + "=" * 80)
print("STEP 9: Feature engineering...")
print("=" * 80)

if 'year' in df.columns:
    current_year = 2025
    df['age_of_car'] = current_year - df['year']
    print(f"  Created 'age_of_car' feature (2025 - year)")
    print(f"    Age range: {df['age_of_car'].min()} to {df['age_of_car'].max()} years")
    print(f"    Mean age: {df['age_of_car'].mean():.2f} years")

# ============================================================================
# STEP 10: Save Cleaned Data
# ============================================================================
print("\n" + "=" * 80)
print("STEP 10: Saving cleaned data...")
print("=" * 80)

df.to_csv(cleaned_data_path, index=False)
print(f"  Cleaned data saved to '{cleaned_data_path}'")
print(f"  Final dataset shape: {df.shape[0]} rows, {df.shape[1]} columns")

# ============================================================================
# STEP 11: Generate Data Quality Report
# ============================================================================
print("\n" + "=" * 80)
print("STEP 11: Generating data quality report...")
print("=" * 80)

# Create a comprehensive report
report = []

report.append("=" * 80)
report.append("DATA QUALITY REPORT")
report.append("=" * 80)
report.append("")

# Dataset Overview
report.append("DATASET OVERVIEW")
report.append("-" * 80)
report.append(f"Original shape: {original_shape[0]} rows × {original_shape[1]} columns")
report.append(f"Final shape: {df.shape[0]} rows × {df.shape[1]} columns")
report.append(f"Rows removed: {original_shape[0] - df.shape[0]}")
report.append(f"Columns added: {df.shape[1] - original_shape[1]}")
report.append("")

# Missing Values
report.append("MISSING VALUES")
report.append("-" * 80)
report.append("Before cleaning:")
for col in original_missing.index:
    if original_missing[col] > 0:
        report.append(f"  {col}: {original_missing[col]} ({original_missing[col]/original_shape[0]*100:.2f}%)")

report.append("")
report.append("After cleaning:")
missing_after = df.isnull().sum()
if missing_after.sum() == 0:
    report.append("  No missing values remaining!")
else:
    for col in missing_after.index:
        if missing_after[col] > 0:
            report.append(f"  {col}: {missing_after[col]} ({missing_after[col]/len(df)*100:.2f}%)")
report.append("")

# Data Types
report.append("DATA TYPES")
report.append("-" * 80)
for col in df.columns:
    report.append(f"  {col}: {df[col].dtype}")
report.append("")

# Numeric Columns Statistics
report.append("NUMERIC COLUMNS STATISTICS")
report.append("-" * 80)
numeric_cols_final = df.select_dtypes(include=[np.number]).columns
for col in numeric_cols_final:
    if col not in ['condition_encoded', 'fuel_type_encoded', 'location_encoded']:
        report.append(f"\n{col}:")
        report.append(f"  Mean: {df[col].mean():.2f}")
        report.append(f"  Median: {df[col].median():.2f}")
        report.append(f"  Std Dev: {df[col].std():.2f}")
        report.append(f"  Min: {df[col].min():.2f}")
        report.append(f"  Max: {df[col].max():.2f}")
report.append("")

# Categorical Columns Statistics
report.append("CATEGORICAL COLUMNS STATISTICS")
report.append("-" * 80)
categorical_cols_final = ['condition', 'fuel_type', 'location', 'make', 'model']
for col in categorical_cols_final:
    if col in df.columns:
        unique_count = df[col].nunique()
        report.append(f"\n{col}:")
        report.append(f"  Unique values: {unique_count}")
        top_values = df[col].value_counts().head(5)
        report.append(f"  Top 5 values:")
        for val, count in top_values.items():
            report.append(f"    {val}: {count} ({count/len(df)*100:.2f}%)")
report.append("")

# Summary
report.append("CLEANING SUMMARY")
report.append("-" * 80)
report.append("[OK] Missing values handled")
report.append("[OK] Duplicates removed")
report.append("[OK] Data types fixed")
report.append("[OK] Mileage standardized to km")
report.append("[OK] Text columns cleaned")
report.append("[OK] Outliers handled")
report.append("[OK] Categorical variables encoded")
report.append("[OK] Feature engineering completed")
report.append("")
report.append("=" * 80)

# Print and save report
report_text = "\n".join(report)
print(report_text)

# Save report to file
with open('data_quality_report.txt', 'w', encoding='utf-8') as f:
    f.write(report_text)

print(f"\nData quality report saved to 'data_quality_report.txt'")
print("\n" + "=" * 80)
print("DATA CLEANING COMPLETE!")
print("=" * 80)

