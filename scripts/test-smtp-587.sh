#!/bin/bash
# Testar SMTP na porta 587 com autenticação

echo "📧 Testando SMTP na porta 587..."

# Testar conexão
echo "1. Testar conexão TLS na 587:"
timeout 5 openssl s_client -connect 127.0.0.1:587 -starttls smtp 2>&1 | head -10

echo ""
echo "2. Verificar logs do Dovecot SASL:"
tail -10 /var/log/mail.log | grep -i "sasl\|auth"

echo ""
echo "3. Testar autenticação (precisa de usuário/senha):"
echo "   Usuário: osher@oshercollective.com"
echo "   Senha: [senha do email]"

echo ""
echo "🔧 Para testar manualmente:"
echo "   swaks --to silva.chamo@gmail.com --from osher@oshercollective.com --server 127.0.0.1:587 --auth-user osher@oshercollective.com --auth-password SENHA"
