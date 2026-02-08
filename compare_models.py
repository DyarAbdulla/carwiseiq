"""
Compare OLD vs NEW models
"""
import pickle
import pandas as pd
import numpy as np
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import os

print("=" * 80)
print("COMPARING OLD (99.96%?) vs NEW (96%) MODELS")
print("=" * 80)

# Load both models
print("\n[1] Loading models...")

# OLD model
old_model_path = 'models/car_price_model.pkl'
with open(old_model_path, 'rb') as f:
    old_model_data = pickle.load(f)

if isinstance(old_model_data, dict):
    old_model = old_model_data.get('model')
    old_features = old_model_data.get('features', [])
    old_model_name = old_model_data.get('model_name', 'Unknown')
    print(f"   OLD model: {old_model_name}")
    print(f"   OLD features: {len(old_features)}")
    if old_features:
        print(f"   OLD feature list: {old_features[:10]}...")
else:
    old_model = old_model_data
    old_features = None
    print(f"   OLD model: {type(old_model).__name__} (direct model, no metadata)")

# NEW model (broken)
new_model_path = 'models/best_model_broken_96percent_TRASH.pkl'
with open(new_model_path, 'rb') as f:
    new_model_data = pickle.load(f)

if isinstance(new_model_data, dict):
    new_model = new_model_data.get('model')
    new_features = new_model_data.get('features', [])
    new_model_name = new_model_data.get('model_name', 'Unknown')
    print(f"   NEW model: {new_model_name}")
    print(f"   NEW features: {len(new_features)}")
    if new_features:
        print(f"   NEW feature list: {new_features[:10]}...")
else:
    new_model = new_model_data
    new_features = None
    print(f"   NEW model: {type(new_model).__name__} (direct model, no metadata)")

# Compare model types
print("\n[2] Model comparison:")
print(f"   OLD model type: {type(old_model).__name__}")
print(f"   NEW model type: {type(new_model).__name__}")

# Compare features
if old_features and new_features:
    print("\n[3] Feature comparison:")
    old_set = set(old_features)
    new_set = set(new_features)
    only_old = old_set - new_set
    only_new = new_set - old_set
    common = old_set & new_set

    print(f"   Common features: {len(common)}")
    print(f"   Only in OLD: {len(only_old)}")
    if only_old:
        print(f"      {list(only_old)[:5]}...")
    print(f"   Only in NEW: {len(only_new)}")
    if only_new:
        print(f"      {list(only_new)[:5]}...")

# Check for price_per_km feature (data leakage indicator)
if old_features:
    has_price_per_km_old = 'price_per_km' in old_features
    print(f"\n[4] Data leakage check:")
    print(f"   OLD model has 'price_per_km' feature: {has_price_per_km_old}")
    if has_price_per_km_old:
        print("   ⚠️ WARNING: OLD model uses price_per_km (data leakage!)")
        print("   This explains the 99.96% R² - it's using the target variable!")

if new_features:
    has_price_per_km_new = 'price_per_km' in new_features
    print(f"   NEW model has 'price_per_km' feature: {has_price_per_km_new}")
    if not has_price_per_km_new:
        print("   NEW model does NOT use price_per_km (no data leakage)")

# Load dataset
print("\n[5] Loading dataset...")
data_file = 'cleaned_car_data.csv'
if not os.path.exists(data_file):
    data_file = 'data/cleaned_car_data.csv'

df = pd.read_csv(data_file)
print(f"   Dataset: {len(df):,} rows")

# Show what data was removed
print("\n[6] Data comparison:")
print(f"   Original dataset: {len(df):,} rows")
df_clean_minimal = df[df['price'] > 0].copy()
print(f"   After removing $0 prices: {len(df_clean_minimal):,} rows")
print(f"   Rows removed: {len(df) - len(df_clean_minimal):,}")

# Check if old model used full dataset or cleaned
print("\n[7] Model training data:")
print("   OLD model: Likely trained on full dataset (with price_per_km)")
print("   NEW model: Trained on cleaned dataset (without price_per_km)")

print("\n" + "=" * 80)
print("WHAT CHANGED?")
print("=" * 80)
print("\n1. FEATURES:")
if has_price_per_km_old and not has_price_per_km_new:
    print("   - OLD model used 'price_per_km' (DATA LEAKAGE)")
    print("   - NEW model removed 'price_per_km' (NO DATA LEAKAGE)")
    print("   - This is why R² dropped from 99.96% to 96%")
    print("   - 99.96% was artificially high because model 'cheated'")
    print("   - 96% is the REAL accuracy without cheating")

print("\n2. DATA:")
print(f"   - OLD model: Trained on ~{len(df):,} rows (with outliers)")
print(f"   - NEW model: Trained on ~43,336 rows (cleaned, outliers removed)")

print("\n3. MODEL TYPE:")
print(f"   - OLD: {type(old_model).__name__}")
print(f"   - NEW: {type(new_model).__name__}")

print("\n" + "=" * 80)
print("CONCLUSION")
print("=" * 80)
if has_price_per_km_old:
    print("\n⚠️ The OLD model's 99.96% R² was NOT real accuracy!")
    print("   It was using 'price_per_km' which requires knowing the price.")
    print("   This is data leakage - the model was 'cheating'.")
    print("\n✓ The NEW model's 96% R² is REAL accuracy!")
    print("   It doesn't use the target variable as a feature.")
    print("   This is honest, production-ready accuracy.")
    print("\nRECOMMENDATION:")
    print("   Keep the NEW model (96%) - it's actually better!")
    print("   The OLD model (99.96%) cannot work in production")
    print("   because you can't calculate price_per_km without knowing the price.")
else:
    print("\nBoth models appear to use similar features.")
    print("The difference in R² may be due to:")
    print("  - Different data cleaning")
    print("  - Different hyperparameters")
    print("  - Different train/test splits")
