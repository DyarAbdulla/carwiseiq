@echo off
echo Checking for processes using port 3002...

REM Find and kill process using port 3002
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    echo Killing process %%a...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo Starting frontend dev server...
npm run dev
