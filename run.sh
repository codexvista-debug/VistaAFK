#!/bin/bash
U="${1:-guest}"
T="${2:-token}"
C="${3:-https://vista-afk.vercel.app}"

clear 2>/dev/null || true
echo -e "\033[1;36m┌──────────────────────────────────────────┐\033[0m"
echo -e "\033[1;36m│   ⚡  VistaAFK Instant Mobile Setup  ⚡   │\033[0m"
echo -e "\033[1;36m└──────────────────────────────────────────┘\033[0m"
echo ""

# Acquire wake lock early for 24/7 background operation
command -v termux-wake-lock &>/dev/null && termux-wake-lock 2>/dev/null || true

# 1. Environment check
echo -ne " \033[1;33m⏳\033[0m [1/3] Preparing mobile environment... "
MISSING_PKGS=""
command -v git &>/dev/null || MISSING_PKGS="$MISSING_PKGS git"
command -v node &>/dev/null || MISSING_PKGS="$MISSING_PKGS nodejs-lts npm"
command -v cloudflared &>/dev/null || MISSING_PKGS="$MISSING_PKGS cloudflared"
command -v curl &>/dev/null || MISSING_PKGS="$MISSING_PKGS curl"
command -v termux-notification &>/dev/null || MISSING_PKGS="$MISSING_PKGS termux-api"

if [ -n "$MISSING_PKGS" ]; then
  pkg install -y -q $MISSING_PKGS >/dev/null 2>&1 || true
fi
echo -e "\033[1;32m✔ Done!\033[0m"

# 2. Fetch engine
echo -ne " \033[1;33m⏳\033[0m [2/3] Fetching VistaAFK engine... "
if [ -d "$HOME/VistaAFK" ]; then
  cd "$HOME/VistaAFK"
  (git fetch --quiet origin main && git reset --hard origin/main) >/dev/null 2>&1 || git pull --quiet origin main >/dev/null 2>&1 || true
else
  git clone --quiet --depth 1 https://github.com/codexvista-debug/VistaAFK.git "$HOME/VistaAFK" >/dev/null 2>&1
  cd "$HOME/VistaAFK"
fi
echo -e "\033[1;32m✔ Ready!\033[0m"

# 3. Launch daemon
echo -e " \033[1;32m🚀\033[0m [3/3] Launching background daemon..."
echo ""
bash start.sh "$U" "$T" "$C"

