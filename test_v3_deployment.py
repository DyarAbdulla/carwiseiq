"""
Test script for Model V3 deployment
Tests model loading, predictions, and accuracy
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'core'))

from core.predict_price import predict_price, load_model
import pandas as pd
import numpy as np
import time

def test_model_loading():
    """Test that v3 model loads correctly"""
    print("=" * 80)
    print("TEST 1: Model Loading")
    print("=" * 80)

    try:
        result = load_model()
        model, features, model_name, _, _, _, _, _, _, _, _, scaler, _, _, _, _, image_features_enabled, image_feature_dim, model_version, model_rmse = result

        print(f"[OK] Model loaded successfully!")
        print(f"  Model Name: {model_name}")
        print(f"  Version: {model_version}")
        print(f"  Features: {len(features)}")
        print(f"  Image Features Enabled: {image_features_enabled}")
        if image_features_enabled:
            print(f"  Image Feature Dimension: {image_feature_dim}")
        print(f"  Has Scaler: {scaler is not None}")
        print(f"  RMSE: ${model_rmse:,.2f}" if model_rmse else "  RMSE: N/A")

        # Verify it's v3
        if model_version == 'v3':
            print(f"[OK] Correct model version (v3)")
        else:
            print(f"[WARNING] Expected v3, got {model_version}")

        return True
    except Exception as e:
        print(f"[ERROR] Failed to load model: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_prediction():
    """Test basic prediction"""
    print("\n" + "=" * 80)
    print("TEST 2: Basic Prediction")
    print("=" * 80)

    car_data = {
        'year': 2020,
        'mileage': 30000,
        'engine_size': 2.5,
        'cylinders': 4,
        'make': 'Toyota',
        'model': 'Camry',
        'trim': 'LE',
        'condition': 'Good',
        'fuel_type': 'Gasoline',
        'location': 'California'
    }

    try:
        start = time.time()
        prediction = predict_price(car_data)
        duration = time.time() - start

        print(f"[OK] Prediction successful!")
        print(f"  Car: {car_data['year']} {car_data['make']} {car_data['model']}")
        print(f"  Predicted Price: ${prediction:,.2f}")
        print(f"  Prediction Time: {duration:.3f}s")

        # Validate prediction is reasonable
        if 1000 <= prediction <= 200000:
            print(f"[OK] Prediction is in reasonable range")
        else:
            print(f"[WARNING] Prediction seems unrealistic: ${prediction:,.2f}")

        return True, prediction, duration
    except Exception as e:
        print(f"[ERROR] Prediction failed: {e}")
        import traceback
        traceback.print_exc()
        return False, None, None

def test_confidence_intervals():
    """Test confidence intervals"""
    print("\n" + "=" * 80)
    print("TEST 3: Confidence Intervals")
    print("=" * 80)

    car_data = {
        'year': 2020,
        'mileage': 30000,
        'engine_size': 2.5,
        'cylinders': 4,
        'make': 'Toyota',
        'model': 'Camry',
        'trim': 'LE',
        'condition': 'Good',
        'fuel_type': 'Gasoline',
        'location': 'California'
    }

    try:
        price, intervals = predict_price(car_data, return_confidence=True)

        print(f"[OK] Confidence intervals calculated!")
        print(f"  Predicted Price: ${price:,.2f}")
        print(f"  95% CI Lower: ${intervals['lower_95']:,.2f}")
        print(f"  95% CI Upper: ${intervals['upper_95']:,.2f}")
        print(f"  Std Dev: ${intervals['std']:,.2f}")

        # Check if using RMSE ~$6,080 (v3 model)
        if 5000 <= intervals['std'] <= 8000:
            print(f"[OK] Confidence intervals use RMSE ~$6,080 (v3 model)")
        else:
            print(f"[INFO] Std Dev: ${intervals['std']:,.2f} (may be from different model)")

        return True
    except Exception as e:
        print(f"[ERROR] Confidence intervals failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_multiple_cars():
    """Test predictions for 10 different cars"""
    print("\n" + "=" * 80)
    print("TEST 4: Multiple Car Predictions (10 cars)")
    print("=" * 80)

    # Load dataset to get real car examples
    try:
        df = pd.read_csv('cleaned_car_data.csv')
        test_cars = df.sample(10, random_state=42)

        passed = 0
        failed = 0
        predictions_times = []

        for idx, row in test_cars.iterrows():
            car_data = {
                'year': int(row['year']),
                'mileage': float(row['mileage']),
                'engine_size': float(row['engine_size']),
                'cylinders': int(row['cylinders']),
                'make': str(row['make']),
                'model': str(row['model']),
                'trim': str(row['trim']) if pd.notna(row['trim']) else '',
                'condition': str(row['condition']),
                'fuel_type': str(row['fuel_type']),
                'location': str(row['location'])
            }

            try:
                start = time.time()
                pred = predict_price(car_data)
                duration = time.time() - start
                predictions_times.append(duration)

                actual = float(row['price'])
                diff_pct = abs(pred - actual) / actual * 100

                status = "OK" if diff_pct <= 20 else "HIGH ERROR"
                print(f"{status}: {car_data['make']} {car_data['model']} {car_data['year']}")
                print(f"  Predicted: ${pred:,.2f}, Actual: ${actual:,.2f}, Diff: {diff_pct:.1f}%")

                if diff_pct <= 20:
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"ERROR: {car_data['make']} {car_data['model']} - {e}")
                failed += 1

        avg_time = np.mean(predictions_times) if predictions_times else 0
        print(f"\nSummary: {passed}/10 passed, Avg time: {avg_time:.3f}s")

        return passed >= 8  # At least 8/10 should pass
    except Exception as e:
        print(f"[ERROR] Failed to test multiple cars: {e}")
        return False

def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("MODEL V3 DEPLOYMENT TESTING")
    print("=" * 80)
    print()

    results = []

    # Test 1: Model Loading
    results.append(("Model Loading", test_model_loading()))

    # Test 2: Basic Prediction
    pred_ok, _, pred_time = test_prediction()
    results.append(("Basic Prediction", pred_ok))
    if pred_time:
        results.append(("Prediction Speed", pred_time < 1.0))

    # Test 3: Confidence Intervals
    results.append(("Confidence Intervals", test_confidence_intervals()))

    # Test 4: Multiple Cars
    results.append(("Multiple Cars", test_multiple_cars()))

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status}: {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n[SUCCESS] All tests passed! Model v3 is ready for deployment.")
        return 0
    else:
        print(f"\n[WARNING] {total - passed} test(s) failed. Please review before deployment.")
        return 1

if __name__ == "__main__":
    exit(main())
