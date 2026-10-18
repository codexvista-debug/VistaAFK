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
$ErrorActionPreference = "SilentlyContinue"
$u = "${u}"
$t = "${t}"
$c = "${c}"
$dest = Join-Path $HOME "VistaAFK"
if (Test-Path $dest) {
    Set-Location $dest
    git pull origin main 2>$null
} else {
    git clone https://github.com/codexvista-debug/VistaAFK.git $dest
    Set-Location $dest
}
powershell -ExecutionPolicy Bypass -File .\\start.ps1 "$u" "$t" "$c"
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
