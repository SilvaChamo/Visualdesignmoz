#!/bin/bash
# Testar envio SMTP autenticado

echo "📧 Testando envio SMTP autenticado..."

EMAIL="osher@oshercollective.com"
SENHA="gce7G)S-1FfUX)-b"
DESTINO="silva.chamo@gmail.com"

# Instalar swaks
apt-get update -qq && apt-get install -y -qq swaks 2>/dev/null || true

# Testar envio
swaks \
    --to "$DESTINO" \
    --from "$EMAIL" \
    --server 127.0.0.1:587 \
    --auth-user "$EMAIL" \
    --auth-password "$SENHA" \
    --auth-plain \
    --tls \
    --body "Teste SMTP autenticado $(date)" \
    --header "Subject: Teste Auth SMTP $(date +%H:%M)" \
    --h-Subject "Teste Auth SMTP $(date +%H:%M)" 2>&1

echo ""
echo "⏳ Aguardando 15s..."
sleep 15

echo ""
echo "📊 Logs:"
tail -12 /var/log/mail.log | grep -E "(sasl|auth|status|gmail)" | tail -8

echo ""
echo "📋 Fila:"
mailq
