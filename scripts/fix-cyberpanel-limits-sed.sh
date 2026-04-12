#!/bin/bash
# Script alternativo usando sed para desativar limites

echo "🚫 DESATIVANDO LIMITES (VERSÃO SED SIMPLES)"
echo "============================================="
echo ""

SERVER="109.199.104.22"
PHP_FILE="/usr/local/CyberCP/public/send-email-api.php"

echo "🔍 Verificando arquivo no servidor..."

# Verificar se existe
if ! ssh root@$SERVER "test -f $PHP_FILE" ; then
    echo "❌ Arquivo não encontrado!"
    exit 1
fi

echo "✅ Arquivo encontrado"
echo ""

echo "📋 Criando backup..."
ssh root@$SERVER "cp $PHP_FILE ${PHP_FILE}.backup.sed.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup criado"
echo ""

echo "🔧 Aplicando correções com sed..."

# Comandos sed para desativar limites
ssh root@$SERVER "
    # Desativar verificações de limite comentando ou modificando
    sed -i 's/if (\$sentToday >= \$dailyLimit)/if (false \/* LIMITE DESATIVADO *\/)/g' $PHP_FILE
    sed -i 's/throw new Exception.*Limite diario/\/\/ LIMITE DESATIVADO: throw new Exception/g' $PHP_FILE
    sed -i 's/echo.*Limite diario atingido/\/\/ LIMITE DESATIVADO: echo/g' $PHP_FILE
    sed -i 's/return.*Limite diario/\/\/ LIMITE DESATIVADO: return/g' $PHP_FILE
    
    # Aumentar limites para valores altos
    sed -i 's/\$dailyLimit = [0-9]*/\$dailyLimit = 999999/g' $PHP_FILE
    sed -i 's/\$daily_limit = [0-9]*/\$daily_limit = 999999/g' $PHP_FILE
    
    # Forçar retorno positivo em funções de verificação
    sed -i 's/return \$sentToday >= \$dailyLimit;/return false; \/* LIMITE DESATIVADO *\//g' $PHP_FILE
"

echo "✅ Correções aplicadas"
echo ""

echo "🔍 Verificando alterações..."
ssh root@$SERVER "grep -n 'LIMITE DESATIVADO\|999999' $PHP_FILE | head -20"
echo ""

echo "🔄 Reiniciando LSCPD..."
ssh root@$SERVER "systemctl restart lscpd 2>/dev/null || service lscpd restart 2>/dev/null || echo 'Reinicie manualmente'"
echo "✅ Reiniciado"
echo ""

echo "============================================="
echo "✅ Pronto! Teste o envio de email."
echo ""
echo "Para verificar: ssh root@$SERVER 'cat $PHP_FILE | grep -n dailyLimit'"
