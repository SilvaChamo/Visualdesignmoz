#!/bin/bash

# Deploy direto via SSH para o servidor Hetzner (DirectAdmin)
# Autorizado pelo usuário para execução automática

echo "🚀 Iniciando deploy para visualdesignmoz.com..."

# Verificar se a chave SSH existe
SSH_KEY="${SSH_KEY:-/Users/macbook/.ssh/visualdesign_hetzner}"
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ Chave SSH não encontrada: $SSH_KEY"
    exit 1
fi

SSH_PORT="${SSH_PORT:-2234}"
SSH_HOST="${SSH_HOST:-37.27.17.25}"
SERVER="root@${SSH_HOST}"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=30 -p $SSH_PORT"
REMOTE_PATH="${REMOTE_PATH:-/home/visualdesignmoz.com/public_html}"
LOCAL_PATH="/Users/macbook/Desktop/APP/visualdesign"

echo "📤 Enviando arquivos para o servidor..."

# Sync dos arquivos (excluir node_modules, .next, .git, env files)
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude '*.env*' \
    --exclude '.DS_Store' \
    -e "ssh $SSH_OPTS" \
    "$LOCAL_PATH/" \
    "$SERVER:$REMOTE_PATH/"

if [ $? -ne 0 ]; then
    echo "❌ Falha no rsync"
    exit 1
fi

echo "🔨 Executando build no servidor..."

# Executar build e restart do PM2
ssh $SSH_OPTS "$SERVER" << 'EOF'
    cd /home/visualdesignmoz.com/public_html
    
    # Verificar se há node_modules, se não, instalar
    if [ ! -d "node_modules" ]; then
        echo "📦 Instalando dependências..."
        npm ci
    fi
    
    # Build
    echo "🔨 Compilando..."
    npm run build 2>&1
    
    # Restart PM2
    echo "🔄 Reiniciando serviço..."
    pm2 restart visualdesign || pm2 start npm --name "visualdesign" -- start
    pm2 save
    
    echo "✅ Deploy concluído!"
EOF

echo "🌐 Site atualizado: https://visualdesignmoz.com"
