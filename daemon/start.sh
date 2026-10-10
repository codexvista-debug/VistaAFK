#!/bin/bash
echo "============================================="
echo "      🚀 Starting VistaAFK Daemon v1.2.4      "
echo "============================================="

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

# Rebuild every time so git-pulled daemon fixes are actually used.
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

# 6. Ensure Cloudflare Tunnel is available for remote PC/laptop connection
if ! command -v cloudflared &>/dev/null; then
  echo "🌐 Installing Cloudflare tunnel for remote access from PC..."
  pkg install cloudflared -y 2>/dev/null || true
fi

# 7. Check for user account credentials, CLI arguments, or reset flag
if [ "$1" == "--login" ] || [ "$1" == "-l" ] || [ "$1" == "--reset" ]; then
  rm -f user_auth.json ../user_auth.json 2>/dev/null
  echo "🧹 Reset account credentials."
elif [ -n "$1" ] && [ -n "$2" ]; then
  AUTH_USER="$1"
  AUTH_SECRET="$2"
  echo "{\"username\":\"$AUTH_USER\",\"token\":\"$AUTH_SECRET\",\"password\":\"$AUTH_SECRET\",\"cloudUrl\":\"https://vista-afk.vercel.app\"}" > user_auth.json
  cp user_auth.json ../user_auth.json 2>/dev/null
  echo "✅ Credentials auto-configured for '$AUTH_USER'!"
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
  cloudflared tunnel --url http://localhost:8080 > cloudflared.log 2>&1 &
  
  # Wait up to 6 seconds for the tunnel to establish
  TUNNEL_URL=""
  for i in 1 2 3 4 5 6; do
    sleep 1
    TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' cloudflared.log 2>/dev/null | tail -n 1)
    if [ -n "$TUNNEL_URL" ]; then
      break
    fi
  done

  if [ -n "$TUNNEL_URL" ]; then
    WSS_URL=$(echo "$TUNNEL_URL" | sed 's/https:\/\//wss:\/\//')
    ONE_CLICK_URL="https://vista-afk.vercel.app/?connect=$WSS_URL"
    echo ""
    echo "============================================================="
    echo "  🟢 VistaAFK Bot Daemon is RUNNING 24/7!"
    echo "============================================================="
    echo ""
    echo "👉 Click or copy this 1-CLICK LINK into your browser:"
    echo ""
    echo "   $ONE_CLICK_URL"
    echo ""
    echo "(Open on your PC or phone - connects instantly, NO setup needed!)"
    echo "============================================================="
    echo ""
  fi
fi

# 9. Run the pre-compiled daemon directly (Zero compilation needed on mobile!)
echo "✅ Launching 24/7 VistaAFK Daemon on port 8080..."
node dist/server.js
