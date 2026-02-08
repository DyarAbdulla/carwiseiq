# Complete cuDNN Installation Script
# This script extracts and installs cuDNN automatically

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "========================================"
    Write-Host "cuDNN Complete Installation Script"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "This script requires administrator privileges." -ForegroundColor Yellow
    Write-Host "Restarting with elevated privileges..." -ForegroundColor Yellow
    Write-Host ""

    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Wait
    exit
}

Write-Host "========================================"
Write-Host "cuDNN Complete Installation Script"
Write-Host "========================================"
Write-Host ""

# Paths
$cudaPath = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"
$installerPath = "$env:USERPROFILE\Downloads\cudnn_9.17.1_windows_x86_64.exe"
$extractPath = "$env:TEMP\cudnn_extract"

# Check CUDA
if (-not (Test-Path $cudaPath)) {
    Write-Host "ERROR: CUDA 12.4 not found at: $cudaPath" -ForegroundColor Red
    exit 1
}

Write-Host "CUDA found at: $cudaPath" -ForegroundColor Green
Write-Host ""

# Step 1: Extract cuDNN if needed
$cudnnPath = $null

# Check if already extracted
$checkPaths = @(
    "$extractPath",
    "C:\Users\Darin Game\AppData\Local\Temp\cudnn_extract",
    "C:\cudnn"
)

foreach ($checkPath in $checkPaths) {
    if (Test-Path $checkPath) {
        # Check for direct structure
        if ((Test-Path "$checkPath\bin") -and (Test-Path "$checkPath\include") -and (Test-Path "$checkPath\lib\x64")) {
            $cudnnPath = $checkPath
            Write-Host "Found extracted cuDNN at: $cudnnPath" -ForegroundColor Green
            break
        }
        # Check for nested structure
        $nested = Get-ChildItem -Path $checkPath -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object {
            (Test-Path "$($_.FullName)\bin") -and (Test-Path "$($_.FullName)\include") -and (Test-Path "$($_.FullName)\lib\x64")
        } | Select-Object -First 1
        if ($nested) {
            $cudnnPath = $nested.FullName
            Write-Host "Found extracted cuDNN at: $cudnnPath" -ForegroundColor Green
            break
        }
    }
}

# Extract if not found
if (-not $cudnnPath -and (Test-Path $installerPath)) {
    Write-Host "Extracting cuDNN installer..." -ForegroundColor Yellow
    Write-Host "Installer: $installerPath" -ForegroundColor Cyan
    Write-Host "Extract to: $extractPath" -ForegroundColor Cyan
    Write-Host ""

    # Create extract directory
    if (-not (Test-Path $extractPath)) {
        New-Item -ItemType Directory -Path $extractPath -Force | Out-Null
    }

    # Run installer
    Write-Host "Running installer (this may take a moment)..." -ForegroundColor Yellow
    $process = Start-Process -FilePath $installerPath -ArgumentList "-o`"$extractPath`"" -Wait -PassThru

    Write-Host "Waiting for extraction to complete..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    # Check extraction result
    if ((Test-Path "$extractPath\bin") -and (Test-Path "$extractPath\include") -and (Test-Path "$extractPath\lib\x64")) {
        $cudnnPath = $extractPath
        Write-Host "Extraction successful!" -ForegroundColor Green
    } else {
        # Check nested
        $nested = Get-ChildItem -Path $extractPath -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object {
            (Test-Path "$($_.FullName)\bin") -and (Test-Path "$($_.FullName)\include") -and (Test-Path "$($_.FullName)\lib\x64")
        } | Select-Object -First 1
        if ($nested) {
            $cudnnPath = $nested.FullName
            Write-Host "Extraction successful! Found at: $cudnnPath" -ForegroundColor Green
        }
    }
}

if (-not $cudnnPath) {
    Write-Host ""
    Write-Host "ERROR: Could not find or extract cuDNN files!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please manually:" -ForegroundColor Yellow
    Write-Host "1. Run: $installerPath"
    Write-Host "2. Extract to: $extractPath"
    Write-Host "3. Run this script again"
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "Copying cuDNN files to CUDA directory..." -ForegroundColor Yellow
Write-Host ""

# Copy files
try {
    Write-Host "Copying bin files..." -ForegroundColor Cyan
    Copy-Item "$cudnnPath\bin\*" -Destination "$cudaPath\bin\" -Force -ErrorAction Stop
    $binCount = (Get-ChildItem "$cudaPath\bin\cudnn*" -ErrorAction SilentlyContinue).Count
    Write-Host "  Copied $binCount bin files" -ForegroundColor Green

    Write-Host "Copying include files..." -ForegroundColor Cyan
    Copy-Item "$cudnnPath\include\*" -Destination "$cudaPath\include\" -Force -ErrorAction Stop
    $includeCount = (Get-ChildItem "$cudaPath\include\cudnn*" -ErrorAction SilentlyContinue).Count
    Write-Host "  Copied $includeCount include files" -ForegroundColor Green

    Write-Host "Copying lib files..." -ForegroundColor Cyan
    Copy-Item "$cudnnPath\lib\x64\*" -Destination "$cudaPath\lib\x64\" -Force -ErrorAction Stop
    $libCount = (Get-ChildItem "$cudaPath\lib\x64\cudnn*" -ErrorAction SilentlyContinue).Count
    Write-Host "  Copied $libCount lib files" -ForegroundColor Green

    Write-Host ""
    Write-Host "========================================"
    Write-Host "cuDNN installation complete!" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Restart your computer"
    Write-Host "2. Verify GPU detection with:"
    Write-Host "   python -c `"import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))`""
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to copy files: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}
