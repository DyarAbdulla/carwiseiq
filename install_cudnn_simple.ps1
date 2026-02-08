# Simple cuDNN Installation Script
# Runs installer, waits for extraction, then installs automatically

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Requesting administrator privileges..." -ForegroundColor Yellow
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Wait
    exit
}

Write-Host "========================================"
Write-Host "cuDNN Installation"
Write-Host "========================================"
Write-Host ""

$cudaPath = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"
$installerPath = "$env:USERPROFILE\Downloads\cudnn_9.17.1_windows_x86_64.exe"
$extractPath = "C:\cudnn_extract"

# Check CUDA
if (-not (Test-Path $cudaPath)) {
    Write-Host "ERROR: CUDA not found!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "CUDA found: $cudaPath" -ForegroundColor Green
Write-Host ""

# Check installer
if (-not (Test-Path $installerPath)) {
    Write-Host "ERROR: Installer not found!" -ForegroundColor Red
    pause
    exit 1
}

# Create extraction folder
if (Test-Path $extractPath) {
    Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $extractPath -Force | Out-Null

Write-Host "========================================"
Write-Host "Step 1: Extract cuDNN"
Write-Host "========================================"
Write-Host ""
Write-Host "Opening cuDNN installer..." -ForegroundColor Yellow
Write-Host ""
Write-Host "INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "  1. When the installer window opens, click 'Extract' or 'Next'" -ForegroundColor White
Write-Host "  2. Extract to: $extractPath" -ForegroundColor White
Write-Host "  3. Wait for extraction to complete" -ForegroundColor White
Write-Host "  4. Close the installer window" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to start the installer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Run installer
Start-Process -FilePath $installerPath -ArgumentList "-o`"$extractPath`""

Write-Host ""
Write-Host "Waiting for you to extract cuDNN..." -ForegroundColor Yellow
Write-Host "Please complete the extraction in the installer window, then press any key here..."
Write-Host ""
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "Searching for extracted files..." -ForegroundColor Yellow

# Wait a moment
Start-Sleep -Seconds 2

# Find cuDNN files
$cudnnPath = $null

# Check direct
if ((Test-Path "$extractPath\bin") -and (Test-Path "$extractPath\include") -and (Test-Path "$extractPath\lib\x64")) {
    $cudnnPath = $extractPath
} else {
    # Check nested
    $nested = Get-ChildItem -Path $extractPath -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object {
        (Test-Path "$($_.FullName)\bin") -and (Test-Path "$($_.FullName)\include") -and (Test-Path "$($_.FullName)\lib\x64")
    } | Select-Object -First 1
    if ($nested) {
        $cudnnPath = $nested.FullName
    }
}

if (-not $cudnnPath) {
    Write-Host ""
    Write-Host "ERROR: Could not find extracted cuDNN files!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. Did extraction complete successfully?" -ForegroundColor Yellow
    Write-Host "  2. Check folder: $extractPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or provide the path manually:" -ForegroundColor Cyan
    $manualPath = Read-Host "Enter cuDNN folder path"
    if ($manualPath -and (Test-Path $manualPath)) {
        if ((Test-Path "$manualPath\bin") -and (Test-Path "$manualPath\include") -and (Test-Path "$manualPath\lib\x64")) {
            $cudnnPath = $manualPath
        } else {
            Write-Host "Invalid folder structure!" -ForegroundColor Red
            pause
            exit 1
        }
    } else {
        pause
        exit 1
    }
}

Write-Host "Found cuDNN at: $cudnnPath" -ForegroundColor Green
Write-Host ""

# Install
Write-Host "========================================"
Write-Host "Step 2: Installing to CUDA"
Write-Host "========================================"
Write-Host ""

try {
    Write-Host "Copying files..." -ForegroundColor Yellow

    Copy-Item "$cudnnPath\bin\*" -Destination "$cudaPath\bin\" -Force -ErrorAction Stop
    $binCount = (Get-ChildItem "$cudaPath\bin\cudnn*" -ErrorAction SilentlyContinue).Count
    Write-Host "  Bin: $binCount files" -ForegroundColor Green

    Copy-Item "$cudnnPath\include\*" -Destination "$cudaPath\include\" -Force -ErrorAction Stop
    $includeCount = (Get-ChildItem "$cudaPath\include\cudnn*" -ErrorAction SilentlyContinue).Count
    Write-Host "  Include: $includeCount files" -ForegroundColor Green

    Copy-Item "$cudnnPath\lib\x64\*" -Destination "$cudaPath\lib\x64\" -Force -ErrorAction Stop
    $libCount = (Get-ChildItem "$cudaPath\lib\x64\cudnn*" -ErrorAction SilentlyContinue).Count
    Write-Host "  Lib: $libCount files" -ForegroundColor Green

    Write-Host ""
    Write-Host "========================================"
    Write-Host "SUCCESS: Installation complete!" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "RESTART your computer, then verify with:" -ForegroundColor Cyan
    Write-Host "  python -c `"import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))`"" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    pause
    exit 1
}

pause
