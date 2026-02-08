# PowerShell script to start the backend server
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Car Price Predictor Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
Set-Location $PSScriptRoot

# Check if virtual environment exists
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
} else {
    Write-Host "WARNING: Virtual environment not found. Using system Python." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting FastAPI server on http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Suppress TensorFlow oneDNN and floating-point warnings
$env:TF_ENABLE_ONEDNN_OPTS = "0"
$env:TF_CPP_MIN_LOG_LEVEL = "2"

# Exclude dirs/files from reload watcher to prevent restarts from cache, logs, DB, uploads, data, etc.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload `
  --reload-exclude "__pycache__" --reload-exclude "*.pyc" --reload-exclude "*.pyo" --reload-exclude "*.log" `
  --reload-exclude "logs" --reload-exclude "uploads" --reload-exclude "data" --reload-exclude "models" `
  --reload-exclude "*.db" --reload-exclude ".git" --reload-exclude "venv" --reload-exclude ".venv" --reload-exclude ".env"
