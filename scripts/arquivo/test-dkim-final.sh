#!/bin/bash
# Teste final DKIM

echo "📧 Testando envio com DKIM..."
echo "Teste DKIM $(date)" | mail -s "Teste Assinatura $(date +%H:%M:%S)" silva.chamo@gmail.com

echo "⏳ Aguardando 15 segundos..."
sleep 15

echo ""
echo "📊 Verificando logs:"
tail -15 /var/log/mail.log | grep -iE "(dkim|signed|signature|status=sent|gmail)" | tail -10

echo ""
echo "📋 Fila:"
mailq

echo ""
echo "🔍 Verificar no Gmail se chegou!"
