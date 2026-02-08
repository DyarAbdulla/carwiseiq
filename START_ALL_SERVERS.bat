@echo off
echo ========================================
echo STARTING ALL SERVICES
echo ========================================
echo.

echo [1/2] Starting Backend (Python FastAPI)...
echo    - Includes: ML Predictions + Authentication
echo    - Database: SQLite (auto-initialized on startup)
echo    - Port: 8000
start "Backend Server - Port 8000" cmd /k "cd /d %~dp0backend && venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 5 /nobreak >nul

echo [2/2] Starting Frontend (Next.js)...
echo    - Port: 3002
start "Frontend Server - Port 3002" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo ALL SERVICES STARTED!
echo ========================================
echo.
echo Services Running:
echo   - Backend (ML + Auth):  http://localhost:8000
echo   - API Documentation:    http://localhost:8000/docs
echo   - Frontend:             http://localhost:3002
echo   - Database:             SQLite (users.db) - initialized automatically
echo.
echo Check the opened command windows for status.
echo.
echo Press any key to open services in browser...
pause >nul

start http://localhost:3002
start http://localhost:8000/docs

echo.
echo Done! All services are running.
echo.
pause
