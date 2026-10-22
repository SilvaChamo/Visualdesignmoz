#!/bin/bash
# Testar envio SMTP autenticado na porta 587

echo "📧 Testando envio SMTP autenticado..."

# Instalar swaks se não existir
if ! command -v swaks &> /dev/null; then
    echo "Instalando swaks..."
    apt-get update -qq && apt-get install -y -qq swaks 2>/dev/null || echo "Não foi possível instalar swaks"
fi

# Testar com swaks
echo ""
echo "🚀 Testando com swaks:"
swaks \
    --to silva.chamo@gmail.com \
    --from osher@oshercollective.com \
    --server 127.0.0.1:587 \
    --auth-user osher@oshercollective.com \
    --auth-password "SENHA_AQUI" \
    --auth-plain \
    --tls \
    --body "Teste SMTP autenticado $(date)" \
    --header "Subject: Teste Auth SMTP $(date +%H:%M)" 2>&1

echo ""
echo "⏳ Aguardando 10s..."
sleep 10

echo ""
echo "📊 Verificando logs:"
tail -10 /var/log/mail.log | grep -E "(sasl|auth|status)" | tail -5

echo ""
echo "📋 Fila:"
mailq
