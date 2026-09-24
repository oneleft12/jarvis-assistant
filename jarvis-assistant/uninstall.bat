@echo off
title J.A.R.V.I.S. Uninstall

echo Removing autostart from registry...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v JARVIS /f >nul 2>&1

echo Stopping tunnel (server is left running)...
taskkill /IM cloudflared.exe /F >nul 2>&1

echo Done. Autostart disabled.
ping -n 7 127.0.0.1 >nul
