#!/bin/bash
echo "============================================="
echo "      🚀 Starting VistaAFK Daemon v1.2.3      "
echo "============================================="

# 1. Kill any existing zombie processes
pkill -f "node dist/server.js" 2>/dev/null
pkill -f "dist/server.js" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
pkill -f "tsx" 2>/dev/null

# 2. Automatically pull the latest updates from GitHub
echo "🔄 Checking for latest VistaAFK updates..."
if [ -d "../.git" ]; then
  cd ..
  git pull origin main
  cd daemon
else
  git pull origin main
fi

# 3. Ensure Bedrock protocol dependencies are installed
if [ ! -d "node_modules/bedrock-protocol" ]; then
  echo "📦 Installing Bedrock support (pure JS, 0 compilation)..."
  npm install bedrock-protocol --ignore-scripts --omit=optional
fi

# 4. Ensure Cloudflare Tunnel is available for remote PC/laptop connection
if ! command -v cloudflared &>/dev/null; then
  echo "🌐 Installing Cloudflare tunnel for remote access from PC..."
  pkg install cloudflared -y 2>/dev/null || true
fi

# 5. Check for user account credentials
if [ ! -f "user_auth.json" ] && [ ! -f "../user_auth.json" ]; then
  echo ""
  echo "============================================="
  echo "  🔐 VistaAFK Account Setup (Connect Anywhere)"
  echo "============================================="
  echo "Link this phone daemon to your account so you"
  echo "can access it from your PC or anywhere!"
  echo ""
  read -p "Enter username (min 4 letters): " AUTH_USER
  read -s -p "Enter password (min 6 characters): " AUTH_PASS
  echo ""
  if [ ${#AUTH_USER} -ge 4 ] && [ ${#AUTH_PASS} -ge 6 ]; then
    echo "{\"username\":\"$AUTH_USER\",\"password\":\"$AUTH_PASS\",\"cloudUrl\":\"https://vista-afk.vercel.app\"}" > user_auth.json
    echo "✅ Account credentials saved! Your PC will now connect automatically."
  else
    echo "⚠️ Skipping setup (username < 4 or password < 6). You can link anytime in the web dashboard."
  fi
  echo ""
fi

# 6. Start Cloudflare Tunnel in background if installed
if command -v cloudflared &>/dev/null; then
  echo "🌐 Starting secure Cloudflare tunnel..."
  rm -f cloudflared.log 2>/dev/null
  cloudflared tunnel --url http://localhost:8080 > cloudflared.log 2>&1 &
  sleep 2
fi

# 7. Run the pre-compiled daemon directly (Zero compilation needed on mobile!)
echo "✅ Launching 24/7 VistaAFK Daemon on port 8080..."
node dist/server.js
