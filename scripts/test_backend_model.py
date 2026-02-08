"""
Test Backend Model Loading
Verifies production_model.pkl loads correctly and can make predictions
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

def test_model_loading():
    """Test that model loads correctly"""
    print("=" * 80)
    print("TESTING BACKEND MODEL LOADING")
    print("=" * 80)
    
    try:
        from app.core.predict_price import load_model, predict_price
        
        print("\n1. Testing model loading...")
        model, model_info, encoders = load_model()
        print(f"   [OK] Model loaded: {type(model).__name__}")
        print(f"   [OK] Model info keys: {list(model_info.keys())}")
        print(f"   [OK] Encoders: {list(encoders.keys()) if encoders else 'None'}")
        
        # Check accuracy
        if 'metrics' in model_info:
            test_r2 = model_info['metrics'].get('test', {}).get('r2', 'N/A')
            print(f"   [OK] Model accuracy (R²): {test_r2}")
        
        print("\n2. Testing prediction...")
        test_car = {
            "year": 2020,
            "mileage": 50000,
            "engine_size": 2.5,
            "cylinders": 4,
            "make": "Toyota",
            "model": "Camry",
            "condition": "Good",
            "fuel_type": "Gasoline",
            "location": "Baghdad"
        }
        
        prediction = predict_price(test_car)
        print(f"   [OK] Prediction successful: ${prediction:,.2f}")
        
        # Validate prediction
        if 500 <= prediction <= 300000:
            print(f"   [OK] Price is in valid range")
        else:
            print(f"   [WARNING] Price outside valid range: ${prediction:,.2f}")
        
        print("\n" + "=" * 80)
        print("[OK] ALL TESTS PASSED")
        print("=" * 80)
        return True
        
    except Exception as e:
        print(f"\n[ERROR] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_model_loading()
    sys.exit(0 if success else 1)
