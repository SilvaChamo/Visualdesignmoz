#!/bin/bash
# Verificar se email foi entregue

echo "⏳ Aguardando 10s..."
sleep 10

echo "📊 Verificando logs:"
tail -15 /var/log/mail.log | grep -E "(9F4AA|status|gmail|relay)" | tail -10

echo ""
echo "📋 Fila:"
mailq

echo ""
echo "🔍 Verificar no Gmail se chegou!"
