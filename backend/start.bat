@echo off
echo ========================================
echo Starting Car Price Predictor Backend
echo ========================================
echo.

cd /d "%~dp0"

echo Activating virtual environment...
call venv\Scripts\activate.bat

if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    echo Make sure you've created the venv first:
    echo   python -m venv venv
    pause
    exit /b 1
)

echo.
echo Starting FastAPI server...
echo Server will be available at: http://localhost:8000
echo Press Ctrl+C to stop the server
echo.

python main.py
