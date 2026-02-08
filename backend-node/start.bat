@echo off
echo ========================================
echo Starting Authentication Server
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo Please run setup.bat first
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist node_modules (
    echo [WARNING] Dependencies not installed!
    echo Installing dependencies...
    call npm install
)

echo Starting server...
echo Server will run on http://localhost:3001
echo Press Ctrl+C to stop
echo.

node server.js








