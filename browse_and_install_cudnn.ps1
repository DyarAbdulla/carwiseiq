# Browse and Install cuDNN Script
# This script opens a folder browser to select cuDNN extraction folder

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "========================================"
    Write-Host "Browse and Install cuDNN Script"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "This script requires administrator privileges." -ForegroundColor Yellow
    Write-Host "Restarting with elevated privileges..." -ForegroundColor Yellow
    Write-Host ""

    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Wait
    exit
}

Add-Type -AssemblyName System.Windows.Forms

Write-Host "========================================"
Write-Host "Browse and Install cuDNN Script"
Write-Host "========================================"
Write-Host ""

$cudaPath = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"

# Check CUDA
if (-not (Test-Path $cudaPath)) {
    Write-Host "ERROR: CUDA 12.4 not found at: $cudaPath" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "CUDA found at: $cudaPath" -ForegroundColor Green
Write-Host ""

# Open folder browser
Write-Host "Please select the folder where you extracted cuDNN files." -ForegroundColor Yellow
Write-Host "This folder should contain 'bin', 'include', and 'lib' subfolders." -ForegroundColor Yellow
Write-Host ""

$folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
$folderBrowser.Description = "Select the cuDNN extraction folder (should contain bin, include, lib folders)"
$folderBrowser.RootFolder = [System.Environment+SpecialFolder]::MyComputer
$folderBrowser.ShowNewFolderButton = $false

if ($folderBrowser.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    $selectedPath = $folderBrowser.SelectedPath
    Write-Host "Selected: $selectedPath" -ForegroundColor Cyan
    Write-Host ""

    # Check if it's the right structure
    $cudnnPath = $null

    if ((Test-Path "$selectedPath\bin") -and (Test-Path "$selectedPath\include") -and (Test-Path "$selectedPath\lib\x64")) {
        $cudnnPath = $selectedPath
        Write-Host "Found cuDNN structure!" -ForegroundColor Green
    } else {
        # Check nested
        Write-Host "Checking for nested cuDNN folder..." -ForegroundColor Yellow
        $nested = Get-ChildItem -Path $selectedPath -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object {
            (Test-Path "$($_.FullName)\bin") -and (Test-Path "$($_.FullName)\include") -and (Test-Path "$($_.FullName)\lib\x64")
        } | Select-Object -First 1

        if ($nested) {
            $cudnnPath = $nested.FullName
            Write-Host "Found cuDNN in nested folder: $cudnnPath" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Selected folder does not contain cuDNN structure!" -ForegroundColor Red
            Write-Host "The folder must contain 'bin', 'include', and 'lib\x64' subfolders." -ForegroundColor Red
            pause
            exit 1
        }
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "Installing cuDNN to CUDA"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Source: $cudnnPath" -ForegroundColor Cyan
    Write-Host "Destination: $cudaPath" -ForegroundColor Cyan
    Write-Host ""

    # Copy files
    try {
        Write-Host "Copying bin files..." -ForegroundColor Yellow
        Copy-Item "$cudnnPath\bin\*" -Destination "$cudaPath\bin\" -Force -ErrorAction Stop
        $binFiles = Get-ChildItem "$cudaPath\bin\cudnn*" -ErrorAction SilentlyContinue
        Write-Host "  Copied $($binFiles.Count) files" -ForegroundColor Green

        Write-Host "Copying include files..." -ForegroundColor Yellow
        Copy-Item "$cudnnPath\include\*" -Destination "$cudaPath\include\" -Force -ErrorAction Stop
        $includeFiles = Get-ChildItem "$cudaPath\include\cudnn*" -ErrorAction SilentlyContinue
        Write-Host "  Copied $($includeFiles.Count) files" -ForegroundColor Green

        Write-Host "Copying lib files..." -ForegroundColor Yellow
        Copy-Item "$cudnnPath\lib\x64\*" -Destination "$cudaPath\lib\x64\" -Force -ErrorAction Stop
        $libFiles = Get-ChildItem "$cudaPath\lib\x64\cudnn*" -ErrorAction SilentlyContinue
        Write-Host "  Copied $($libFiles.Count) files" -ForegroundColor Green

        Write-Host ""
        Write-Host "========================================"
        Write-Host "SUCCESS: cuDNN installation complete!" -ForegroundColor Green
        Write-Host "========================================"
        Write-Host ""
        Write-Host "IMPORTANT: You must RESTART your computer for changes to take effect!" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "After restart, verify GPU detection with:" -ForegroundColor Yellow
        Write-Host "  python -c `"import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))`"" -ForegroundColor White
        Write-Host ""

    } catch {
        Write-Host ""
        Write-Host "ERROR: Failed to copy files: $_" -ForegroundColor Red
        Write-Host ""
        pause
        exit 1
    }

} else {
    Write-Host "Installation cancelled." -ForegroundColor Yellow
}

pause
