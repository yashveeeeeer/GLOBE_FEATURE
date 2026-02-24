# Start the Globe dev server (uses Node from AppData\Local\node if npm not in PATH)
$nodeRoot = "$env:LOCALAPPDATA\node\node-v22.14.0-win-x64"
$npm = Join-Path $nodeRoot "npm.cmd"
if (-not (Test-Path $npm)) {
  Write-Host "Node not found at $nodeRoot. Install Node or run: npm run dev" -ForegroundColor Red
  exit 1
}
Set-Location $PSScriptRoot
& $npm run dev
