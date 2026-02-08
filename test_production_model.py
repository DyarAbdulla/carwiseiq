"""
Test Production Model v1.0 Predictions
"""
import requests
import pandas as pd
import json
from datetime import datetime

print("=" * 80)
print("TESTING PRODUCTION MODEL v1.0 (96% Accuracy)")
print("=" * 80)

# Load dataset for comparison
df = pd.read_csv('cleaned_car_data.csv')
df = df[df['price'] > 0].copy()

# Test cases
test_cases = [
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

print("\nTesting predictions via API...")
print("(Using Production Model v1.0 - 96% accuracy)\n")

results = []
for test_case in test_cases:
    car = test_case['features']

    # Find market price
    similar = df[
        (df['make'] == car['make']) &
        (df['model'] == car['model']) &
        (df['year'] == car['year'])
    ]

    market_median = similar['price'].median() if len(similar) > 0 else None
    market_mean = similar['price'].mean() if len(similar) > 0 else None
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
            confidence = data.get('confidence_interval', {})
            message = data.get('message', '')

            if market_median:
                diff_percent = ((predicted - market_median) / market_median * 100)
                diff_str = f"{diff_percent:+.1f}%"
                status = "OK" if abs(diff_percent) <= 30 else "WARNING"
            else:
                diff_str = "N/A"
                status = "NO_DATA"

            results.append({
                'car': test_case['name'],
                'predicted': predicted,
                'market_median': market_median,
                'market_mean': market_mean,
                'market_range': market_range,
                'diff_percent': diff_percent if market_median else None,
                'status': status,
                'message': message
            })

            print(f"{test_case['name']}:")
            print(f"  Predicted: ${predicted:,.0f}")
            print(f"  Market median: ${market_median:,.0f}" if market_median else "  Market median: N/A")
            print(f"  Market mean: ${market_mean:,.0f}" if market_mean else "  Market mean: N/A")
            print(f"  Market range: {market_range}")
            print(f"  Difference: {diff_str}")
            print(f"  Status: {status}")
            if message:
                print(f"  Message: {message[:100]}...")
            print()
        else:
            print(f"{test_case['name']}: API Error {response.status_code}")
            print(f"  Response: {response.text[:200]}\n")
    except Exception as e:
        print(f"{test_case['name']}: Error - {e}\n")

# Summary
print("=" * 80)
print("TEST RESULTS SUMMARY")
print("=" * 80)

for result in results:
    print(f"\n{result['car']}:")
    print(f"  Prediction: ${result['predicted']:,.0f}")
    print(f"  Market: ${result['market_median']:,.0f} (median)")
    print(f"  Difference: {result['diff_percent']:+.1f}%" if result['diff_percent'] else "  Difference: N/A")
    print(f"  Status: {result['status']}")

print("\n" + "=" * 80)
