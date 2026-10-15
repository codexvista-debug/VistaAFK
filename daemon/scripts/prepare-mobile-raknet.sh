#!/bin/bash
set -u

case "${PREFIX:-}" in
  *termux*) ;;
  *)
    if [ -z "${TERMUX_VERSION:-}" ]; then
      exit 0
    fi
    ;;
esac

if node -e "require('raknet-native')" >/dev/null 2>&1; then
  echo "✅ Native RakNet binding is ready for Termux."
  exit 0
fi

echo "📦 Preparing the native RakNet backend used by the PC daemon..."
if ! command -v pkg >/dev/null 2>&1; then
  echo "⚠️ Termux package manager is unavailable; the daemon will use the JSP RakNet fallback."
  exit 0
fi

pkg install -y cmake clang make git || {
  echo "⚠️ Could not install native build tools; the daemon will use the JSP RakNet fallback."
  exit 0
}

# The daemon installs dependencies with lifecycle scripts disabled for Android.
# Install the native package if a lockfile/install variation left it out.
if [ ! -f "node_modules/raknet-native/buildChecks.js" ]; then
  npm install --no-save --package-lock=false --ignore-scripts raknet-native@1.2.3 || {
    echo "⚠️ Could not install raknet-native; the daemon will use the JSP RakNet fallback."
    exit 0
  }
fi

node ./scripts/patch-termux-raknet-native.cjs || {
  echo "⚠️ Could not patch native RakNet for Termux; the daemon will use the JSP RakNet fallback."
  exit 0
}

if [ ! -x "node_modules/.bin/cmake-js" ]; then
  echo "⚠️ cmake-js is unavailable; the daemon will use the JSP RakNet fallback."
  exit 0
fi

if [ ! -d "node_modules/raknet-native/raknet/Source" ]; then
  echo "📥 Fetching RakNet native source for the Android build..."
  git clone --depth 1 https://github.com/extremeheat/fb-raknet node_modules/raknet-native/raknet || {
    echo "⚠️ Could not fetch RakNet native source; the daemon will use the JSP RakNet fallback."
    exit 0
  }
fi

(cd node_modules/raknet-native && ../../node_modules/.bin/cmake-js compile) || {
  echo "⚠️ Native RakNet build failed; the daemon will use the JSP RakNet fallback."
  exit 0
}

if node -e "require('raknet-native')" >/dev/null 2>&1; then
  echo "✅ Native RakNet compiled and is ready for Termux."
else
  echo "⚠️ Native RakNet did not load after compilation; the daemon will use the JSP RakNet fallback."
fi
