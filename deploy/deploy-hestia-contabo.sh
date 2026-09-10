#!/bin/bash

set -euo pipefail

SERVER_HOST="${SERVER_HOST:-teste.visualdesignmoz.com}"
SERVER_USER="${SERVER_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/claude_contabo}"
REMOTE_DIR="${REMOTE_DIR:-/opt/visualdesign-panel}"
APP_PORT="${APP_PORT:-3002}"
LOCAL_PROJECT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "ERRO: chave SSH não encontrada: $SSH_KEY" >&2
  exit 1
fi

SSH_OPTS=(-i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=20)
SERVER="${SERVER_USER}@${SERVER_HOST}"

echo "==> Verificar servidor Hestia/Contabo"
ssh "${SSH_OPTS[@]}" "$SERVER" 'hostname; command -v node; command -v pm2 || true'

echo "==> Enviar código"
ssh "${SSH_OPTS[@]}" "$SERVER" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude '.env*' \
  --exclude '.DS_Store' \
  -e "ssh ${SSH_OPTS[*]}" \
  "$LOCAL_PROJECT/" "$SERVER:$REMOTE_DIR/"

echo "==> Configurar ambiente Hestia"
if [[ ! -f "$LOCAL_PROJECT/.env.local" ]]; then
  echo "ERRO: .env.local não encontrado" >&2
  exit 1
fi

env_keys=(
  NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_PANEL_SLUG PANEL_SLUG NEXT_PUBLIC_WEBMAIL_URL
  SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_MASTER_PASSWORD BREVO_API_KEY BREVO_SMTP_USER
  SITE_EMAIL_FROM PASSWORD_RESET_USE_SITE_SMTP PORKBUN_API_KEY PORKBUN_SECRET_KEY
  SPACESHIP_API_KEY SPACESHIP_SECRET_KEY CRON_SECRET
)

env_args=()
for key in "${env_keys[@]}"; do
  value="$(grep -E "^${key}=" "$LOCAL_PROJECT/.env.local" | head -1 | cut -d= -f2- || true)"
  env_args+=("$key=$value")
done

env_args+=(
  "NEXT_PUBLIC_SITE_URL=https://teste.visualdesignmoz.com"
  "NEXT_PUBLIC_SERVER_IP=169.58.148.144"
  "DEFAULT_HOSTING_PROVIDER=hestia"
  "HESTIA_HOST=teste.visualdesignmoz.com"
  "HESTIA_PORT=8083"
  "HESTIA_USER=vdadmin"
  "SERVER_IP=169.58.148.144"
  "SERVER_SSH_PORT=22"
  "SERVER_SSH_USER=root"
  "SERVER_USE_LOCAL_EXEC=true"
  "PORT=$APP_PORT"
)

printf '%s\n' "${env_args[@]}" | ssh "${SSH_OPTS[@]}" "$SERVER" "cat > '$REMOTE_DIR/.env.local'"

echo "==> Instalar dependências e compilar"
ssh "${SSH_OPTS[@]}" "$SERVER" "cd '$REMOTE_DIR' && npm ci --prefer-offline --no-audit --no-fund && npm run build"

echo "==> Reiniciar aplicação"
ssh "${SSH_OPTS[@]}" "$SERVER" "cd '$REMOTE_DIR' && pm2 delete visualdesign-panel 2>/dev/null || true; pm2 start npm --name visualdesign-panel -- start -- -p '$APP_PORT'; pm2 save"

echo "Deploy Hestia concluído em https://${SERVER_HOST}"