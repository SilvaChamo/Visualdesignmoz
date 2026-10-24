#!/bin/bash
# Verificar status da fila

echo "⏳ Aguardando mais 10s..."
sleep 10

echo "📊 Verificando logs do envio:"
tail -15 /var/log/mail.log | grep -E "(23:23|status|gmail|dkim|bounced)" | tail -10

echo ""
echo "📋 Fila atual:"
mailq

echo ""
echo "🔍 Verificar no Gmail!"
