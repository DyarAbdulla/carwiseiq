# Server Status Checker for Car Price Predictor
# This script checks if both frontend and backend servers are running

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Car Price Predictor - Server Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Backend (Port 8000)
Write-Host "Checking Backend Server (Port 8000)..." -ForegroundColor Yellow
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
    if ($backendResponse.StatusCode -eq 200) {
        Write-Host "✓ Backend is RUNNING" -ForegroundColor Green
        $healthData = $backendResponse.Content | ConvertFrom-Json
        Write-Host "  Status: $($healthData.status)" -ForegroundColor Gray
        Write-Host "  Model Loaded: $($healthData.model_loaded)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Backend is NOT RUNNING" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start backend:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor White
}

Write-Host ""

# Check Frontend (Port 3000)
Write-Host "Checking Frontend Server (Port 3000)..." -ForegroundColor Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 2 -ErrorAction Stop
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "✓ Frontend is RUNNING" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Frontend is NOT RUNNING" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start frontend:" -ForegroundColor Yellow
    Write-Host "  cd frontend" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostic Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

