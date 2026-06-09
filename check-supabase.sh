#!/bin/bash
# Script para verificar dados em Supabase
# Instale supabase CLI: brew install supabase
# Ou use curl direto com a API

echo "🔍 Verificando emails gravados em Supabase..."
echo ""

# Credenciais do Supabase
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://supabase.visualdesignmoz.com}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:?Defina NEXT_PUBLIC_SUPABASE_ANON_KEY}"

# Buscar tabela email_contas
echo "📊 Tabela: email_contas"
echo "─────────────────────────────────────"
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/email_contas?select=email,nome_conta,status&order=email.asc" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null | head -50

echo ""
echo "📊 Procurando emails com 'joao'..."
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/email_contas?select=email,nome_conta&email=ilike.%joao%" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json"

echo ""
echo "✅ Verificação concluída"
