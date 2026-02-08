@echo off
echo ========================================
echo Testing Car Price Predictor Backend
echo ========================================
echo.

cd /d "%~dp0"

echo Running tests...
echo.

python test_api.py

echo.
echo ========================================
echo Test completed!
echo ========================================
pause
