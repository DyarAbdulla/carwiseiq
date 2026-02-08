# Unlock All Files Script
# Run this script to unlock all files in the project

Write-Host "Unlocking all files..." -ForegroundColor Green

# Remove read-only attributes
Get-ChildItem -Recurse -File | Where-Object { $_.IsReadOnly } | ForEach-Object { 
    $_.IsReadOnly = $false 
    Write-Host "Unlocked: $($_.FullName)" -ForegroundColor Yellow
}

# Grant full control permissions
$username = $env:USERNAME
icacls . /grant "${username}:(OI)(CI)F" /T /C /Q | Out-Null

Write-Host "`nAll files unlocked and permissions granted!" -ForegroundColor Green
Write-Host "You now have full control over all files." -ForegroundColor Green
