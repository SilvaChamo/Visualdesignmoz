#!/bin/bash
# Configurar site para usar SMTP autenticado na porta 587

echo "📧 Configurando site para usar SMTP submission..."

# O problema é que o site envia via 'mail' ou sendmail local
# Precisamos configurar as APIs para usar SMTP na porta 587

echo "✅ Porta 587 está configurada:"
ss -tlnp | grep 587

echo ""
echo "📋 Configuração submission:"
grep -A5 "^submission" /etc/postfix/master.cf

echo ""
echo "🔧 As APIs do site precisam ser atualizadas para:"
echo "- Usar SMTP na porta 587"
echo "- Autenticar com usuário/senha do email"
echo "- Em vez de envio local via 'mail'"

echo ""
echo "📧 SnappyMail já usa esta configuração!"
echo "O site (APIs) precisa fazer o mesmo."
