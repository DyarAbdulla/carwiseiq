@echo off
REM Quick start script for Car Price Predictor Pro

echo ========================================
echo Starting Car Price Predictor Pro...
echo ========================================
echo.

REM Check if streamlit is installed
py -c "import streamlit" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Streamlit is not installed
    echo Please run INSTALL.bat first to install dependencies
    pause
    exit /b 1
)

REM Run the app
echo [INFO] Starting Streamlit application...
echo [INFO] The app will open in your default browser
echo [INFO] Press Ctrl+C to stop the server
echo.
py -m streamlit run app.py

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start the application
    echo Please check the error messages above
    pause
)
