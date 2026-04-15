#!/bin/bash
# Verificar e corrigir milter no pickup

echo "🔍 Verificando master.cf..."

# Ver pickup no master.cf
grep -A5 "^pickup" /etc/postfix/master.cf

echo ""
echo "🔧 Adicionando milter ao pickup..."

# Fazer backup
cp /etc/postfix/master.cf /etc/postfix/master.cf.bak.$(date +%s)

# Adicionar override de milter ao pickup
# O pickup precisa ter o milter também
cat >> /etc/postfix/master.cf << 'EOF'

# Override para ativar milter no pickup
pickup    unix  n       -       n       60      1       pickup
  -o receive_override_options=no_header_body_checks
  -o smtpd_milters=inet:127.0.0.1:8891
EOF

echo "✅ Master.cf atualizado!"

# Recarregar Postfix
/usr/sbin/postfix -c /etc/postfix reload

echo ""
echo "📧 Testando envio..."
echo "Teste Pickup Milter $(date)" | mail -s "Teste $(date +%H:%M:%S)" silva.chamo@gmail.com

sleep 10

echo ""
echo "📊 Logs:"
tail -12 /var/log/mail.log | grep -E "(pickup|cleanup|milter|opendkim)" | tail -8
