@echo off
echo ========================================
echo Car Price Predictor - Auth System Setup
echo ========================================
echo.
echo This script will set up the complete authentication system.
echo.

REM Navigate to backend-node directory
cd backend-node
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] backend-node directory not found!
    echo Please run this script from the project root.
    pause
    exit /b 1
)

echo Running automated setup...
call setup.bat

cd ..

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next: Configure your frontend .env.local with:
echo   NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
echo.
pause








