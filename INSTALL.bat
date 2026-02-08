@echo off
REM Installation script for Car Price Predictor Pro
REM This script installs all dependencies needed to run the app

echo ========================================
echo Car Price Predictor Pro - Installation
echo ========================================
echo.

REM Check if Python is installed
py --version >nul 2>&1
if errorlevel 1 (
    python --version >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Python is not installed or not in PATH
        echo Please install Python 3.8 or higher from https://www.python.org/downloads/
        pause
        exit /b 1
    )
    set PYTHON_CMD=python
) else (
    set PYTHON_CMD=py
)

echo [OK] Python found
%PYTHON_CMD% --version
echo.

REM Check if pip is available
%PYTHON_CMD% -m pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pip is not available
    echo Please install pip or use: %PYTHON_CMD% -m ensurepip --upgrade
    pause
    exit /b 1
)

echo [OK] pip is available
echo.

REM Upgrade pip first
echo [INFO] Upgrading pip...
%PYTHON_CMD% -m pip install --upgrade pip
echo.

REM Install dependencies
echo [INFO] Installing dependencies from requirements.txt...
%PYTHON_CMD% -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation completed successfully!
echo ========================================
echo.
echo To run the application, use:
echo   py -m streamlit run app.py
echo.
echo Or double-click RUN_APP.bat
echo.
pause

