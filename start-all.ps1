# PowerShell Launcher for Geofence Attendance System
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Locate Python executable
$pythonExe = "python"
if (Test-Path "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe") {
    $pythonExe = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
} elseif (Test-Path "$env:ProgramFiles\Python312\python.exe") {
    $pythonExe = "$env:ProgramFiles\Python312\python.exe"
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Starting Geofence Attendance Management System    " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Start Python ML Service
Write-Host "[1/3] Starting ML Anomaly & Biometric Service (Port 5001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot'; & '$pythonExe' ml-service/app/app.py"
Start-Sleep -Seconds 3

# 2. Start Backend API
Write-Host "[2/3] Starting Express Backend REST API (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot'; node backend/src/server.js"
Start-Sleep -Seconds 3

# 3. Start Frontend Web Server
Write-Host "[3/3] Starting Frontend Web Server (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot'; node frontend/serve.cjs"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  All 3 services successfully launched!             " -ForegroundColor Green
Write-Host "  - Web Application:   http://localhost:3000        " -ForegroundColor Green
Write-Host "  - Backend API:       http://localhost:5000/api   " -ForegroundColor Green
Write-Host "  - ML Anomaly Engine: http://localhost:5001        " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""

Start-Process "http://localhost:3000"
