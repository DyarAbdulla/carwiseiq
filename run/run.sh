#!/bin/bash

# Car Price Predictor - Complete Pipeline Execution Script
# This script runs the entire data processing and model training pipeline

set -e  # Exit on error

echo "=========================================="
echo "Car Price Predictor - Pipeline Execution"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Data Cleaning
echo -e "${BLUE}Step 1: Data Cleaning...${NC}"
python data_cleaning.py
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Data cleaning completed${NC}"
else
    echo -e "${YELLOW}✗ Data cleaning failed${NC}"
    exit 1
fi
echo ""

# Step 2: Data Visualization
echo -e "${BLUE}Step 2: Generating Visualizations...${NC}"
python data_visualization.py
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Visualizations generated${NC}"
else
    echo -e "${YELLOW}✗ Visualization generation failed${NC}"
    exit 1
fi
echo ""

# Step 3: Model Training
echo -e "${BLUE}Step 3: Training Models...${NC}"
python model_training.py
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Model training completed${NC}"
else
    echo -e "${YELLOW}✗ Model training failed${NC}"
    exit 1
fi
echo ""

# Step 4: Test Prediction
echo -e "${BLUE}Step 4: Testing Prediction...${NC}"
python test_app_logic.py
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Prediction test passed${NC}"
else
    echo -e "${YELLOW}✗ Prediction test failed${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo -e "${GREEN}Pipeline execution completed successfully!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review results in evaluation_reports/"
echo "  2. Check visualizations in visualizations/"
echo "  3. Run web app: streamlit run app.py"
echo ""










