"""
Test Predictions - STEP 4
Validate the fixed model with test cases
"""
import pandas as pd
import pickle
import numpy as np
import os

print("=" * 80)
print("STEP 4: VALIDATION TESTING")
print("=" * 80)

# Load model
print("\n[1] Loading model...")
model_path = 'models/best_model_v2.pkl'
with open(model_path, 'rb') as f:
    model_data = pickle.load(f)

model = model_data['model']
available_features = model_data['features']
encoders = model_data.get('encoders', {})
print(f"   Model type: {model_data.get('model_name', 'Unknown')}")
print(f"   Features: {len(available_features)}")

# Load dataset
print("\n[2] Loading dataset...")
data_file = 'cleaned_car_data.csv'
if not os.path.exists(data_file):
    data_file = 'data/cleaned_car_data.csv'

df = pd.read_csv(data_file)
df_clean = df[df['price'] > 0].copy()
df_clean = df_clean[(df_clean['price'] >= 5000) & (df_clean['price'] <= 80000)].copy()
df_clean = df_clean[(df_clean['year'] >= 2015) & (df_clean['year'] <= 2026)].copy()
print(f"   Dataset loaded: {len(df_clean):,} rows")

# Helper function to prepare test car
def prepare_test_car(car_data):
    """Prepare a test car for prediction"""
    car_df = pd.DataFrame([car_data])
    car_df['age_of_car'] = 2025 - car_df['year']

    # Brand popularity
    if 'make_popularity_map' in encoders:
        car_df['brand_popularity'] = car_df['make'].map(encoders['make_popularity_map']).fillna(0)

    # Interaction features
    car_df['year_mileage_interaction'] = car_df['year'] * car_df['mileage']
    car_df['engine_cylinders_interaction'] = car_df['engine_size'] * car_df['cylinders']

    # Encode make and model
    if 'make' in encoders:
        try:
            car_df['make_encoded'] = encoders['make'].transform(car_df['make'].astype(str))
        except ValueError:
            car_df['make_encoded'] = 0

    if 'model' in encoders:
        try:
            car_df['model_encoded'] = encoders['model'].transform(car_df['model'].astype(str))
        except ValueError:
            car_df['model_encoded'] = 0

    # Select features
    test_X = car_df[[col for col in available_features if col in car_df.columns]]

    # Fill missing columns (use defaults)
    for col in available_features:
        if col not in test_X.columns:
            if col == 'condition_encoded':
                test_X[col] = 3  # Default to 'Good'
            elif col == 'fuel_type_encoded':
                test_X[col] = 0  # Default to 'Gasoline'
            elif col == 'location_encoded':
                test_X[col] = 0  # Default
            else:
                test_X[col] = 0

    # Reorder columns to match training
    test_X = test_X[available_features]

    return test_X

# Test cases
print("\n[3] Testing predictions...")
test_cars = [
    {'make': 'Toyota', 'model': 'Camry', 'year': 2025, 'mileage': 0, 'engine_size': 2.5, 'cylinders': 4, 'condition': 'New', 'fuel_type': 'Hybrid', 'location': 'Baghdad'},
    {'make': 'Chery', 'model': 'Tiggo 7 Pro', 'year': 2024, 'mileage': 20000, 'engine_size': 2.0, 'cylinders': 4, 'condition': 'Good', 'fuel_type': 'Gasoline', 'location': 'Baghdad'},
    {'make': 'Honda', 'model': 'Accord', 'year': 2024, 'mileage': 5000, 'engine_size': 2.0, 'cylinders': 4, 'condition': 'Used', 'fuel_type': 'Gasoline', 'location': 'Baghdad'},
]

results_table = []

print("\n" + "=" * 80)
print("VALIDATION RESULTS")
print("=" * 80)

for car in test_cars:
    # Find similar cars in dataset
    similar = df_clean[
        (df_clean['make'] == car['make']) &
        (df_clean['model'] == car['model']) &
        (df_clean['year'] == car['year'])
    ]

    if len(similar) > 0:
        dataset_prices = similar['price']
        dataset_median = dataset_prices.median()
        dataset_mean = dataset_prices.mean()
        dataset_min = dataset_prices.min()
        dataset_max = dataset_prices.max()

        # Make prediction
        try:
            test_X = prepare_test_car(car)
            prediction = model.predict(test_X)[0]

            difference = ((prediction - dataset_median) / dataset_median * 100) if dataset_median > 0 else 0
            abs_diff = abs(difference)

            status = "OK" if abs_diff <= 30 else "WARNING"

            print(f"\n{car['year']} {car['make']} {car['model']} ({car['mileage']:,} km)")
            print(f"  Dataset: Min=${dataset_min:,.0f}, Median=${dataset_median:,.0f}, Mean=${dataset_mean:,.0f}, Max=${dataset_max:,.0f}")
            print(f"  Prediction: ${prediction:,.0f}")
            print(f"  Difference from median: {difference:+.1f}%")
            print(f"  Status: {status}")

            results_table.append({
                'Car': f"{car['year']} {car['make']} {car['model']}",
                'Year': car['year'],
                'Mileage': car['mileage'],
                'Dataset_Median': dataset_median,
                'Prediction': prediction,
                'Diff_%': difference,
                'Status': status
            })
        except Exception as e:
            print(f"\n{car['year']} {car['make']} {car['model']}:")
            print(f"  ERROR: {e}")
            results_table.append({
                'Car': f"{car['year']} {car['make']} {car['model']}",
                'Year': car['year'],
                'Mileage': car['mileage'],
                'Dataset_Median': 'ERROR',
                'Prediction': 'ERROR',
                'Diff_%': 'ERROR',
                'Status': 'ERROR'
            })
    else:
        print(f"\n{car['year']} {car['make']} {car['model']}:")
        print(f"  No similar cars found in dataset")
        results_table.append({
            'Car': f"{car['year']} {car['make']} {car['model']}",
            'Year': car['year'],
            'Mileage': car['mileage'],
            'Dataset_Median': 'N/A',
            'Prediction': 'N/A',
            'Diff_%': 'N/A',
            'Status': 'NO_DATA'
        })

# Print summary table
print("\n" + "=" * 80)
print("SUMMARY TABLE")
print("=" * 80)
print(f"\n{'Car':<30} {'Year':<6} {'Mileage':<10} {'Dataset Median':<15} {'Prediction':<12} {'Diff %':<10} {'Status':<10}")
print("-" * 100)

for result in results_table:
    dataset_str = f"${result['Dataset_Median']:,.0f}" if isinstance(result['Dataset_Median'], (int, float)) else str(result['Dataset_Median'])
    pred_str = f"${result['Prediction']:,.0f}" if isinstance(result['Prediction'], (int, float)) else str(result['Prediction'])
    diff_str = f"{result['Diff_%']:.1f}%" if isinstance(result['Diff_%'], (int, float)) else str(result['Diff_%'])

    print(f"{result['Car']:<30} {result['Year']:<6} {result['Mileage']:<10} {dataset_str:<15} {pred_str:<12} {diff_str:<10} {result['Status']:<10}")

# Check success criteria
print("\n" + "=" * 80)
print("SUCCESS CRITERIA CHECK")
print("=" * 80)

all_passed = True
for result in results_table:
    if result['Status'] == 'OK':
        print(f"✓ {result['Car']}: PASSED (within ±30%)")
    elif result['Status'] == 'WARNING':
        print(f"⚠ {result['Car']}: WARNING (outside ±30%)")
        all_passed = False
    elif result['Status'] == 'NO_DATA':
        print(f"⚠ {result['Car']}: NO DATA in dataset")
    else:
        print(f"✗ {result['Car']}: ERROR")
        all_passed = False

print("\n" + "=" * 80)
if all_passed:
    print("ALL TESTS PASSED!")
else:
    print("SOME TESTS HAVE WARNINGS")
print("=" * 80)
