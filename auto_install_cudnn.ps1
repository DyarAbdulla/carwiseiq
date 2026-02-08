# Fully Automated cuDNN Installation Script
# This script extracts cuDNN and installs it automatically

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "========================================"
    Write-Host "Automated cuDNN Installation"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Requesting administrator privileges..." -ForegroundColor Yellow
    Write-Host ""

    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Wait
    exit
}

Write-Host "========================================"
Write-Host "Automated cuDNN Installation"
Write-Host "========================================"
Write-Host ""

# Paths
$cudaPath = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"
$installerPath = "$env:USERPROFILE\Downloads\cudnn_9.17.1_windows_x86_64.exe"
$extractPath = "C:\cudnn_auto_extract"

# Check CUDA
if (-not (Test-Path $cudaPath)) {
    Write-Host "ERROR: CUDA 12.4 not found!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "CUDA found: $cudaPath" -ForegroundColor Green
Write-Host ""

# Check installer
if (-not (Test-Path $installerPath)) {
    Write-Host "ERROR: cuDNN installer not found at: $installerPath" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Installer found: $installerPath" -ForegroundColor Green
Write-Host ""

# Step 1: Clean up old extraction if exists
if (Test-Path $extractPath) {
    Write-Host "Cleaning up old extraction folder..." -ForegroundColor Yellow
    Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue
}

# Step 2: Create extraction directory
Write-Host "Creating extraction directory: $extractPath" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $extractPath -Force | Out-Null

Write-Host ""
Write-Host "========================================"
Write-Host "Step 1: Extracting cuDNN"
Write-Host "========================================"
Write-Host ""
Write-Host "Running cuDNN installer..." -ForegroundColor Yellow
Write-Host "This may take a minute..." -ForegroundColor Yellow
Write-Host ""

# Extract cuDNN silently
$process = Start-Process -FilePath $installerPath -ArgumentList "-o`"$extractPath`"" -Wait -PassThru -NoNewWindow

Write-Host "Waiting for extraction to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Step 3: Find extracted files
Write-Host ""
Write-Host "========================================"
Write-Host "Step 2: Locating extracted files"
Write-Host "========================================"
Write-Host ""

$cudnnPath = $null

# Check direct path
if ((Test-Path "$extractPath\bin") -and (Test-Path "$extractPath\include") -and (Test-Path "$extractPath\lib\x64")) {
    $cudnnPath = $extractPath
    Write-Host "Found cuDNN at: $cudnnPath" -ForegroundColor Green
} else {
    # Search for nested folders
    Write-Host "Searching for cuDNN files..." -ForegroundColor Yellow
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
    Write-Host "Checking extraction folder contents..." -ForegroundColor Yellow
    Get-ChildItem $extractPath -Recurse -Directory | Select-Object FullName -First 10 | Format-Table -AutoSize
    Write-Host ""
    Write-Host "Please check: $extractPath" -ForegroundColor Yellow
    pause
    exit 1
}

# Step 4: Install to CUDA
Write-Host ""
Write-Host "========================================"
Write-Host "Step 3: Installing cuDNN to CUDA"
Write-Host "========================================"
Write-Host ""
Write-Host "Source: $cudnnPath" -ForegroundColor Cyan
Write-Host "Destination: $cudaPath" -ForegroundColor Cyan
Write-Host ""

try {
    # Copy bin files
    Write-Host "Copying bin files..." -ForegroundColor Yellow
    $binSource = "$cudnnPath\bin"
    $binDest = "$cudaPath\bin"
    if (Test-Path $binSource) {
        Copy-Item "$binSource\*" -Destination $binDest -Force -ErrorAction Stop
        $binFiles = Get-ChildItem "$binDest\cudnn*" -ErrorAction SilentlyContinue
        Write-Host "  Copied $($binFiles.Count) bin files" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: bin folder not found!" -ForegroundColor Yellow
    }

    # Copy include files
    Write-Host "Copying include files..." -ForegroundColor Yellow
    $includeSource = "$cudnnPath\include"
    $includeDest = "$cudaPath\include"
    if (Test-Path $includeSource) {
        Copy-Item "$includeSource\*" -Destination $includeDest -Force -ErrorAction Stop
        $includeFiles = Get-ChildItem "$includeDest\cudnn*" -ErrorAction SilentlyContinue
        Write-Host "  Copied $($includeFiles.Count) include files" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: include folder not found!" -ForegroundColor Yellow
    }

    # Copy lib files
    Write-Host "Copying lib files..." -ForegroundColor Yellow
    $libSource = "$cudnnPath\lib\x64"
    $libDest = "$cudaPath\lib\x64"
    if (Test-Path $libSource) {
        Copy-Item "$libSource\*" -Destination $libDest -Force -ErrorAction Stop
        $libFiles = Get-ChildItem "$libDest\cudnn*" -ErrorAction SilentlyContinue
        Write-Host "  Copied $($libFiles.Count) lib files" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: lib\x64 folder not found!" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "SUCCESS: cuDNN installation complete!" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""

    # Verify installation
    Write-Host "Verifying installation..." -ForegroundColor Cyan
    $totalFiles = (Get-ChildItem "$cudaPath\bin\cudnn*" -ErrorAction SilentlyContinue).Count +
                  (Get-ChildItem "$cudaPath\include\cudnn*" -ErrorAction SilentlyContinue).Count +
                  (Get-ChildItem "$cudaPath\lib\x64\cudnn*" -ErrorAction SilentlyContinue).Count

    if ($totalFiles -gt 0) {
        Write-Host "  Verified: $totalFiles cuDNN files installed" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: No cuDNN files found after installation!" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "IMPORTANT: You must RESTART your computer for changes to take effect!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "After restart, verify GPU detection with:" -ForegroundColor Yellow
    Write-Host "  python -c `"import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))`"" -ForegroundColor White
    Write-Host ""

    # Cleanup
    Write-Host "Cleaning up extraction folder..." -ForegroundColor Cyan
    Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue

} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to install cuDNN: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
