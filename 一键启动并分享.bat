@echo off
chcp 65001 > nul
title DuoCheck 一键启动与外网分享

echo ====================================================
echo        DuoCheck 搭档打卡网站一键启动器
echo ====================================================
echo.
echo [1/2] 正在后台启动本地服务器...
start "DuoCheck Local Server" cmd /c "node server.js"

echo.
echo [2/2] 正在建立公网访问通道（外网直接访问）...
echo.
echo ====================================================
echo  📢 请注意：
echo  下方连接成功后，输出的 "https://xxxx.lhr.life"
echo  就是你的【公网临时网址】！
echo  
echo  你只需把该链接发给搭档，TA 即可在任何设备（包括手机）上直接访问。
echo  
echo  ⚠️ 提示：
echo  1. 只要不关闭此窗口，通道就会一直保持。
echo  2. 如果想停止运行，直接关闭该窗口即可。
echo ====================================================
echo.

ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run

pause
