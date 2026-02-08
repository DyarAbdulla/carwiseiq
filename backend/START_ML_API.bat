@echo off
echo ========================================
echo Starting ML Prediction API Server
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Python installation...
python --version
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

echo.
echo [2/3] Checking virtual environment...
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
)

echo Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)

echo.
echo [3/3] Installing/Updating dependencies...
pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo WARNING: Some dependencies may have failed to install
    echo Continuing anyway...
)

echo.
echo ========================================
echo Starting FastAPI Server
echo ========================================
echo.
echo Server will start on: http://localhost:8000
echo API Docs will be at: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.
set TF_ENABLE_ONEDNN_OPTS=0
set TF_CPP_MIN_LOG_LEVEL=2
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload ^
  --reload-exclude "__pycache__" --reload-exclude "*.pyc" --reload-exclude "logs" --reload-exclude "uploads" --reload-exclude "data" --reload-exclude "models" --reload-exclude "*.db" --reload-exclude ".git" --reload-exclude "venv" --reload-exclude ".venv" --reload-exclude ".env"

pause







