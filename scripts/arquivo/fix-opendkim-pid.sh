#!/bin/bash
# Corrigir diretório PID do OpenDKIM

echo "🔧 Corrigindo diretório PID..."

# Criar diretório
mkdir -p /run/opendkim
chown opendkim:opendkim /run/opendkim
chmod 755 /run/opendkim

# Alternativa: usar /var/run
mkdir -p /var/run/opendkim
chown opendkim:opendkim /var/run/opendkim
chmod 755 /var/run/opendkim

echo "✅ Diretório criado!"

# Reiniciar
systemctl restart opendkim
sleep 2
systemctl status opendkim --no-pager | head -5
