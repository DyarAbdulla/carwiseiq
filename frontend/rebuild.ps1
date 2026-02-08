# ========================================
# Full Rebuild Script for Next.js Frontend
# Does a complete clean and reinstalls everything
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next.js Full Rebuild Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  1. Stop all Node processes"
Write-Host "  2. Delete .next, .next-cache, and node_modules/.cache"
Write-Host "  3. Delete node_modules folder"
Write-Host "  4. Delete package-lock.json"
Write-Host "  5. Reinstall all dependencies"
Write-Host ""

$confirm = Read-Host "Continue? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Rebuild cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Full Rebuild..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Stop Node processes
Write-Host "[1/5] Stopping Node processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "   Node processes stopped" -ForegroundColor Green
} else {
    Write-Host "   No Node processes found" -ForegroundColor Gray
}

# Remove build caches
Write-Host ""
Write-Host "[2/5] Removing build caches..." -ForegroundColor Yellow
$cacheDirs = @(".next", ".next-cache", "node_modules/.cache", "tsconfig.tsbuildinfo")
foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
        if (Test-Path $dir -PathType Container) {
            Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            Remove-Item -Path $dir -Force -ErrorAction SilentlyContinue
        }
    }
}
Write-Host "   Build caches removed" -ForegroundColor Green

# Remove node_modules
Write-Host ""
Write-Host "[3/5] Removing node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   node_modules removed" -ForegroundColor Green
} else {
    Write-Host "   node_modules not found" -ForegroundColor Gray
}

# Remove package-lock.json
Write-Host ""
Write-Host "[4/5] Removing package-lock.json..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") {
    Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
    Write-Host "   package-lock.json removed" -ForegroundColor Green
} else {
    Write-Host "   package-lock.json not found" -ForegroundColor Gray
}

# Reinstall dependencies
Write-Host ""
Write-Host "[5/5] Reinstalling dependencies..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray
Write-Host ""

npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: npm install failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Rebuild Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now run: npm run dev" -ForegroundColor Cyan
Write-Host ""
