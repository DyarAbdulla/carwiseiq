@echo off
echo ========================================
echo Starting Car Price Predictor Backend
echo ========================================
echo.

cd /d "%~dp0"

if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo WARNING: Virtual environment not found. Using system Python.
)

echo.
echo Starting FastAPI server on http://127.0.0.1:8000
echo Press Ctrl+C to stop the server
echo.

 REM Suppress TensorFlow oneDNN and floating-point warnings
set TF_ENABLE_ONEDNN_OPTS=0
set TF_CPP_MIN_LOG_LEVEL=2

 REM Exclude dirs/files from reload watcher to prevent restarts from cache, logs, DB, uploads, data, etc.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload ^
  --reload-exclude "__pycache__" --reload-exclude "*.pyc" --reload-exclude "*.pyo" --reload-exclude "*.log" ^
  --reload-exclude "logs" --reload-exclude "uploads" --reload-exclude "data" --reload-exclude "models" ^
  --reload-exclude "*.db" --reload-exclude ".git" --reload-exclude "venv" --reload-exclude ".venv" --reload-exclude ".env"

pause
