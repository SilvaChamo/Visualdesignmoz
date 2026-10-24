#!/bin/bash
# Corrigir domínios DKIM

echo "🔧 Adicionando domínios ao DKIM..."

# Adicionar ambos os domínios
{
echo "visualdesignmoz.com default:/etc/opendkim/keys/visualdesignmoz.com/default.private"
echo "vmi3097666.visualdesignmoz.com default:/etc/opendkim/keys/visualdesignmoz.com/default.private"
} > /etc/opendkim/key.table

# Adicionar signing table para ambos
{
echo "*@visualdesignmoz.com visualdesignmoz.com"
echo "*@vmi3097666.visualdesignmoz.com visualdesignmoz.com"
} > /etc/opendkim/signing.table

# Atualizar opendkim.conf com múltiplos domínios
cat > /etc/opendkim.conf << 'EOF'
Syslog yes
LogWhy yes
Mode sv
Canonicalization relaxed/relaxed
Selector default
Domain visualdesignmoz.com,vmi3097666.visualdesignmoz.com
KeyFile /etc/opendkim/keys/visualdesignmoz.com/default.private
Socket inet:8891@localhost
SignatureAlgorithm rsa-sha256
KeyTable /etc/opendkim/key.table
SigningTable /etc/opendkim/signing.table
EOF

# Corrigir permissões
chown root:root /etc/opendkim.conf
chmod 644 /etc/opendkim.conf
chown root:root /etc/opendkim/key.table /etc/opendkim/signing.table
chmod 644 /etc/opendkim/key.table /etc/opendkim/signing.table

echo "✅ Domínios configurados!"

# Reiniciar
systemctl restart opendkim
sleep 2
systemctl status opendkim --no-pager | head -3
