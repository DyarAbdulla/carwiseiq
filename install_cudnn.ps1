# cuDNN Installation Script
# This script finds extracted cuDNN files and copies them to CUDA directory

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "========================================"
    Write-Host "cuDNN Installation Script"
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
Write-Host "cuDNN Installation Script"
Write-Host "========================================"
Write-Host ""

# CUDA installation path
$cudaPath = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"

# cuDNN installer path
$installerPath = "$env:USERPROFILE\Downloads\cudnn_9.17.1_windows_x86_64.exe"
$extractPath = "$env:TEMP\cudnn_extract"

# Check if CUDA is installed
if (-not (Test-Path $cudaPath)) {
    Write-Host "ERROR: CUDA 12.4 not found at: $cudaPath" -ForegroundColor Red
    Write-Host "Please install CUDA 12.4 first." -ForegroundColor Red
    exit 1
}

Write-Host "CUDA found at: $cudaPath" -ForegroundColor Green
Write-Host ""

# Search for extracted cuDNN folder
Write-Host "Searching for extracted cuDNN files..." -ForegroundColor Yellow

$searchPaths = @(
    "$env:USERPROFILE\Downloads\cudnn*",
    "$env:TEMP\cudnn*",
    "C:\Users\DARING~1\AppData\Local\Temp\cudnn_extract",
    "C:\Users\Darin Game\AppData\Local\Temp\cudnn_extract",
    "C:\cudnn*",
    "C:\Program Files\NVIDIA GPU Computing Toolkit\cudnn*",
    "$env:USERPROFILE\Desktop\cudnn*"
)

$cudnnPath = $null

foreach ($searchPath in $searchPaths) {
    # Check if it's a direct path (no wildcard)
    if ($searchPath -notlike "*`**") {
        if (Test-Path $searchPath) {
            if ((Test-Path "$searchPath\bin") -and (Test-Path "$searchPath\include") -and (Test-Path "$searchPath\lib\x64")) {
                $cudnnPath = $searchPath
                Write-Host "Found cuDNN at: $cudnnPath" -ForegroundColor Green
                break
            }
        }
    }
    else {
        # It's a wildcard path, search for folders
        $folders = Get-ChildItem -Path $searchPath -Directory -ErrorAction SilentlyContinue
        foreach ($folder in $folders) {
            if ((Test-Path "$($folder.FullName)\bin") -and (Test-Path "$($folder.FullName)\include") -and (Test-Path "$($folder.FullName)\lib\x64")) {
                $cudnnPath = $folder.FullName
                Write-Host "Found cuDNN at: $cudnnPath" -ForegroundColor Green
                break
            }
        }
    }
    if ($cudnnPath) { break }
}

if (-not $cudnnPath) {
    Write-Host ""
    Write-Host "cuDNN extraction folder not found. Attempting to extract..." -ForegroundColor Yellow
    Write-Host ""

    # Check if installer exists
    if (Test-Path $installerPath) {
        Write-Host "Found cuDNN installer at: $installerPath" -ForegroundColor Green
        Write-Host "Extracting to: $extractPath" -ForegroundColor Cyan

        # Create extract directory
        if (-not (Test-Path $extractPath)) {
            New-Item -ItemType Directory -Path $extractPath -Force | Out-Null
        }

        # Extract cuDNN
        Write-Host "Running installer to extract files..." -ForegroundColor Yellow
        $process = Start-Process -FilePath $installerPath -ArgumentList "-o`"$extractPath`"" -Wait -PassThru -NoNewWindow

        if ($process.ExitCode -eq 0 -or $process.ExitCode -eq $null) {
            Write-Host "Extraction completed. Searching for extracted files..." -ForegroundColor Green

            # Wait a moment for files to be written
            Start-Sleep -Seconds 2

            # Check if extraction created the expected structure
            if ((Test-Path "$extractPath\bin") -and (Test-Path "$extractPath\include") -and (Test-Path "$extractPath\lib\x64")) {
                $cudnnPath = $extractPath
                Write-Host "Found cuDNN at: $cudnnPath" -ForegroundColor Green
            }
            else {
                # Check for nested folder structure
                $nestedFolders = Get-ChildItem -Path $extractPath -Directory -ErrorAction SilentlyContinue
                foreach ($folder in $nestedFolders) {
                    if ((Test-Path "$($folder.FullName)\bin") -and (Test-Path "$($folder.FullName)\include") -and (Test-Path "$($folder.FullName)\lib\x64")) {
                        $cudnnPath = $folder.FullName
                        Write-Host "Found cuDNN at: $cudnnPath" -ForegroundColor Green
                        break
                    }
                }
            }
        }
    }

    # If still not found, use the provided path directly
    if (-not $cudnnPath) {
        $providedPath = "C:\Users\Darin Game\AppData\Local\Temp\cudnn_extract"
        if (Test-Path $providedPath) {
            Write-Host ""
            Write-Host "Checking provided path: $providedPath" -ForegroundColor Cyan
            # Check for nested structure
            $allFolders = Get-ChildItem -Path $providedPath -Recurse -Directory -ErrorAction SilentlyContinue
            foreach ($folder in $allFolders) {
                if ((Test-Path "$($folder.FullName)\bin") -and (Test-Path "$($folder.FullName)\include") -and (Test-Path "$($folder.FullName)\lib\x64")) {
                    $cudnnPath = $folder.FullName
                    Write-Host "Found cuDNN at: $cudnnPath" -ForegroundColor Green
                    break
                }
            }
        }
    }

    # Final check - if still not found, exit
    if (-not $cudnnPath) {
        Write-Host ""
        Write-Host "ERROR: cuDNN extraction folder not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please:" -ForegroundColor Yellow
        Write-Host "1. Run: cudnn_9.17.1_windows_x86_64.exe from Downloads folder"
        Write-Host "2. Extract it to a location"
        Write-Host "3. Run this script again"
        Write-Host ""
        exit 1
    }
}

Write-Host ""
Write-Host "Copying cuDNN files to CUDA directory..." -ForegroundColor Yellow
Write-Host ""

# Copy bin files
Write-Host "Copying bin files..." -ForegroundColor Cyan
try {
    Copy-Item "$cudnnPath\bin\*" -Destination "$cudaPath\bin\" -Force -ErrorAction Stop
    $binCount = (Get-ChildItem "$cudaPath\bin\cudnn*" -ErrorAction SilentlyContinue).Count
    Write-Host "  Copied bin files ($binCount files)" -ForegroundColor Green
}
catch {
    Write-Host "  Error copying bin files: $_" -ForegroundColor Red
    exit 1
}

# Copy include files
Write-Host "Copying include files..." -ForegroundColor Cyan
try {
    Copy-Item "$cudnnPath\include\*" -Destination "$cudaPath\include\" -Force -ErrorAction Stop
    $includeCount = (Get-ChildItem "$cudaPath\include\cudnn*" -ErrorAction SilentlyContinue).Count
    Write-Host "  Copied include files ($includeCount files)" -ForegroundColor Green
}
catch {
    Write-Host "  Error copying include files: $_" -ForegroundColor Red
    exit 1
}

# Copy lib files
Write-Host "Copying lib\x64 files..." -ForegroundColor Cyan
try {
    Copy-Item "$cudnnPath\lib\x64\*" -Destination "$cudaPath\lib\x64\" -Force -ErrorAction Stop
    $libCount = (Get-ChildItem "$cudaPath\lib\x64\cudnn*" -ErrorAction SilentlyContinue).Count
    Write-Host "  Copied lib\x64 files ($libCount files)" -ForegroundColor Green
}
catch {
    Write-Host "  Error copying lib files: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "cuDNN installation complete!" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Restart your computer (if not already done)"
Write-Host "2. Verify GPU detection with:"
Write-Host "   python -c `"import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))`""
Write-Host ""
