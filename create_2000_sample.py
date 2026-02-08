"""
Create a 2000-row sample dataset with all 18 columns from cleaned data
"""

import pandas as pd

print('Loading cleaned dataset (18 columns)...')
df = pd.read_csv('data/cleaned_car_data.csv')

print(f'Cleaned dataset: {len(df)} rows, {len(df.columns)} columns')
print(f'\nColumn names:')
for i, col in enumerate(df.columns, 1):
    print(f'  {i}. {col}')

# Create 2000-row sample
sample = df.sample(n=min(2000, len(df)), random_state=42).reset_index(drop=True)

# Sort by year for better organization
sample = sample.sort_values('year', ascending=False).reset_index(drop=True)

# Save to Excel
output_file = 'sample_dataset_2000rows_18columns.xlsx'
sample.to_excel(output_file, index=False)

print(f'\nSuccessfully created sample with {len(sample)} rows and {len(sample.columns)} columns')
print(f'File saved: {output_file}')

# Show statistics
print(f'\nDataset statistics:')
print(f'  Year range: {sample["year"].min()} - {sample["year"].max()}')
print(f'  Price range: ${sample["price"].min():,.0f} - ${sample["price"].max():,.0f}')
if 'make' in sample.columns:
    print(f'  Unique makes: {sample["make"].nunique()}')

