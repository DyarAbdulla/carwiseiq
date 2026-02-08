#!/bin/bash
# Quick start script for Car Price Predictor Pro (Linux/Mac)

echo "========================================"
echo "Starting Car Price Predictor Pro..."
echo "========================================"
echo

# Check if streamlit is installed
python3 -c "import streamlit" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "[ERROR] Streamlit is not installed"
    echo "Please run ./install.sh first to install dependencies"
    exit 1
fi

# Run the app
echo "[INFO] Starting Streamlit application..."
echo "[INFO] The app will open in your default browser"
echo "[INFO] Press Ctrl+C to stop the server"
echo
streamlit run app.py
