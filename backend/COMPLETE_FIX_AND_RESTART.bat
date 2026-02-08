@echo off
echo ========================================
echo COMPLETE BACKEND FIX AND RESTART
echo ========================================
echo.

echo Step 1: Stopping any running backend processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" 2>nul
timeout /t 3 /nobreak >nul

echo.
echo Step 2: Clearing Python cache...
cd /d "%~dp0"
for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d" 2>nul
del /s /q *.pyc 2>nul
echo Cache cleared!

echo.
echo Step 3: Activating virtual environment...
if not exist venv\Scripts\Activate.bat (
    echo ERROR: Virtual environment not found!
    pause
    exit /b 1
)
call venv\Scripts\activate.bat

echo.
echo Step 4: Verifying and reinstalling bcrypt...
pip uninstall bcrypt -y >nul 2>&1
pip install bcrypt==4.3.0 --quiet
python -c "import bcrypt; print('bcrypt version:', bcrypt.__version__)"

echo.
echo Step 5: Testing password hashing...
python FIX_PASSWORD_HASHING.py
if errorlevel 1 (
    echo ERROR: Password hashing test failed!
    pause
    exit /b 1
)

echo.
echo Step 6: Starting backend server...
echo.
echo ========================================
echo Backend starting on: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.
set TF_ENABLE_ONEDNN_OPTS=0
set TF_CPP_MIN_LOG_LEVEL=2
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload ^
  --reload-exclude "__pycache__" --reload-exclude "*.pyc" --reload-exclude "logs" --reload-exclude "uploads" --reload-exclude "data" --reload-exclude "models" --reload-exclude "*.db" --reload-exclude ".git" --reload-exclude "venv" --reload-exclude ".venv" --reload-exclude ".env"

pause
