#!/bin/bash
# setup-contabo-supabase.sh
# Script para configurar Supabase Docker no Contabo

set -e

echo "🚀 Iniciando configuração do Supabase no Contabo..."

# 1. Atualizar sistema
apt-get update && apt-get upgrade -y

# 2. Instalar Docker se não existir
if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# 3. Instalar Docker Compose se não existir
if ! command -v docker-compose &> /dev/null; then
    echo "🐙 Instalando Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.24.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# 4. Preparar diretório do Supabase
mkdir -p /root/supabase
cd /root/supabase

# 5. Clonar repositório do Supabase Docker (se não existir)
if [ ! -d "docker" ]; then
    git clone --depth 1 https://github.com/supabase/docker.git
fi

cd docker

# 6. Configurar .env (será enviado pelo script Node.js)
# Usaremos o conteúdo do scratch/supabase.env

echo "✅ Ambiente Docker preparado!"
