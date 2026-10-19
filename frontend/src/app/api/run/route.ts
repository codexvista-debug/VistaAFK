import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const u = (url.searchParams.get('u') || url.searchParams.get('user') || 'guest').trim();
  const t = (url.searchParams.get('t') || url.searchParams.get('token') || '').trim();
  const rawOrigin = url.searchParams.get('c') || url.origin || 'https://vista-afk.vercel.app';
  const c = rawOrigin.replace(/\/+$/, '');

  const shellParam = (url.searchParams.get('shell') || '').toLowerCase();
  const userAgent = (req.headers.get('user-agent') || '').toLowerCase();
  const isPowerShell = shellParam === 'ps' || shellParam === 'powershell' || userAgent.includes('powershell');

  if (isPowerShell) {
    const psScript = `# VistaAFK 1-Click Windows Launcher
$u = "${u}"
$t = "${t}"
$c = "${c}"
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
        Copy-Item -Path (Join-Path $tempExtract "VistaAFK-main\\*") -Destination $dest -Recurse -Force
        Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
    }
    Set-Location $dest
}

$startScript = Join-Path $dest "start.ps1"
if (Test-Path $startScript) {
    powershell -ExecutionPolicy Bypass -File "$startScript" "$u" "$t" "$c"
} else {
    Write-Host "[!] Could not find start.ps1 in $dest" -ForegroundColor Red
}
`;
    return new NextResponse(psScript, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // Default to Mobile Termux Bash Script
  const shScript = `#!/bin/bash
U="${u}"
T="${t}"
C="${c}"

clear 2>/dev/null || true
echo -e "\\033[1;36m┌──────────────────────────────────────────┐\\033[0m"
echo -e "\\033[1;36m│   ⚡  VistaAFK Instant Mobile Setup  ⚡   │\\033[0m"
echo -e "\\033[1;36m└──────────────────────────────────────────┘\\033[0m"
echo ""

# Acquire wake lock early for 24/7 background operation
command -v termux-wake-lock &>/dev/null && termux-wake-lock 2>/dev/null || true

# 1. Environment check
echo -ne " \\033[1;33m⏳\\033[0m [1/3] Preparing mobile environment... "
MISSING_PKGS=""
command -v git &>/dev/null || MISSING_PKGS="$MISSING_PKGS git"
command -v node &>/dev/null || MISSING_PKGS="$MISSING_PKGS nodejs-lts npm"
command -v cloudflared &>/dev/null || MISSING_PKGS="$MISSING_PKGS cloudflared"
command -v curl &>/dev/null || MISSING_PKGS="$MISSING_PKGS curl"
command -v termux-notification &>/dev/null || MISSING_PKGS="$MISSING_PKGS termux-api"

if [ -n "$MISSING_PKGS" ]; then
  pkg install -y -q $MISSING_PKGS >/dev/null 2>&1 || true
fi
echo -e "\\033[1;32m✔ Done!\\033[0m"

# 2. Fetch engine
echo -ne " \\033[1;33m⏳\\033[0m [2/3] Fetching VistaAFK engine... "
if [ -d "$HOME/VistaAFK" ]; then
  cd "$HOME/VistaAFK"
  (git fetch --quiet origin main && git reset --hard origin/main) >/dev/null 2>&1 || git pull --quiet origin main >/dev/null 2>&1 || true
else
  git clone --quiet --depth 1 https://github.com/codexvista-debug/VistaAFK.git "$HOME/VistaAFK" >/dev/null 2>&1
  cd "$HOME/VistaAFK"
fi
echo -e "\\033[1;32m✔ Ready!\\033[0m"

# 3. Launch daemon
echo -e " \\033[1;32m🚀\\033[0m [3/3] Launching background daemon..."
echo ""
bash start.sh "$U" "$T" "$C"
`;

  return new NextResponse(shScript, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
