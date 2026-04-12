#!/bin/bash

echo "🧪 TESTANDO CRIAÇÃO DE DOMÍNIO NO CYBERPANEL"
echo "============================================"
echo ""
echo "Este teste vai tentar criar um domínio de teste no servidor."
echo ""

# Verificar se o servidor Next.js está rodando
echo "1. Verificando se o servidor está rodando..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "   ✅ Servidor Next.js está rodando"
else
    echo "   ❌ Servidor Next.js NÃO está rodando"
    echo "   💡 Execute primeiro: npm run dev"
    exit 1
fi

echo ""
echo "2. Testando criação de domínio..."
echo "   Domínio: teste-diagnostico-$(date +%s).com"
echo ""

# Fazer a requisição para criar domínio
curl -s -X POST http://localhost:3000/api/server-exec \
  -H "Content-Type: application/json" \
  -d '{
    "action": "createWebsite",
    "params": {
      "domain": "teste-diagnostico-'$(date +%s)'.com",
      "email": "admin@teste.com",
      "php": "PHP 8.2",
      "openLiteSpeed": true
    }
  }' | tee /tmp/domain-response.json | python3 -m json.tool 2>/dev/null || cat /tmp/domain-response.json

echo ""
echo "3. Analisando resposta..."
echo ""

# Verificar se o arquivo tem conteúdo
if [ -s /tmp/domain-response.json ]; then
    echo "   ✅ Resposta recebida do servidor"
    echo ""
    echo "Conteúdo da resposta:"
    cat /tmp/domain-response.json
else
    echo "   ❌ Resposta vazia do servidor"
fi

echo ""
echo "============================================"
echo "Fim do teste"
