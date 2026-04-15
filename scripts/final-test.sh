#!/bin/bash
# Teste final de DKIM

echo "📧 Enviando email de teste..."

# Enviar
SUBJECT="Teste DKIM $(date +%H:%M:%S)"
echo "Teste de assinatura DKIM - $(date)" | mail -s "$SUBJECT" silva.chamo@gmail.com

echo "Assunto: $SUBJECT"
echo "⏳ Aguardando 15 segundos..."
sleep 15

echo ""
echo "📊 Verificando logs:"
tail -12 /var/log/mail.log | grep -E "(dkim|DKIM|status=sent|gmail|bounced|clean)" | tail -8

echo ""
echo "📋 Fila:"
mailq

echo ""
echo "🔍 Status do OpenDKIM:"
ps aux | grep opendkim | grep -v grep
