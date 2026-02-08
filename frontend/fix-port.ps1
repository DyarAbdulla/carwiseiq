# PowerShell script to free port 3002 and start frontend dev server

Write-Host "Checking for processes using port 3002..." -ForegroundColor Yellow

# Find process using port 3002
$process = Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($process) {
    Write-Host "Found process $process using port 3002. Killing it..." -ForegroundColor Red
    Stop-Process -Id $process -Force
    Start-Sleep -Seconds 2
    Write-Host "Process killed successfully!" -ForegroundColor Green
} else {
    Write-Host "Port 3002 is free!" -ForegroundColor Green
}

Write-Host "`nStarting frontend dev server..." -ForegroundColor Cyan
npm run dev
