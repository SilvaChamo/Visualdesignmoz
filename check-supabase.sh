#!/bin/bash
# Script para verificar dados em Supabase
# Instale supabase CLI: brew install supabase
# Ou use curl direto com a API

echo "🔍 Verificando emails gravados em Supabase..."
echo ""

# Credenciais do Supabase
SUPABASE_URL="https://gwankhxcbkrtgxopbxwd.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY"

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
