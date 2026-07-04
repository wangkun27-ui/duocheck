@echo off
title DuoCheck Service Manager

echo Checking and stopping existing DuoCheck services...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /f /pid %%a >nul 2>nul
taskkill /f /im node.exe >nul 2>nul
taskkill /f /im ssh.exe >nul 2>nul
ping 127.0.0.1 -n 2 >nul

echo [1/2] Starting DuoCheck Local Server...
start "DuoCheckServer" "C:\Program Files\nodejs\node.exe" server.js
ping 127.0.0.1 -n 4 >nul

echo ====================================================
echo  DuoCheck is running!
echo  No IP verification needed for visitors!
echo.
echo  Your fixed public URL is updated:
echo  https://duocheck-leonx2.loca.lt
echo.
echo  If localtunnel asks for a password/IP, enter:
echo  185.220.239.10
echo ====================================================
echo.
pause
