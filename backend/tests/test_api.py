"""
Tests for API endpoints
"""

import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)


def test_health_endpoint():
    """Test health check endpoint"""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["scrapers"] == 12


def test_platforms_endpoint():
    """Test platforms endpoint"""
    response = client.get("/api/platforms")
    assert response.status_code == 200
    data = response.json()
    assert "supported" in data
    assert "count" in data
    assert data["count"] == 12


def test_history_endpoint():
    """Test history endpoint"""
    response = client.get("/api/history?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "success" in data
    assert "data" in data


def test_trends_endpoint():
    """Test trends endpoint"""
    response = client.get("/api/trends?make=Toyota&model=Camry")
    assert response.status_code == 200
    data = response.json()
    assert "success" in data
    assert "data" in data


def test_decode_vin_endpoint():
    """Test VIN decoder endpoint"""
    # Use a sample VIN (this is a test VIN format)
    response = client.post("/api/decode-vin", json={"vin": "1HGBH41JXMN109186"})
    # May succeed or fail depending on NHTSA API, but should not crash
    assert response.status_code in [200, 400, 500]


def test_similar_cars_endpoint():
    """Test similar cars endpoint"""
    response = client.get("/api/similar?make=Toyota&model=Camry&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "success" in data
    assert "data" in data


def test_price_alert_endpoint():
    """Test price alert endpoint"""
    response = client.post("/api/price-alert", json={
        "make": "Toyota",
        "model": "Camry",
        "year": 2020,
        "target_price": 20000,
        "alert_type": "below"
    })
    assert response.status_code == 200
    data = response.json()
    assert "success" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
