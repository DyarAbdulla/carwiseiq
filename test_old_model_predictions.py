"""
Test OLD model predictions via API
"""
import requests
import json

print("=" * 80)
print("TESTING OLD MODEL PREDICTIONS")
print("=" * 80)

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
    }
]

print("\nTesting predictions with OLD model...")
print("(Make sure backend is restarted with old model)\n")

results = []
for test_case in test_cases:
    print(f"Testing: {test_case['name']}")
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
            message = data.get('message', '')

            print(f"  Predicted: ${predicted_price:,.0f}")
            print(f"  Confidence: ${confidence_interval.get('lower', 0):,.0f} - ${confidence_interval.get('upper', 0):,.0f}")
            if message:
                print(f"  Message: {message[:100]}...")

            results.append({
                'car': test_case['name'],
                'predicted': predicted_price,
                'message': message
            })
        else:
            print(f"  ERROR: Status {response.status_code}")
            print(f"  Response: {response.text[:200]}")
    except Exception as e:
        print(f"  ERROR: {e}")

print("\n" + "=" * 80)
print("OLD MODEL PREDICTIONS")
print("=" * 80)
for result in results:
    print(f"{result['car']}: ${result['predicted']:,.0f}")
