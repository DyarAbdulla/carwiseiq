# PowerShell Setup Script for Car Price Predictor Auth
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Car Price Predictor Auth Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "[1/5] Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Install dependencies
Write-Host "[2/5] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Dependencies installed" -ForegroundColor Green
Write-Host ""

# Check for .env file
Write-Host "[3/5] Checking for .env file..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "[IMPORTANT] Please edit .env file and configure:" -ForegroundColor Yellow
    Write-Host "  - DB_PASSWORD (your PostgreSQL password)" -ForegroundColor Yellow
    Write-Host "  - JWT_SECRET (will be generated next)" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ".env file already exists" -ForegroundColor Green
}
Write-Host ""

# Generate JWT Secret
Write-Host "[4/5] Generating JWT Secret..." -ForegroundColor Yellow
node scripts\generate-secret.js
Write-Host ""

# Check PostgreSQL
Write-Host "[5/5] Checking PostgreSQL..." -ForegroundColor Yellow
try {
    $pgVersion = psql --version 2>$null
    Write-Host "PostgreSQL found" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] PostgreSQL not found in PATH" -ForegroundColor Yellow
    Write-Host "You may need to install PostgreSQL or add it to PATH" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Edit .env file with your PostgreSQL credentials" -ForegroundColor White
Write-Host "  2. Create database: psql -U postgres -c 'CREATE DATABASE car_price_predictor;'" -ForegroundColor White
Write-Host "  3. Run: npm run setup-db" -ForegroundColor White
Write-Host "  4. Start server: npm run dev" -ForegroundColor White
Write-Host ""








