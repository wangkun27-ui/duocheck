@echo off
cd /d "%~dp0"
start "DuoCheckServer" "C:\Program Files\nodejs\node.exe" server.js
ping 127.0.0.1 -n 3 >nul
start "DuoCheckTunnel" /b cmd /c "ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run > tunnel.log 2>&1"
