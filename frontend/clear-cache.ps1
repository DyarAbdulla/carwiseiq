# PowerShell script to clear Next.js build cache
# Run this if you encounter "Cannot find module" errors

Write-Host "Clearing Next.js build cache..." -ForegroundColor Yellow

# Stop any running Node processes
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Remove cache directories
$cacheDirs = @(".next", ".next-cache", "node_modules/.cache", "tsconfig.tsbuildinfo")

foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
        if (Test-Path $dir -PathType Container) {
            Remove-Item -Recurse -Force $dir
        } else {
            Remove-Item -Force $dir
        }
        Write-Host "✅ Cleared: $dir" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Not found: $dir" -ForegroundColor Gray
    }
}

Write-Host "`n✅ Cache cleared successfully!" -ForegroundColor Green
Write-Host "You can now run: npm run dev" -ForegroundColor Cyan









