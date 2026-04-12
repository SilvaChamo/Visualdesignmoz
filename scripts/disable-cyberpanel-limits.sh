#!/bin/bash
# Script para desativar limites de email no CyberPanel

echo "🚫 Desativando limites de email no CyberPanel..."
echo ""

ssh root@109.199.104.22 '
    # Backup do arquivo original
    if [ -f "/usr/local/CyberCP/public/send-email-api.php" ]; then
        cp /usr/local/CyberCP/public/send-email-api.php /usr/local/CyberCP/public/send-email-api.php.backup.$(date +%Y%m%d_%H%M%S)
        echo "✅ Backup criado"
        
        # Verificar se tem verificação de limite
        if grep -q "dailyLimit\|limite.*diario\|canSendEmail" /usr/local/CyberCP/public/send-email-api.php; then
            echo "📝 Arquivo contém verificações de limite - mostrando linhas:"
            grep -n "dailyLimit\|limite.*diario\|canSendEmail" /usr/local/CyberCP/public/send-email-api.php
            echo ""
            echo "⚠️  Você precisa editar manualmente ou fornecer acesso para eu comentar as linhas"
        else
            echo "✅ Nenhuma verificação de limite encontrada no arquivo PHP"
        fi
    else
        echo "❌ Arquivo send-email-api.php não encontrado"
    fi
    
    # Verificar logs de erro
    echo ""
    echo "=== ÚLTIMOS ERROS DE EMAIL ==="
    tail -20 /var/log/mail.log 2>/dev/null || echo "Sem acesso ao mail.log"
    tail -20 /usr/local/CyberCP/logs/* 2>/dev/null | grep -i "limit\|daily" | head -10
'

echo ""
echo "📋 INSTRUÇÕES PARA DESATIVAR MANUALMENTE:"
echo "1. SSH para o servidor: ssh root@109.199.104.22"
echo "2. Edite o arquivo: nano /usr/local/CyberCP/public/send-email-api.php"
echo "3. Procure por funções de limite e comente com //"
echo "4. Salve e reinicie o CyberPanel: systemctl restart lscpd"
echo ""
echo "🔍 Ou execute para ver o conteúdo completo:"
echo "   ssh root@109.199.104.22 'cat /usr/local/CyberCP/public/send-email-api.php'"
