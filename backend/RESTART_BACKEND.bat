@echo off
echo ========================================
echo RESTARTING BACKEND SERVER
echo ========================================
echo.
echo Step 1: Stopping any running backend...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Step 2: Activating virtual environment...
cd /d "%~dp0"
if not exist venv\Scripts\Activate.ps1 (
    echo ERROR: Virtual environment not found!
    echo Please create it first: python -m venv venv
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo.
echo Step 3: Verifying bcrypt version...
python -c "import bcrypt; print('bcrypt version:', bcrypt.__version__)" 2>nul
if errorlevel 1 (
    echo Installing bcrypt...
    pip install "bcrypt<5.0.0"
)

echo.
echo Step 4: Starting backend server...
echo Backend will start on: http://localhost:8000
echo Press Ctrl+C to stop
echo.
set TF_ENABLE_ONEDNN_OPTS=0
set TF_CPP_MIN_LOG_LEVEL=2
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload ^
  --reload-exclude "__pycache__" --reload-exclude "*.pyc" --reload-exclude "logs" --reload-exclude "uploads" --reload-exclude "data" --reload-exclude "models" --reload-exclude "*.db" --reload-exclude ".git" --reload-exclude "venv" --reload-exclude ".venv" --reload-exclude ".env"

pause
