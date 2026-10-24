#!/bin/bash
# Verificar configuração submission (porta 587)

echo "📧 Verificando submission..."

# Verificar se submission está ativo
echo "1. Master.cf - submission:"
grep -A10 "^submission" /etc/postfix/master.cf

echo ""
echo "2. Porta 587:"
ss -tlnp | grep 587

echo ""
echo "3. Testar conexão submission:"
timeout 3 bash -c 'echo "EHLO test" | nc 127.0.0.1 587' 2>&1 | head -5

echo ""
echo "4. Configuração SASL:"
postconf | grep -E "sasl|submission" | grep -v warning | head -10
