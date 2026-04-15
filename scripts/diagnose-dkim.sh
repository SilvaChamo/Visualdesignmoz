#!/bin/bash
# Diagnosticar por que OpenDKIM não assina

echo "🔍 Diagnosticando OpenDKIM..."

# 1. Verificar se Postfix está tentando conectar
echo "1. Configuração Postfix:"
postconf | grep -E "(milter|smtpd_milters|non_smtpd)" | grep -v "warning"

echo ""
echo "2. Verificar conexão:"
telnet 127.0.0.1 8891 2>/dev/null || nc -zv 127.0.0.1 8891 2>/dev/null || echo "Conexão falhou"

echo ""
echo "3. Verificar logs de conexão milter:"
grep -i "milter\|opendkim" /var/log/mail.log | tail -5

echo ""
echo "4. Testar conexão manual:"
printf '\x00\x00\x00\x01\x00\x00\x00\x01M' | timeout 2 nc 127.0.0.1 8891 2>&1 | head -1 || echo "Sem resposta"

echo ""
echo "5. Verificar se Postfix chama milter:"
tail -10 /var/log/mail.log | grep -E "(cleanup|milter)"
