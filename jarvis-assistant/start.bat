@echo off
chcp 65001 >nul
title J.A.R.V.I.S. Server
cd /d "%~dp0"

echo ============================================
echo   J.A.R.V.I.S. - zapusk servera i tunnelya
echo ============================================

rem --- 1. Server (esli zavis - perezapusk) ---
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js ne naiden. Postav: https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo [*] Ustanovka zavisimostej...
  call npm install --no-audit --no-fund
)

echo [*] Server: http://localhost:3000
start "JARVIS-Server" cmd /c "node server.js"
timeout /t 2 >nul

rem --- 2. Cloudflare Tunnel (skachivaetsya odnazhdy) ---
if not exist cloudflared.exe (
  echo [*] Skachivayu cloudflared.exe...
  curl -sL -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  if not exist cloudflared.exe (
    echo [!] Ne udalos skachat cloudflared.exe
    pause
    exit /b 1
  )
)

echo.
echo [*] Tunnel zapuskaetsya - link nizhe (budet gotov cherez ~10 sek):
echo.
echo     Otkroyte etu ssylku s LYUBOGO ustroystva
echo.
cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate

pause
