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
command -v git &>/dev/null && command -v node &>/dev/null || pkg install -y git nodejs-lts npm cloudflared curl termux-api 2>/dev/null
if [ -d "$HOME/VistaAFK" ]; then
  cd "$HOME/VistaAFK" && git pull origin main 2>/dev/null || true
else
  git clone https://github.com/codexvista-debug/VistaAFK.git "$HOME/VistaAFK"
  cd "$HOME/VistaAFK"
fi
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
