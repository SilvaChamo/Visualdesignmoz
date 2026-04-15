#!/bin/bash
# Verificar se milter está realmente ativo

echo "🔍 Verificando se milter está ativo..."

# 1. Verificar conexão
nc -zv 127.0.0.1 8891 2>&1

echo ""
echo "2. Verificar logs de milter em tempo real:"
# Enviar email e capturar logs imediatamente
echo "Teste Milter $(date)" | mail -s "Teste $(date +%H:%M:%S)" silva.chamo@gmail.com &

sleep 2

echo "Logs após 2s:"
tail -8 /var/log/mail.log | grep -E "(cleanup|milter|opendkim)"

echo ""
echo "3. Aguardando mais 10s..."
sleep 10

echo "Logs após 12s:"
tail -15 /var/log/mail.log | grep -E "(cleanup|milter|opendkim|status)" | tail -10
