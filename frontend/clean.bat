@echo off
REM ========================================
REM Full Clean Script for Next.js Frontend
REM Deletes all build caches and optionally node_modules
REM ========================================

echo.
echo ========================================
echo Next.js Full Clean Script
echo ========================================
echo.

REM Stop any running Node processes
echo [1/4] Stopping Node processes...
taskkill /F /IM node.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    Node processes stopped
) else (
    echo    No Node processes found (this is OK)
)
timeout /t 1 /nobreak >nul

REM Remove build cache directories
echo.
echo [2/4] Removing build cache directories...
if exist .next (
    rmdir /s /q .next
    echo    Removed: .next
) else (
    echo    .next not found (OK)
)

if exist .next-cache (
    rmdir /s /q .next-cache
    echo    Removed: .next-cache
) else (
    echo    .next-cache not found (OK)
)

if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo    Removed: node_modules\.cache
) else (
    echo    node_modules\.cache not found (OK)
)

if exist tsconfig.tsbuildinfo (
    del /q tsconfig.tsbuildinfo
    echo    Removed: tsconfig.tsbuildinfo
)

REM Remove node_modules if requested
echo.
set /p REMOVE_NODE_MODULES="[3/4] Remove node_modules folder? (y/N): "
if /i "%REMOVE_NODE_MODULES%"=="Y" (
    if exist node_modules (
        echo    Removing node_modules (this may take a moment)...
        rmdir /s /q node_modules
        echo    Removed: node_modules
        echo.
        echo    To reinstall dependencies, run: npm install
    ) else (
        echo    node_modules not found (OK)
    )
) else (
    echo    Skipping node_modules removal
)

REM Remove package-lock.json if node_modules was removed
if /i "%REMOVE_NODE_MODULES%"=="Y" (
    if exist package-lock.json (
        del /q package-lock.json
        echo    Removed: package-lock.json
    )
)

echo.
echo [4/4] Cleanup complete!
echo.
echo ========================================
echo Clean Summary
echo ========================================
echo   Build caches: CLEARED
if /i "%REMOVE_NODE_MODULES%"=="Y" (
    echo   node_modules: REMOVED
    echo   Next step: Run 'npm install' then 'npm run dev'
) else (
    echo   node_modules: PRESERVED
    echo   Next step: Run 'npm run dev'
)
echo.
echo ========================================
pause
