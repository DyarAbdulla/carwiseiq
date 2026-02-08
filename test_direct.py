"""
Direct Integration Testing (No API Server Required)
Tests core functionality directly
"""

import pandas as pd
import numpy as np
import time
import sys
import os

# Add paths
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'core'))

from core.predict_price import predict_price, load_model
import pandas as pd

class DirectTester:
    def __init__(self):
        self.results = []
        self.csv_file = "cleaned_car_data.csv"

    def log_result(self, test_name: str, passed: bool, message: str = "", duration: float = 0):
        """Log test result"""
        status = "[PASS]" if passed else "[FAIL]"
        self.results.append({
            'test': test_name,
            'status': status,
            'passed': passed,
            'message': message,
            'duration': duration
        })
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if duration > 0:
            print(f"   Duration: {duration:.3f}s")

    def test_model_loading(self):
        """Test model loading"""
        try:
            start = time.time()
            result = load_model()
            duration = time.time() - start

            # Handle tuple return
            if isinstance(result, tuple) and len(result) >= 3:
                model = result[0]
                features = result[1]
                model_name = result[2]
            else:
                model = None
                features = []
                model_name = 'Unknown'

            self.log_result(
                "Model Loading",
                model is not None and len(features) > 0,
                f"Model: {model_name}, Features: {len(features)}",
                duration
            )
            return model is not None
        except Exception as e:
            self.log_result("Model Loading", False, str(e), 0)
            return False

    def test_dataset_loading(self):
        """Test dataset loading"""
        try:
            start = time.time()
            df = pd.read_csv(self.csv_file)
            duration = time.time() - start

            is_loaded = df is not None and len(df) > 0

            self.log_result(
                "Dataset Loading",
                is_loaded,
                f"Rows: {len(df) if df is not None else 0}",
                duration
            )
            return is_loaded
        except Exception as e:
            self.log_result("Dataset Loading", False, str(e), 0)
            return False

    def test_data_consistency(self):
        """Test data consistency"""
        try:
            # Load CSV
            df = pd.read_csv(self.csv_file)

            # Check basic consistency
            has_required_cols = all(col in df.columns for col in
                                   ['make', 'model', 'year', 'mileage', 'price',
                                    'engine_size', 'cylinders', 'condition', 'fuel_type', 'location'])

            self.log_result(
                "Data Consistency",
                has_required_cols,
                f"Required columns present: {has_required_cols}, Total rows: {len(df)}"
            )
            return has_required_cols
        except Exception as e:
            self.log_result("Data Consistency", False, str(e), 0)
            return False

    def test_prediction_accuracy(self, car_data: dict, expected_range: tuple = None):
        """Test prediction accuracy"""
        try:
            start = time.time()
            prediction = predict_price(car_data)
            duration = time.time() - start

            # Handle array return
            if isinstance(prediction, np.ndarray):
                prediction = float(prediction[0]) if len(prediction) > 0 else 0.0
            elif isinstance(prediction, (list, tuple)):
                prediction = float(prediction[0]) if len(prediction) > 0 else 0.0
            else:
                prediction = float(prediction)

            # Validate prediction is reasonable
            is_valid = 1000 <= prediction <= 200000

            # Check against actual market price
            df = pd.read_csv(self.csv_file)
            make = car_data.get('make', '')
            model = car_data.get('model', '')
            year = car_data.get('year', 0)

            similar_cars = df[
                (df['make'] == make) &
                (df['model'] == model) &
                (df['year'] == year)
            ]

            accuracy_msg = ""
            is_accurate = True

            if len(similar_cars) > 0:
                avg_price = similar_cars['price'].mean()
                diff_pct = abs(prediction - avg_price) / avg_price * 100
                accuracy_msg = f"Predicted: ${prediction:,.2f}, Avg Market: ${avg_price:,.2f}, Diff: {diff_pct:.1f}%"

                # Consider accurate if within 15%
                is_accurate = diff_pct <= 15
            else:
                accuracy_msg = f"Predicted: ${prediction:,.2f} (no similar cars in dataset)"

            car_desc = f"{make} {model} {year}"
            self.log_result(
                f"Prediction ({car_desc})",
                is_valid and is_accurate,
                accuracy_msg,
                duration
            )

            return is_valid and is_accurate, duration
        except Exception as e:
            car_desc = f"{car_data.get('make', 'Unknown')} {car_data.get('model', 'Unknown')}"
            self.log_result(f"Prediction ({car_desc})", False, str(e), 0)
            return False, 0

    def test_feature_preparation(self, car_data: dict):
        """Test feature preparation"""
        try:
            from core.predict_price import prepare_features, _get_cached_model

            # Get cached model data
            (model, features, model_name, make_encoder, model_encoder,
             target_transform, transform_offset, poly_transformer,
             numeric_cols_for_poly, original_features, make_popularity_map,
             scaler, encoders, luxury_brands, premium_brands,
             brand_reliability, price_range_models) = _get_cached_model()

            # Prepare features
            X = prepare_features(
                car_data, features, make_encoder, model_encoder,
                poly_transformer, numeric_cols_for_poly, original_features,
                make_popularity_map, encoders, luxury_brands, premium_brands,
                brand_reliability
            )

            # Check feature count matches
            features_match = X.shape[1] == len(features)

            self.log_result(
                f"Feature Preparation ({car_data.get('make', 'Unknown')})",
                features_match,
                f"Expected: {len(features)}, Got: {X.shape[1]}"
            )
            return features_match
        except Exception as e:
            self.log_result(
                f"Feature Preparation ({car_data.get('make', 'Unknown')})",
                False,
                str(e)
            )
            return False

    def generate_test_cars(self, n: int = 20):
        """Generate diverse test cars from dataset"""
        df = pd.read_csv(self.csv_file)

        # Ensure we have diverse samples
        test_cars = []

        # Sample from different makes
        makes = df['make'].value_counts().head(10).index.tolist()
        cars_per_make = max(1, n // len(makes))

        for make in makes:
            make_cars = df[df['make'] == make]
            if len(make_cars) > 0:
                sampled = make_cars.sample(min(cars_per_make, len(make_cars)), random_state=42)
                for _, row in sampled.iterrows():
                    car = {
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
                    test_cars.append(car)
                    if len(test_cars) >= n:
                        break
            if len(test_cars) >= n:
                break

        return test_cars[:n]

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("=" * 80)
        print("DIRECT INTEGRATION TESTING (No API Server Required)")
        print("=" * 80)
        print()

        # Basic tests
        print("1. Core Component Tests")
        print("-" * 80)
        model_loaded = self.test_model_loading()
        dataset_loaded = self.test_dataset_loading()
        self.test_data_consistency()
        print()

        if not model_loaded or not dataset_loaded:
            print("ERROR: Core components not loaded. Cannot continue tests.")
            return False

        # Feature preparation tests
        print("2. Feature Preparation Tests")
        print("-" * 80)
        test_cars = self.generate_test_cars(5)
        for car in test_cars:
            self.test_feature_preparation(car)
        print()

        # Prediction tests
        print("3. Prediction Accuracy Tests (20 cars)")
        print("-" * 80)
        test_cars = self.generate_test_cars(20)
        prediction_times = []
        passed_predictions = 0

        for car in test_cars:
            passed, duration = self.test_prediction_accuracy(car)
            if passed:
                passed_predictions += 1
            if duration > 0:
                prediction_times.append(duration)

        avg_prediction_time = np.mean(prediction_times) if prediction_times else 0
        print(f"\nPrediction Summary: {passed_predictions}/20 passed")
        print(f"Average prediction time: {avg_prediction_time:.3f}s")
        print()

        # Performance tests
        print("4. Performance Tests")
        print("-" * 80)
        if prediction_times:
            self.log_result(
                "Prediction Speed",
                avg_prediction_time < 1.0,
                f"Average: {avg_prediction_time:.3f}s (target: <1.0s)"
            )

        # Test model loading speed
        load_times = []
        for _ in range(3):
            start = time.time()
            try:
                load_model()
                load_times.append(time.time() - start)
            except:
                pass

        if load_times:
            avg_load_time = np.mean(load_times)
            self.log_result(
                "Model Loading Speed (cached)",
                avg_load_time < 0.1,
                f"Average: {avg_load_time:.3f}s (target: <0.1s for cached)"
            )
        print()

        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['passed'])
        failed_tests = total_tests - passed_tests

        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {passed_tests/total_tests*100:.1f}%")
        print()

        # Failed tests
        if failed_tests > 0:
            print("Failed Tests:")
            for result in self.results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['message']}")

        return passed_tests == total_tests

if __name__ == "__main__":
    tester = DirectTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
