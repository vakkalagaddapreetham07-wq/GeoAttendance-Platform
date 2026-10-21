@echo off
cd /d "%~dp0"
title Geofence Attendance System Launcher

echo ====================================================================
echo   Starting Geofence Attendance Management System Services
echo ====================================================================
echo.

:: Detect Python executable
set "PYTHON_CMD=python"
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else if exist "%ProgramFiles%\Python312\python.exe" (
    set "PYTHON_CMD=%ProgramFiles%\Python312\python.exe"
)

echo [1/3] Starting Python ML & Biometric Service (Port 5001)...
start "ML Anomaly & Face Service (Port 5001)" cmd /k ""%PYTHON_CMD%" ml-service\app\app.py"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Express Backend REST API (Port 5000)...
start "Backend REST API (Port 5000)" cmd /k "node backend\src\server.js"
timeout /t 3 /nobreak >nul

echo [3/3] Starting React Frontend Web Application (Port 3000)...
start "Frontend Web Server (Port 3000)" cmd /k "node frontend\serve.cjs"
timeout /t 2 /nobreak >nul

echo.
echo ====================================================================
echo   All 3 services successfully launched in separate windows!
echo   ------------------------------------------------------------
echo   - Web Application:     http://localhost:3000
echo   - Backend REST API:    http://localhost:5000/api
echo   - ML Anomaly Engine:   http://localhost:5001
echo ====================================================================
echo.
echo Opening http://localhost:3000 in your browser...
start http://localhost:3000

echo.
echo Leave this launcher window or press any key to close launcher.
echo (The 3 service windows will keep running in the background.)
pause >nul
