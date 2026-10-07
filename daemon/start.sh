#!/bin/bash
echo "============================================="
echo "      🚀 Starting VistaAFK Daemon v1.2.1      "
echo "============================================="

# 1. Kill any existing zombie node/tsx processes holding port 8080
pkill -f "node dist/server.js" 2>/dev/null
pkill -f "dist/server.js" 2>/dev/null
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
  echo "📦 Installing Bedrock support (npm install bedrock-protocol --no-optional)..."
  npm install bedrock-protocol@^3.60.1 --no-optional
fi

# 4. Run the pre-compiled daemon directly (Zero compilation needed on mobile!)
echo "✅ Launching 24/7 VistaAFK Daemon on port 8080..."
node dist/server.js
