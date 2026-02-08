"""
Test script to verify app logic without Streamlit
This helps identify any logical errors before running the full app
"""

import pandas as pd
import numpy as np
from predict_price import load_model, predict_price

def test_model_loading():
    """Test if model loads correctly"""
    print("Testing model loading...")
    try:
        model, features, model_name, make_encoder, model_encoder = load_model()
        print(f"[OK] Model loaded: {model_name}")
        print(f"[OK] Features: {len(features)} features")
        return True
    except Exception as e:
        print(f"[ERROR] Error loading model: {e}")
        return False

def test_data_loading():
    """Test if data loads correctly"""
    print("\nTesting data loading...")
    try:
        df = pd.read_csv('cleaned_car_data.csv')
        print(f"[OK] Data loaded: {len(df)} rows, {len(df.columns)} columns")
        
        # Check required columns
        required_cols = ['make', 'model', 'year', 'mileage', 'price', 'condition', 'fuel_type']
        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            print(f"[ERROR] Missing columns: {missing}")
            return False
        else:
            print("[OK] All required columns present")
            return True
    except Exception as e:
        print(f"[ERROR] Error loading data: {e}")
        return False

def test_prediction():
    """Test if prediction works"""
    print("\nTesting prediction...")
    try:
        car_data = {
            'year': 2020,
            'mileage': 30000,
            'engine_size': 2.5,
            'cylinders': 4,
            'make': 'Toyota',
            'model': 'Camry',
            'condition': 'Good',
            'fuel_type': 'Gasoline',
            'location': 'California'
        }
        
        price, confidence = predict_price(car_data, return_confidence=True)
        predicted_price = price[0] if isinstance(price, np.ndarray) else price
        print(f"[OK] Prediction successful: ${predicted_price:,.2f}")
        print(f"[OK] Confidence interval: ${confidence['lower_95'][0]:,.2f} - ${confidence['upper_95'][0]:,.2f}")
        return True
    except Exception as e:
        print(f"[ERROR] Error making prediction: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_data_statistics():
    """Test data statistics calculations"""
    print("\nTesting data statistics...")
    try:
        df = pd.read_csv('cleaned_car_data.csv')
        
        # Test metrics
        total = len(df)
        avg_price = df['price'].mean()
        median_price = df['price'].median()
        year_range = f"{int(df['year'].min())} - {int(df['year'].max())}"
        
        print(f"[OK] Total cars: {total:,}")
        print(f"[OK] Average price: ${avg_price:,.2f}")
        print(f"[OK] Median price: ${median_price:,.2f}")
        print(f"[OK] Year range: {year_range}")
        
        # Test chart data
        top_makes = df['make'].value_counts().head(10)
        fuel_dist = df['fuel_type'].value_counts()
        price_by_year = df.groupby('year')['price'].mean()
        
        print(f"[OK] Top makes calculated: {len(top_makes)}")
        print(f"[OK] Fuel types: {len(fuel_dist)}")
        print(f"[OK] Price by year: {len(price_by_year)} years")
        
        return True
    except Exception as e:
        print(f"[ERROR] Error calculating statistics: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Testing Car Price Predictor App Logic")
    print("=" * 60)
    
    results = []
    results.append(("Model Loading", test_model_loading()))
    results.append(("Data Loading", test_data_loading()))
    results.append(("Prediction", test_prediction()))
    results.append(("Statistics", test_data_statistics()))
    
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    for test_name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{test_name}: {status}")
    
    all_passed = all(result for _, result in results)
    print("\n" + "=" * 60)
    if all_passed:
        print("[SUCCESS] All tests passed! App logic is correct.")
    else:
        print("[FAILURE] Some tests failed. Please check the errors above.")
    print("=" * 60)

