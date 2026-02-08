# ========================================
# Full Clean Script for Next.js Frontend
# Deletes all build caches and optionally node_modules
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next.js Full Clean Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Stop any running Node processes
Write-Host "[1/4] Stopping Node processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "   Node processes stopped" -ForegroundColor Green
} else {
    Write-Host "   No Node processes found (this is OK)" -ForegroundColor Gray
}

# Remove build cache directories
Write-Host ""
Write-Host "[2/4] Removing build cache directories..." -ForegroundColor Yellow

$cacheDirs = @(
    ".next",
    ".next-cache",
    "node_modules/.cache",
    "tsconfig.tsbuildinfo"
)

foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
        if (Test-Path $dir -PathType Container) {
            Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            Remove-Item -Path $dir -Force -ErrorAction SilentlyContinue
        }
        Write-Host "   Removed: $dir" -ForegroundColor Green
    } else {
        Write-Host "   $dir not found (OK)" -ForegroundColor Gray
    }
}

# Ask about node_modules
Write-Host ""
Write-Host "[3/4] Remove node_modules folder?" -ForegroundColor Yellow
$removeNodeModules = Read-Host "   (y/N)"

if ($removeNodeModules -eq "y" -or $removeNodeModules -eq "Y") {
    if (Test-Path "node_modules") {
        Write-Host "   Removing node_modules (this may take a moment)..." -ForegroundColor Yellow
        Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "   Removed: node_modules" -ForegroundColor Green

        # Also remove package-lock.json
        if (Test-Path "package-lock.json") {
            Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
            Write-Host "   Removed: package-lock.json" -ForegroundColor Green
        }
    } else {
        Write-Host "   node_modules not found (OK)" -ForegroundColor Gray
    }
} else {
    Write-Host "   Skipping node_modules removal" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[4/4] Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Clean Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Build caches: CLEARED" -ForegroundColor Green

if ($removeNodeModules -eq "y" -or $removeNodeModules -eq "Y") {
    Write-Host "  node_modules: REMOVED" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next step: Run 'npm install' then 'npm run dev'" -ForegroundColor Cyan
} else {
    Write-Host "  node_modules: PRESERVED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step: Run 'npm run dev'" -ForegroundColor Cyan
}

Write-Host ""
