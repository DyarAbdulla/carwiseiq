@echo off
echo ========================================
echo Starting Backend Server (Port 8000)
echo ========================================
echo.

cd /d "%~dp0backend"

if not exist "venv" (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv venv
    pause
    exit /b 1
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo Initializing database...
python -c "from app.services.auth_service import init_db; init_db(); print('Database initialized')"

echo.
echo Starting FastAPI server on http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop
echo.

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

pause
