#!/bin/bash
# Coloca proxy de cookies à frente do DirectAdmin (porta pública 2026 → DA interno 2027).
set -euo pipefail

SERVER_IP="${SERVER_IP:-37.27.17.25}"
SSH_PORT="${SSH_PORT:-2234}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/visualdesign_hetzner}"
SSH_USER="${SSH_USER:-root}"
LOCAL_PROJECT="$(cd "$(dirname "$0")/.." && pwd)"

SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=no)
if [[ -f "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

scp -P "$SSH_PORT" -o StrictHostKeyChecking=no ${SSH_KEY:+-i "$SSH_KEY"} \
  "${LOCAL_PROJECT}/deploy/da-cookie-proxy.js" \
  "${LOCAL_PROJECT}/deploy/da-cookie-proxy.service" \
  "${LOCAL_PROJECT}/deploy/sync-da-ssl.sh" \
  "${SSH_USER}@${SERVER_IP}:/tmp/"

ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SERVER_IP}" bash -s <<'REMOTE'
set -euo pipefail

mkdir -p /opt/da-cookie-proxy
cp /tmp/da-cookie-proxy.js /opt/da-cookie-proxy/
chmod +x /opt/da-cookie-proxy/da-cookie-proxy.js

if [[ ! -f /opt/da-cookie-proxy/package.json ]]; then
  cd /opt/da-cookie-proxy
  npm init -y >/dev/null
fi
cd /opt/da-cookie-proxy
npm install http-proxy@1.18.1 --no-audit --no-fund --silent

DA_CONF=/usr/local/directadmin/conf/directadmin.conf
if grep -q '^port=2026$' "$DA_CONF"; then
  sed -i 's/^port=2026$/port=2027/' "$DA_CONF"
  echo "DirectAdmin: port 2026 -> 2027 (interno)"
  systemctl restart directadmin
  sleep 2
fi

cp /tmp/da-cookie-proxy.service /etc/systemd/system/da-cookie-proxy.service
cp /tmp/sync-da-ssl.sh /opt/da-cookie-proxy/sync-da-ssl.sh 2>/dev/null || true
if [[ -f /opt/da-cookie-proxy/sync-da-ssl.sh ]]; then
  chmod +x /opt/da-cookie-proxy/sync-da-ssl.sh
  /opt/da-cookie-proxy/sync-da-ssl.sh
fi
if [[ ! -f /etc/cron.d/directadmin_ssl-proxy ]]; then
  echo '15 4 * * * root /opt/da-cookie-proxy/sync-da-ssl.sh' > /etc/cron.d/directadmin_ssl-proxy
fi
systemctl daemon-reload
systemctl enable da-cookie-proxy
systemctl restart da-cookie-proxy

# Bloquear acesso externo directo à porta interna 2027 (opcional, localhost OK)
if command -v csf >/dev/null 2>&1 && ! grep -q "DA internal 2027" /etc/csf/csf.allow 2>/dev/null; then
  echo "127.0.0.1 # DA internal 2027" >> /etc/csf/csf.allow
fi

echo "=== status ==="
systemctl is-active directadmin da-cookie-proxy
ss -tlnp | grep -E ':2026|:2027'
curl -sk -o /dev/null -w "DA via proxy: %{http_code}\n" https://127.0.0.1:2026/
REMOTE

echo "Concluído: https://host.visualdesignmoz.com:2026/"
