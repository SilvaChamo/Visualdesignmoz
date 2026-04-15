#!/bin/bash
# Verificar DKIM para oshercollective.com

echo "🔍 Verificando DKIM para oshercollective.com..."

# Verificar se existe chave
ls -la /etc/opendkim/keys/oshercollective.com/ 2>/dev/null || echo "❌ Não existe chave para oshercollective.com"

# Verificar DNS
nslookup -type=TXT default._domainkey.oshercollective.com 2>/dev/null || dig TXT default._domainkey.oshercollective.com +short 2>/dev/null || echo "❌ Sem registro DKIM no DNS"

# Verificar SPF
nslookup -type=TXT oshercollective.com 2>/dev/null | grep -i spf || dig TXT oshercollective.com +short 2>/dev/null | grep -i spf || echo "❌ Sem SPF"

echo ""
echo "📋 Soluções:"
echo "1. Criar DKIM para oshercollective.com"
echo "2. Usar visualdesigne.com como remetente"
echo "3. Configurar relayhost para enviar via outro servidor"
