#!/bin/bash
# Testar envio de admin@visualdesignmoz.com

echo "📧 Testando envio de admin@visualdesignmoz.com..."

# Verificar se admin@visualdesignmoz.com existe
grep "admin@visualdesignmoz.com" /etc/postfix/virtual 2>/dev/null || echo "Verificando no CyberPanel..."

# Testar envio (precisa de senha)
# Vamos usar swaks para testar
swaks \
    --to silva.chamo@gmail.com \
    --from admin@visualdesignmoz.com \
    --server 127.0.0.1:587 \
    --auth-user admin@visualdesignmoz.com \
    --auth-password "SENHA_ADMIN" \
    --auth-plain \
    --tls \
    --body "Teste admin@visualdesignmoz.com $(date)" \
    --h-Subject "Teste admin $(date +%H:%M)" 2>&1

echo ""
echo "Precisa da senha de admin@visualdesignmoz.com!"
