@echo off
title J.A.R.V.I.S. Installer

echo Registering autostart in HKCU Run (no admin needed)...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v JARVIS /t REG_SZ /d "%~dp0start.bat" /f >nul
if errorlevel 1 (
  echo FAILED to write registry.
  ping -n 11 127.0.0.1 >nul
  exit /b 1
)
echo OK - start.bat will run at Windows logon.

echo Launching now...
start "" "%~dp0start.bat"

echo.
echo Site: https://windowshelper.win  (PIN 1212)
echo Remove autostart: uninstall.bat
ping -n 9 127.0.0.1 >nul
