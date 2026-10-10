param(
    [Parameter(Position=0)]
    [string]$Username = "",
    [Parameter(Position=1)]
    [string]$Token = "",
    [Parameter(Position=2)]
    [string]$CloudUrl = "https://vista-afk.vercel.app",
    [switch]$Reset
)

$ErrorActionPreference = "Continue"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "      Starting VistaAFK Daemon (Windows PC)  " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Terminate any previous instances on port 8080
try {
    $processes = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
    foreach ($proc in $processes) {
        if ($proc.OwningProcess) {
            Stop-Process -Id $proc.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
} catch {}

# Stop lingering cloudflared processes from previous runs
Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue

# 2. Check Node.js installation
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Node.js is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js (LTS version) from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# 3. Navigate into repository root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($ScriptDir) {
    Set-Location $ScriptDir
}

# Pull latest updates if in git repo
try {
    if (Test-Path ".git") {
        Write-Host "[*] Checking for latest VistaAFK updates..." -ForegroundColor Gray
        git pull origin main 2>$null
    }
} catch {}

# 4. Check credentials
$DaemonDir = Join-Path (Get-Location) "daemon"
if (-not (Test-Path $DaemonDir)) {
    $DaemonDir = Get-Location
}

if ($Reset) {
    Remove-Item (Join-Path $DaemonDir "user_auth.json") -Force -ErrorAction SilentlyContinue
    Remove-Item "user_auth.json" -Force -ErrorAction SilentlyContinue
    Write-Host "[*] Reset account credentials." -ForegroundColor Yellow
} elseif ($Username -and $Token) {
    $cleanCloud = $CloudUrl.TrimEnd('/')
    $authObj = @{
        username = $Username
        token = $Token
        password = $Token
        cloudUrl = $cleanCloud
    }
    $authJson = $authObj | ConvertTo-Json -Compress
    Set-Content -Path (Join-Path $DaemonDir "user_auth.json") -Value $authJson -Encoding UTF8
    Set-Content -Path "user_auth.json" -Value $authJson -Encoding UTF8
    Write-Host "[+] Account credentials linked to $Username (Cloud: $cleanCloud)!" -ForegroundColor Green
}

# 5. Check dependencies and rebuild the daemon so source updates are used immediately.
Set-Location $DaemonDir

if (-not (Test-Path "node_modules\.bin\tsc.cmd")) {
    Write-Host "[*] Installing daemon dependencies and TypeScript build tools..." -ForegroundColor Yellow
    npm install --include=dev --omit=optional
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] Dependency installation failed. Daemon was not started." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[*] Compiling the latest daemon source..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Daemon build failed. Daemon was not started." -ForegroundColor Red
    exit 1
}

# 6. Start Cloudflare Tunnel for secure cloud access
$CloudflaredBin = "cloudflared"
$HasCloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue) -ne $null

# If cloudflared is not installed, download the official standalone executable
if (-not $HasCloudflared) {
    $LocalBinDir = Join-Path $DaemonDir "bin"
    if (-not (Test-Path $LocalBinDir)) { New-Item -ItemType Directory -Path $LocalBinDir | Out-Null }
    $LocalCloudflared = Join-Path $LocalBinDir "cloudflared.exe"
    
    if (-not (Test-Path $LocalCloudflared)) {
        Write-Host "[*] Downloading Cloudflare tunnel for remote access from anywhere..." -ForegroundColor Yellow
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $LocalCloudflared -UseBasicParsing
        } catch {
            Write-Host "[-] Could not auto-download cloudflared. Falling back to local access (ws://localhost:8080)." -ForegroundColor Gray
        }
    }
    
    if (Test-Path $LocalCloudflared) {
        $CloudflaredBin = $LocalCloudflared
        $HasCloudflared = $true
    }
}

if ($HasCloudflared) {
    Write-Host "[*] Starting secure Cloudflare tunnel..." -ForegroundColor Cyan
    Remove-Item "cloudflared.log" -Force -ErrorAction SilentlyContinue
    Remove-Item "cloudflared.err" -Force -ErrorAction SilentlyContinue
    
    Start-Process -FilePath $CloudflaredBin -ArgumentList "tunnel --no-autoupdate --url http://127.0.0.1:8080" -RedirectStandardOutput "cloudflared.log" -RedirectStandardError "cloudflared.err" -WindowStyle Hidden
    
    # Wait up to 10 seconds for the public trycloudflare.com URL
    $TunnelUrl = ""
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path "cloudflared.err") {
            $errContent = Get-Content "cloudflared.err" -Raw -ErrorAction SilentlyContinue
            if ($errContent -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
                $TunnelUrl = $matches[0]
                break
            }
        }
        if (Test-Path "cloudflared.log") {
            $logContent = Get-Content "cloudflared.log" -Raw -ErrorAction SilentlyContinue
            if ($logContent -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
                $TunnelUrl = $matches[0]
                break
            }
        }
    }
    
    if ($TunnelUrl) {
        $WssUrl = $TunnelUrl -replace "https://", "wss://"
        $env:DAEMON_PUBLIC_URL = $WssUrl
        
        # Read current auth info for cloud heartbeat
        $currentUser = $Username
        $currentToken = $Token
        $targetCloud = $CloudUrl.TrimEnd('/')
        if (Test-Path "user_auth.json") {
            try {
                $authData = Get-Content "user_auth.json" -Raw | ConvertFrom-Json
                if ($authData.username) { $currentUser = $authData.username }
                if ($authData.token) { $currentToken = $authData.token }
                if ($authData.cloudUrl) { $targetCloud = $authData.cloudUrl.TrimEnd('/') }
            } catch {}
        }
        
        if ($currentUser) {
            Write-Host "[+] Auto-linking tunnel to VistaAFK account: $currentUser..." -ForegroundColor Green
            $payload = @{
                username = $currentUser
                token = $currentToken
                password = $currentToken
                daemonUrl = $WssUrl
                deviceType = "pc"
                deviceLabel = "Windows PC"
            } | ConvertTo-Json -Compress
            
            try {
                Invoke-RestMethod -Uri "$targetCloud/api/daemon/heartbeat" -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 5 -ErrorAction SilentlyContinue | Out-Null
            } catch {}
        }
        
        Write-Host ""
        Write-Host "=============================================================" -ForegroundColor Green
        Write-Host "  [+] VistaAFK Bot Daemon is RUNNING on your PC!" -ForegroundColor Green
        Write-Host "=============================================================" -ForegroundColor Green
        Write-Host "  AUTO-CONNECTED: Web dashboard is connected to this daemon!" -ForegroundColor Yellow
        Write-Host "  Public WSS: $WssUrl" -ForegroundColor Cyan
        Write-Host "  Local WS:   ws://localhost:8080" -ForegroundColor Cyan
        Write-Host "=============================================================" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "[*] Tunnel starting in background. Local daemon running on ws://localhost:8080" -ForegroundColor Yellow
    }
} else {
    Write-Host "[*] Running local daemon on ws://localhost:8080" -ForegroundColor Yellow
}

# 7. Start the Daemon Node server
$env:VISTAAFK_DEVICE_TYPE = "pc"
$env:VISTAAFK_DEVICE_LABEL = "Windows PC"
Write-Host "[+] Launching VistaAFK Daemon on port 8080 (Windows PC)..." -ForegroundColor Green
node dist/server.js
