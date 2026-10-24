#!/bin/bash
# Adicionar ambos os domínios ao DKIM

echo "🔧 Configurando OpenDKIM para ambos os domínios..."

# Parar OpenDKIM atual
pkill -9 opendkim 2>/dev/null || true
sleep 1

# Criar configuração com ambos os domínios
/usr/sbin/opendkim \
  -d visualdesignmoz.com,vmi3097666.visualdesignmoz.com \
  -s default \
  -k /etc/opendkim/keys/visualdesignmoz.com/default.private \
  -p inet:8891@127.0.0.1 \
  -l &

sleep 2

# Verificar
ps aux | grep opendkim | grep -v grep
ss -tlnp | grep 8891

echo ""
echo "✅ OpenDKIM configurado com ambos os domínios!"
