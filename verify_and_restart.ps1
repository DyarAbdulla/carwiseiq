# Comprehensive Verification and Restart Script
# Stops all services, cleans builds, and restarts everything

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Car Price Predictor - Full Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop all running processes
Write-Host "[1/5] Stopping all running services..." -ForegroundColor Yellow
$ports = @(3001, 3002, 8000)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $connections | ForEach-Object {
            $processId = $_.OwningProcess
            $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).Name
            Write-Host "  Stopping process on port $port (PID: $processId, Name: $processName)" -ForegroundColor Gray
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

# Stop Node.js processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "next" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Stop Python processes (uvicorn)
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*uvicorn*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2
Write-Host "  ✓ All processes stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Clean frontend build artifacts
Write-Host "[2/5] Cleaning frontend build artifacts..." -ForegroundColor Yellow
$frontendPath = Join-Path $PSScriptRoot "frontend"
if (Test-Path $frontendPath) {
    $cacheDirs = @(".next", ".next-cache", "node_modules\.cache")
    foreach ($dir in $cacheDirs) {
        $fullPath = Join-Path $frontendPath $dir
        if (Test-Path $fullPath) {
            Write-Host "  Removing $dir..." -ForegroundColor Gray
            Remove-Item -Path $fullPath -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "  ✓ Frontend cache cleared" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Frontend directory not found" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Clean Python cache
Write-Host "[3/5] Cleaning Python cache..." -ForegroundColor Yellow
$pythonCacheDirs = Get-ChildItem -Path $PSScriptRoot -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue
foreach ($dir in $pythonCacheDirs) {
    Write-Host "  Removing $($dir.FullName)..." -ForegroundColor Gray
    Remove-Item -Path $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "  ✓ Python cache cleared" -ForegroundColor Green
Write-Host ""

# Step 4: Start all services
Write-Host "[4/5] Starting all services..." -ForegroundColor Yellow

# Start ML Backend (Python FastAPI)
Write-Host "  Starting ML Backend (port 8000)..." -ForegroundColor Gray
$backendPath = Join-Path $PSScriptRoot "backend"
if (Test-Path $backendPath) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; if (Test-Path 'venv\Scripts\Activate.ps1') { . venv\Scripts\Activate.ps1 }; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000" -WindowStyle Normal
    Start-Sleep -Seconds 3
    Write-Host "    ✓ ML Backend started" -ForegroundColor Green
} else {
    Write-Host "    ⚠ Backend directory not found" -ForegroundColor Yellow
}

# Start Auth Backend (Node.js)
Write-Host "  Starting Auth Backend (port 3001)..." -ForegroundColor Gray
$backendNodePath = Join-Path $PSScriptRoot "backend-node"
if (Test-Path $backendNodePath) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendNodePath'; npm run dev" -WindowStyle Normal
    Start-Sleep -Seconds 2
    Write-Host "    ✓ Auth Backend started" -ForegroundColor Green
} else {
    Write-Host "    ⚠ Auth Backend directory not found" -ForegroundColor Yellow
}

# Start Frontend (Next.js)
Write-Host "  Starting Frontend (port 3002)..." -ForegroundColor Gray
if (Test-Path $frontendPath) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -WindowStyle Normal
    Start-Sleep -Seconds 2
    Write-Host "    ✓ Frontend started" -ForegroundColor Green
} else {
    Write-Host "    ⚠ Frontend directory not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ⏳ Waiting 15 seconds for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 15
Write-Host ""

# Step 5: Verify services
Write-Host "[5/5] Verifying services..." -ForegroundColor Yellow
Write-Host ""

$allHealthy = $true

# Check ML Backend
Write-Host "  Checking ML Backend (http://localhost:8000)..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $health = $response.Content | ConvertFrom-Json
        Write-Host "    ✓ ML Backend is RUNNING" -ForegroundColor Green
        Write-Host "      Status: $($health.status)" -ForegroundColor Gray
        Write-Host "      Model Loaded: $($health.model_loaded)" -ForegroundColor Gray
    }
} catch {
    Write-Host "    ✗ ML Backend is NOT responding" -ForegroundColor Red
    Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor Red
    $allHealthy = $false
}

# Check Auth Backend
Write-Host "  Checking Auth Backend (http://localhost:3001)..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "    ✓ Auth Backend is RUNNING" -ForegroundColor Green
    }
} catch {
    Write-Host "    ⚠ Auth Backend may not be running (this is OK if PostgreSQL is not configured)" -ForegroundColor Yellow
}

# Check Frontend
Write-Host "  Checking Frontend (http://localhost:3002)..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3002" -Method GET -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "    ✓ Frontend is RUNNING" -ForegroundColor Green
    }
} catch {
    Write-Host "    ⚠ Frontend is still starting (may take 30-60 seconds)" -ForegroundColor Yellow
    Write-Host "      Check the Frontend PowerShell window for compilation progress" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allHealthy) {
    Write-Host "✓ Verification Complete!" -ForegroundColor Green
} else {
    Write-Host "⚠ Some services may need attention" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "  Frontend:     http://localhost:3002" -ForegroundColor White
Write-Host "  ML API Docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Auth Backend: http://localhost:3001/health" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:3002 in your browser" -ForegroundColor White
Write-Host "  2. Test the application functionality" -ForegroundColor White
Write-Host "  3. Check browser console for any errors" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
