@echo off
REM Car Price Predictor - Complete Pipeline Execution Script (Windows)
REM This script runs the entire data processing and model training pipeline

echo ==========================================
echo Car Price Predictor - Pipeline Execution
echo ==========================================
echo.

REM Step 1: Data Cleaning
echo Step 1: Data Cleaning...
python data_cleaning.py
if errorlevel 1 (
    echo [ERROR] Data cleaning failed
    exit /b 1
)
echo [OK] Data cleaning completed
echo.

REM Step 2: Data Visualization
echo Step 2: Generating Visualizations...
python data_visualization.py
if errorlevel 1 (
    echo [ERROR] Visualization generation failed
    exit /b 1
)
echo [OK] Visualizations generated
echo.

REM Step 3: Model Training
echo Step 3: Training Models...
python model_training.py
if errorlevel 1 (
    echo [ERROR] Model training failed
    exit /b 1
)
echo [OK] Model training completed
echo.

REM Step 4: Test Prediction
echo Step 4: Testing Prediction...
python test_app_logic.py
if errorlevel 1 (
    echo [ERROR] Prediction test failed
    exit /b 1
)
echo [OK] Prediction test passed
echo.

echo ==========================================
echo Pipeline execution completed successfully!
echo ==========================================
echo.
echo Next steps:
echo   1. Review results in evaluation_reports/
echo   2. Check visualizations in visualizations/
echo   3. Run web app: streamlit run app.py
echo.

pause










