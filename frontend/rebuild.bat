@echo off
REM ========================================
REM Full Rebuild Script for Next.js Frontend
REM Does a complete clean and reinstalls everything
REM ========================================

echo.
echo ========================================
echo Next.js Full Rebuild Script
echo ========================================
echo.
echo This will:
echo   1. Stop all Node processes
echo   2. Delete .next, .next-cache, and node_modules/.cache
echo   3. Delete node_modules folder
echo   4. Delete package-lock.json
echo   5. Reinstall all dependencies
echo.
set /p CONFIRM="Continue? (y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Rebuild cancelled.
    exit /b 0
)

echo.
echo ========================================
echo Starting Full Rebuild...
echo ========================================
echo.

REM Stop Node processes
echo [1/5] Stopping Node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Remove build caches
echo [2/5] Removing build caches...
if exist .next rmdir /s /q .next
if exist .next-cache rmdir /s /q .next-cache
if exist node_modules\.cache rmdir /s /q node_modules\.cache
if exist tsconfig.tsbuildinfo del /q tsconfig.tsbuildinfo
echo    Build caches removed

REM Remove node_modules
echo.
echo [3/5] Removing node_modules...
if exist node_modules (
    rmdir /s /q node_modules
    echo    node_modules removed
) else (
    echo    node_modules not found
)

REM Remove package-lock.json
echo.
echo [4/5] Removing package-lock.json...
if exist package-lock.json (
    del /q package-lock.json
    echo    package-lock.json removed
) else (
    echo    package-lock.json not found
)

REM Reinstall dependencies
echo.
echo [5/5] Reinstalling dependencies...
echo    This may take a few minutes...
echo.
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Rebuild Complete!
echo ========================================
echo.
echo You can now run: npm run dev
echo.
pause
