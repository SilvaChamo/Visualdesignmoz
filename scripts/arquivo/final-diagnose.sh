#!/bin/bash
# Diagnóstico final do milter

echo "🔍 Diagnóstico completo..."

echo "1. Verificar se OpenDKIM está rodando:"
ps aux | grep opendkim | grep -v grep

echo ""
echo "2. Verificar porta 8891:"
ss -tlnp | grep 8891

echo ""
echo "3. Testar conexão milter:"
timeout 3 bash -c 'echo -e "LHLO test\nQUIT" | nc 127.0.0.1 8891' 2>&1 | head -3

echo ""
echo "4. Verificar logs de erro do milter:"
grep -i "milter\|opendkim" /var/log/mail.log | tail -10

echo ""
echo "5. Verificar se há erros de conexão:"
grep -i "warning.*milter\|error.*milter\|connection refused" /var/log/mail.log | tail -5

echo ""
echo "6. Configuração atual:"
postconf | grep -E "^smtpd_milters|^non_smtpd" | grep -v warning
