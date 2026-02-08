# Extract and Install cuDNN Script
# This script extracts cuDNN from the installer and installs it automatically

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "========================================"
    Write-Host "cuDNN Extract and Install Script"
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
Write-Host "cuDNN Extract and Install Script"
Write-Host "========================================"
Write-Host ""

# Paths
$cudaPath = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"
$installerPath = "$env:USERPROFILE\Downloads\cudnn_9.17.1_windows_x86_64.exe"
$extractPath = "C:\cudnn_temp_extract"

# Check CUDA
if (-not (Test-Path $cudaPath)) {
    Write-Host "ERROR: CUDA 12.4 not found at: $cudaPath" -ForegroundColor Red
    Write-Host "Please install CUDA 12.4 first." -ForegroundColor Red
    pause
    exit 1
}

Write-Host "CUDA found at: $cudaPath" -ForegroundColor Green
Write-Host ""

# Check installer
if (-not (Test-Path $installerPath)) {
    Write-Host "ERROR: cuDNN installer not found at: $installerPath" -ForegroundColor Red
    Write-Host "Please download cudnn_9.17.1_windows_x86_64.exe to your Downloads folder." -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Installer found: $installerPath" -ForegroundColor Green
Write-Host ""

# Create extract directory
Write-Host "Creating extraction directory: $extractPath" -ForegroundColor Cyan
if (Test-Path $extractPath) {
    Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $extractPath -Force | Out-Null

Write-Host ""
Write-Host "========================================"
Write-Host "Step 1: Extracting cuDNN files"
Write-Host "========================================"
Write-Host ""
Write-Host "Running cuDNN installer to extract files..." -ForegroundColor Yellow
Write-Host "This will open a window - please:" -ForegroundColor Yellow
Write-Host "  1. Click 'Extract' or 'OK' when prompted" -ForegroundColor Yellow
Write-Host "  2. Select or confirm: $extractPath" -ForegroundColor Yellow
Write-Host "  3. Wait for extraction to complete" -ForegroundColor Yellow
Write-Host "  4. Close the installer window" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to start extraction..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Run installer
Write-Host ""
Write-Host "Starting installer..." -ForegroundColor Cyan
Start-Process -FilePath $installerPath -ArgumentList "-o`"$extractPath`"" -Wait

Write-Host ""
Write-Host "Waiting for extraction to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Search for extracted files
Write-Host ""
Write-Host "========================================"
Write-Host "Step 2: Finding extracted files"
Write-Host "========================================"
Write-Host ""

$cudnnPath = $null

# Check direct path
if ((Test-Path "$extractPath\bin") -and (Test-Path "$extractPath\include") -and (Test-Path "$extractPath\lib\x64")) {
    $cudnnPath = $extractPath
    Write-Host "Found cuDNN at: $cudnnPath" -ForegroundColor Green
} else {
    # Check for nested folders
    Write-Host "Searching for cuDNN files in subdirectories..." -ForegroundColor Yellow
    $allFolders = Get-ChildItem -Path $extractPath -Recurse -Directory -ErrorAction SilentlyContinue
    foreach ($folder in $allFolders) {
        if ((Test-Path "$($folder.FullName)\bin") -and (Test-Path "$($folder.FullName)\include") -and (Test-Path "$($folder.FullName)\lib\x64")) {
            $cudnnPath = $folder.FullName
            Write-Host "Found cuDNN at: $cudnnPath" -ForegroundColor Green
            break
        }
    }
}

if (-not $cudnnPath) {
    Write-Host ""
    Write-Host "ERROR: Could not find extracted cuDNN files!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. Did the installer extract files successfully?" -ForegroundColor Yellow
    Write-Host "  2. Check the folder: $extractPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "If files were extracted to a different location, please provide the path:" -ForegroundColor Cyan
    $manualPath = Read-Host "Enter cuDNN extraction folder path (or press Enter to exit)"
    if ($manualPath -and (Test-Path $manualPath)) {
        if ((Test-Path "$manualPath\bin") -and (Test-Path "$manualPath\include") -and (Test-Path "$manualPath\lib\x64")) {
            $cudnnPath = $manualPath
        } else {
            Write-Host "ERROR: Invalid cuDNN folder structure!" -ForegroundColor Red
            pause
            exit 1
        }
    } else {
        pause
        exit 1
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "Step 3: Installing cuDNN to CUDA"
Write-Host "========================================"
Write-Host ""

# Copy files
try {
    Write-Host "Copying bin files..." -ForegroundColor Cyan
    if (-not (Test-Path "$cudaPath\bin")) {
        New-Item -ItemType Directory -Path "$cudaPath\bin" -Force | Out-Null
    }
    Copy-Item "$cudnnPath\bin\*" -Destination "$cudaPath\bin\" -Force -ErrorAction Stop
    $binFiles = Get-ChildItem "$cudaPath\bin\cudnn*" -ErrorAction SilentlyContinue
    Write-Host "  Copied $($binFiles.Count) bin files" -ForegroundColor Green
    $binFiles | ForEach-Object { Write-Host "    - $($_.Name)" -ForegroundColor Gray }

    Write-Host ""
    Write-Host "Copying include files..." -ForegroundColor Cyan
    if (-not (Test-Path "$cudaPath\include")) {
        New-Item -ItemType Directory -Path "$cudaPath\include" -Force | Out-Null
    }
    Copy-Item "$cudnnPath\include\*" -Destination "$cudaPath\include\" -Force -ErrorAction Stop
    $includeFiles = Get-ChildItem "$cudaPath\include\cudnn*" -ErrorAction SilentlyContinue
    Write-Host "  Copied $($includeFiles.Count) include files" -ForegroundColor Green
    $includeFiles | ForEach-Object { Write-Host "    - $($_.Name)" -ForegroundColor Gray }

    Write-Host ""
    Write-Host "Copying lib files..." -ForegroundColor Cyan
    if (-not (Test-Path "$cudaPath\lib\x64")) {
        New-Item -ItemType Directory -Path "$cudaPath\lib\x64" -Force | Out-Null
    }
    Copy-Item "$cudnnPath\lib\x64\*" -Destination "$cudaPath\lib\x64\" -Force -ErrorAction Stop
    $libFiles = Get-ChildItem "$cudaPath\lib\x64\cudnn*" -ErrorAction SilentlyContinue
    Write-Host "  Copied $($libFiles.Count) lib files" -ForegroundColor Green
    $libFiles | ForEach-Object { Write-Host "    - $($_.Name)" -ForegroundColor Gray }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "SUCCESS: cuDNN installation complete!" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. RESTART YOUR COMPUTER (required for changes to take effect)" -ForegroundColor Cyan
    Write-Host "2. After restart, verify GPU detection with:" -ForegroundColor Yellow
    Write-Host "   python -c `"import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))`"" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to copy files: $_" -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

# Cleanup
Write-Host "Cleaning up extraction folder..." -ForegroundColor Cyan
Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
