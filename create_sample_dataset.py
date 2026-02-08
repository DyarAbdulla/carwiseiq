"""
Create a representative sample dataset for teacher submission
Includes all columns but only a subset of rows (250 samples)
Ensures variety across different makes, years, and conditions
"""

import pandas as pd
import numpy as np
import sys
import io

# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Load the full dataset
print("Loading dataset...")
df = pd.read_csv('data/cleaned_car_data.csv')
print(f"Full dataset: {len(df)} rows, {len(df.columns)} columns")

# Create a stratified sample to ensure variety
# We'll sample from different makes to show variety
sample_size = 250
samples_per_group = max(5, sample_size // 20)  # At least 5 per make, max 20 groups

# Get top makes for variety
if 'make' in df.columns:
    top_makes = df['make'].value_counts().head(15).index.tolist()
    
    # Sample from each make
    sampled_data = []
    for make in top_makes:
        make_data = df[df['make'] == make]
        if len(make_data) > 0:
            n_samples = min(samples_per_group, len(make_data))
            sampled_data.append(make_data.sample(n=n_samples, random_state=42))
    
    # Combine and add random samples to reach target size
    if sampled_data:
        stratified_sample = pd.concat(sampled_data, ignore_index=True)
        remaining = sample_size - len(stratified_sample)
        
        if remaining > 0:
            # Add random samples from remaining data
            remaining_data = df[~df.index.isin(stratified_sample.index)]
            if len(remaining_data) > 0:
                additional = remaining_data.sample(n=min(remaining, len(remaining_data)), random_state=42)
                stratified_sample = pd.concat([stratified_sample, additional], ignore_index=True)
        
        # Final random shuffle
        final_sample = stratified_sample.sample(n=min(sample_size, len(stratified_sample)), 
                                                random_state=42).reset_index(drop=True)
    else:
        # Fallback to random sampling
        final_sample = df.sample(n=min(sample_size, len(df)), random_state=42).reset_index(drop=True)
else:
    # Fallback to random sampling if no 'make' column
    final_sample = df.sample(n=min(sample_size, len(df)), random_state=42).reset_index(drop=True)

# Sort by year and price for better readability
if 'year' in final_sample.columns:
    final_sample = final_sample.sort_values(['year', 'price'], ascending=[False, True]).reset_index(drop=True)

# Save the sample dataset
output_file = 'sample_dataset_for_teacher.csv'
final_sample.to_csv(output_file, index=False)

print(f"\n✅ Sample dataset created successfully!")
print(f"   File: {output_file}")
print(f"   Rows: {len(final_sample)} (out of {len(df)} total)")
print(f"   Columns: {len(final_sample.columns)} (all columns preserved)")
print(f"\nColumn names:")
for i, col in enumerate(final_sample.columns, 1):
    print(f"   {i}. {col}")

print(f"\nDataset statistics:")
print(f"   Year range: {final_sample['year'].min()} - {final_sample['year'].max()}")
print(f"   Price range: ${final_sample['price'].min():,.0f} - ${final_sample['price'].max():,.0f}")
if 'make' in final_sample.columns:
    print(f"   Unique makes: {final_sample['make'].nunique()}")
if 'condition' in final_sample.columns:
    print(f"   Conditions: {', '.join(final_sample['condition'].unique())}")
if 'fuel_type' in final_sample.columns:
    print(f"   Fuel types: {', '.join(final_sample['fuel_type'].unique())}")

print(f"\n📊 First 5 rows preview:")
print(final_sample.head().to_string())

print(f"\n✅ Sample dataset is ready to send to your teacher!")
print(f"   This file contains {len(final_sample)} representative samples with all {len(final_sample.columns)} columns.")

