#!/usr/bin/env bash
set -euo pipefail
PORT=${1:-3002}
DOMAIN=${2:-visualdesignmoz.com}

echo "Checking port ${PORT}..."
PID=$(lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$PID" ]; then
  echo "Killing process $PID listening on port ${PORT}"
  kill "$PID" || kill -9 "$PID"
  sleep 1
fi

echo "Starting Next.js in dev mode on port ${PORT} (logs -> backend_debug.log)"
nohup npm run dev -- --port ${PORT} > backend_debug.log 2>&1 &
NEWPID=$!
echo "Started PID: $NEWPID"

echo "Waiting for server to boot..."
sleep 4

echo "Calling API: /api/panel-email?domain=${DOMAIN}"
curl -i "http://localhost:${PORT}/api/panel-email?domain=${DOMAIN}"

echo "Log tail (last 40 lines):"
tail -n 40 backend_debug.log
