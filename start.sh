#!/bin/bash
echo "============================================="
echo "      🚀 Starting VistaAFK Daemon v1.2.3      "
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

# 6. Ensure Cloudflare Tunnel is available for remote PC/laptop connection
if ! command -v cloudflared &>/dev/null; then
  echo "🌐 Installing Cloudflare tunnel for remote access from PC..."
  pkg install cloudflared -y 2>/dev/null || true
fi

# 7. Check for user account credentials, CLI arguments, or reset flag
if [ "$1" == "--login" ] || [ "$1" == "-l" ] || [ "$1" == "--reset" ]; then
  rm -f user_auth.json ../user_auth.json 2>/dev/null
elif [ -n "$1" ] && [ -n "$2" ]; then
  AUTH_USER="$1"
  AUTH_PASS="$2"
  echo "{\"username\":\"$AUTH_USER\",\"password\":\"$AUTH_PASS\",\"cloudUrl\":\"https://vista-afk.vercel.app\"}" > user_auth.json
  cp user_auth.json ../user_auth.json 2>/dev/null
  echo "✅ Credentials auto-configured for '$AUTH_USER'!"
fi

if [ ! -f "user_auth.json" ] && [ ! -f "../user_auth.json" ]; then
  echo ""
  echo "============================================="
  echo "  🔐 VistaAFK Account Setup (Connect Anywhere)"
  echo "============================================="
  echo "Link this phone daemon to your account so you"
  echo "can access it from your PC or anywhere!"
  echo ""
  echo -n "Enter username (min 4 letters): "
  read -r AUTH_USER < /dev/tty
  echo -n "Enter password (min 4 characters): "
  read -r AUTH_PASS < /dev/tty
  echo ""
  if [ ${#AUTH_USER} -ge 4 ] && [ ${#AUTH_PASS} -ge 4 ]; then
    echo "{\"username\":\"$AUTH_USER\",\"password\":\"$AUTH_PASS\",\"cloudUrl\":\"https://vista-afk.vercel.app\"}" > user_auth.json
    cp user_auth.json ../user_auth.json 2>/dev/null
    echo "✅ Account credentials saved for '$AUTH_USER'! Your PC will now connect automatically."
  else
    echo "⚠️ Skipping setup (username < 4 or password < 4). You can link anytime in the web dashboard."
  fi
  echo ""
else
  CURRENT_USER=$(grep -o '"username":"[^"]*' user_auth.json 2>/dev/null | cut -d'"' -f4)
  if [ -z "$CURRENT_USER" ]; then
    CURRENT_USER=$(grep -o '"username":"[^"]*' ../user_auth.json 2>/dev/null | cut -d'"' -f4)
  fi
  echo "👤 Linked to account: ${CURRENT_USER:-saved user} (run 'bash start.sh --login' to switch accounts)"
fi

# 8. Start Cloudflare Tunnel in background if installed
if command -v cloudflared &>/dev/null; then
  echo "🌐 Starting secure Cloudflare tunnel..."
  rm -f cloudflared.log 2>/dev/null
  cloudflared tunnel --url http://localhost:8080 > cloudflared.log 2>&1 &
  sleep 2
fi

# 9. Run the pre-compiled daemon directly (Zero compilation needed on mobile!)
echo "✅ Launching 24/7 VistaAFK Daemon on port 8080..."
node dist/server.js
