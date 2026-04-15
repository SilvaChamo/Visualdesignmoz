#!/bin/bash
# Matar processo antigo e reiniciar

echo "🔧 Matando processo antigo 1735008..."

# Matar processo específico
kill -9 1735008 2>/dev/null || true
sleep 2

# Matar todos os opendkim
pkill -9 opendkim 2>/dev/null || true
killall -9 opendkim 2>/dev/null || true
sleep 2

# Verificar se morreu
ps aux | grep opendkim | grep -v grep || echo "✅ Nenhum opendkim rodando"

# Iniciar novo com configuração correta
/usr/sbin/opendkim \
  -d visualdesigne.com,vmi3097666.visualdesigne.com \
  -s default \
  -k /etc/opendkim/keys/visualdesigne.com/default.private \
  -p inet:8891@127.0.0.1 \
  -l &

sleep 3

echo "✅ Novo OpenDKIM iniciado!"
ps aux | grep opendkim | grep -v grep
ss -tlnp | grep 8891
