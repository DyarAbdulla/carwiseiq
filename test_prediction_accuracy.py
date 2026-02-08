"""
Quick prediction accuracy test
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'core'))

from core.predict_price import predict_price
import pandas as pd
import numpy as np

# Load dataset
df = pd.read_csv('cleaned_car_data.csv')

# Test 5 diverse cars
test_cars = [
    {'make': 'Toyota', 'model': 'Camry', 'year': 2020},
    {'make': 'Honda', 'model': 'Accord', 'year': 2018},
    {'make': 'BMW', 'model': 'X5', 'year': 2022},
    {'make': 'Ford', 'model': 'F-150', 'year': 2019},
    {'make': 'Tesla', 'model': 'Model 3', 'year': 2021}
]

print("=" * 80)
print("PREDICTION ACCURACY TEST")
print("=" * 80)
print()

for test_car in test_cars:
    # Find matching car in dataset
    matches = df[
        (df['make'] == test_car['make']) &
        (df['model'] == test_car['model']) &
        (df['year'] == test_car['year'])
    ]

    if len(matches) > 0:
        car = matches.iloc[0]

        # Prepare car data
        car_data = {
            'year': int(car['year']),
            'mileage': float(car['mileage']),
            'engine_size': float(car['engine_size']),
            'cylinders': int(car['cylinders']),
            'make': str(car['make']),
            'model': str(car['model']),
            'trim': str(car['trim']) if pd.notna(car['trim']) else '',
            'condition': str(car['condition']),
            'fuel_type': str(car['fuel_type']),
            'location': str(car['location'])
        }

        # Predict
        try:
            pred = predict_price(car_data)
            if isinstance(pred, np.ndarray):
                pred = float(pred[0])
            else:
                pred = float(pred)

            actual = float(car['price'])
            diff_pct = abs(pred - actual) / actual * 100

            status = "OK" if diff_pct <= 15 else "HIGH ERROR"
            print(f"{status}: {test_car['make']} {test_car['model']} {test_car['year']}")
            print(f"  Predicted: ${pred:,.2f}")
            print(f"  Actual:    ${actual:,.2f}")
            print(f"  Difference: {diff_pct:.1f}%")
            print()
        except Exception as e:
            print(f"ERROR: {test_car['make']} {test_car['model']} {test_car['year']}")
            print(f"  {str(e)}")
            print()
