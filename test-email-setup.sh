#!/bin/bash

# TESTE RÁPIDO DO SETUP EMAIL E CYBERPANEL
# Este script verifica se tudo está configurado corretamente

echo "🔍 VERIFICAÇÃO DO SETUP EMAIL - CyberPanel"
echo "==========================================="
echo ""

# 1. Verificar arquivo .env.local
echo "1️⃣  Verificando .env.local..."
if grep -q "SMTP_MASTER_PASSWORD=Ad.Vd#2425" .env.local; then
    echo "   ✅ SMTP_MASTER_PASSWORD configurada corretamente"
else
    echo "   ❌ SMTP_MASTER_PASSWORD não encontrada ou incorreta"
fi

if grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local; then
    echo "   ✅ SUPABASE_SERVICE_ROLE_KEY definida"
else
    echo "   ❌ SUPABASE_SERVICE_ROLE_KEY faltando"
fi

echo ""

# 2. Verificar se os arquivos de API existem
echo "2️⃣  Verificando endpoints de API..."
if test -f "src/app/api/on-register/route.ts"; then
    echo "   ✅ /api/on-register endpoint existe"
else
    echo "   ❌ /api/on-register endpoint não encontrado"
fi

if test -f "src/app/api/cyberpanel-cli/route.ts"; then
    echo "   ✅ /api/cyberpanel-cli endpoint existe"
else
    echo "   ❌ /api/cyberpanel-cli endpoint não encontrado"
fi

echo ""

# 3. Verificar integração em auth.ts
echo "3️⃣  Verificando integração em auth.ts..."
if grep -q "fetch('/api/on-register'" src/lib/services/auth.ts; then
    echo "   ✅ Hook /api/on-register integrado no signup"
else
    echo "   ❌ Hook /api/on-register não encontrado em auth.ts"
fi

echo ""

# 4. Verificar if scripts de ativação existem
echo "4️⃣  Verificando scripts de ativação..."
if test -f "activate-cyberpanel-accounts.sh"; then
    echo "   ✅ activate-cyberpanel-accounts.sh existe (API local)"
    chmod +x activate-cyberpanel-accounts.sh
else
    echo "   ❌ activate-cyberpanel-accounts.sh não encontrado"
fi

if test -f "activate-cyberpanel-ssh.sh"; then
    echo "   ✅ activate-cyberpanel-ssh.sh existe (SSH remoto)"
    chmod +x activate-cyberpanel-ssh.sh
else
    echo "   ❌ activate-cyberpanel-ssh.sh não encontrado"
fi

echo ""

# 5. Verificar senha padronizada em arquivos críticos
echo "5️⃣  Verificando senha padronizada em componentes..."
count=$(grep -r "Ad.Vd#2425" src/lib/email-service.ts src/components/dashboard/ | wc -l)
if [ $count -gt 0 ]; then
    echo "   ✅ Senha padronizada encontrada em $count locais"
else
    echo "   ❌ Senha padronizada não encontrada"
fi

echo ""
echo "==========================================="
echo "✅ VERIFICAÇÃO CONCLUÍDA!"
echo ""
echo "📌 Próximos passos:"
echo "   1. npm install (se não feito)"
echo "   2. npm run dev"
echo "   3. ./activate-cyberpanel-accounts.sh (criar contas)"
echo "   4. Testar registro em http://localhost:3000/auth/register/"
