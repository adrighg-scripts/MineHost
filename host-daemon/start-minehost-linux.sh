#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "==================================================================="
echo "  MineHost Server-Host (Linux / Ubuntu / Debian / macOS)"
echo "  Dashboard: https://minehost-dashboard.adrilolghg.workers.dev"
echo "==================================================================="

if command -v node >/dev/null 2>&1; then
  exec node --experimental-strip-types src/index.ts
fi

if [ -x "runtimes/node/bin/node" ]; then
  exec "runtimes/node/bin/node" --experimental-strip-types src/index.ts
fi

echo "[MineHost] Lade portable Node.js 22 LTS Laufzeit herunter ..."
mkdir -p runtimes/node
ARCH="$(uname -m)"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then NARCH="arm64"; else NARCH="x64"; fi
URL="https://nodejs.org/dist/v22.14.0/node-v22.14.0-${OS}-${NARCH}.tar.gz"
curl -fsSL "$URL" | tar -xz -C runtimes/node --strip-components=1
exec "runtimes/node/bin/node" --experimental-strip-types src/index.ts

