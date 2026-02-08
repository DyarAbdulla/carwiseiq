@echo off
REM Complete Installation Script
REM This script does everything automatically

echo ========================================
echo Car Price Predictor Auth - Full Install
echo ========================================
echo.

REM Step 1: Install dependencies
echo [1/4] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Step 2: Setup environment
echo [2/4] Setting up environment...
if not exist .env (
    echo Creating .env file...
    copy .env.example .env >nul
    echo [OK] .env file created
    echo.
    echo [IMPORTANT] You need to edit .env and set:
    echo   1. DB_PASSWORD - Your PostgreSQL password
    echo   2. JWT_SECRET - Will be generated next
    echo.
) else (
    echo [OK] .env file exists
)
echo.

REM Step 3: Generate JWT Secret
echo [3/4] Generating JWT Secret...
node scripts\generate-secret.js
echo.

REM Step 4: Display instructions
echo [4/4] Installation complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo.
echo 1. Edit .env file:
echo    - Set DB_PASSWORD (your PostgreSQL password)
echo    - JWT_SECRET is already generated
echo.
echo 2. Create PostgreSQL database:
echo    psql -U postgres -c "CREATE DATABASE car_price_predictor;"
echo.
echo 3. Setup database schema:
echo    npm run setup-db
echo.
echo 4. Start the server:
echo    npm run dev
echo    OR
echo    start.bat
echo.
echo 5. Test the setup:
echo    npm run test-auth
echo.
echo 6. Add to frontend .env.local:
echo    NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
echo.
echo ========================================
pause








