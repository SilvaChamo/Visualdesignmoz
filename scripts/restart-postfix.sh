#!/bin/bash
# Reiniciar Postfix para reconectar ao milter

echo "🔄 Reiniciando Postfix..."

# Recarregar Postfix
/usr/sbin/postfix -c /etc/postfix reload

echo "⏳ Aguardando 2s..."
sleep 2

# Enviar novo teste
echo "Teste após reload $(date)" | mail -s "Teste Milter $(date +%H:%M:%S)" silva.chamo@gmail.com

echo "📧 Email enviado!"
echo "⏳ Aguardando 15s..."
sleep 15

echo ""
echo "📊 Logs:"
tail -12 /var/log/mail.log | grep -E "(milter|dkim|status|gmail)" | tail -8

echo ""
echo "📋 Fila:"
mailq
