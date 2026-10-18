param(
    [string]$Username = "guest",
    [string]$Token = "token",
    [string]$CloudUrl = "https://vista-afk.vercel.app"
)
$ErrorActionPreference = "SilentlyContinue"
$dest = Join-Path $HOME "VistaAFK"
if (Test-Path $dest) {
    Set-Location $dest
    git pull origin main 2>$null
} else {
    git clone https://github.com/codexvista-debug/VistaAFK.git $dest
    Set-Location $dest
}
powershell -ExecutionPolicy Bypass -File .\start.ps1 "$Username" "$Token" "$CloudUrl"
