#!/bin/bash
# OpenDKIM via linha de comando apenas

echo "🔧 Matando e reiniciando OpenDKIM..."

# Matar TUDO
pkill -9 opendkim 2>/dev/null || true
sleep 2
killall -9 opendkim 2>/dev/null || true
sleep 1

# Apagar arquivo de config problemático
rm -f /etc/opendkim.conf

# Iniciar SÓ com linha de comando
/usr/sbin/opendkim \
  -d visualdesigne.com,vmi3097666.visualdesigne.com \
  -s default \
  -k /etc/opendkim/keys/visualdesigne.com/default.private \
  -p inet:8891@127.0.0.1 &

sleep 3

echo "✅ Verificando:"
ps aux | grep opendkim | grep -v grep
ss -tlnp | grep 8891
