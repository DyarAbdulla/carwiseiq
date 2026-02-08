# Copy cuDNN from NVIDIA installation to CUDA directory
# This fixes the issue where NVIDIA installer doesn't copy files to CUDA

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Requesting administrator privileges..." -ForegroundColor Yellow
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Wait
    exit
}

Write-Host "========================================"
Write-Host "Copy cuDNN to CUDA Directory"
Write-Host "========================================"
Write-Host ""

$cudaPath = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"
$cudnnSource = "C:\Program Files\NVIDIA\cuDNN\v9.17"

# Check CUDA
if (-not (Test-Path $cudaPath)) {
    Write-Host "ERROR: CUDA not found at: $cudaPath" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "CUDA path: $cudaPath" -ForegroundColor Green

# Check cuDNN source
if (-not (Test-Path $cudnnSource)) {
    Write-Host "ERROR: cuDNN not found at: $cudnnSource" -ForegroundColor Red
    Write-Host ""
    Write-Host "Searching for cuDNN installation..." -ForegroundColor Yellow

    # Search for cuDNN
    $found = $false
    $searchPaths = @(
        "C:\Program Files\NVIDIA\cuDNN",
        "C:\Program Files\NVIDIA GPU Computing Toolkit\cuDNN"
    )

    foreach ($searchPath in $searchPaths) {
        if (Test-Path $searchPath) {
            $versionFolders = Get-ChildItem $searchPath -Directory | Where-Object { $_.Name -like "v*" } | Sort-Object Name -Descending
            foreach ($versionFolder in $versionFolders) {
                if ((Test-Path "$($versionFolder.FullName)\bin") -or (Test-Path "$($versionFolder.FullName)\include")) {
                    $cudnnSource = $versionFolder.FullName
                    Write-Host "Found cuDNN at: $cudnnSource" -ForegroundColor Green
                    $found = $true
                    break
                }
            }
            if ($found) { break }
        }
    }

    if (-not $found) {
        Write-Host "ERROR: Could not find cuDNN installation!" -ForegroundColor Red
        pause
        exit 1
    }
} else {
    Write-Host "cuDNN source: $cudnnSource" -ForegroundColor Green
}

Write-Host ""

# Copy files
Write-Host "========================================"
Write-Host "Copying cuDNN files to CUDA"
Write-Host "========================================"
Write-Host ""

try {
    # Copy bin files
    if (Test-Path "$cudnnSource\bin") {
        Write-Host "Copying bin files..." -ForegroundColor Yellow
        $binFiles = Get-ChildItem "$cudnnSource\bin" -File
        Copy-Item "$cudnnSource\bin\*" -Destination "$cudaPath\bin\" -Force -ErrorAction Stop
        Write-Host "  Copied $($binFiles.Count) files" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: bin folder not found in source" -ForegroundColor Yellow
    }

    # Copy include files
    if (Test-Path "$cudnnSource\include") {
        Write-Host "Copying include files..." -ForegroundColor Yellow
        $includeFiles = Get-ChildItem "$cudnnSource\include" -Recurse -File
        Copy-Item "$cudnnSource\include\*" -Destination "$cudaPath\include\" -Force -Recurse -ErrorAction Stop
        Write-Host "  Copied $($includeFiles.Count) files" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: include folder not found in source" -ForegroundColor Yellow
    }

    # Copy lib files
    $libSource = "$cudnnSource\lib"
    if (Test-Path "$libSource\x64") {
        $libSource = "$libSource\x64"
    }

    if (Test-Path $libSource) {
        Write-Host "Copying lib files..." -ForegroundColor Yellow
        $libFiles = Get-ChildItem $libSource -File -Filter "*.dll","*.lib"
        Copy-Item "$libSource\*" -Destination "$cudaPath\lib\x64\" -Force -ErrorAction Stop
        Write-Host "  Copied $($libFiles.Count) files" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: lib folder not found in source" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "Verifying installation"
    Write-Host "========================================"
    Write-Host ""

    $binCount = (Get-ChildItem "$cudaPath\bin\cudnn*" -ErrorAction SilentlyContinue).Count
    $includeCount = (Get-ChildItem "$cudaPath\include\cudnn*" -ErrorAction SilentlyContinue).Count
    $libCount = (Get-ChildItem "$cudaPath\lib\x64\cudnn*" -ErrorAction SilentlyContinue).Count

    Write-Host "cuDNN files in CUDA directory:" -ForegroundColor Cyan
    Write-Host "  Bin: $binCount files" -ForegroundColor $(if ($binCount -gt 0) { "Green" } else { "Red" })
    Write-Host "  Include: $includeCount files" -ForegroundColor $(if ($includeCount -gt 0) { "Green" } else { "Red" })
    Write-Host "  Lib: $libCount files" -ForegroundColor $(if ($libCount -gt 0) { "Green" } else { "Red" })

    Write-Host ""

    if ($binCount -gt 0 -or $includeCount -gt 0 -or $libCount -gt 0) {
        Write-Host "========================================"
        Write-Host "SUCCESS: cuDNN copied to CUDA!" -ForegroundColor Green
        Write-Host "========================================"
        Write-Host ""
        Write-Host "IMPORTANT: RESTART your computer now!" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "After restart, verify GPU detection with:" -ForegroundColor Yellow
        Write-Host "  python -c `"import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))`"" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "WARNING: No cuDNN files found after copy!" -ForegroundColor Yellow
        Write-Host "Checking source structure..." -ForegroundColor Yellow
        Get-ChildItem $cudnnSource -Recurse | Select-Object FullName -First 20
    }

} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to copy files: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
}

pause
