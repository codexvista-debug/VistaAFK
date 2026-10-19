param(
    [string]$Username = "guest",
    [string]$Token = "token",
    [string]$CloudUrl = "https://vista-afk.vercel.app"
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "[*] Node.js not found. Auto-installing Node.js LTS via winget..." -ForegroundColor Yellow
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "[!] Node.js (LTS) is required to run VistaAFK." -ForegroundColor Red
        Write-Host "[>] Download and install Node.js from https://nodejs.org" -ForegroundColor Yellow
        Start-Process "https://nodejs.org/en/download"
        return
    }
}

$dest = Join-Path $HOME "VistaAFK"
$hasGit = (Get-Command git -ErrorAction SilentlyContinue) -ne $null

if ($hasGit) {
    if (Test-Path (Join-Path $dest ".git")) {
        Set-Location $dest
        git pull origin main 2>$null
    } elseif (Test-Path $dest) {
        Set-Location $dest
    } else {
        Write-Host "[*] Fetching VistaAFK..." -ForegroundColor Cyan
        git clone https://github.com/codexvista-debug/VistaAFK.git $dest
        Set-Location $dest
    }
} else {
    # No Git installed: download and unpack ZIP directly (0 dependencies, works on 100% of Windows PCs)
    if (-not (Test-Path (Join-Path $dest "start.ps1"))) {
        Write-Host "[*] Downloading VistaAFK from GitHub..." -ForegroundColor Cyan
        $zipFile = Join-Path $env:TEMP "VistaAFK.zip"
        $tempExtract = Join-Path $env:TEMP "VistaAFK_extract"
        Invoke-WebRequest -Uri "https://github.com/codexvista-debug/VistaAFK/archive/refs/heads/main.zip" -OutFile $zipFile -UseBasicParsing
        if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue }
        Expand-Archive -Path $zipFile -DestinationPath $tempExtract -Force
        if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
        Copy-Item -Path (Join-Path $tempExtract "VistaAFK-main\*") -Destination $dest -Recurse -Force
        Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
    }
    Set-Location $dest
}

$startScript = Join-Path $dest "start.ps1"
if (Test-Path $startScript) {
    powershell -ExecutionPolicy Bypass -File "$startScript" "$Username" "$Token" "$CloudUrl"
} else {
    Write-Host "[!] Could not find start.ps1 in $dest" -ForegroundColor Red
}

