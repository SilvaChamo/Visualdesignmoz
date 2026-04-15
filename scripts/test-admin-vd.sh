#!/bin/bash
# Testar envio de admin@visualdesigne.com

echo "📧 Testando envio de admin@visualdesigne.com..."

swaks \
    --to silva.chamo@gmail.com \
    --from admin@visualdesigne.com \
    --server 127.0.0.1:587 \
    --auth-user admin@visualdesigne.com \
    --auth-password 'Ad.Vd#2425?*' \
    --auth-plain \
    --tls \
    --body "Teste admin@visualdesigne.com $(date)" \
    --h-Subject "Teste admin VD $(date +%H:%M)" 2>&1

echo ""
echo "⏳ Aguardando 15s..."
sleep 15

echo ""
echo "📊 Logs:"
tail -15 /var/log/mail.log | grep -E "(admin|visualdesigne|status|gmail)" | tail -8

echo ""
echo "📋 Fila:"
mailq

echo ""
echo "🔍 Verificar no Gmail!"
