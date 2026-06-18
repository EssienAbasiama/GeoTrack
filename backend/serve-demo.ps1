# GeoTrack demo launcher
# Starts the Laravel API on :8000 and exposes it publicly via ngrok.
# Usage:  right-click > "Run with PowerShell"   (or:  pwsh ./serve-demo.ps1)
#
# If you have reserved a free static ngrok domain (dashboard.ngrok.com/domains),
# set it here so the public URL never changes between restarts:
$StaticDomain = ""   # e.g. "geotrack-abasiama.ngrok-free.app"

$ErrorActionPreference = "Stop"
$be  = $PSScriptRoot
$ng  = "$env:APPDATA\npm\node_modules\ngrok\bin\ngrok.exe"

Write-Host "Starting Laravel API on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Start-Process -FilePath "php" -ArgumentList "artisan","serve","--host=127.0.0.1","--port=8000" -WorkingDirectory $be -WindowStyle Minimized

Start-Sleep -Seconds 3

Write-Host "Opening public ngrok tunnel ..." -ForegroundColor Cyan
if ($StaticDomain) {
    Start-Process -FilePath $ng -ArgumentList "http","8000","--url=$StaticDomain" -WindowStyle Minimized
} else {
    Start-Process -FilePath $ng -ArgumentList "http","8000" -WindowStyle Minimized
}

Start-Sleep -Seconds 5
try {
    $t  = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 10
    $url = ($t.tunnels | Select-Object -First 1).public_url
    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host " PUBLIC API URL : $url" -ForegroundColor Green
    Write-Host " Mobile env     : EXPO_PUBLIC_API_BASE_URL=$url/api" -ForegroundColor Green
    Write-Host " ngrok dashboard: http://127.0.0.1:4040" -ForegroundColor Green
    Write-Host "==================================================================" -ForegroundColor Green
} catch {
    Write-Host "Could not read tunnel URL yet - check http://127.0.0.1:4040" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Leave this running during your demo. Press Enter to STOP everything." -ForegroundColor Yellow
[void](Read-Host)
Get-Process php,ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Stopped." -ForegroundColor Cyan
