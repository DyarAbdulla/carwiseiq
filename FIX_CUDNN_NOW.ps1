# FINAL FIX: Copy cuDNN from NVIDIA installation to CUDA
# Run this as Administrator

Write-Host "========================================"
Write-Host "FINAL cuDNN FIX"
Write-Host "========================================"
Write-Host ""

$cudnnSource = "C:\Program Files\NVIDIA\cuDNN\v9.17"
$cudaPath = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"

Write-Host "Source: $cudnnSource" -ForegroundColor Cyan
Write-Host "Destination: $cudaPath" -ForegroundColor Cyan
Write-Host ""

# Verify paths
if (-not (Test-Path $cudnnSource)) {
    Write-Host "ERROR: cuDNN source not found!" -ForegroundColor Red
    pause
    exit 1
}

if (-not (Test-Path $cudaPath)) {
    Write-Host "ERROR: CUDA path not found!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Copying files..." -ForegroundColor Yellow
Write-Host ""

# Copy bin files
Write-Host "[1/3] Copying bin files..." -ForegroundColor Cyan
try {
    $binFiles = Get-ChildItem "$cudnnSource\bin" -File -ErrorAction Stop
    Copy-Item "$cudnnSource\bin\*" -Destination "$cudaPath\bin\" -Force -ErrorAction Stop
    Write-Host "  SUCCESS: Copied $($binFiles.Count) bin files" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $_" -ForegroundColor Red
}

# Copy include files (handle nested structure)
Write-Host "[2/3] Copying include files..." -ForegroundColor Cyan
try {
    # cuDNN 9.17 has nested version folders, copy all
    $includeSource = "$cudnnSource\include"
    if (Test-Path $includeSource) {
        # Copy all subdirectories and files
        Get-ChildItem $includeSource -Recurse | ForEach-Object {
            $relativePath = $_.FullName.Substring($includeSource.Length + 1)
            $destPath = Join-Path "$cudaPath\include" $relativePath
            $destDir = Split-Path $destPath -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            if (-not $_.PSIsContainer) {
                Copy-Item $_.FullName -Destination $destPath -Force -ErrorAction Stop
            }
        }
        $includeCount = (Get-ChildItem "$cudaPath\include" -Recurse -Filter "cudnn*" -File -ErrorAction SilentlyContinue).Count
        Write-Host "  SUCCESS: Copied include files ($includeCount cudnn files)" -ForegroundColor Green
    }
} catch {
    Write-Host "  ERROR: $_" -ForegroundColor Red
}

# Copy lib files
Write-Host "[3/3] Copying lib files..." -ForegroundColor Cyan
try {
    $libSource = "$cudnnSource\lib\x64"
    if (-not (Test-Path $libSource)) {
        $libSource = "$cudnnSource\lib"
    }
    if (Test-Path $libSource) {
        $libFiles = Get-ChildItem $libSource -File -Filter "*.dll","*.lib" -ErrorAction Stop
        Copy-Item "$libSource\*" -Destination "$cudaPath\lib\x64\" -Force -ErrorAction Stop
        Write-Host "  SUCCESS: Copied $($libFiles.Count) lib files" -ForegroundColor Green
    }
} catch {
    Write-Host "  ERROR: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================"
Write-Host "Verification"
Write-Host "========================================"
Write-Host ""

$binCount = (Get-ChildItem "$cudaPath\bin\cudnn*" -ErrorAction SilentlyContinue).Count
$includeCount = (Get-ChildItem "$cudaPath\include" -Recurse -Filter "cudnn*" -File -ErrorAction SilentlyContinue).Count
$libCount = (Get-ChildItem "$cudaPath\lib\x64\cudnn*" -ErrorAction SilentlyContinue).Count

Write-Host "cuDNN files in CUDA directory:" -ForegroundColor Cyan
Write-Host "  Bin: $binCount files" -ForegroundColor $(if ($binCount -gt 0) { "Green" } else { "Yellow" })
Write-Host "  Include: $includeCount files" -ForegroundColor $(if ($includeCount -gt 0) { "Green" } else { "Yellow" })
Write-Host "  Lib: $libCount files" -ForegroundColor $(if ($libCount -gt 0) { "Green" } else { "Yellow" })

Write-Host ""

if ($binCount -gt 0 -or $includeCount -gt 0 -or $libCount -gt 0) {
    Write-Host "========================================"
    Write-Host "SUCCESS: cuDNN installation complete!" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "CRITICAL: You MUST restart your computer now!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "After restart, test GPU detection:" -ForegroundColor Yellow
    Write-Host "  python -c `"import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))`"" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "WARNING: No cuDNN files detected!" -ForegroundColor Yellow
    Write-Host "Please check the admin PowerShell window for errors." -ForegroundColor Yellow
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
