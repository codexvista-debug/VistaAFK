#!/bin/bash
# ANSI Color Codes for Modern Terminal UI
CYAN='\033[0;36m'
BOLD_CYAN='\033[1;36m'
GREEN='\033[0;32m'
BOLD_GREEN='\033[1;32m'
YELLOW='\033[1;33m'
BOLD_YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD_RED='\033[1;31m'
MAGENTA='\033[0;35m'
BOLD_MAGENTA='\033[1;35m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
RESET='\033[0m'

echo -e "${BOLD_CYAN}┌──────────────────────────────────────────┐${RESET}"
echo -e "${BOLD_CYAN}│   ⚡ VistaAFK Daemon (Mobile Termux) ⚡   │${RESET}"
echo -e "${BOLD_CYAN}└──────────────────────────────────────────┘${RESET}"

# 0. Automatically acquire Termux Wake Lock so Android OS never sleeps or throttles daemon
if command -v termux-wake-lock &>/dev/null; then
  termux-wake-lock 2>/dev/null || true
  echo -e " ${GREEN}✔${RESET} Android wake lock active (24/7 background mode)"
fi

# 1. Kill any existing zombie processes
pkill -f "node dist/server.js" 2>/dev/null
pkill -f "dist/server.js" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
pkill -f "tsx" 2>/dev/null

# 2. Navigate to VistaAFK repository directory
if [ -d "$HOME/VistaAFK" ]; then
  cd "$HOME/VistaAFK"
elif [ -d "VistaAFK" ]; then
  cd VistaAFK
fi

# 3. Automatically pull the latest updates from GitHub
echo -e " ${CYAN}🔄${RESET} Checking for latest updates..."
git restore --worktree -- daemon/dist daemon/package-lock.json 2>/dev/null || true
git fetch origin main && git reset --hard origin/main || git pull origin main || { echo -e "${BOLD_RED}Git update failed. Resolve local changes and retry.${RESET}"; exit 1; }

# Keep global ~/start.sh in sync
if [ -f "start.sh" ] && [ -d "$HOME" ]; then
  cp start.sh "$HOME/start.sh" 2>/dev/null
fi

# 4. Navigate into daemon directory if not already there
if [ -d "daemon" ]; then
  cd daemon
fi

NODE_MAJOR_VERSION=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
if [ "$NODE_MAJOR_VERSION" -lt 24 ]; then
  if command -v pkg &>/dev/null; then
    echo -e " ${YELLOW}📦${RESET} Updating Termux to Node.js LTS (24+) and npm for Bedrock support..."
    pkg install nodejs-lts npm -y || true
    NODE_MAJOR_VERSION=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
  fi
  if [ "$NODE_MAJOR_VERSION" -lt 24 ]; then
    echo -e "${BOLD_RED}❌ Bedrock connections require Node.js 24+. Install nodejs-lts and npm, then run start.sh again.${RESET}"
    exit 1
  fi
fi
if ! command -v npm &>/dev/null; then
  if command -v pkg &>/dev/null; then
    echo -e " ${YELLOW}📦${RESET} Installing npm..."
    pkg install npm -y || true
  fi
  if ! command -v npm &>/dev/null; then
    echo -e "${BOLD_RED}❌ npm is required. Install the npm package and run start.sh again.${RESET}"
    exit 1
  fi
fi

# 5. Ensure Bedrock protocol dependencies are installed
if [ ! -d "node_modules/bedrock-protocol" ]; then
  echo -e " ${YELLOW}📦${RESET} Installing Bedrock support (pure JS, 0 compilation)..."
  npm install bedrock-protocol --ignore-scripts --omit=optional
fi

# Termux needs a compatibility fix for the bundled JavaScript RakNet transport.
echo -e " ${CYAN}🔧${RESET} Preparing Bedrock transport for Termux..."
node ./scripts/patch-mobile-raknet.cjs || {
  echo -e "${BOLD_RED}❌ Could not prepare Termux Bedrock transport.${RESET}"
  exit 1
}
bash ./scripts/prepare-mobile-raknet.sh

# Compile daemon source
if [ ! -x "node_modules/.bin/tsc" ]; then
  echo -e " ${YELLOW}📦${RESET} Installing daemon build dependencies..."
  npm install --include=dev --ignore-scripts --omit=optional || {
    echo -e "${BOLD_RED}❌ Could not install build dependencies.${RESET}"
    exit 1
  }
fi
echo -e " ${CYAN}🔨${RESET} Compiling daemon source..."
npm run build || {
  echo -e "${BOLD_RED}❌ Daemon build failed.${RESET}"
  exit 1
}

# 6. Ensure Cloudflare Tunnel, curl & termux-api are available
if ! command -v cloudflared &>/dev/null; then
  echo -e " ${YELLOW}🌐${RESET} Installing Cloudflare tunnel..."
  pkg install cloudflared -y 2>/dev/null || true
fi
if ! command -v curl &>/dev/null; then
  pkg install curl -y 2>/dev/null || true
fi
if ! command -v termux-notification &>/dev/null; then
  pkg install termux-api -y 2>/dev/null || true
fi

# 7. Check for user account credentials, CLI arguments, or reset flag
if [ "$1" == "--login" ] || [ "$1" == "-l" ] || [ "$1" == "--reset" ]; then
  rm -f user_auth.json ../user_auth.json 2>/dev/null
  echo -e " ${YELLOW}🧹${RESET} Reset account credentials."
elif [ -n "$1" ] && [ -n "$2" ]; then
  AUTH_USER="$1"
  AUTH_SECRET="$2"
  AUTH_CLOUD="${3:-https://vista-afk.vercel.app}"
  AUTH_CLOUD=$(echo "$AUTH_CLOUD" | sed 's:/*$::')
  echo "{\"username\":\"$AUTH_USER\",\"token\":\"$AUTH_SECRET\",\"password\":\"$AUTH_SECRET\",\"cloudUrl\":\"$AUTH_CLOUD\"}" > user_auth.json
  cp user_auth.json ../user_auth.json 2>/dev/null
  echo -e " ${GREEN}✅${RESET} Credentials auto-configured for '$AUTH_USER'!"
fi

CURRENT_USER=$(grep -o '"username":"[^"]*' user_auth.json 2>/dev/null | cut -d'"' -f4)
if [ -z "$CURRENT_USER" ]; then
  CURRENT_USER=$(grep -o '"username":"[^"]*' ../user_auth.json 2>/dev/null | cut -d'"' -f4)
fi

# 8. Start Cloudflare Tunnel in background for instant 1-click remote access
if command -v cloudflared &>/dev/null; then
  echo -e " ${CYAN}🌐${RESET} Establishing Cloudflare tunnel..."
  rm -f cloudflared.log 2>/dev/null
  cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8080 > cloudflared.log 2>&1 &
  
  # Wait up to 10 seconds for the tunnel to establish
  TUNNEL_URL=""
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' cloudflared.log 2>/dev/null | tail -n 1)
    if [ -n "$TUNNEL_URL" ]; then
      break
    fi
  done

  if [ -n "$TUNNEL_URL" ]; then
    WSS_URL=$(echo "$TUNNEL_URL" | sed 's/https:\/\//wss:\/\//')
    export DAEMON_PUBLIC_URL="$WSS_URL"
    
    TARGET_CLOUD=$(grep -o '"cloudUrl":"[^"]*' user_auth.json 2>/dev/null | cut -d'"' -f4)
    if [ -z "$TARGET_CLOUD" ]; then
      TARGET_CLOUD=$(grep -o '"cloudUrl":"[^"]*' ../user_auth.json 2>/dev/null | cut -d'"' -f4)
    fi
    if [ -z "$TARGET_CLOUD" ] || [ "$TARGET_CLOUD" == "https://afkvista.vercel.app" ]; then
      TARGET_CLOUD="https://vista-afk.vercel.app"
    fi
    TARGET_CLOUD=$(echo "$TARGET_CLOUD" | sed 's:/*$::')

    if [ -n "$CURRENT_USER" ]; then
      ONE_CLICK_URL="${TARGET_CLOUD}/?user=${CURRENT_USER}&connect=$WSS_URL"
    else
      ONE_CLICK_URL="${TARGET_CLOUD}/?connect=$WSS_URL"
    fi

    # Synchronously verify tunnel registration with cloud account
    VERIFY_STATUS="UNKNOWN"
    VERIFY_DETAIL=""
    if [ -n "$CURRENT_USER" ]; then
      echo -ne " ${CYAN}⏳${RESET} Registering tunnel with cloud (@${CURRENT_USER})... "
      AUTH_TOKEN_PAYLOAD=$(grep -o '"token":"[^"]*' user_auth.json 2>/dev/null | cut -d'"' -f4)
      if [ -z "$AUTH_TOKEN_PAYLOAD" ]; then
        AUTH_TOKEN_PAYLOAD=$(grep -o '"token":"[^"]*' ../user_auth.json 2>/dev/null | cut -d'"' -f4)
      fi
      
      HEARTBEAT_RES=$(curl -s -m 8 -X POST "${TARGET_CLOUD}/api/daemon/heartbeat" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$CURRENT_USER\",\"token\":\"$AUTH_TOKEN_PAYLOAD\",\"password\":\"$AUTH_TOKEN_PAYLOAD\",\"daemonUrl\":\"$WSS_URL\",\"deviceType\":\"mobile\",\"deviceLabel\":\"Mobile (Termux)\"}" 2>/dev/null)

      CONFIRMED_URL=$(echo "$HEARTBEAT_RES" | grep -o '"daemonUrl":"[^"]*' | cut -d'"' -f4)
      IS_SUCCESS=$(echo "$HEARTBEAT_RES" | grep -o '"success":true')

      if [ "$CONFIRMED_URL" == "$WSS_URL" ]; then
        VERIFY_STATUS="VERIFIED"
        VERIFY_DETAIL="Matched & Bound"
        echo -e "${BOLD_GREEN}VERIFIED!${RESET}"
      elif [ -n "$IS_SUCCESS" ]; then
        VERIFY_STATUS="VERIFIED"
        VERIFY_DETAIL="Acknowledged"
        echo -e "${BOLD_GREEN}CONFIRMED!${RESET}"
      else
        ERR_MSG=$(echo "$HEARTBEAT_RES" | grep -o '"error":"[^"]*' | cut -d'"' -f4)
        if [ -n "$ERR_MSG" ]; then
          VERIFY_STATUS="ERROR"
          VERIFY_DETAIL="$ERR_MSG"
          echo -e "${BOLD_RED}FAILED: $ERR_MSG${RESET}"
        else
          VERIFY_STATUS="PENDING"
          VERIFY_DETAIL="Background Sync"
          echo -e "${YELLOW}SYNCING${RESET}"
        fi
      fi

      # Secondary sync to default URL if user specified custom host
      if [ "$TARGET_CLOUD" != "https://vista-afk.vercel.app" ]; then
        curl -s -m 5 -X POST "https://vista-afk.vercel.app/api/daemon/heartbeat" \
          -H "Content-Type: application/json" \
          -d "{\"username\":\"$CURRENT_USER\",\"token\":\"$AUTH_TOKEN_PAYLOAD\",\"password\":\"$AUTH_TOKEN_PAYLOAD\",\"daemonUrl\":\"$WSS_URL\",\"deviceType\":\"mobile\",\"deviceLabel\":\"Mobile (Termux)\"}" >/dev/null 2>&1 &
      fi
    fi

    # Compact Mobile-Friendly Dashboard Status Box (Zero line-wrapping)
    echo ""
    echo -e "${BOLD_CYAN}  ┌──────────────────────────────────────────┐${RESET}"
    echo -e "${BOLD_CYAN}  │        ⚡  V I S T A  A F K  2 4 / 7     │${RESET}"
    echo -e "${BOLD_CYAN}  │      Mobile Termux Daemon • v1.2.23      │${RESET}"
    echo -e "${BOLD_CYAN}  └──────────────────────────────────────────┘${RESET}"
    echo ""
    echo -e "  ${WHITE}👤 User Account :${RESET} ${BOLD_GREEN}@${CURRENT_USER:-guest}${RESET}"
    if [ "$VERIFY_STATUS" == "VERIFIED" ]; then
      echo -e "  ${WHITE}🔒 Cloud Link   :${RESET} ${BOLD_GREEN}✔ ACTIVE${RESET} ${GRAY}(${VERIFY_DETAIL})${RESET}"
    elif [ "$VERIFY_STATUS" == "ERROR" ]; then
      echo -e "  ${WHITE}🔒 Cloud Link   :${RESET} ${BOLD_RED}✘ ${VERIFY_DETAIL}${RESET}"
    else
      echo -e "  ${WHITE}🔒 Cloud Link   :${RESET} ${YELLOW}⏳ ${VERIFY_DETAIL:-Pending}${RESET}"
    fi
    echo -e "  ${WHITE}🌐 Tunnel URL   :${RESET} ${CYAN}${WSS_URL}${RESET}"
    echo -e "  ${WHITE}📱 Device       :${RESET} ${BOLD_MAGENTA}Android Termux${RESET} ${GRAY}(Node $(node -v))${RESET}"
    echo -e "  ${WHITE}🚀 Web Portal   :${RESET} ${BOLD_CYAN}${ONE_CLICK_URL}${RESET}"
    echo ""
    echo -e "  ${GRAY}──────────────────────────────────────────${RESET}"
    echo -e "  ${BOLD_GREEN}✨ STREAMLINED MODE:${RESET}"
    echo -e "  ${GRAY}• Telemetry, chat & inv stream to web UI.${RESET}"
    echo -e "  ${GRAY}• Status bar notification tracks uptime.${RESET}"
    echo -e "  ${GRAY}• Resource packs are accepted automatically.${RESET}"
    echo -e "  ${GRAY}──────────────────────────────────────────${RESET}"
    echo ""
  fi
fi

# 9. Launch the daemon
export VISTAAFK_DEVICE_TYPE="mobile"
export VISTAAFK_DEVICE_LABEL="Mobile (Termux)"
export VISTAAFK_QUIET="true"
node dist/server.js
