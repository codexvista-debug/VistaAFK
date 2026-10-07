#!/bin/bash
echo "============================================="
echo "      🚀 Starting VistaAFK Daemon v1.2.1      "
echo "============================================="

# 1. Kill any existing zombie node process holding port 8080
pkill -f "node dist/server.js" 2>/dev/null
pkill -f "dist/server.js" 2>/dev/null

# 2. Automatically pull the latest updates from GitHub
echo "🔄 Checking for latest VistaAFK updates..."
git pull origin main

# 3. Navigate into daemon directory if not already there
if [ -d "daemon" ]; then
  cd daemon
fi

# 4. Run the pre-compiled daemon directly (Zero compilation needed on mobile!)
echo "✅ Launching 24/7 VistaAFK Daemon on port 8080..."
node dist/server.js
