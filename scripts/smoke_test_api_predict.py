"""
Smoke Test API Predict Endpoint
Sends POST to /api/predict and verifies 200 OK response
"""

import requests
import json
import sys

def test_api_predict():
    """Test /api/predict endpoint"""
    url = "http://127.0.0.1:8000/api/predict"
    
    # Test car data
    test_car = {
        "features": {
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
    }
    
    print("=" * 80)
    print("SMOKE TEST: /api/predict")
    print("=" * 80)
    print(f"\nSending POST to {url}")
    print(f"Request body:")
    print(json.dumps(test_car, indent=2))
    
    try:
        response = requests.post(url, json=test_car, timeout=10)
        
        print(f"\n{'='*80}")
        print("RESPONSE")
        print(f"{'='*80}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Status: 200 OK")
            try:
                data = response.json()
                print(f"\nResponse JSON:")
                print(json.dumps(data, indent=2))
                
                # Check for prediction
                if 'prediction' in data or 'price' in data:
                    pred = data.get('prediction') or data.get('price')
                    print(f"\n✅ Prediction received: ${pred:,.2f}")
                    
                    # Verify price is realistic
                    if 500 <= float(pred) <= 300000:
                        print("✅ Price is in valid range ($500 - $300,000)")
                    else:
                        print(f"⚠️ Price outside valid range: ${pred:,.2f}")
                else:
                    print("⚠️ No prediction field in response")
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON: {e}")
                print(f"Response text: {response.text[:500]}")
                return False
        else:
            print(f"❌ Status: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        print(f"\n{'='*80}")
        print("✅ SMOKE TEST PASSED")
        print(f"{'='*80}")
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Connection error: Backend not running?")
        print("   Start backend with: cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_api_predict()
    sys.exit(0 if success else 1)
