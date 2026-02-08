"""
Investigate Dataset - STEP 2B
Analyze the dataset to understand the problem
"""
import pandas as pd
import os

print("=" * 80)
print("STEP 2B: DATASET INVESTIGATION")
print("=" * 80)

# Find dataset file
csv_files = [
    'car_data.csv',
    'data/car_data.csv',
    'cleaned_car_data.csv',
    'data/cleaned_car_data.csv'
]

data_file = None
for f in csv_files:
    if os.path.exists(f):
        data_file = f
        break

if not data_file:
    print("ERROR: No dataset file found!")
    print("Searched for:", csv_files)
    exit(1)

print(f"\nLoading dataset: {data_file}")
df = pd.read_csv(data_file)

print(f"\nDataset shape: {df.shape}")
print(f"Columns: {list(df.columns)}")

print("\n" + "=" * 80)
print("FIRST 10 ROWS:")
print("=" * 80)
print(df.head(10).to_string())

print("\n" + "=" * 80)
print("PRICE STATISTICS:")
print("=" * 80)
print(df['price'].describe())

# Check specific cars
print("\n" + "=" * 80)
print("2025 Toyota Camry prices in dataset:")
print("=" * 80)
toyota_2025 = df[(df['make'] == 'Toyota') & (df['model'] == 'Camry') & (df['year'] == 2025)]
if len(toyota_2025) > 0:
    print(toyota_2025[['make', 'model', 'year', 'mileage', 'price']].head(20).to_string())
    print(f"\nStatistics:")
    print(toyota_2025['price'].describe())
else:
    print("No 2025 Toyota Camry found in dataset")
    # Check what years exist
    toyota_camry = df[(df['make'] == 'Toyota') & (df['model'] == 'Camry')]
    if len(toyota_camry) > 0:
        print(f"\nToyota Camry years available: {sorted(toyota_camry['year'].unique())}")
        recent = toyota_camry[toyota_camry['year'] >= 2020]
        if len(recent) > 0:
            print(f"\nRecent Toyota Camry (2020+):")
            print(recent[['year', 'mileage', 'price']].head(20).to_string())
            print(f"\nPrice statistics for recent:")
            print(recent['price'].describe())

print("\n" + "=" * 80)
print("2024 Chery Tiggo 7 Pro prices in dataset:")
print("=" * 80)
chery_2024 = df[(df['make'] == 'Chery') & (df['model'].str.contains('Tiggo 7', case=False, na=False)) & (df['year'] == 2024)]
if len(chery_2024) > 0:
    print(chery_2024[['make', 'model', 'year', 'mileage', 'price']].head(20).to_string())
    print(f"\nStatistics:")
    print(chery_2024['price'].describe())
else:
    print("No 2024 Chery Tiggo 7 Pro found in dataset")
    chery_tiggo = df[(df['make'] == 'Chery') & (df['model'].str.contains('Tiggo 7', case=False, na=False))]
    if len(chery_tiggo) > 0:
        print(f"\nChery Tiggo 7 years available: {sorted(chery_tiggo['year'].unique())}")
        recent = chery_tiggo[chery_tiggo['year'] >= 2022]
        if len(recent) > 0:
            print(f"\nRecent Chery Tiggo 7 (2022+):")
            print(recent[['year', 'mileage', 'price']].head(20).to_string())
            print(f"\nPrice statistics for recent:")
            print(recent['price'].describe())

print("\n" + "=" * 80)
print("PRICE FORMAT CHECK:")
print("=" * 80)
print(f"Min price: ${df['price'].min():,.0f}")
print(f"Max price: ${df['price'].max():,.0f}")
print(f"Mean price: ${df['price'].mean():,.0f}")
print(f"Median price: ${df['price'].median():,.0f}")

# Check if prices seem to be in cents (if mean > 100000)
if df['price'].mean() > 100000:
    print("\n⚠️ WARNING: Prices appear to be in CENTS (mean > $100k)")
    print("   This might be the problem! Prices should be in dollars.")
else:
    print("\n✓ Prices appear to be in DOLLARS (reasonable range)")

print("\n" + "=" * 80)
