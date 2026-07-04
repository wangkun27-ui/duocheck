$serverPath = "d:\Documents\code\duocheck"
$nodeExe = "C:\Program Files\nodejs\node.exe"
$npxCmd = "C:\Program Files\nodejs\npx.cmd"

# Kill any existing instances
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Start node server as a background job (truly backgrounded, no window needed)
$serverJob = Start-Job -ScriptBlock {
    param($dir, $node)
    Set-Location $dir
    & $node "server.js" 2>&1
} -ArgumentList $serverPath, $nodeExe

# Wait for server to initialize
Start-Sleep -Seconds 5

# Start localtunnel with fixed subdomain as a background job
$tunnelJob = Start-Job -ScriptBlock {
    param($dir, $npx)
    Set-Location $dir
    & "cmd.exe" "/c" "`"$npx`" --yes localtunnel --port 3000 --subdomain duocheck-leonx" 2>&1
} -ArgumentList $serverPath, $npxCmd
