@echo off
echo ========================================
echo STOPPING ALL SERVERS
echo ========================================
echo.

echo Step 1: Stopping Backend Server...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" >nul 2>&1
taskkill /F /IM python.exe /FI "COMMANDLINE eq *uvicorn*" >nul 2>&1
timeout /t 2 /nobreak >nul
echo Backend stopped.

echo.
echo Step 2: Stopping Frontend Server...
taskkill /F /IM node.exe /FI "COMMANDLINE eq *next-server*" >nul 2>&1
taskkill /F /IM node.exe /FI "COMMANDLINE eq *npm run dev*" >nul 2>&1
taskkill /F /IM node.exe /FI "COMMANDLINE eq *next dev*" >nul 2>&1
timeout /t 2 /nobreak >nul
echo Frontend stopped.

echo.
echo ========================================
echo ALL SERVERS STOPPED
echo ========================================
echo.
echo You can safely turn off your PC now.
echo.
pause
