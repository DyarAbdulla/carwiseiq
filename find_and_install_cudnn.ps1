# Find and Install cuDNN Script
# This script helps you find extracted cuDNN files and install them

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "========================================"
    Write-Host "Find and Install cuDNN Script"
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
Write-Host "Find and Install cuDNN Script"
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

# Search for cuDNN files
Write-Host "Searching for cuDNN files..." -ForegroundColor Yellow
Write-Host ""

$foundPaths = @()

# Search common locations
$searchLocations = @(
    "C:\cudnn",
    "$env:USERPROFILE\Downloads\cudnn*",
    "$env:USERPROFILE\Desktop\cudnn*",
    "C:\Users\Darin Game\AppData\Local\Temp\cudnn*",
    "$env:TEMP\cudnn*"
)

foreach ($location in $searchLocations) {
    if ($location -like "*`**") {
        $folders = Get-ChildItem -Path $location -Directory -ErrorAction SilentlyContinue
    } else {
        if (Test-Path $location) {
            $folders = @(Get-Item $location)
        } else {
            $folders = @()
        }
    }

    foreach ($folder in $folders) {
        $folderPath = $folder.FullName
        if ((Test-Path "$folderPath\bin") -and (Test-Path "$folderPath\include") -and (Test-Path "$folderPath\lib\x64")) {
            $foundPaths += $folderPath
            Write-Host "  Found: $folderPath" -ForegroundColor Green
        } else {
            # Check nested
            $nested = Get-ChildItem -Path $folderPath -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object {
                (Test-Path "$($_.FullName)\bin") -and (Test-Path "$($_.FullName)\include") -and (Test-Path "$($_.FullName)\lib\x64")
            } | Select-Object -First 1
            if ($nested) {
                $foundPaths += $nested.FullName
                Write-Host "  Found (nested): $($nested.FullName)" -ForegroundColor Green
            }
        }
    }
}

Write-Host ""

# Select path
$cudnnPath = $null

if ($foundPaths.Count -eq 0) {
    Write-Host "No cuDNN folders found automatically." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please provide the path where you extracted cuDNN." -ForegroundColor Cyan
    Write-Host "This should be a folder containing 'bin', 'include', and 'lib' subfolders." -ForegroundColor Cyan
    Write-Host ""
    $manualPath = Read-Host "Enter the full path to cuDNN extraction folder"

    if ($manualPath -and (Test-Path $manualPath)) {
        # Check if it's the right structure
        if ((Test-Path "$manualPath\bin") -and (Test-Path "$manualPath\include") -and (Test-Path "$manualPath\lib\x64")) {
            $cudnnPath = $manualPath
        } else {
            # Check nested
            $nested = Get-ChildItem -Path $manualPath -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object {
                (Test-Path "$($_.FullName)\bin") -and (Test-Path "$($_.FullName)\include") -and (Test-Path "$($_.FullName)\lib\x64")
            } | Select-Object -First 1
            if ($nested) {
                $cudnnPath = $nested.FullName
                Write-Host "Found cuDNN in nested folder: $cudnnPath" -ForegroundColor Green
            } else {
                Write-Host "ERROR: Invalid cuDNN folder structure!" -ForegroundColor Red
                Write-Host "The folder must contain 'bin', 'include', and 'lib\x64' subfolders." -ForegroundColor Red
                pause
                exit 1
            }
        }
    } else {
        Write-Host "Invalid path or path not found." -ForegroundColor Red
        pause
        exit 1
    }
} elseif ($foundPaths.Count -eq 1) {
    $cudnnPath = $foundPaths[0]
    Write-Host "Using found path: $cudnnPath" -ForegroundColor Green
} else {
    Write-Host "Multiple cuDNN folders found. Please select one:" -ForegroundColor Yellow
    Write-Host ""
    for ($i = 0; $i -lt $foundPaths.Count; $i++) {
        Write-Host "  [$i] $($foundPaths[$i])"
    }
    Write-Host ""
    $selection = Read-Host "Enter number (0-$($foundPaths.Count-1))"
    $index = [int]$selection
    if ($index -ge 0 -and $index -lt $foundPaths.Count) {
        $cudnnPath = $foundPaths[$index]
    } else {
        Write-Host "Invalid selection." -ForegroundColor Red
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

pause
