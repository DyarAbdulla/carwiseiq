#!/bin/bash

# Server Status Checker for Car Price Predictor
# This script checks if both frontend and backend servers are running

echo "========================================"
echo "Car Price Predictor - Server Status"
echo "========================================"
echo ""

# Check Backend (Port 8000)
echo "Checking Backend Server (Port 8000)..."
if curl -s -f http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✓ Backend is RUNNING"
    curl -s http://localhost:8000/api/health | python3 -m json.tool 2>/dev/null || echo "  (Health check endpoint responded)"
else
    echo "✗ Backend is NOT RUNNING"
    echo ""
    echo "To start backend:"
    echo "  cd backend"
    echo "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
fi

echo ""

# Check Frontend (Port 3000)
echo "Checking Frontend Server (Port 3000)..."
if curl -s -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Frontend is RUNNING"
else
    echo "✗ Frontend is NOT RUNNING"
    echo ""
    echo "To start frontend:"
    echo "  cd frontend"
    echo "  npm run dev"
fi

echo ""
echo "========================================"
echo "Diagnostic Complete"
echo "========================================"

