"""
Test script for URL prediction feature
Tests the /api/predict/from-url endpoint with an iqcars.net URL
"""

import requests
import json
import sys
import io

# Fix encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Backend API URL
API_BASE_URL = "http://localhost:8000"
ENDPOINT = f"{API_BASE_URL}/api/predict/from-url"

def test_url_prediction(url: str):
    """Test the URL prediction endpoint"""
    print(f"\n{'='*60}")
    print("Testing URL Prediction Feature")
    print(f"{'='*60}\n")

    print(f"🔗 Testing URL: {url}")
    print(f"📡 Endpoint: {ENDPOINT}\n")

    try:
        # Make request
        print("⏳ Sending request to backend...")
        response = requests.post(
            ENDPOINT,
            json={"url": url},
            timeout=30
        )

        print(f"📊 Status Code: {response.status_code}\n")

        if response.status_code == 200:
            data = response.json()
            print("✅ SUCCESS! Response received:\n")
            print(json.dumps(data, indent=2))

            # Validate response structure
            print("\n" + "="*60)
            print("Response Validation:")
            print("="*60)

            required_fields = [
                'extracted_data',
                'predicted_price',
            ]

            for field in required_fields:
                if field in data:
                    print(f"✅ {field}: Present")
                else:
                    print(f"❌ {field}: Missing")

            # Check extracted data
            if 'extracted_data' in data:
                extracted = data['extracted_data']
                print("\n📋 Extracted Car Details:")
                print(f"  - Make: {extracted.get('make', 'N/A')}")
                print(f"  - Model: {extracted.get('model', 'N/A')}")
                print(f"  - Year: {extracted.get('year', 'N/A')}")
                print(f"  - Mileage: {extracted.get('mileage', 'N/A')} km")
                print(f"  - Condition: {extracted.get('condition', 'N/A')}")
                print(f"  - Fuel Type: {extracted.get('fuel_type', 'N/A')}")
                print(f"  - Engine Size: {extracted.get('engine_size', 'N/A')}L")
                print(f"  - Cylinders: {extracted.get('cylinders', 'N/A')}")
                print(f"  - Location: {extracted.get('location', 'N/A')}")

            # Check predicted price
            if 'predicted_price' in data:
                print(f"\n💰 Predicted Price: ${data['predicted_price']:,.2f}")

            # Check listing price comparison
            if 'listing_price' in data and data['listing_price']:
                print(f"💵 Listing Price: ${data['listing_price']:,.2f}")
                if 'price_comparison' in data:
                    comp = data['price_comparison']
                    print(f"📊 Price Difference: ${comp.get('difference', 0):,.2f} ({comp.get('difference_percent', 0):.1f}%)")

            # Check confidence interval
            if 'confidence_interval' in data:
                ci = data['confidence_interval']
                print(f"📈 Confidence Range: ${ci.get('lower', 0):,.2f} - ${ci.get('upper', 0):,.2f}")

            if 'message' in data and data['message']:
                print(f"\n💬 Message: {data['message']}")

            print("\n" + "="*60)
            print("✅ Test completed successfully!")
            print("="*60 + "\n")
            return True

        else:
            print(f"❌ ERROR! Status Code: {response.status_code}")
            print(f"Response: {response.text}\n")
            return False

    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Could not connect to backend server!")
        print(f"   Make sure the backend is running on {API_BASE_URL}")
        print("   Start it with: cd backend && uvicorn app.main:app --reload\n")
        return False
    except requests.exceptions.Timeout:
        print("❌ ERROR: Request timed out!")
        print("   The URL might be taking too long to scrape.\n")
        return False
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {str(e)}\n")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Default test URL (replace with actual iqcars.net URL)
    test_url = "https://www.iqcars.net/en/car/..."

    # Allow URL to be passed as command line argument
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
    else:
        print("⚠️  No URL provided. Using placeholder URL.")
        print("   Usage: python test_url_prediction.py <iqcars.net-url>")
        print("   Example: python test_url_prediction.py https://www.iqcars.net/en/car/12345\n")

    success = test_url_prediction(test_url)
    sys.exit(0 if success else 1)
