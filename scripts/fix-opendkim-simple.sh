#!/bin/bash
# Configuração simples do OpenDKIM

echo "🔧 Configurando OpenDKIM simplificado..."

# Usar socket de arquivo ao invés de inet (mais confiável)
mkdir -p /var/spool/postfix/opendkim
chown opendkim:opendkim /var/spool/postfix/opendkim
chmod 755 /var/spool/postfix/opendkim

# Configuração simplificada
cat > /etc/opendkim.conf << 'EOF'
Syslog yes
LogWhy yes
Mode sv
Canonicalization relaxed/relaxed
Selector default
Domain visualdesignmoz.com
KeyFile /etc/opendkim/keys/visualdesignmoz.com/default.private
Socket local:/var/spool/postfix/opendkim/opendkim.sock
SignatureAlgorithm rsa-sha256
EOF

# Atualizar Postfix para usar socket de arquivo
postconf -e "smtpd_milters = local:/var/spool/postfix/opendkim/opendkim.sock"
postconf -e "non_smtpd_milters = local:/var/spool/postfix/opendkim/opendkim.sock"

# Corrigir permissões
chown root:root /etc/opendkim.conf
chmod 644 /etc/opendkim.conf

echo "✅ Configuração atualizada!"

# Reiniciar
systemctl restart opendkim
sleep 2
systemctl status opendkim --no-pager | head -3
