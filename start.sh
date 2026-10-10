#!/bin/bash
echo "============================================="
echo "      🚀 Starting VistaAFK Daemon v1.2.4      "
echo "============================================="

# 0. Automatically acquire Termux Wake Lock so Android OS never sleeps or throttles daemon
if command -v termux-wake-lock &>/dev/null; then
  termux-wake-lock 2>/dev/null || true
  echo "🔒 Android wake lock acquired (24/7 background mode active)"
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
echo "🔄 Checking for latest VistaAFK updates..."
git pull origin main

# Keep global ~/start.sh in sync
if [ -f "start.sh" ] && [ -d "$HOME" ]; then
  cp start.sh "$HOME/start.sh" 2>/dev/null
fi

# 4. Navigate into daemon directory if not already there
if [ -d "daemon" ]; then
  cd daemon
fi

# 5. Ensure Bedrock protocol dependencies are installed
if [ ! -d "node_modules/bedrock-protocol" ]; then
  echo "📦 Installing Bedrock support (pure JS, 0 compilation)..."
  npm install bedrock-protocol --ignore-scripts --omit=optional
fi

# Always compile after pulling updates. Running the old dist files leaves the
# daemon's telemetry (including inventory enchantments) stale.
if [ ! -x "node_modules/.bin/tsc" ]; then
  echo "📦 Installing daemon build dependencies..."
  npm install --include=dev --ignore-scripts --omit=optional || {
    echo "❌ Could not install TypeScript build dependencies; daemon was not started."
    exit 1
  }
fi
echo "🔨 Compiling the latest daemon source..."
npm run build || {
  echo "❌ Daemon build failed; daemon was not started."
  exit 1
}

# 6. Ensure Cloudflare Tunnel & curl are available for remote access
if ! command -v cloudflared &>/dev/null; then
  echo "🌐 Installing Cloudflare tunnel for remote access from PC..."
  pkg install cloudflared -y 2>/dev/null || true
fi
if ! command -v curl &>/dev/null; then
  pkg install curl -y 2>/dev/null || true
fi

# 7. Check for user account credentials, CLI arguments, or reset flag
if [ "$1" == "--login" ] || [ "$1" == "-l" ] || [ "$1" == "--reset" ]; then
  rm -f user_auth.json ../user_auth.json 2>/dev/null
  echo "🧹 Reset account credentials."
elif [ -n "$1" ] && [ -n "$2" ]; then
  AUTH_USER="$1"
  AUTH_SECRET="$2"
  AUTH_CLOUD="${3:-https://vista-afk.vercel.app}"
  AUTH_CLOUD=$(echo "$AUTH_CLOUD" | sed 's:/*$::')
  echo "{\"username\":\"$AUTH_USER\",\"token\":\"$AUTH_SECRET\",\"password\":\"$AUTH_SECRET\",\"cloudUrl\":\"$AUTH_CLOUD\"}" > user_auth.json
  cp user_auth.json ../user_auth.json 2>/dev/null
  echo "✅ Credentials auto-configured for '$AUTH_USER' (Cloud: $AUTH_CLOUD)!"
fi

CURRENT_USER=$(grep -o '"username":"[^"]*' user_auth.json 2>/dev/null | cut -d'"' -f4)
if [ -z "$CURRENT_USER" ]; then
  CURRENT_USER=$(grep -o '"username":"[^"]*' ../user_auth.json 2>/dev/null | cut -d'"' -f4)
fi
if [ -n "$CURRENT_USER" ]; then
  echo "👤 Linked to account: $CURRENT_USER"
fi

# 8. Start Cloudflare Tunnel in background for instant 1-click remote access
if command -v cloudflared &>/dev/null; then
  echo "🌐 Starting secure Cloudflare tunnel..."
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

    # Automatically notify VistaAFK cloud so web dashboard connects instantly without pasting!
    if [ -n "$CURRENT_USER" ]; then
      echo "📡 Auto-linking tunnel to VistaAFK account (@$CURRENT_USER) on ${TARGET_CLOUD}..."
      AUTH_TOKEN_PAYLOAD=$(grep -o '"token":"[^"]*' user_auth.json 2>/dev/null | cut -d'"' -f4)
      if [ -z "$AUTH_TOKEN_PAYLOAD" ]; then
        AUTH_TOKEN_PAYLOAD=$(grep -o '"token":"[^"]*' ../user_auth.json 2>/dev/null | cut -d'"' -f4)
      fi
      
      # 1. Post to primary configured cloud URL
      curl -s -m 5 -X POST "${TARGET_CLOUD}/api/daemon/heartbeat" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$CURRENT_USER\",\"token\":\"$AUTH_TOKEN_PAYLOAD\",\"password\":\"$AUTH_TOKEN_PAYLOAD\",\"daemonUrl\":\"$WSS_URL\",\"deviceType\":\"mobile\",\"deviceLabel\":\"Mobile (Termux)\"}" >/dev/null 2>&1 &

      # 2. Always also notify https://vista-afk.vercel.app
      if [ "$TARGET_CLOUD" != "https://vista-afk.vercel.app" ]; then
        curl -s -m 5 -X POST "https://vista-afk.vercel.app/api/daemon/heartbeat" \
          -H "Content-Type: application/json" \
          -d "{\"username\":\"$CURRENT_USER\",\"token\":\"$AUTH_TOKEN_PAYLOAD\",\"password\":\"$AUTH_TOKEN_PAYLOAD\",\"daemonUrl\":\"$WSS_URL\",\"deviceType\":\"mobile\",\"deviceLabel\":\"Mobile (Termux)\"}" >/dev/null 2>&1 &
      fi
    fi

    echo ""
    echo "============================================================="
    echo "  🟢 VistaAFK Bot Daemon is RUNNING 24/7!"
    echo "============================================================="
    echo "  ✨ AUTO-CONNECTED: Your web dashboard is now automatically"
    echo "     connected to this daemon. No copy-pasting required!"
    echo "============================================================="
    echo "  🌐 Direct 1-Click Link (if needed):"
    echo "     $ONE_CLICK_URL"
    echo "============================================================="
    echo ""
  fi
fi

# 9. Run the pre-compiled daemon directly (Zero compilation needed on mobile!)
export VISTAAFK_DEVICE_TYPE="mobile"
export VISTAAFK_DEVICE_LABEL="Mobile (Termux)"
echo "✅ Launching 24/7 VistaAFK Daemon on port 8080 (Mobile Termux)..."
node dist/server.js
