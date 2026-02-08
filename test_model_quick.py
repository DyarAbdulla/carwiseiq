"""
Quick test script to verify test_model.py works correctly.
"""

import sys
from test_model import load_models, create_tabular_features, predict_price

def test_quick():
    """Quick test with sample data."""
    print("="*60)
    print("QUICK TEST - test_model.py")
    print("="*60)

    # Load models
    ensemble_model, encoders, scaler, model_metadata, expected_features = load_models()

    # Sample car data
    car_data = {
        'make': 'Toyota',
        'model': 'Camry',
        'year': 2020,
        'mileage': 50000,
        'condition': 'Used',
        'fuel_type': 'Gasoline',
        'engine_size': 2.5,
        'cylinders': 4,
        'trim': 'Unknown',
        'location': 'Unknown'
    }

    print("\n" + "="*60)
    print("Testing with sample car:")
    print(f"  {car_data['make']} {car_data['model']} {car_data['year']}")
    print("="*60)

    # Make prediction
    try:
        prediction, confidence_range = predict_price(
            car_data, ensemble_model, encoders, scaler, model_metadata, expected_features
        )

        print("\n" + "="*60)
        print("[SUCCESS] TEST PASSED!")
        print("="*60)
        print(f"\nPredicted Price: ${prediction:,.2f}")
        print(f"Confidence Range: ${confidence_range[0]:,.2f} - ${confidence_range[1]:,.2f}")
        print("\n" + "="*60)

        return True
    except Exception as e:
        print("\n" + "="*60)
        print("[FAILED] TEST FAILED!")
        print("="*60)
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_quick()
    sys.exit(0 if success else 1)
