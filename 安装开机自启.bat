@echo off
title DuoCheck - Register Startup Task

echo Registering DuoCheck as a Windows startup task...

REM Delete old task if exists
schtasks /delete /tn "DuoCheckServer" /f >nul 2>nul
schtasks /delete /tn "DuoCheckTunnel" /f >nul 2>nul

REM Register node server to run at login (no window)
schtasks /create /tn "DuoCheckServer" /tr "\"C:\Program Files\nodejs\node.exe\" server.js" /sc onlogon /rl highest /f /sd 01/01/2024 >nul
if errorlevel 1 (
    echo ERROR: Failed to register server task. Try right-clicking this file and selecting "Run as administrator".
    pause
    exit /b 1
)

REM Register localtunnel to run at login after a 10-second delay
schtasks /create /tn "DuoCheckTunnel" /tr "\"C:\Program Files\nodejs\npx.cmd\" --yes localtunnel --port 3000 --subdomain duocheck-leonx" /sc onlogon /delay 0000:10 /rl highest /f /sd 01/01/2024 >nul
if errorlevel 1 (
    echo ERROR: Failed to register tunnel task.
    pause
    exit /b 1
)

REM Set working directory for both tasks
schtasks /change /tn "DuoCheckServer" /tr "cmd /c cd /d d:\Documents\code\duocheck && \"C:\Program Files\nodejs\node.exe\" server.js" >nul 2>nul

echo ====================================================
echo  SUCCESS! DuoCheck will now start automatically
echo  every time you log into Windows.
echo.
echo  Starting services right now...
echo ====================================================

REM Start immediately
schtasks /run /tn "DuoCheckServer"
timeout /t 5 /nobreak >nul
schtasks /run /tn "DuoCheckTunnel"

echo.
echo  Your FIXED public URL (never changes):
echo  https://duocheck-leonx.loca.lt
echo.
echo  Share this URL with your partner!
echo ====================================================
pause
