```bat
@echo off
title KTX System Launcher

set "PROJECT=%~dp0"

echo =====================================
echo       KTX SYSTEM - STARTING
echo =====================================

cd /d "%PROJECT%"

echo Checking backend...

powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000/health' -TimeoutSec 3 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"

if errorlevel 1 (
    echo Starting KTX Backend...
    start "KTX Backend" powershell.exe -NoExit -Command "Set-Location '%PROJECT%'; npm start"
) else (
    echo Backend is already running.
)

timeout /t 5 /nobreak >nul

echo Checking ngrok...

powershell -NoProfile -Command "if (Get-Process ngrok -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"

if errorlevel 1 (
    echo Starting KTX Ngrok...
    start "KTX Ngrok" powershell.exe -NoExit -Command "ngrok http 3000"
) else (
    echo Ngrok is already running.
)

echo.
echo KTX launcher completed.
pause
```
