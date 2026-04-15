#!/bin/bash
# Configurar OpenDKIM com socket inet (mais estável)

echo "🔧 Configurando OpenDKIM com socket inet..."

# Limpar socket antigo
rm -f /var/spool/postfix/opendkim/opendkim.sock

# Configuração com inet
cat > /etc/opendkim.conf << 'EOF'
Syslog yes
LogWhy yes
Mode sv
Canonicalization relaxed/relaxed
Selector default
Domain visualdesigne.com
KeyFile /etc/opendkim/keys/visualdesigne.com/default.private
Socket inet:8891@127.0.0.1
SignatureAlgorithm rsa-sha256
PidFile /run/opendkim/opendkim.pid
EOF

# Criar diretório PID
mkdir -p /run/opendkim
chown opendkim:opendkim /run/opendkim
chmod 755 /run/opendkim

# Corrigir permissões
chown root:root /etc/opendkim.conf
chmod 644 /etc/opendkim.conf

# Atualizar Postfix
postconf -e "smtpd_milters = inet:127.0.0.1:8891"
postconf -e "non_smtpd_milters = inet:127.0.0.1:8891"

echo "✅ Configuração atualizada!"

# Parar e iniciar limpo
pkill -9 opendkim 2>/dev/null || true
sleep 1

# Iniciar manualmente para testar
/usr/sbin/opendkim -c /etc/opendkim.conf &
sleep 2

# Verificar
ps aux | grep opendkim | grep -v grep
ss -tlnp | grep 8891
