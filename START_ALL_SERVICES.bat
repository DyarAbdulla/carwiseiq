@echo off
echo ========================================
echo Starting All Services
echo ========================================
echo.

REM Start ML Backend
echo [1/3] Starting ML Backend (Python FastAPI)...
start "ML Backend - Port 8000" /MIN powershell -NoExit -Command "cd /d '%~dp0backend'; .\venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

REM Start Auth Backend
echo [2/3] Starting Auth Backend (Node.js Express)...
start "Auth Backend - Port 3001" /MIN powershell -NoExit -Command "cd /d '%~dp0backend-node'; npm start"

timeout /t 2 /nobreak >nul

REM Start Frontend
echo [3/3] Starting Frontend (Next.js)...
start "Frontend - Port 3002" /MIN powershell -NoExit -Command "cd /d '%~dp0frontend'; npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo All Services Started!
echo ========================================
echo.
echo Services:
echo   - ML Backend:    http://localhost:8000
echo   - ML API Docs:   http://localhost:8000/docs
echo   - Auth Backend:  http://localhost:3001
echo   - Frontend:      http://localhost:3002
echo.
echo Check the PowerShell windows for status.
echo.
echo Press any key to open services in browser...
pause >nul

start http://localhost:3002
start http://localhost:8000/docs
start http://localhost:3001/health

echo.
echo Done! All services are running.
pause
