#!/bin/bash

# Script de teste rápido - Limpeza de Emails e Consolidação de Contactos

echo "🧪 TESTE DE LIMPEZA DE EMAILS - CyberPanel + Supabase"
echo "========================================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# URL base (ajustar se necessário)
BASE_URL="${1:-http://localhost:3000}"

echo "🔗 URL Base: $BASE_URL"
echo ""

# ========== TESTE 1: Filtro de CyberPanel ==========
echo -e "${BLUE}1️⃣  Testando Filtro de CyberPanel${NC}"
echo "Endpoint: /api/cyberpanel-list-emails?domain=visualdesignmoz.com"
echo ""

RESPONSE1=$(curl -s "$BASE_URL/api/cyberpanel-list-emails?domain=visualdesignmoz.com")

# Verificar se contém "joao"
if echo "$RESPONSE1" | grep -qi "joao"; then
    echo -e "${RED}❌ FALHOU: Email 'joao' ainda está na lista!${NC}"
    echo "Resposta: $RESPONSE1"
else
    echo -e "${GREEN}✅ PASSOU: Email 'joao' foi removido!${NC}"
fi

# Verificar se tem sucesso
if echo "$RESPONSE1" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ API respondeu com sucesso${NC}"
else
    echo -e "${RED}❌ API retornou erro${NC}"
fi

echo ""

# ========== TESTE 2: Endpoint Consolidado ==========
echo -e "${BLUE}2️⃣  Testando Endpoint Consolidado (CyberPanel + Supabase)${NC}"
echo "Endpoint: /api/get-all-contacts?domain=visualdesignmoz.com"
echo ""

RESPONSE2=$(curl -s "$BASE_URL/api/get-all-contacts?domain=visualdesignmoz.com")

# Verificar se existe
if [ -z "$RESPONSE2" ]; then
    echo -e "${RED}❌ FALHOU: Nenhuma resposta do servidor${NC}"
else
    echo -e "${GREEN}✅ Servidor respondeu${NC}"
    
    # Verificar estrutura
    if echo "$RESPONSE2" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Estrutura JSON correta${NC}"
    else
        echo -e "${RED}❌ Estrutura JSON inválida${NC}"
    fi
    
    # Verificar campos
    if echo "$RESPONSE2" | grep -q '"stats"'; then
        echo -e "${GREEN}✅ Estatísticas incluídas${NC}"
    fi
    
    # Verificar se "joao" foi filtrado
    if echo "$RESPONSE2" | grep -qi "joao"; then
        echo -e "${RED}❌ Email 'joao' ainda presente no endpoint consolidado!${NC}"
    else
        echo -e "${GREEN}✅ Email 'joao' foi filtrado com sucesso${NC}"
    fi
fi

echo ""

# ========== TESTE 3: Emails Esperados ==========
echo -e "${BLUE}3️⃣  Verificando Emails Esperados${NC}"

EXPECTED_EMAILS=(
    "admin@visualdesignmoz.com"
    "suporte@visualdesignmoz.com"
    "geral@visualdesignmoz.com"
)

for EMAIL in "${EXPECTED_EMAILS[@]}"; do
    if echo "$RESPONSE2" | grep -qi "$EMAIL"; then
        echo -e "${GREEN}✅ $EMAIL presente${NC}"
    else
        echo -e "${YELLOW}⚠️  $EMAIL não encontrado${NC}"
    fi
done

echo ""

# ========== TESTE 4: Emails Blocados ==========
echo -e "${BLUE}4️⃣  Verificando Emails Bloqueados${NC}"

BLOCKED_EMAILS=(
    "contato@joao.visualdesign.ao"
    "teste@"
    "exemplo@"
    "placeholder"
)

for EMAIL in "${BLOCKED_EMAILS[@]}"; do
    if echo "$RESPONSE2" | grep -qi "$EMAIL"; then
        echo -e "${RED}❌ $EMAIL deve estar bloqueado!${NC}"
    else
        echo -e "${GREEN}✅ $EMAIL está bloqueado${NC}"
    fi
done

echo ""

# ========== TESTE 5: Debug de Estatísticas ==========
echo -e "${BLUE}5️⃣  Estatísticas${NC}"

STATS=$(echo "$RESPONSE2" | grep -o '"stats":{[^}]*}')
if [ -n "$STATS" ]; then
    echo "📊 $STATS"
else
    echo -e "${YELLOW}⚠️  Estatísticas não encontradas${NC}"
fi

echo ""
echo "========================================================"
echo -e "${GREEN}✅ Testes concluídos!${NC}"
echo ""
echo "📝 Próximas etapas:"
echo "   1. Verifique os endpoints manualmente em seu navegador:"
echo "      - $BASE_URL/api/cyberpanel-list-emails?domain=visualdesignmoz.com"
echo "      - $BASE_URL/api/get-all-contacts?domain=visualdesignmoz.com"
echo "   2. Abra o Webmail no painel e confirme a lista de contactos"
echo "   3. Verifique o console (Dev Tools) para ver os logs de carregamento"
echo ""
