#!/bin/bash
# Verificar configuração OpenDKIM

echo "📋 Verificando configuração..."

# Ver arquivo
echo "Conteúdo de /etc/opendkim.conf:"
cat /etc/opendkim.conf

echo ""
echo "🔧 Testando com config mínima..."

# Parar
pkill -9 opendkim 2>/dev/null || true
sleep 1

# Criar config funcional
rm -f /etc/opendkim.conf
touch /etc/opendkim.conf

# Iniciar com parâmetros na linha de comando
/usr/sbin/opendkim \
  -x /etc/opendkim.conf \
  -d visualdesigne.com \
  -s default \
  -k /etc/opendkim/keys/visualdesigne.com/default.private \
  -p inet:8891@127.0.0.1 \
  -P /run/opendkim/opendkim.pid \
  -l &

sleep 2

# Verificar
ps aux | grep opendkim | grep -v grep
ss -tlnp | grep 8891

echo ""
echo "✅ OpenDKIM iniciado com parâmetros!"
