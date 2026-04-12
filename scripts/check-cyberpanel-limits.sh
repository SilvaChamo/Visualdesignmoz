#!/bin/bash
# Script para verificar e desativar limites de email no CyberPanel

echo "🔍 Verificando arquivos de limite de email no CyberPanel..."
echo ""

# Conectar ao servidor e verificar
ssh root@109.199.104.22 '
    echo "=== ARQUIVOS DE API DE EMAIL ==="
    find /usr/local/CyberCP -name "*send*email*" -o -name "*mail*api*" 2>/dev/null | head -20
    
    echo ""
    echo "=== PROCURANDO POR LIMITES DIÁRIOS ==="
    grep -r "dailyLimit\|limite\|warmup\|DAILY_LIMIT" /usr/local/CyberCP/ --include="*.php" 2>/dev/null | head -20
    
    echo ""
    echo "=== VERIFICANDO send-email-api.php ==="
    if [ -f "/usr/local/CyberCP/public/send-email-api.php" ]; then
        echo "✅ Arquivo encontrado: /usr/local/CyberCP/public/send-email-api.php"
        grep -n "limit\|daily\|warmup" /usr/local/CyberCP/public/send-email-api.php | head -30
    else
        echo "❌ Arquivo não encontrado em /usr/local/CyberCP/public/send-email-api.php"
        find /usr/local/CyberCP -name "send-email-api.php" 2>/dev/null
    fi
    
    echo ""
    echo "=== VERIFICANDO LIMITES NO MYSQL ==="
    mysql cyberpanel -e "SHOW TABLES LIKE '%limit%';" 2>/dev/null
    mysql cyberpanel -e "SHOW TABLES LIKE '%email%';" 2>/dev/null | head -10
'
