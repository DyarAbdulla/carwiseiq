@echo off
echo ========================================
echo Starting Car Price Predictor Servers
echo ========================================
echo.

echo [1/2] Starting Backend Server (Port 3001)...
start "Backend Server" cmd /k "cd /d C:\Car prices definer program local C\backend-node && npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Server (Port 3002)...
start "Frontend Server" cmd /k "cd /d C:\Car prices definer program local C\frontend && npm run dev"

echo.
echo ========================================
echo Servers are starting in separate windows
echo ========================================
echo.
echo Backend:  http://127.0.0.1:3001
echo Frontend: http://localhost:3002
echo.
echo Wait 10-15 seconds for servers to start
echo Then open: http://localhost:3002/en/register
echo.
pause







