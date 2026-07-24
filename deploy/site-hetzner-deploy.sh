#!/bin/bash
# Deploy do site público VisualDesign para www-teste.visualdesignmoz.com (Hetzner)
# Instância de teste — não mexe no domínio principal (que continua na Vercel).
# Uso: bash deploy/site-hetzner-deploy.sh

set -euo pipefail

SERVER_IP="${SERVER_IP:-37.27.17.25}"
SSH_PORT="${SSH_PORT:-2234}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/claude_hetzner}"
SSH_USER="${SSH_USER:-root}"
LOCAL_PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="/opt/visualdesign-site"
SITE_PORT="${SITE_PORT:-3003}"
SITE_SUB="${SITE_SUB:-www-teste}"
SITE_HOST="${SITE_SUB}.visualdesignmoz.com"
ENV_FILE="${LOCAL_PROJECT}/.env.local"

SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=no)
if [[ -f "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

ssh_cmd() { ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SERVER_IP}" "$@"; }

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: $ENV_FILE não encontrado"
  exit 1
fi

echo "==> 1/6 Node.js + PM2 no servidor"
ssh_cmd "if ! command -v node >/dev/null 2>&1 || [[ \$(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs; fi && if ! command -v pm2 >/dev/null 2>&1; then npm install -g pm2; fi && node -v && pm2 -v"

echo "==> 2/6 Clonar repositório (para o deploy automático do GitHub Actions poder git fetch/reset depois)"
GIT_REPO="${GIT_REPO:-https://github.com/SilvaChamo/Visualdesigne.git}"
ssh_cmd "if [[ -d ${REMOTE_DIR}/.git ]]; then cd ${REMOTE_DIR} && git fetch origin && git reset --hard origin/main; else rm -rf ${REMOTE_DIR} && git clone ${GIT_REPO} ${REMOTE_DIR}; fi"

echo "==> 3/6 .env.local (Hetzner / site de teste)"
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  key="${key// /}"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  export "$key=$val" 2>/dev/null || true
done < "$ENV_FILE"

# Mesma base de env do painel-hetzner-deploy.sh, mas identidade de site público
# (não painel) e a apontar para o painel real já em produção — não duplicamos
# o painel nesta instância de teste.
ENV_CONTENT="NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://supabase.visualdesignmoz.com}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-}
NEXT_PUBLIC_SITE_URL=https://${SITE_HOST}
NEXT_PUBLIC_PUBLIC_SITE_URL=https://${SITE_HOST}
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
SPACESHIP_API_KEY=${SPACESHIP_API_KEY:-}
SPACESHIP_SECRET_KEY=${SPACESHIP_SECRET_KEY:-}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}
CRON_SECRET=${CRON_SECRET:-}
PORT=${SITE_PORT}"

echo "$ENV_CONTENT" > "${LOCAL_PROJECT}/scratch/.env.remote-site"

SCP_OPTS=(-o StrictHostKeyChecking=no -P "$SSH_PORT")
if [[ -f "$SSH_KEY" ]]; then
  SCP_OPTS+=(-i "$SSH_KEY")
fi

scp "${SCP_OPTS[@]}" "${LOCAL_PROJECT}/scratch/.env.remote-site" "${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/.env.local"
rm -f "${LOCAL_PROJECT}/scratch/.env.remote-site"

echo "==> 4/6 npm install + build"
ssh_cmd "cd ${REMOTE_DIR} && export NODE_OPTIONS='--max-old-space-size=4096' && npm ci --prefer-offline --no-audit --no-fund && npm run build"

echo "==> 5/6 PM2"
ssh_cmd "cd ${REMOTE_DIR} && pm2 delete visualdesign-site 2>/dev/null || true && pm2 start npm --name visualdesign-site -- start -- -p ${SITE_PORT} && pm2 save && pm2 list"

echo "==> 6/6 Apache proxy (site de teste)"
scp "${SCP_OPTS[@]}" "${LOCAL_PROJECT}/deploy/site-hetzner-apache.sh" "${SSH_USER}@${SERVER_IP}:/tmp/site-hetzner-apache.sh"
ssh_cmd "SITE_SUB=${SITE_SUB} SITE_PORT=${SITE_PORT} bash /tmp/site-hetzner-apache.sh"

echo ""
echo "Concluído: http://${SITE_HOST} (SSL só depois do DNS propagar e do certificado ser emitido no DirectAdmin)"
