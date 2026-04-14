#!/bin/bash

# Script para ativar contas de email no CyberPanel via API local
# Este script assume que o servidor local está em execução em localhost:3002

set -e

echo "🚀 Ativando Contas de Email no CyberPanel"
echo "=========================================="

API_URL="http://localhost:3002/api/cyberpanel-cli"
DOMAIN="visualdesigne.com"
PASSWORD="Ad.Vd#2425?*"

# Função para criar email via API
create_email() {
  local username=$1
  echo "📧 Criando conta: $username@$DOMAIN"
  
  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"createEmail\",\"domain\":\"$DOMAIN\",\"userName\":\"$username\",\"password\":\"$PASSWORD\"}" \
    | jq '.' || echo "⚠️ Falha na resposta (possível erro)"
}

# Criar contas
create_email "admin"
echo "✓ Admin account request sent"
echo ""

create_email "suporte"
echo "✓ Suporte account request sent"
echo ""

create_email "geral"
echo "✓ Geral account request sent"
echo ""

echo "=========================================="
echo "✅ Solicitações de criação enviadas!"
echo "❓ Verifique o console do servidor para erros"
echo ""
echo "Para verificar as contas, acesse:"
echo "  Panel: https://109.199.104.22:8090"
echo "  Webmail: https://visualdesigne.com:8090/snappymail/"
