#!/bin/bash
# Configuração mínima do OpenDKIM

echo "🔧 Configurando OpenDKIM ultra-simples..."

# Matar tudo
pkill -9 opendkim 2>/dev/null || true
sleep 2

# Configuração mínima - sem canonicalization
cat > /etc/opendkim.conf << 'ENDCONF'
Syslog yes
LogWhy yes
Mode sv
Selector default
KeyTable /etc/opendkim/key.table
SigningTable /etc/opendkim/signing.table
Socket inet:8891@127.0.0.1
ENDCONF

# Corrigir permissões
chown root:root /etc/opendkim.conf
chmod 644 /etc/opendkim.conf

# Iniciar
/usr/sbin/opendkim -c /etc/opendkim.conf &
sleep 3

# Verificar
ps aux | grep opendkim | grep -v grep
ss -tlnp | grep 8891

echo "✅ OpenDKIM iniciado!"
