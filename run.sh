#!/bin/bash
U="${1:-guest}"
T="${2:-token}"
C="${3:-https://vista-afk.vercel.app}"
command -v git &>/dev/null && command -v node &>/dev/null || pkg install -y git nodejs-lts npm cloudflared curl termux-api 2>/dev/null
if [ -d "$HOME/VistaAFK" ]; then
  cd "$HOME/VistaAFK" && git pull origin main 2>/dev/null || true
else
  git clone https://github.com/codexvista-debug/VistaAFK.git "$HOME/VistaAFK"
  cd "$HOME/VistaAFK"
fi
bash start.sh "$U" "$T" "$C"
