"""
Apply data cleaning and transformations to the sample dataset
Same steps as applied to the original dataset
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import warnings
import sys
import io

# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
warnings.filterwarnings('ignore')

print("=" * 80)
print("CLEANING AND TRANSFORMING SAMPLE DATASET")
print("=" * 80)

# Load the sample dataset
input_file = 'sample_dataset_2000rows_18columns.xlsx'
print(f"\nLoading dataset: {input_file}")
df = pd.read_excel(input_file)

print(f"Original dataset: {df.shape[0]} rows, {df.shape[1]} columns")

# ============================================================================
# STEP 1: Fix Data Types
# ============================================================================
print("\n" + "=" * 80)
print("STEP 1: Fixing data types...")
print("=" * 80)

# Convert year to integer
if 'year' in df.columns:
    df['year'] = pd.to_numeric(df['year'], errors='coerce')
    print(f"  Converted 'year' to numeric")

# Convert price to numeric
if 'price' in df.columns:
    if df['price'].dtype == 'object':
        df['price'] = df['price'].astype(str).str.replace('$', '').str.replace(',', '').str.replace('€', '').str.replace('£', '')
    df['price'] = pd.to_numeric(df['price'], errors='coerce')
    print(f"  Converted 'price' to numeric")

# Convert mileage to numeric
if 'mileage' in df.columns:
    if df['mileage'].dtype == 'object':
        df['mileage'] = df['mileage'].astype(str).str.replace(',', '').str.replace('km', '').str.replace('mi', '').str.replace('miles', '')
    df['mileage'] = pd.to_numeric(df['mileage'], errors='coerce')
    print(f"  Converted 'mileage' to numeric")

# Convert engine_size to numeric
if 'engine_size' in df.columns:
    if df['engine_size'].dtype == 'object':
        df['engine_size'] = df['engine_size'].astype(str).str.replace('L', '').str.replace('l', '').str.replace('T', '').str.replace('t', '')
    df['engine_size'] = pd.to_numeric(df['engine_size'], errors='coerce')
    print(f"  Converted 'engine_size' to numeric")

# Convert cylinders to numeric
if 'cylinders' in df.columns:
    df['cylinders'] = pd.to_numeric(df['cylinders'], errors='coerce')
    print(f"  Converted 'cylinders' to numeric")

# ============================================================================
# STEP 2: Handle Missing Values
# ============================================================================
print("\n" + "=" * 80)
print("STEP 2: Handling missing values...")
print("=" * 80)

numeric_cols = ['year', 'price', 'mileage', 'engine_size', 'cylinders']
categorical_cols = ['make', 'model', 'trim', 'condition', 'fuel_type', 'location', 'mileage_unit']

# Fill numeric columns with median
for col in numeric_cols:
    if col in df.columns:
        # Replace infinite values
        inf_count = np.isinf(df[col]).sum()
        if inf_count > 0:
            df[col] = df[col].replace([np.inf, -np.inf], np.nan)
        
        missing_count = df[col].isnull().sum()
        
        if missing_count > 0 or inf_count > 0:
            median_value = df[col].median()
            
            if pd.isna(median_value) or np.isinf(median_value):
                if col == 'year':
                    median_value = 2020
                elif col == 'cylinders':
                    median_value = 4
                elif col == 'price':
                    median_value = 0
                elif col == 'mileage':
                    median_value = 0
                elif col == 'engine_size':
                    median_value = 2.0
                else:
                    median_value = 0
            
            df[col].fillna(median_value, inplace=True)
            
            # Convert to int for year and cylinders
            if col == 'year' or col == 'cylinders':
                df[col] = pd.to_numeric(df[col], errors='coerce')
                df[col] = df[col].fillna(median_value)
                df[col] = df[col].round().astype(int)
                print(f"  Filled {missing_count + inf_count} missing/infinite values in '{col}' with median: {int(median_value)}")
            else:
                print(f"  Filled {missing_count + inf_count} missing/infinite values in '{col}' with median: {median_value:.2f}")
        
        # Ensure year and cylinders are integers
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

# Handle other columns
if 'title' in df.columns:
    df['title'].fillna('Unknown', inplace=True)
if 'scraped_date' in df.columns:
    df['scraped_date'].fillna(df['scraped_date'].mode()[0] if not df['scraped_date'].mode().empty else 'Unknown', inplace=True)

print(f"Missing values after filling: {df.isnull().sum().sum()}")

# ============================================================================
# STEP 3: Remove Duplicates
# ============================================================================
print("\n" + "=" * 80)
print("STEP 3: Removing duplicates...")
print("=" * 80)

duplicates_before = df.duplicated().sum()
print(f"Duplicates found: {duplicates_before}")

df = df.drop_duplicates()
print(f"Rows after removing duplicates: {df.shape[0]} (removed {duplicates_before} duplicates)")

# ============================================================================
# STEP 4: Standardize Mileage to km
# ============================================================================
print("\n" + "=" * 80)
print("STEP 4: Standardizing mileage to km...")
print("=" * 80)

if 'mileage' in df.columns and 'mileage_unit' in df.columns:
    miles_mask = df['mileage_unit'].astype(str).str.lower().isin(['mi', 'miles', 'mile', 'm'])
    df.loc[miles_mask, 'mileage'] = df.loc[miles_mask, 'mileage'] * 1.60934
    print(f"  Converted {miles_mask.sum()} records from miles to km")
    df['mileage_unit'] = 'km'
    print(f"  Standardized all mileage units to 'km'")
elif 'mileage' in df.columns:
    print("  No mileage_unit column found. Assuming all values are in km.")

# ============================================================================
# STEP 5: Clean Text Columns
# ============================================================================
print("\n" + "=" * 80)
print("STEP 5: Cleaning text columns...")
print("=" * 80)

# Clean make column
if 'make' in df.columns:
    df['make'] = df['make'].astype(str).str.strip()
    df['make'] = df['make'].str.replace(r'\s+', ' ', regex=True)
    df['make'] = df['make'].str.title()
    print(f"  Cleaned 'make' column")

# Clean model column
if 'model' in df.columns:
    df['model'] = df['model'].astype(str).str.strip()
    df['model'] = df['model'].str.replace(r'\s+', ' ', regex=True)
    df['model'] = df['model'].str.title()
    print(f"  Cleaned 'model' column")

# Clean trim column
if 'trim' in df.columns:
    df['trim'] = df['trim'].astype(str).str.strip()
    df['trim'] = df['trim'].str.replace(r'\s+', ' ', regex=True)
    df['trim'] = df['trim'].str.title()
    print(f"  Cleaned 'trim' column")

# Clean title column
if 'title' in df.columns:
    df['title'] = df['title'].astype(str).str.strip()
    df['title'] = df['title'].str.replace(r'\s+', ' ', regex=True)
    print(f"  Cleaned 'title' column")

# ============================================================================
# STEP 6: Handle Outliers
# ============================================================================
print("\n" + "=" * 80)
print("STEP 6: Handling outliers...")
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
    
    price_lower = df['price'].quantile(0.01)
    price_upper = df['price'].quantile(0.99)
    df.loc[df['price'] < price_lower, 'price'] = price_lower
    df.loc[df['price'] > price_upper, 'price'] = price_upper
    print(f"  Capped price outliers to range: [${price_lower:.2f}, ${price_upper:.2f}]")

# Handle mileage outliers
if 'mileage' in df.columns:
    outliers_mileage = detect_outliers_iqr(df['mileage'])
    outliers_count = outliers_mileage.sum()
    print(f"  Mileage outliers detected: {outliers_count} ({outliers_count/len(df)*100:.2f}%)")
    
    mileage_lower = df['mileage'].quantile(0.01)
    mileage_upper = df['mileage'].quantile(0.99)
    df.loc[df['mileage'] < mileage_lower, 'mileage'] = mileage_lower
    df.loc[df['mileage'] > mileage_upper, 'mileage'] = mileage_upper
    print(f"  Capped mileage outliers to range: [{mileage_lower:.2f}, {mileage_upper:.2f}]")

# Handle year outliers
if 'year' in df.columns:
    current_year = 2025
    invalid_years = (df['year'] < 1900) | (df['year'] > current_year)
    invalid_count = invalid_years.sum()
    if invalid_count > 0:
        median_year = df['year'].median()
        df.loc[invalid_years, 'year'] = int(median_year)
        print(f"  Fixed {invalid_count} invalid years (replaced with median: {int(median_year)})")
    else:
        print(f"  No invalid years detected")

# ============================================================================
# STEP 7: Encode Categorical Variables (if not already encoded)
# ============================================================================
print("\n" + "=" * 80)
print("STEP 7: Encoding categorical variables...")
print("=" * 80)

# Encode condition (only if condition_encoded doesn't exist or needs refresh)
if 'condition' in df.columns:
    if 'condition_encoded' not in df.columns:
        le_condition = LabelEncoder()
        df['condition_encoded'] = le_condition.fit_transform(df['condition'])
        print(f"  Encoded 'condition': {len(le_condition.classes_)} unique values")
    else:
        # Refresh encoding to ensure consistency
        le_condition = LabelEncoder()
        df['condition_encoded'] = le_condition.fit_transform(df['condition'])
        print(f"  Refreshed 'condition_encoded': {len(le_condition.classes_)} unique values")

# Encode fuel_type
if 'fuel_type' in df.columns:
    if 'fuel_type_encoded' not in df.columns:
        le_fuel = LabelEncoder()
        df['fuel_type_encoded'] = le_fuel.fit_transform(df['fuel_type'])
        print(f"  Encoded 'fuel_type': {len(le_fuel.classes_)} unique values")
    else:
        le_fuel = LabelEncoder()
        df['fuel_type_encoded'] = le_fuel.fit_transform(df['fuel_type'])
        print(f"  Refreshed 'fuel_type_encoded': {len(le_fuel.classes_)} unique values")

# Encode location
if 'location' in df.columns:
    if 'location_encoded' not in df.columns:
        le_location = LabelEncoder()
        df['location_encoded'] = le_location.fit_transform(df['location'])
        print(f"  Encoded 'location': {len(le_location.classes_)} unique values")
    else:
        le_location = LabelEncoder()
        df['location_encoded'] = le_location.fit_transform(df['location'])
        print(f"  Refreshed 'location_encoded': {len(le_location.classes_)} unique values")

# ============================================================================
# STEP 8: Feature Engineering - age_of_car
# ============================================================================
print("\n" + "=" * 80)
print("STEP 8: Feature engineering...")
print("=" * 80)

if 'year' in df.columns:
    current_year = 2025
    df['age_of_car'] = current_year - df['year']
    print(f"  Created/Updated 'age_of_car' feature (2025 - year)")
    print(f"    Age range: {df['age_of_car'].min()} to {df['age_of_car'].max()} years")
    print(f"    Mean age: {df['age_of_car'].mean():.2f} years")

# ============================================================================
# STEP 9: Save Cleaned Dataset
# ============================================================================
print("\n" + "=" * 80)
print("STEP 9: Saving cleaned and transformed dataset...")
print("=" * 80)

output_file = 'sample_dataset_cleaned_transformed.xlsx'

# Ensure all columns are in the correct order (same as cleaned dataset)
column_order = ['scraped_date', 'title', 'make', 'model', 'trim', 'year', 'price', 
                'mileage', 'mileage_unit', 'location', 'condition', 'fuel_type', 
                'engine_size', 'cylinders', 'condition_encoded', 'fuel_type_encoded', 
                'location_encoded', 'age_of_car']

# Reorder columns (only include columns that exist)
final_columns = [col for col in column_order if col in df.columns]
df_cleaned = df[final_columns]

df_cleaned.to_excel(output_file, index=False)

print(f"\n✅ Cleaned dataset saved successfully!")
print(f"   File: {output_file}")
print(f"   Rows: {len(df_cleaned)} (after cleaning)")
print(f"   Columns: {len(df_cleaned.columns)}")
print(f"\n📊 Dataset Statistics:")
print(f"   Year range: {df_cleaned['year'].min()} - {df_cleaned['year'].max()}")
print(f"   Price range: ${df_cleaned['price'].min():,.0f} - ${df_cleaned['price'].max():,.0f}")
if 'make' in df_cleaned.columns:
    print(f"   Unique makes: {df_cleaned['make'].nunique()}")
if 'condition' in df_cleaned.columns:
    print(f"   Conditions: {', '.join(df_cleaned['condition'].unique())}")
if 'fuel_type' in df_cleaned.columns:
    print(f"   Fuel types: {', '.join(df_cleaned['fuel_type'].unique())}")

print(f"\n✅ All cleaning and transformation steps completed!")
print(f"   Ready to send to teacher: {output_file}")

