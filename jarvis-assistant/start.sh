#!/bin/bash
# J.A.R.V.I.S. — запуск сервера и Cloudflare Tunnel одной командой
cd "$(dirname "$0")"

echo "============================================"
echo "  J.A.R.V.I.S. - zapusk servera i tunnelya"
echo "============================================"

# 1. Сервер
if [ ! -d node_modules ]; then
  echo "[*] Ustanovka zavisimostej..."
  npm install --no-audit --no-fund
fi
echo "[*] Server: http://localhost:3000"
node server.js &
SERVER_PID=$!
sleep 2

# 2. cloudflared (скачивается один раз)
if [ ! -x ./cloudflared ]; then
  echo "[*] Skachivayu cloudflared..."
  ARCH=$([ "$(uname -m)" = "aarch64" ] && echo "arm64" || echo "amd64")
  curl -sL -o ./cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}"
  chmod +x ./cloudflared
fi

echo
echo "[*] Tunnel zapuskaetsya - link nizhe (budet gotov cherez ~10 sek):"
echo "    Otkroyte etu ssylku s LYUBOGO ustroystva"
echo

cleanup() { kill $SERVER_PID 2>/dev/null; }
trap cleanup EXIT

./cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate
