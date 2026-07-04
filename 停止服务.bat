@echo off
title Stop DuoCheck Services

echo Stopping DuoCheck server and tunnel...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /f /pid %%a >nul 2>nul
taskkill /f /im node.exe >nul 2>nul
taskkill /f /im cloudflared.exe >nul 2>nul

echo.
echo ====================================================
echo  DuoCheck services stopped successfully!
echo ====================================================
echo.
pause
