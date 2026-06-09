#!/bin/bash
# ============================================================
# VisualDesign Admin Panel — Instalador Automático no Servidor
# Corre este script na tua Mac para instalar tudo no servidor
# ============================================================

set -e

# ── Configuração ──────────────────────────────────────────────
SERVER_IP="37.27.17.25"
SERVER_USER="root"
SSH_KEY="${SSH_KEY:-/Users/macbook/.ssh/aamihe_hetzner}"
SSH_PORT="${SSH_PORT:-2234}"
APP_DOMAIN="visualdesignmoz.com"
APP_DIR="/home/${APP_DOMAIN}/public_html"
APP_PORT=3002
LOCAL_PROJECT="/Users/macbook/Desktop/APP/visualdesign"

# ── Cores para output ─────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  VisualDesign — Instalador no Servidor     ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verifica se a chave SSH existe
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${YELLOW}AVISO: Chave SSH não encontrada em $SSH_KEY${NC}"
    echo "Tentando com password... (vais ser pedido a password)"
    SSH_CMD="ssh -p ${SSH_PORT} -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP}"
    RSYNC_SSH="ssh -p ${SSH_PORT} -o StrictHostKeyChecking=no"
else
    echo -e "${GREEN}✓ Chave SSH encontrada${NC}"
    SSH_CMD="ssh -i $SSH_KEY -p ${SSH_PORT} -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP}"
    RSYNC_SSH="ssh -i $SSH_KEY -p ${SSH_PORT} -o StrictHostKeyChecking=no"
fi

echo ""
echo -e "${BLUE}Passo 1/5 — Instalar Node.js 20 no servidor...${NC}"
$SSH_CMD << 'REMOTE'
# Instala Node.js 20 se não estiver instalado
if ! command -v node &> /dev/null || [[ $(node --version | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
    echo "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "Node.js já instalado: $(node --version)"
fi

# Instala PM2 se não estiver instalado
if ! command -v pm2 &> /dev/null; then
    echo "Instalando PM2..."
    npm install -g pm2
else
    echo "PM2 já instalado: $(pm2 --version)"
fi
REMOTE

echo -e "${GREEN}✓ Node.js e PM2 prontos${NC}"
echo ""

echo -e "${BLUE}Passo 2/5 — Criar pasta no servidor...${NC}"
$SSH_CMD "mkdir -p ${APP_DIR}"
echo -e "${GREEN}✓ Pasta criada: ${APP_DIR}${NC}"
echo ""

echo -e "${BLUE}Passo 3/5 — Enviar código para o servidor...${NC}"
echo "(Pode demorar 1-2 minutos...)"
rsync -avz --progress \
    --exclude node_modules \
    --exclude .next \
    --exclude .git \
    --exclude "*.env*" \
    -e "$RSYNC_SSH" \
    "${LOCAL_PROJECT}/" \
    "${SERVER_USER}@${SERVER_IP}:${APP_DIR}/"
echo -e "${GREEN}✓ Código enviado${NC}"
echo ""

echo -e "${BLUE}Passo 4/5 — Configurar ambiente e instalar dependências...${NC}"
# Carregar variáveis de ambiente locais se existirem (.env.production ou .env.local)
if [ -f "${LOCAL_PROJECT}/.env.production" ]; then
    export $(grep -v '^#' "${LOCAL_PROJECT}/.env.production" | xargs)
elif [ -f "${LOCAL_PROJECT}/.env.local" ]; then
    echo -e "${YELLOW}AVISO: Usando variáveis de .env.local (certifica-te que são as de produção!)${NC}"
    export $(grep -v '^#' "${LOCAL_PROJECT}/.env.local" | xargs)
fi

# Validar variáveis obrigatórias
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}ERRO: SUPABASE_SERVICE_ROLE_KEY não está definida. Usa deploy/env.production.template como referência.${NC}"
    exit 1
fi

$SSH_CMD << REMOTE
cd ${APP_DIR}

cat > .env.local << ENVFILE
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://supabase.visualdesignmoz.com}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
NEXT_PUBLIC_SERVER_IP=${NEXT_PUBLIC_SERVER_IP:-37.27.17.25}
NEXT_PUBLIC_WEBMAIL_URL=${NEXT_PUBLIC_WEBMAIL_URL:-https://webmail.visualdesignmoz.com}
DIRECTADMIN_HOST=${DIRECTADMIN_HOST:-host.visualdesignmoz.com}
DIRECTADMIN_PORT=${DIRECTADMIN_PORT:-2222}
DIRECTADMIN_PROTOCOL=${DIRECTADMIN_PROTOCOL:-https}
DIRECTADMIN_USER=${DIRECTADMIN_USER:-admin}
DIRECTADMIN_PASSWORD=${DIRECTADMIN_PASSWORD}
SMTP_HOST=${SMTP_HOST:-smtp-relay.brevo.com}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
BREVO_API_KEY=${BREVO_API_KEY}
SITE_EMAIL_FROM=${SITE_EMAIL_FROM:-Visualdesign <noreply@visualdesignmoz.com>}
NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:-https://visualdesignmoz.com}
ENVFILE
REMOTE
echo "Instalando dependências (pode demorar 2-3 minutos)..."
npm install --production=false

echo "Compilando o site (pode demorar 2-3 minutos)..."
npm run build

echo -e "${GREEN}✓ Site compilado com sucesso${NC}"
echo ""

echo -e "${BLUE}Passo 5/5 — Iniciar o servidor do site...${NC}"
$SSH_CMD << REMOTE
cd ${APP_DIR}

# Para versão antiga se existir
pm2 delete visualdesign 2>/dev/null || true

# Inicia o site
pm2 start npm --name "visualdesign" -- start -- -p ${APP_PORT}
pm2 save

# Configura para arrancar automaticamente ao reiniciar o servidor
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "Estado do PM2:"
pm2 list
REMOTE

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ✓ Instalação Concluída!                  ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Site a correr em: ${BLUE}http://${SERVER_IP}:${APP_PORT}${NC}"
echo ""
echo -e "${YELLOW}PRÓXIMO PASSO:${NC}"
echo "No DirectAdmin, configura o proxy reverso para o domínio ${APP_DOMAIN}:"
echo ""
echo -e "${BLUE}https://${SERVER_IP}:2222${NC}"
echo "→ Websites → ${APP_DOMAIN} → Rewrite Rules"
echo "→ Adiciona:"
echo ""
echo "  ProxyPreserveHost On"
echo "  ProxyPass / http://127.0.0.1:${APP_PORT}/"
echo "  ProxyPassReverse / http://127.0.0.1:${APP_PORT}/"
echo ""
echo -e "${GREEN}Após isso, o site estará em: https://${APP_DOMAIN}/admin${NC}"
