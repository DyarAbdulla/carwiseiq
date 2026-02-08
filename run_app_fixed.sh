#!/bin/bash
echo "Starting Car Price Predictor Web App..."
echo ""
cd "$(dirname "$0")/.."
streamlit run app/app.py

