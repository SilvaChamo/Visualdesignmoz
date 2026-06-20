#!/bin/bash
# Deploy do painel VisualDesign para painel.visualdesignmoz.com (Hetzner)
# Uso: bash deploy/painel-hetzner-deploy.sh

set -euo pipefail

SERVER_IP="${SERVER_IP:-37.27.17.25}"
SSH_PORT="${SSH_PORT:-2234}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/visualdesign_hetzner}"
SSH_USER="${SSH_USER:-root}"
LOCAL_PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="/opt/visualdesign-panel"
PANEL_PORT="${PANEL_PORT:-3003}"
ENV_FILE="${LOCAL_PROJECT}/.env.local"

SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=no)
if [[ -f "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

ssh_cmd() { ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SERVER_IP}" "$@"; }
rsync_cmd() { rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$@"; }

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: $ENV_FILE não encontrado"
  exit 1
fi

echo "==> 1/6 Node.js + PM2 no servidor"
ssh_cmd bash -s <<'REMOTE'
set -e
if ! command -v node >/dev/null 2>&1 || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
node -v
pm2 -v
REMOTE

echo "==> 2/6 Enviar código"
ssh_cmd "mkdir -p ${REMOTE_DIR}"
rsync_cmd \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude '.env*' \
  --exclude '.cursor' \
  "${LOCAL_PROJECT}/" \
  "${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/"

echo "==> 3/6 .env.local (Hetzner / painel)"
# Carregar .env.local (ignorar linhas inválidas)
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  key="${key// /}"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  export "$key=$val" 2>/dev/null || true
done < "$ENV_FILE"

ssh_cmd "cat > ${REMOTE_DIR}/.env.local" <<ENVFILE
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://supabase.visualdesignmoz.com}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-}
NEXT_PUBLIC_SITE_URL=https://painel.visualdesignmoz.com
NEXT_PUBLIC_PUBLIC_SITE_URL=https://visualdesignmoz.com
NEXT_PUBLIC_PANEL_URL=https://painel.visualdesignmoz.com
NEXT_PUBLIC_SERVER_IP=${NEXT_PUBLIC_SERVER_IP:-37.27.17.25}
NEXT_PUBLIC_PANEL_SLUG=${NEXT_PUBLIC_PANEL_SLUG:-visualdesign}
PANEL_SLUG=${PANEL_SLUG:-visualdesign}
NEXT_PUBLIC_WEBMAIL_URL=${NEXT_PUBLIC_WEBMAIL_URL:-https://webmail.visualdesignmoz.com}
DIRECTADMIN_HOST=127.0.0.1
DIRECTADMIN_PORT=${DIRECTADMIN_PORT:-2026}
DIRECTADMIN_PROTOCOL=${DIRECTADMIN_PROTOCOL:-https}
DIRECTADMIN_USER=${DIRECTADMIN_USER:-}
DIRECTADMIN_PASSWORD=${DIRECTADMIN_PASSWORD:-}
DIRECTADMIN_LOGIN_KEY=${DIRECTADMIN_LOGIN_KEY:-}
IMAP_HOST=127.0.0.1
SERVER_IP=127.0.0.1
SERVER_USE_LOCAL_EXEC=true
DA_USE_SSH_PROXY=false
SMTP_HOST=${SMTP_HOST:-smtp-relay.brevo.com}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_MASTER_PASSWORD=${SMTP_MASTER_PASSWORD:-${SMTP_PASS:-}}
BREVO_API_KEY=${BREVO_API_KEY:-}
BREVO_SMTP_USER=${BREVO_SMTP_USER:-${SMTP_USER:-}}
SITE_EMAIL_FROM=${SITE_EMAIL_FROM:-Visualdesign <noreply@visualdesignmoz.com>}
PASSWORD_RESET_USE_SITE_SMTP=${PASSWORD_RESET_USE_SITE_SMTP:-true}
PORKBUN_API_KEY=${PORKBUN_API_KEY:-}
PORKBUN_SECRET_KEY=${PORKBUN_SECRET_KEY:-}
CRON_SECRET=${CRON_SECRET:-}
PORT=${PANEL_PORT}
ENVFILE

echo "==> 4/6 npm install + build"
ssh_cmd bash -s <<REMOTE
set -e
cd ${REMOTE_DIR}
export NODE_OPTIONS="--max-old-space-size=4096"
npm ci --prefer-offline --no-audit --no-fund
npm run build
REMOTE

echo "==> 5/6 PM2"
ssh_cmd bash -s <<REMOTE
set -e
cd ${REMOTE_DIR}
pm2 delete visualdesign-panel 2>/dev/null || true
pm2 start npm --name visualdesign-panel -- start -- -p ${PANEL_PORT}
pm2 save
pm2 list
REMOTE

echo "==> 6/6 Apache proxy (painel)"
SCP_OPTS=(-o StrictHostKeyChecking=no -P "$SSH_PORT")
if [[ -f "$SSH_KEY" ]]; then
  SCP_OPTS+=(-i "$SSH_KEY")
fi
scp "${SCP_OPTS[@]}" "${LOCAL_PROJECT}/deploy/painel-hetzner-apache.sh" "${SSH_USER}@${SERVER_IP}:/tmp/painel-hetzner-apache.sh"
ssh_cmd "PANEL_PORT=${PANEL_PORT} bash /tmp/painel-hetzner-apache.sh"

echo ""
echo "Concluído: https://painel.visualdesignmoz.com"
echo "Admin: https://painel.visualdesignmoz.com/admin"
