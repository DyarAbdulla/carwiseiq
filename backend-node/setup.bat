@echo off
echo ========================================
echo Car Price Predictor Auth Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Checking Node.js installation...
node --version
echo.

echo [2/5] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo.

echo [3/5] Checking for .env file...
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo.
    echo [IMPORTANT] Please edit .env file and configure:
    echo   - DB_PASSWORD (your PostgreSQL password)
    echo   - JWT_SECRET (run: node scripts\generate-secret.js)
    echo.
    pause
) else (
    echo .env file already exists
)
echo.

echo [4/5] Generating JWT Secret...
node scripts\generate-secret.js
echo.

echo [5/5] Setup complete!
echo.
echo Next steps:
echo   1. Edit .env file with your PostgreSQL credentials
echo   2. Create database: psql -U postgres -c "CREATE DATABASE car_price_predictor;"
echo   3. Run: npm run setup-db
echo   4. Start server: npm run dev
echo.
pause








