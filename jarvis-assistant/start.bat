@echo off
title J.A.R.V.I.S. Launcher
cd /d "%~dp0"

echo [1/2] Checking server on :3000 (WSL)...
wsl.exe -e bash -lc "ss -ltn | grep -q ':3000 '"
if errorlevel 1 (
  echo       Starting node server in WSL...
  start /min "JARVIS-Server" wsl.exe -e bash -lc "cd /mnt/c/Projects/jarvis-assistant && exec node server.js"
) else (
  echo       Server already running.
)

echo [2/2] Checking tunnel windowshelper.win...
tasklist /FI "IMAGENAME eq cloudflared.exe" | findstr /I cloudflared >nul
if errorlevel 1 (
  echo       Starting cloudflared tunnel run jarvis...
  start /min "JARVIS-Tunnel" "%~dp0cloudflared.exe" tunnel run jarvis
) else (
  echo       Tunnel already running.
)

echo Done: https://windowshelper.win
