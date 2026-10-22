#!/bin/bash
# Testar envio com DKIM

echo "📧 Enviando teste..."
echo "Teste DKIM $(date)" | mail -s "Teste Assinatura $(date +%H:%M:%S)" silva.chamo@gmail.com

echo "⏳ Aguardando 15s..."
sleep 15

echo ""
echo "📊 Logs:"
tail -12 /var/log/mail.log | grep -E "(dkim|DKIM|signed|status)" | tail -8

echo ""
echo "📋 Fila:"
mailq
