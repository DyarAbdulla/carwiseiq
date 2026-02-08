#!/bin/bash
# Installation script for Car Price Predictor Pro (Linux/Mac)
# This script installs all dependencies needed to run the app

echo "========================================"
echo "Car Price Predictor Pro - Installation"
echo "========================================"
echo

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed or not in PATH"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

echo "[OK] Python found"
python3 --version
echo

# Check if pip is available
if ! python3 -m pip --version &> /dev/null; then
    echo "[ERROR] pip is not available"
    echo "Please install pip or use: python3 -m ensurepip --upgrade"
    exit 1
fi

echo "[OK] pip is available"
echo

# Upgrade pip first
echo "[INFO] Upgrading pip..."
python3 -m pip install --upgrade pip
echo

# Install dependencies
echo "[INFO] Installing dependencies from requirements.txt..."
python3 -m pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies"
    exit 1
fi

echo
echo "========================================"
echo "Installation completed successfully!"
echo "========================================"
echo
echo "To run the application, use:"
echo "  streamlit run app.py"
echo
echo "Or run: ./run_app.sh"
echo




