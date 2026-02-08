# PowerShell script to start both servers
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Car Price Predictor Servers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start Backend Server
Write-Host "[1/2] Starting Backend Server (Port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Car prices definer program local C\backend-node'; npm run dev"

Start-Sleep -Seconds 3

# Start Frontend Server
Write-Host "[2/2] Starting Frontend Server (Port 3002)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Car prices definer program local C\frontend'; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Servers are starting in separate windows" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://127.0.0.1:3001" -ForegroundColor White
Write-Host "Frontend: http://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "Wait 10-15 seconds for servers to start" -ForegroundColor Yellow
Write-Host "Then open: http://localhost:3002/en/register" -ForegroundColor Cyan
Write-Host ""







