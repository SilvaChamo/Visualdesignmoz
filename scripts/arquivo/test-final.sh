#!/bin/bash
# Teste final DKIM

echo "📧 Testando envio com DKIM..."

# Enviar
SUBJECT="Teste DKIM Final $(date +%H:%M:%S)"
echo "Teste de assinatura DKIM - $(date)" | mail -s "$SUBJECT" silva.chamo@gmail.com

echo "Assunto: $SUBJECT"
echo "⏳ Aguardando 15 segundos..."
sleep 15

echo ""
echo "📊 Verificando logs por 'signed' ou 'signature':"
tail -15 /var/log/mail.log | grep -iE "(signed|signature|dkim|DKIM)" | tail -8

echo ""
echo "📋 Fila de emails:"
mailq

echo ""
echo "🔍 Verificar se chegou no Gmail!"
