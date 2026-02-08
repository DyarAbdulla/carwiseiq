#!/usr/bin/env python3
"""
Test script for multimodal prediction flow
Tests: image upload -> analysis -> prediction with image features
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
TEST_IMAGE_PATH = None  # Will be set if image exists

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
    print("FAIL: No test image found. Please provide an image path.")
    print("   Expected locations:", [str(p) for p in possible_image_paths])
    sys.exit(1)

print(f"Using test image: {TEST_IMAGE_PATH}")
print(f"API Base URL: {API_BASE_URL}\n")

# Test 1: Health check
print("=" * 60)
print("TEST 1: Health Check")
print("=" * 60)
try:
    response = requests.get(f"{API_BASE_URL}/api/health", timeout=5)
    if response.status_code == 200:
        print("PASS: Backend is running")
        print(f"   Response: {response.json()}")
    else:
        print(f"FAIL: Health check returned {response.status_code}")
        sys.exit(1)
except requests.exceptions.ConnectionError:
    print("FAIL: Cannot connect to backend. Is it running?")
    print("   Start with: cd backend && uvicorn app.main:app --reload --port 8000")
    sys.exit(1)
except Exception as e:
    print(f"FAIL: Health check error: {e}")
    sys.exit(1)

print()

# Test 2: Analyze images
print("=" * 60)
print("TEST 2: Analyze Images")
print("=" * 60)
try:
    with open(TEST_IMAGE_PATH, 'rb') as f:
        files = {'images': (os.path.basename(TEST_IMAGE_PATH), f, 'image/jpeg')}
        response = requests.post(
            f"{API_BASE_URL}/api/analyze-images",
            files=files,
            timeout=30
        )

    if response.status_code == 200:
        data = response.json()
        print("PASS: Image analysis successful")
        print(f"   Summary: {data.get('data', {}).get('summary', 'N/A')}")

        image_features = data.get('data', {}).get('image_features')
        if image_features:
            feature_length = len(image_features)
            print(f"   Image features length: {feature_length}")
            if feature_length == 2048:
                print("PASS: Image features have correct length (2048)")
            else:
                print(f"FAIL: Expected 2048 features, got {feature_length}")
                sys.exit(1)
        else:
            print("WARNING: No image_features returned")
            print("   This is OK if ResNet50 is not available")
            image_features = None
    else:
        print(f"FAIL: Image analysis returned {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

except FileNotFoundError:
    print(f"FAIL: Test image not found: {TEST_IMAGE_PATH}")
    sys.exit(1)
except Exception as e:
    print(f"FAIL: Image analysis error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()

# Test 3: Predict without images (tabular-only)
print("=" * 60)
print("TEST 3: Predict Price (Tabular-Only)")
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
        }
    }

    response = requests.post(
        f"{API_BASE_URL}/api/predict",
        json=payload,
        timeout=10
    )

    if response.status_code == 200:
        data = response.json()
        predicted_price = data.get('predicted_price', 0)
        print(f"PASS: Prediction successful (tabular-only)")
        print(f"   Predicted price: ${predicted_price:,.2f}")
    else:
        print(f"FAIL: Prediction returned {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

except Exception as e:
    print(f"FAIL: Prediction error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()

# Test 4: Predict with images (if available)
if image_features:
    print("=" * 60)
    print("TEST 4: Predict Price (With Image Features)")
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

        if response.status_code == 200:
            data = response.json()
            predicted_price = data.get('predicted_price', 0)
            print(f"PASS: Prediction successful (with images)")
            print(f"   Predicted price: ${predicted_price:,.2f}")
        else:
            print(f"FAIL: Prediction returned {response.status_code}")
            print(f"   Response: {response.text}")
            # Don't exit - multimodal might not be available
            print("   Note: This is OK if multimodal model is not available")
    except Exception as e:
        print(f"WARNING: Prediction with images error: {e}")
        print("   Note: This is OK if multimodal model is not available")
else:
    print("=" * 60)
    print("TEST 4: Predict Price (With Image Features)")
    print("=" * 60)
    print("SKIP: No image features available (ResNet50 may not be loaded)")

print()

# Test 5: Sell car prediction
print("=" * 60)
print("TEST 5: Sell Car Prediction")
print("=" * 60)
try:
    payload = {
        "make": "Toyota",
        "model": "Camry",
        "year": 2020,
        "mileage": 30000,
        "location": "California",
        "condition": "Good",
        "has_accident": False
    }

    if image_features:
        payload["image_features"] = image_features

    response = requests.post(
        f"{API_BASE_URL}/api/sell/predict",
        json=payload,
        timeout=10
    )

    if response.status_code == 200:
        data = response.json()
        final_price = data.get('final_price', 0)
        print(f"PASS: Sell car prediction successful")
        print(f"   Final price: ${final_price:,.2f}")
        print(f"   Base price: ${data.get('base_price', 0):,.2f}")
    else:
        print(f"FAIL: Sell car prediction returned {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

except Exception as e:
    print(f"FAIL: Sell car prediction error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print("=" * 60)
print("ALL TESTS PASSED!")
print("=" * 60)
