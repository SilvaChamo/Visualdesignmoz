#!/bin/bash
# Testar DKIM

echo "🔧 Corrigindo permissões do socket..."

# Corrigir permissões do socket para Postfix poder usar
chgrp postfix /var/spool/postfix/opendkim/opendkim.sock
chmod 660 /var/spool/postfix/opendkim/opendkim.sock

# Adicionar postfix ao grupo opendkim
usermod -a -G opendkim postfix 2>/dev/null || true

echo "✅ Permissões corrigidas!"
echo ""

# Verificar configuração Postfix
echo "📋 Configuração Postfix:"
postconf smtpd_milters non_smtpd_milters 2>/dev/null | grep -v "warning"

echo ""
echo "🚀 Testando envio de email..."
echo "Teste DKIM $(date)" | mail -s "Teste Assinatura $(date +%H:%M)" silva.chamo@gmail.com

echo ""
echo "⏳ Aguardando 10 segundos..."
sleep 10

echo ""
echo "📧 Verificando logs:"
tail -5 /var/log/mail.log 2>/dev/null | grep -i "dkim\|status=sent\|gmail\|C6D3A" || echo "Verificando fila..."

echo ""
echo "📊 Status da fila:"
mailq
