#!/bin/bash
# Configurar OpenDKIM com tabelas

echo "🔧 Configurando OpenDKIM com KeyTable e SigningTable..."

# Parar
pkill -9 opendkim 2>/dev/null || true
sleep 1

# Criar KeyTable
cat > /etc/opendkim/key.table << 'EOF'
default._domainkey.visualdesigne.com visualdesigne.com:default:/etc/opendkim/keys/visualdesigne.com/default.private
EOF

# Criar SigningTable
cat > /etc/opendkim/signing.table << 'EOF'
*@visualdesigne.com default._domainkey.visualdesigne.com
*@vmi3097666.visualdesigne.com default._domainkey.visualdesigne.com
EOF

# Corrigir permissões
chown root:root /etc/opendkim/key.table /etc/opendkim/signing.table
chmod 644 /etc/opendkim/key.table /etc/opendkim/signing.table

# Iniciar com tabelas
/usr/sbin/opendkim \
  -l \
  -p inet:8891@127.0.0.1 &

sleep 2

echo "✅ OpenDKIM iniciado com tabelas!"
ps aux | grep opendkim | grep -v grep
