#!/usr/bin/env bash
cd "$(dirname "$0")"

echo "==================================================================="
echo "  MineHost Server-Host (Linux / Ubuntu / Debian / macOS · Auto-Update)"
echo "  Dashboard: https://minehost-dashboard.adrilolghg.workers.dev"
echo "==================================================================="

if command -v node >/dev/null 2>&1; then
  NODE_BIN="node"
elif [ -x "runtimes/node/bin/node" ]; then
  NODE_BIN="runtimes/node/bin/node"
else
  echo "[MineHost] Lade portable Node.js 22 LTS Laufzeit herunter ..."
  mkdir -p runtimes/node
  ARCH="$(uname -m)"
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then NARCH="arm64"; else NARCH="x64"; fi
  URL="https://nodejs.org/dist/v22.14.0/node-v22.14.0-${OS}-${NARCH}.tar.gz"
  curl -fsSL "$URL" | tar -xz -C runtimes/node --strip-components=1
  NODE_BIN="runtimes/node/bin/node"
fi

while true; do
  "$NODE_BIN" --experimental-strip-types src/index.ts
  EXIT_CODE=$?
  if [ "$EXIT_CODE" -eq 42 ]; then
    echo "[Auto-Update] Starte aktualisierte MineHost-Version ..."
    sleep 1
    continue
  fi
  exit "$EXIT_CODE"
done
