@echo off
echo ========================================
echo Car Price Predictor Pro - Frontend
echo ========================================
echo.

cd frontend

echo Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm ci
    if errorlevel 1 (
        echo npm ci failed, trying npm install...
        call npm install
    )
) else (
    echo Dependencies already installed.
)

echo.
echo Starting development server...
echo Server will be available at http://localhost:3002
echo.
call npm run dev

pause
