# Run Supabase migrations via 'supabase db push'
# Usage: from project root, run: .\supabase\db-push.ps1
# Prereq: run 'npx supabase link' first (one-time) with your project ref + DB password.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

Write-Host "Running Supabase db push..." -ForegroundColor Cyan
npx supabase db push
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "If you see 'Cannot find project ref': run 'npx supabase link' first." -ForegroundColor Yellow
    Write-Host "  Project ref: Supabase Dashboard -> your project -> Settings -> General -> Reference ID" -ForegroundColor Gray
    Write-Host "  DB password: from project creation or Settings -> Database" -ForegroundColor Gray
    exit 1
}
Write-Host "Done." -ForegroundColor Green
