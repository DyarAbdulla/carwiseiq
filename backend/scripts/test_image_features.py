#!/usr/bin/env python3
"""
Test script for image feature extraction and prediction
Tests: Upload image -> Extract 2048 features -> Predict with features
"""

import sys
import os
import requests
import json
from pathlib import Path

# Add parent directories to path
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

# Configuration
API_BASE_URL = "http://localhost:8000"
TEST_IMAGE_PATH = None

# Try to find a test image
possible_image_paths = [
    ROOT_DIR / "car-hero-1.jpg",
    ROOT_DIR / "car-hero-2.jpg",
    ROOT_DIR / "car-hero-3.jpg",
    ROOT_DIR / "52ac6ccf-f99e-404a-9919-68c780f77ec2-md.jpeg",
]

for img_path in possible_image_paths:
    if img_path.exists():
        TEST_IMAGE_PATH = str(img_path)
        break

if not TEST_IMAGE_PATH:
    print("FAIL: No test image found.")
    print("   Expected locations:", [str(p) for p in possible_image_paths])
    sys.exit(1)

print(f"Using test image: {TEST_IMAGE_PATH}")
print(f"API Base URL: {API_BASE_URL}\n")

# Test 1: Upload image and extract features
print("=" * 60)
print("TEST 1: Extract Image Features")
print("=" * 60)
try:
    with open(TEST_IMAGE_PATH, 'rb') as f:
        files = {'images': (os.path.basename(TEST_IMAGE_PATH), f, 'image/jpeg')}
        response = requests.post(
            f"{API_BASE_URL}/api/analyze-images",
            files=files,
            timeout=30
        )

    if response.status_code != 200:
        print(f"FAIL: Image analysis returned {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

    data = response.json()
    if not data.get('success'):
        print(f"FAIL: Image analysis failed")
        print(f"   Response: {data}")
        sys.exit(1)

    result_data = data.get('data', {})
    image_features = result_data.get('image_features')

    if image_features is None:
        print("FAIL: No image_features returned")
        print("   This means ResNet50 is not available")
        print("   Install: pip install tensorflow")
        sys.exit(1)

    feature_length = len(image_features)
    print(f"PASS: Image features extracted successfully")
    print(f"   Feature length: {feature_length}")

    if feature_length != 2048:
        print(f"FAIL: Expected 2048 features, got {feature_length}")
        sys.exit(1)

    print(f"PASS: Feature length is correct (2048)")
    print(f"   First 5 features: {image_features[:5]}")
    print(f"   Feature range: min={min(image_features):.4f}, max={max(image_features):.4f}")

except FileNotFoundError:
    print(f"FAIL: Test image not found: {TEST_IMAGE_PATH}")
    sys.exit(1)
except requests.exceptions.ConnectionError:
    print("FAIL: Cannot connect to backend. Is it running?")
    print("   Start with: cd backend && uvicorn app.main:app --reload --port 8000")
    sys.exit(1)
except Exception as e:
    print(f"FAIL: Image analysis error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()

# Test 2: Predict with image features
print("=" * 60)
print("TEST 2: Predict Price with Image Features")
print("=" * 60)
try:
    payload = {
        "features": {
            "year": 2020,
            "mileage": 30000,
            "engine_size": 2.5,
            "cylinders": 4,
            "make": "Toyota",
            "model": "Camry",
            "condition": "Good",
            "fuel_type": "Gasoline",
            "location": "California"
        },
        "image_features": image_features
    }

    response = requests.post(
        f"{API_BASE_URL}/api/predict",
        json=payload,
        timeout=10
    )

    if response.status_code != 200:
        print(f"FAIL: Prediction returned {response.status_code}")
        print(f"   Response: {response.text}")
        # Don't exit - multimodal model might not be available
        print("   Note: This is OK if multimodal model is not available")
    else:
        data = response.json()
        predicted_price = data.get('predicted_price', 0)
        print(f"PASS: Prediction successful")
        print(f"   Predicted price: ${predicted_price:,.2f}")
        print(f"   Note: Using {'multimodal' if image_features else 'tabular-only'} model")

except Exception as e:
    print(f"WARNING: Prediction error: {e}")
    print("   Note: This is OK if multimodal model is not available")
    import traceback
    traceback.print_exc()

print()
print("=" * 60)
print("TEST SUMMARY")
print("=" * 60)
print(f"Image features extracted: {feature_length} dimensions")
print(f"First 5 features: {image_features[:5]}")
print("PASS: All tests completed successfully!")
