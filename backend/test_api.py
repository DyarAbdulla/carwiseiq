"""
Test script for the Car Price Predictor API
Tests the /api/predict/from-url endpoint
"""

import requests
import json

API_BASE_URL = "http://localhost:8000"

def test_health():
    """Test the health endpoint"""
    print("Testing /api/health...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/health", timeout=5)
        response.raise_for_status()
        print(f"[OK] Health check passed: {response.json()}")
        return True
    except Exception as e:
        print(f"[ERROR] Health check failed: {e}")
        return False

def test_predict_from_url():
    """Test the predict from URL endpoint"""
    print("\nTesting /api/predict/from-url...")
    
    test_url = "https://www.cars.com/vehicledetail/detail/123456/overview/"
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/predict/from-url",
            json={"url": test_url},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("\n[OK] Request succeeded!")
            print("\nResponse:")
            print(json.dumps(data, indent=2))
            
            # Check response structure
            if data.get("success") and data.get("data"):
                car_data = data["data"]
                print(f"\n[OK] Car: {car_data.get('make')} {car_data.get('model')} ({car_data.get('year')})")
                print(f"[OK] Predicted Price: ${car_data.get('predicted_price'):,.2f}")
                print(f"[OK] Listing Price: ${car_data.get('listing_price'):,.2f}" if car_data.get('listing_price') else "[OK] No listing price")
                print(f"[OK] Confidence: {car_data.get('confidence')}%")
                print(f"[OK] Deal Quality: {car_data.get('deal_quality')}")
                print(f"[OK] Platform: {car_data.get('platform')}")
            else:
                print("[WARNING] Response structure unexpected")
            
            return True
        else:
            print(f"\n[ERROR] Request failed with status {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Error: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("[ERROR] Connection error: Could not connect to the API.")
        print("  Make sure the backend server is running on http://localhost:8000")
        return False
    except requests.exceptions.Timeout:
        print("[ERROR] Request timed out")
        return False
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_platforms():
    """Test the platforms endpoint"""
    print("\nTesting /api/platforms...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/platforms", timeout=5)
        response.raise_for_status()
        data = response.json()
        print(f"[OK] Supported platforms: {data.get('supported', [])}")
        print(f"[OK] Total platforms: {data.get('count', 0)}")
        return True
    except Exception as e:
        print(f"[ERROR] Platforms check failed: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Car Price Predictor API Test Script")
    print("=" * 60)
    
    # Test health endpoint
    health_ok = test_health()
    
    if not health_ok:
        print("\n[WARNING] Health check failed. Make sure the backend is running.")
        print("  Run: cd backend && python main.py")
        exit(1)
    
    # Test platforms endpoint
    test_platforms()
    
    # Test predict from URL
    success = test_predict_from_url()
    
    print("\n" + "=" * 60)
    if success:
        print("[SUCCESS] All tests completed!")
    else:
        print("[FAILED] Some tests failed")
    print("=" * 60)
