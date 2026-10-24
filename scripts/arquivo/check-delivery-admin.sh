#!/bin/bash
# Verificar entrega do email admin@visualdesignmoz.com

echo "⏳ Aguardando 15s..."
sleep 15

echo "📊 Verificando logs:"
grep "842EE141FE5" /var/log/mail.log | tail -5

echo ""
echo "📋 Fila:"
mailq

echo ""
echo "🔍 Verificar no Gmail - assunto: 'Teste admin VD 00:10'!"
