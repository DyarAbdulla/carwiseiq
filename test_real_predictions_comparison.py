"""
STEP 3: Test real car predictions side-by-side
"""
import requests
import pandas as pd
import json

print("=" * 80)
print("TESTING REAL CAR PREDICTIONS")
print("=" * 80)

# Load dataset for comparison
df = pd.read_csv('cleaned_car_data.csv')
df = df[df['price'] > 0].copy()

# Test cases
test_cars = [
    {
        'name': '2025 Toyota Camry',
        'features': {
            'year': 2025,
            'mileage': 0,
            'engine_size': 2.5,
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
    }
]

print("\nTesting predictions via API (should use OLD model after restart)...")

results = []
for test_case in test_cars:
    car = test_case['features']

    # Find market price
    similar = df[
        (df['make'] == car['make']) &
        (df['model'] == car['model']) &
        (df['year'] == car['year'])
    ]

    market_median = similar['price'].median() if len(similar) > 0 else None
    market_range = f"${similar['price'].min():,.0f} - ${similar['price'].max():,.0f}" if len(similar) > 0 else "N/A"

    # Test via API
    try:
        response = requests.post(
            'http://localhost:8000/api/predict',
            json={'features': car},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            predicted = data.get('predicted_price', 0)

            if market_median:
                diff_percent = ((predicted - market_median) / market_median * 100)
                diff_str = f"{diff_percent:+.1f}%"
            else:
                diff_str = "N/A"

            results.append({
                'car': test_case['name'],
                'predicted': predicted,
                'market_median': market_median,
                'market_range': market_range,
                'diff_percent': diff_percent if market_median else None
            })

            print(f"\n{test_case['name']}:")
            print(f"  Predicted: ${predicted:,.0f}")
            print(f"  Market median: ${market_median:,.0f}" if market_median else "  Market median: N/A")
            print(f"  Difference: {diff_str}")
        else:
            print(f"\n{test_case['name']}: API Error {response.status_code}")
    except Exception as e:
        print(f"\n{test_case['name']}: Error - {e}")

print("\n" + "=" * 80)
print("PREDICTION RESULTS")
print("=" * 80)

# Note: These are current API predictions (may be using old or new model depending on restart)
print("\nNote: These predictions are from the currently running backend.")
print("If backend was restarted, it should be using the OLD model.")
print("\nFor accurate comparison, both models need to be tested separately.")
