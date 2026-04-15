#!/bin/bash
# Testar envio de admin@visualdesigne.com

echo "📧 Testando envio de admin@visualdesigne.com..."

# Verificar se admin@visualdesigne.com existe
grep "admin@visualdesigne.com" /etc/postfix/virtual 2>/dev/null || echo "Verificando no CyberPanel..."

# Testar envio (precisa de senha)
# Vamos usar swaks para testar
swaks \
    --to silva.chamo@gmail.com \
    --from admin@visualdesigne.com \
    --server 127.0.0.1:587 \
    --auth-user admin@visualdesigne.com \
    --auth-password "SENHA_ADMIN" \
    --auth-plain \
    --tls \
    --body "Teste admin@visualdesigne.com $(date)" \
    --h-Subject "Teste admin $(date +%H:%M)" 2>&1

echo ""
echo "Precisa da senha de admin@visualdesigne.com!"
