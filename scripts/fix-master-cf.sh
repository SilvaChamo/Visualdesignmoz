#!/bin/bash
# Corrigir master.cf para ativar milter no pickup

echo "🔧 Corrigindo master.cf..."

# Backup
cp /etc/postfix/master.cf /etc/postfix/master.cf.backup.$(date +%s)

# Criar nova linha de pickup com milter
# Precisamos editar o arquivo para adicionar milter ao pickup
sed -i 's/^pickup    unix  n       -       n       60      1       pickup$/pickup    unix  n       -       n       60      1       pickup\n  -o smtpd_milters=inet:127.0.0.1:8891\n  -o non_smtpd_milters=inet:127.0.0.1:8891/' /etc/postfix/master.cf

echo "✅ Master.cf atualizado!"

# Verificar
grep -A3 "^pickup" /etc/postfix/master.cf | head -6

echo ""
echo "🔄 Recarregando Postfix..."
/usr/sbin/postfix -c /etc/postfix reload

echo ""
echo "📧 Testando envio..."
echo "Teste Milter $(date)" | mail -s "Teste $(date +%H:%M:%S)" silva.chamo@gmail.com

sleep 10

echo ""
echo "📊 Verificando logs:"
tail -12 /var/log/mail.log | grep -E "(opendkim|dkim|sign|status)" | tail -8
