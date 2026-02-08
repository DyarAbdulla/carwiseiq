# Restore Files to 4:21 AM State
# Target Commit: 9b887b4 (Mon Dec 22 04:21:55 2025)

Write-Host "=== File Restoration Script ===" -ForegroundColor Cyan
Write-Host "Target: 4:21 AM (Dec 22, 2025) - Commit 9b887b4" -ForegroundColor Yellow
Write-Host ""

$projectRoot = "C:\Car prices definer program local C"
Set-Location $projectRoot

# List of files that need restoration
$filesToRestore = @(
    @{Path = "frontend\app\[locale]\batch\page.tsx"; Name = "Batch Prediction Page"},
    @{Path = "frontend\app\[locale]\compare\page.tsx"; Name = "Compare Cars Page"},
    @{Path = "frontend\app\[locale]\budget\page.tsx"; Name = "Budget Finder Page"},
    @{Path = "frontend\app\[locale]\stats\page.tsx"; Name = "Dataset Statistics Page"},
    @{Path = "frontend\app\[locale]\docs\page.tsx"; Name = "API Documentation Page"},
    @{Path = "frontend\lib\types.ts"; Name = "Types Definition"},
    @{Path = "frontend\components\prediction\PredictionForm.tsx"; Name = "Prediction Form Component"},
    @{Path = "backend\app\api\routes\predict.py"; Name = "Backend Predict Route"}
)

Write-Host "=== Files Status ===" -ForegroundColor Cyan
foreach ($file in $filesToRestore) {
    $fullPath = Join-Path $projectRoot $file.Path
    if (Test-Path $fullPath) {
        $info = Get-Item $fullPath
        Write-Host "OK $($file.Name)" -ForegroundColor Green
        Write-Host "  Path: $($file.Path)" -ForegroundColor Gray
        Write-Host "  Last Modified: $($info.LastWriteTime)" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "NOT FOUND $($file.Name)" -ForegroundColor Red
        Write-Host "  Path: $($file.Path)" -ForegroundColor Gray
        Write-Host ""
    }
}

Write-Host ""
Write-Host "=== Restoration Options ===" -ForegroundColor Cyan
Write-Host "1. Windows File History (Recommended)" -ForegroundColor Yellow
Write-Host "   - Press Win+R" -ForegroundColor White
Write-Host "   - Type: control /name Microsoft.FileHistory" -ForegroundColor White
Write-Host "   - Navigate to files from 4:21 AM on Dec 22, 2025" -ForegroundColor White
Write-Host "   - Restore each file" -ForegroundColor White

Write-Host ""
Write-Host "2. Restore Backend from Git" -ForegroundColor Yellow
Write-Host "   Run: git checkout 9b887b4 -- backend/" -ForegroundColor White

Write-Host ""
Write-Host "3. Manual Restoration" -ForegroundColor Yellow
Write-Host "   - Remove enhancements from each file" -ForegroundColor White
Write-Host "   - Simplify UI back to basic versions" -ForegroundColor White
Write-Host "   - See RESTORE_TO_4_21_AM.md for details" -ForegroundColor White

Write-Host ""
Write-Host "=== Checking Git Status ===" -ForegroundColor Cyan
git status --short | Select-Object -First 10

Write-Host ""
Write-Host "=== Checking Commit 9b887b4 ===" -ForegroundColor Cyan
$commitFiles = git show 9b887b4 --name-only --pretty=format:"" | Where-Object { $_ -ne "" }
if ($commitFiles) {
    Write-Host "Files in commit 9b887b4:" -ForegroundColor Green
    $commitFiles | Select-Object -First 10
} else {
    Write-Host "No files found in commit 9b887b4" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Check Windows File History for frontend files" -ForegroundColor White
Write-Host "2. Restore backend files from git if needed" -ForegroundColor White
Write-Host "3. Verify all files are restored correctly" -ForegroundColor White
Write-Host "4. Test the application" -ForegroundColor White
