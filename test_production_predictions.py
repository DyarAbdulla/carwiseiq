"""
Production Testing Script
Tests 5 real-world scenarios via API and compares with dataset
"""
import requests
import pandas as pd
import json
import os

print("=" * 80)
print("PRODUCTION TESTING - 5 REAL-WORLD SCENARIOS")
print("=" * 80)

# Load dataset for comparison
print("\n[1] Loading dataset for comparison...")
data_file = 'cleaned_car_data.csv'
if not os.path.exists(data_file):
    data_file = 'data/cleaned_car_data.csv'

df = pd.read_csv(data_file)
df_clean = df[df['price'] > 0].copy()
df_clean = df_clean[(df_clean['price'] >= 5000) & (df_clean['price'] <= 80000)].copy()
print(f"   Dataset loaded: {len(df_clean):,} rows")

# Test cases
test_cases = [
    {
        'name': '2025 Toyota Camry',
        'features': {
            'year': 2025,
            'mileage': 0,
            'engine_size': 2.0,
            'cylinders': 4,
            'make': 'Toyota',
            'model': 'Camry',
            'trim': 'Xse',
            'condition': 'New',
            'fuel_type': 'Hybrid',
            'location': 'Baghdad'
        }
    },
    {
        'name': '2024 Chery Tiggo 7 Pro',
        'features': {
            'year': 2024,
            'mileage': 20000,
            'engine_size': 2.0,
            'cylinders': 4,
            'make': 'Chery',
            'model': 'Tiggo 7 Pro',
            'trim': 'Luxury',
            'condition': 'Good',
            'fuel_type': 'Gasoline',
            'location': 'Baghdad'
        }
    },
    {
        'name': '2023 Honda Accord',
        'features': {
            'year': 2023,
            'mileage': 15000,
            'engine_size': 2.0,
            'cylinders': 4,
            'make': 'Honda',
            'model': 'Accord',
            'trim': 'Sport',
            'condition': 'Good',
            'fuel_type': 'Gasoline',
            'location': 'Baghdad'
        }
    },
    {
        'name': '2024 Toyota RAV4',
        'features': {
            'year': 2024,
            'mileage': 5000,
            'engine_size': 2.5,
            'cylinders': 4,
            'make': 'Toyota',
            'model': 'RAV4',
            'trim': 'Limited',
            'condition': 'Excellent',
            'fuel_type': 'Gasoline',
            'location': 'Baghdad'
        }
    },
    {
        'name': '2022 Nissan Altima',
        'features': {
            'year': 2022,
            'mileage': 50000,
            'engine_size': 2.5,
            'cylinders': 4,
            'make': 'Nissan',
            'model': 'Altima',
            'trim': 'SV',
            'condition': 'Good',
            'fuel_type': 'Gasoline',
            'location': 'Baghdad'
        }
    }
]

# Test each case
print("\n[2] Testing predictions via API...")
results = []

for i, test_case in enumerate(test_cases, 1):
    print(f"\n--- Test Case {i}: {test_case['name']} ---")

    # Find similar cars in dataset
    similar = df_clean[
        (df_clean['make'] == test_case['features']['make']) &
        (df_clean['model'] == test_case['features']['model']) &
        (df_clean['year'] == test_case['features']['year'])
    ]

    # If exact year not found, try ±1 year
    if len(similar) == 0:
        similar = df_clean[
            (df_clean['make'] == test_case['features']['make']) &
            (df_clean['model'] == test_case['features']['model']) &
            (df_clean['year'] >= test_case['features']['year'] - 1) &
            (df_clean['year'] <= test_case['features']['year'] + 1)
        ]

    dataset_min = similar['price'].min() if len(similar) > 0 else None
    dataset_max = similar['price'].max() if len(similar) > 0 else None
    dataset_median = similar['price'].median() if len(similar) > 0 else None
    dataset_mean = similar['price'].mean() if len(similar) > 0 else None

    # Make API call
    try:
        response = requests.post(
            'http://localhost:8000/api/predict',
            json={'features': test_case['features']},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            predicted_price = data.get('predicted_price', 0)
            confidence_interval = data.get('confidence_interval', {})
            confidence_lower = confidence_interval.get('lower', 0)
            confidence_upper = confidence_interval.get('upper', 0)
            message = data.get('message', '')
            similar_cars = data.get('similar_cars', [])

            # Calculate difference from dataset
            if dataset_median and dataset_median > 0:
                diff_percent = ((predicted_price - dataset_median) / dataset_median * 100)
                abs_diff = abs(diff_percent)
            else:
                diff_percent = None
                abs_diff = None

            # Determine if reasonable
            if dataset_median:
                if abs_diff <= 30:
                    reasonable = True
                    reason = "Within ±30% of dataset median"
                elif abs_diff <= 50:
                    reasonable = "WARNING"
                    reason = f"{abs_diff:.1f}% difference (over 30%)"
                else:
                    reasonable = False
                    reason = f"{abs_diff:.1f}% difference (over 50%)"
            else:
                reasonable = "NO_DATA"
                reason = "No similar cars in dataset"

            # Get similar cars range from API
            if similar_cars and len(similar_cars) > 0:
                similar_prices = [car.get('price', 0) for car in similar_cars if car.get('price', 0) > 0]
                if similar_prices:
                    api_similar_min = min(similar_prices)
                    api_similar_max = max(similar_prices)
                    api_similar_range = f"${api_similar_min:,.0f} - ${api_similar_max:,.0f}"
                else:
                    api_similar_range = "N/A"
            else:
                api_similar_range = "N/A"

            # Dataset range
            if dataset_min and dataset_max:
                dataset_range = f"${dataset_min:,.0f} - ${dataset_max:,.0f}"
            else:
                dataset_range = "N/A"

            print(f"   Predicted: ${predicted_price:,.0f}")
            print(f"   Confidence: ${confidence_lower:,.0f} - ${confidence_upper:,.0f}")
            if dataset_median:
                print(f"   Dataset median: ${dataset_median:,.0f}")
                print(f"   Difference: {diff_percent:+.1f}%")
            if message:
                print(f"   Message: {message}")

            results.append({
                'car': test_case['name'],
                'predicted_price': predicted_price,
                'confidence_lower': confidence_lower,
                'confidence_upper': confidence_upper,
                'dataset_median': dataset_median,
                'dataset_range': dataset_range,
                'api_similar_range': api_similar_range,
                'diff_percent': diff_percent,
                'reasonable': reasonable,
                'issues': reason,
                'message': message
            })
        else:
            print(f"   ERROR: API returned status {response.status_code}")
            print(f"   Response: {response.text}")
            results.append({
                'car': test_case['name'],
                'predicted_price': 'ERROR',
                'confidence_lower': 'ERROR',
                'confidence_upper': 'ERROR',
                'dataset_median': dataset_median,
                'dataset_range': dataset_range if dataset_min else 'N/A',
                'api_similar_range': 'ERROR',
                'diff_percent': 'ERROR',
                'reasonable': False,
                'issues': f"API error: {response.status_code}",
                'message': response.text
            })
    except Exception as e:
        print(f"   ERROR: {e}")
        results.append({
            'car': test_case['name'],
            'predicted_price': 'ERROR',
            'confidence_lower': 'ERROR',
            'confidence_upper': 'ERROR',
            'dataset_median': dataset_median,
            'dataset_range': dataset_range if dataset_min else 'N/A',
            'api_similar_range': 'ERROR',
            'diff_percent': 'ERROR',
            'reasonable': False,
            'issues': f"Exception: {str(e)}",
            'message': ''
        })

# Print results table
print("\n" + "=" * 80)
print("RESULTS TABLE")
print("=" * 80)

print(f"\n{'Car':<25} {'Predicted':<12} {'Similar Cars Range':<20} {'Reasonable?':<12} {'Issues?':<30}")
print("-" * 100)

reasonable_count = 0
for result in results:
    car = result['car']
    pred = f"${result['predicted_price']:,.0f}" if isinstance(result['predicted_price'], (int, float)) else result['predicted_price']
    similar_range = result['api_similar_range'] if result['api_similar_range'] != 'N/A' else result['dataset_range']
    reasonable = result['reasonable']
    issues = result['issues'][:28] if len(result['issues']) > 28 else result['issues']

    if reasonable == True:
        reasonable_str = "YES"
        reasonable_count += 1
    elif reasonable == "WARNING":
        reasonable_str = "WARNING"
    elif reasonable == "NO_DATA":
        reasonable_str = "NO DATA"
    else:
        reasonable_str = "NO"

    print(f"{car:<25} {pred:<12} {similar_range:<20} {reasonable_str:<12} {issues:<30}")

# Summary
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"\nReasonable Predictions: {reasonable_count}/5")

if reasonable_count >= 4:
    print("\nDECISION: MODEL IS READY FOR PRODUCTION")
    print("   - 4+ predictions are reasonable")
    print("   - Model performance is acceptable")
elif reasonable_count >= 2:
    print("\nDECISION: NEED MINOR ADJUSTMENTS")
    print("   - 2-3 predictions need fine-tuning")
    print("   - Investigate problematic car types")
else:
    print("\nDECISION: MODEL STILL BROKEN")
    print("   - 0-1 predictions are reasonable")
    print("   - Need to restore old model or start fresh")

print("\n" + "=" * 80)
