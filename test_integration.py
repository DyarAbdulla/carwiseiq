"""
Comprehensive Integration Testing Suite
Tests all components end-to-end
"""

import requests
import json
import time
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple

# Configuration
API_BASE_URL = "http://localhost:8000"
CSV_FILE = "cleaned_car_data.csv"

class IntegrationTester:
    def __init__(self):
        self.results = []
        self.errors = []

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

    def test_api_health(self) -> bool:
        """Test API health endpoint"""
        try:
            start = time.time()
            response = requests.get(f"{API_BASE_URL}/api/health", timeout=5)
            duration = time.time() - start

            if response.status_code == 200:
                data = response.json()
                model_loaded = data.get('model_loaded', False)
                dataset_loaded = data.get('dataset_loaded', False)

                self.log_result(
                    "API Health Check",
                    model_loaded and dataset_loaded,
                    f"Model: {model_loaded}, Dataset: {dataset_loaded}",
                    duration
                )
                return model_loaded and dataset_loaded
            else:
                self.log_result("API Health Check", False, f"Status: {response.status_code}", duration)
                return False
        except Exception as e:
            self.log_result("API Health Check", False, str(e), 0)
            return False

    def test_model_info(self) -> bool:
        """Test model info endpoint"""
        try:
            start = time.time()
            response = requests.get(f"{API_BASE_URL}/api/model-info", timeout=5)
            duration = time.time() - start

            if response.status_code == 200:
                data = response.json()
                model_name = data.get('model_name', 'Unknown')
                features_count = data.get('features_count', 0)

                self.log_result(
                    "Model Info",
                    features_count > 0,
                    f"Model: {model_name}, Features: {features_count}",
                    duration
                )
                return features_count > 0
            else:
                self.log_result("Model Info", False, f"Status: {response.status_code}", duration)
                return False
        except Exception as e:
            self.log_result("Model Info", False, str(e), 0)
            return False

    def test_makes_dropdown(self) -> bool:
        """Test makes dropdown"""
        try:
            start = time.time()
            response = requests.get(f"{API_BASE_URL}/api/cars/makes", timeout=5)
            duration = time.time() - start

            if response.status_code == 200:
                data = response.json()
                makes = data.get('makes', [])

                # Verify against CSV
                df = pd.read_csv(CSV_FILE)
                unique_makes = df['make'].unique().tolist()

                self.log_result(
                    "Makes Dropdown",
                    len(makes) > 0,
                    f"API: {len(makes)} makes, CSV: {len(unique_makes)} makes",
                    duration
                )
                return len(makes) > 0
            else:
                self.log_result("Makes Dropdown", False, f"Status: {response.status_code}", duration)
                return False
        except Exception as e:
            self.log_result("Makes Dropdown", False, str(e), 0)
            return False

    def test_models_dropdown(self, make: str = "Toyota") -> bool:
        """Test models dropdown for a make"""
        try:
            start = time.time()
            response = requests.get(f"{API_BASE_URL}/api/cars/models/{make}", timeout=5)
            duration = time.time() - start

            if response.status_code == 200:
                data = response.json()
                models = data.get('models', [])

                # Verify against CSV
                df = pd.read_csv(CSV_FILE)
                make_models = df[df['make'] == make]['model'].unique().tolist()

                self.log_result(
                    f"Models Dropdown ({make})",
                    len(models) > 0,
                    f"API: {len(models)} models, CSV: {len(make_models)} models",
                    duration
                )
                return len(models) > 0
            else:
                self.log_result(f"Models Dropdown ({make})", False, f"Status: {response.status_code}", duration)
                return False
        except Exception as e:
            self.log_result(f"Models Dropdown ({make})", False, str(e), 0)
            return False

    def test_trims_dropdown(self, make: str = "Toyota", model: str = "Camry") -> bool:
        """Test trims dropdown"""
        try:
            start = time.time()
            response = requests.get(f"{API_BASE_URL}/api/cars/trims/{make}/{model}", timeout=5)
            duration = time.time() - start

            if response.status_code == 200:
                data = response.json()
                trims = data.get('trims', [])

                # Verify against CSV
                df = pd.read_csv(CSV_FILE)
                make_model_trims = df[(df['make'] == make) & (df['model'] == model)]['trim'].dropna().unique().tolist()

                self.log_result(
                    f"Trims Dropdown ({make} {model})",
                    len(trims) > 0,
                    f"API: {len(trims)} trims, CSV: {len(make_model_trims)} trims",
                    duration
                )
                return len(trims) > 0
            else:
                self.log_result(f"Trims Dropdown ({make} {model})", False, f"Status: {response.status_code}", duration)
                return False
        except Exception as e:
            self.log_result(f"Trims Dropdown ({make} {model})", False, str(e), 0)
            return False

    def test_engine_sizes(self) -> bool:
        """Test engine sizes dropdown"""
        try:
            start = time.time()
            response = requests.get(f"{API_BASE_URL}/api/cars/engine-sizes", timeout=5)
            duration = time.time() - start

            if response.status_code == 200:
                data = response.json()
                engines = data.get('engines', [])

                self.log_result(
                    "Engine Sizes Dropdown",
                    len(engines) > 0,
                    f"Found {len(engines)} engine sizes",
                    duration
                )
                return len(engines) > 0
            else:
                self.log_result("Engine Sizes Dropdown", False, f"Status: {response.status_code}", duration)
                return False
        except Exception as e:
            self.log_result("Engine Sizes Dropdown", False, str(e), 0)
            return False

    def test_prediction(self, car_data: Dict) -> Tuple[bool, float]:
        """Test price prediction"""
        try:
            start = time.time()
            response = requests.post(
                f"{API_BASE_URL}/api/predict",
                json={"features": car_data},
                timeout=10
            )
            duration = time.time() - start

            if response.status_code == 200:
                data = response.json()
                predicted_price = data.get('predicted_price', 0)

                # Validate prediction is reasonable
                is_valid = 1000 <= predicted_price <= 200000

                # Check actual price from CSV if available
                df = pd.read_csv(CSV_FILE)
                make = car_data.get('make', '')
                model = car_data.get('model', '')
                year = car_data.get('year', 0)

                similar_cars = df[
                    (df['make'] == make) &
                    (df['model'] == model) &
                    (df['year'] == year)
                ]

                accuracy_msg = ""
                if len(similar_cars) > 0:
                    avg_price = similar_cars['price'].mean()
                    diff_pct = abs(predicted_price - avg_price) / avg_price * 100
                    accuracy_msg = f"Predicted: ${predicted_price:,.2f}, Avg Market: ${avg_price:,.2f}, Diff: {diff_pct:.1f}%"

                    # Consider accurate if within 15% (reasonable for car prices)
                    is_accurate = diff_pct <= 15
                else:
                    accuracy_msg = f"Predicted: ${predicted_price:,.2f} (no similar cars in dataset)"
                    is_accurate = is_valid

                self.log_result(
                    f"Prediction ({make} {model} {year})",
                    is_valid and is_accurate,
                    accuracy_msg,
                    duration
                )

                return is_valid and is_accurate, duration
            else:
                error_msg = response.text if hasattr(response, 'text') else f"Status: {response.status_code}"
                self.log_result(
                    f"Prediction ({car_data.get('make', 'Unknown')})",
                    False,
                    error_msg,
                    duration
                )
                return False, duration
        except Exception as e:
            self.log_result(
                f"Prediction ({car_data.get('make', 'Unknown')})",
                False,
                str(e),
                0
            )
            return False, 0

    def test_budget_finder(self, budget: float = 20000) -> bool:
        """Test budget finder"""
        try:
            start = time.time()
            response = requests.get(
                f"{API_BASE_URL}/api/budget/search",
                params={"budget": budget, "page": 1, "page_size": 10},
                timeout=10
            )
            duration = time.time() - start

            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                total = data.get('total', 0)

                self.log_result(
                    f"Budget Finder (${budget:,.0f})",
                    len(results) > 0,
                    f"Found {len(results)} results (total: {total})",
                    duration
                )
                return len(results) > 0
            else:
                error_msg = data.get('error', f"Status: {response.status_code}") if hasattr(response, 'json') else f"Status: {response.status_code}"
                self.log_result(f"Budget Finder (${budget:,.0f})", False, error_msg, duration)
                return False
        except Exception as e:
            self.log_result(f"Budget Finder (${budget:,.0f})", False, str(e), 0)
            return False

    def test_image_mapping(self, make: str, model: str, year: int, trim: str = "") -> bool:
        """Test image mapping"""
        try:
            start = time.time()
            response = requests.get(
                f"{API_BASE_URL}/api/cars/car-image",
                params={
                    "make": make,
                    "model": model,
                    "year": year,
                    "trim": trim
                },
                timeout=5
            )
            duration = time.time() - start

            if response.status_code == 200:
                data = response.json()
                image_path = data.get('image_path', '')

                is_valid = image_path != '' and ('car_images' in image_path or 'default' in image_path.lower())

                self.log_result(
                    f"Image Mapping ({make} {model} {year})",
                    is_valid,
                    f"Image: {image_path}",
                    duration
                )
                return is_valid
            else:
                self.log_result(f"Image Mapping ({make} {model} {year})", False, f"Status: {response.status_code}", duration)
                return False
        except Exception as e:
            self.log_result(f"Image Mapping ({make} {model} {year})", False, str(e), 0)
            return False

    def generate_test_cars(self, n: int = 20) -> List[Dict]:
        """Generate test car configurations from dataset"""
        df = pd.read_csv(CSV_FILE)
        test_cars = []

        # Sample diverse cars
        sampled = df.sample(min(n, len(df)), random_state=42)

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

        return test_cars

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("=" * 80)
        print("COMPREHENSIVE INTEGRATION TESTING")
        print("=" * 80)
        print()

        # Basic API tests
        print("1. API Health & Model Tests")
        print("-" * 80)
        self.test_api_health()
        self.test_model_info()
        print()

        # Dropdown tests
        print("2. Dropdown Population Tests")
        print("-" * 80)
        self.test_makes_dropdown()
        self.test_models_dropdown("Toyota")
        self.test_models_dropdown("Honda")
        self.test_trims_dropdown("Toyota", "Camry")
        self.test_trims_dropdown("Honda", "Accord")
        self.test_engine_sizes()
        print()

        # Prediction tests
        print("3. Prediction Tests (20 cars)")
        print("-" * 80)
        test_cars = self.generate_test_cars(20)
        prediction_times = []
        passed_predictions = 0

        for i, car in enumerate(test_cars, 1):
            passed, duration = self.test_prediction(car)
            if passed:
                passed_predictions += 1
            if duration > 0:
                prediction_times.append(duration)

        avg_prediction_time = np.mean(prediction_times) if prediction_times else 0
        print(f"\nPrediction Summary: {passed_predictions}/20 passed, Avg time: {avg_prediction_time:.3f}s")
        print()

        # Image mapping tests
        print("4. Image Mapping Tests")
        print("-" * 80)
        sample_cars = test_cars[:5]
        for car in sample_cars:
            self.test_image_mapping(
                car['make'],
                car['model'],
                car['year'],
                car.get('trim', '')
            )
        print()

        # Budget finder tests
        print("5. Budget Finder Tests")
        print("-" * 80)
        self.test_budget_finder(10000)
        self.test_budget_finder(20000)
        self.test_budget_finder(30000)
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

        # Performance summary
        durations = [r['duration'] for r in self.results if r['duration'] > 0]
        if durations:
            print("Performance Summary:")
            print(f"  Average Response Time: {np.mean(durations):.3f}s")
            print(f"  Max Response Time: {np.max(durations):.3f}s")
            print(f"  Min Response Time: {np.min(durations):.3f}s")
            print()

        # Failed tests
        if failed_tests > 0:
            print("Failed Tests:")
            for result in self.results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['message']}")

        return passed_tests == total_tests

if __name__ == "__main__":
    tester = IntegrationTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
