#!/bin/bash

echo "🧪 TESTANDO CRIAÇÃO DE DOMÍNIO NA PORTA 3002"
echo "============================================"
echo ""

PORT=3002

# Verificar se o servidor está rodando
echo "1. Verificando servidor na porta $PORT..."
if curl -s http://localhost:$PORT > /dev/null; then
    echo "   ✅ Servidor rodando em http://localhost:$PORT"
else
    echo "   ❌ Servidor NÃO está rodando na porta $PORT"
    echo ""
    echo "💡 Execute primeiro:"
    echo "   cd /Users/macbook/Desktop/APP/visualdesign"
    echo "   npm run dev"
    echo ""
    exit 1
fi

DOMAIN="teste-diagnostico-$(date +%s).com"
echo ""
echo "2. Criando domínio de teste: $DOMAIN"
echo ""

# Fazer a requisição
RESPONSE=$(curl -s -X POST http://localhost:$PORT/api/server-exec \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"createWebsite\",
    \"params\": {
      \"domain\": \"$DOMAIN\",
      \"email\": \"admin@teste.com\",
      \"php\": \"PHP 8.2\"
    }
  }")

echo "3. Resposta do servidor:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

echo ""
echo "============================================"
