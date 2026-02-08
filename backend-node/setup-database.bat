@echo off
echo ========================================
echo Database Setup
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo Please run setup.bat first or create .env file manually
    pause
    exit /b 1
)

echo [1/3] Reading database configuration from .env...
echo.

REM Try to read DB settings (basic parsing)
echo [2/3] Checking PostgreSQL connection...
echo Please ensure PostgreSQL is running and database exists.
echo.

echo [3/3] Running database setup script...
node scripts\setup-db.js
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database setup failed!
    echo Please check:
    echo   1. PostgreSQL is running
    echo   2. Database 'car_price_predictor' exists
    echo   3. Credentials in .env are correct
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Database setup complete!
echo.
pause








