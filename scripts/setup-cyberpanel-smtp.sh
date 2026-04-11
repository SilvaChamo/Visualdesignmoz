#!/bin/bash
# Script para configurar CyberPanel SMTP para aceitar ligações externas
# Executar no servidor Contabo via SSH

echo "🚀 Configurando CyberPanel SMTP para ligações externas..."

# 1. Abrir portas no firewall
echo "📡 Abrindo portas no firewall..."
ufw allow 587/tcp
ufw allow 465/tcp
ufw allow 25/tcp
ufw reload

# Ou se usar iptables
iptables -A INPUT -p tcp --dport 587 -j ACCEPT
iptables -A INPUT -p tcp --dport 465 -j ACCEPT
iptables -A INPUT -p tcp --dport 25 -j ACCEPT

# 2. Configurar Postfix para aceitar ligações externas
echo "📧 Configurando Postfix..."

# Backup do ficheiro original
cp /etc/postfix/main.cf /etc/postfix/main.cf.backup.$(date +%Y%m%d)

# Configurações necessárias
postconf -e "inet_interfaces = all"
postconf -e "inet_protocols = all"
postconf -e "mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128"
postconf -e "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination"
postconf -e "smtpd_sasl_auth_enable = yes"
postconf -e "smtpd_sasl_type = dovecot"
postconf -e "smtpd_sasl_path = private/auth"
postconf -e "smtpd_sasl_security_options = noanonymous"
postconf -e "smtpd_sasl_local_domain = \$myhostname"

# 3. Configurar SSL/TLS
echo "🔒 Configurando SSL/TLS..."
postconf -e "smtpd_tls_cert_file = /etc/ssl/cyberpanel/cyberpanel.pem"
postconf -e "smtpd_tls_key_file = /etc/ssl/cyberpanel/cyberpanel.pem"
postconf -e "smtpd_use_tls = yes"
postconf -e "smtpd_tls_auth_only = yes"

# 4. Atualizar master.cf para porta 587 (submission)
echo "📨 Configurando porta 587 (Submission)..."
if ! grep -q "^submission" /etc/postfix/master.cf; then
    cat >> /etc/postfix/master.cf << EOF

# Porta 587 - Submission com STARTTLS
submission inet n       -       -       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_tls_wrappermode=no
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_sasl_type=dovecot
  -o smtpd_sasl_path=private/auth
  -o smtpd_sasl_security_options=noanonymous
  -o smtpd_sasl_local_domain=\$myhostname
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_sender_restrictions=permit_sasl_authenticated,reject
  -o smtpd_recipient_restrictions=permit_mynetworks,permit_sasl_authenticated,reject_unauth_destination

# Porta 465 - SMTPS (SSL direto)
smtps     inet  n       -       -       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_sasl_type=dovecot
  -o smtpd_sasl_path=private/auth
  -o smtpd_sasl_security_options=noanonymous
  -o smtpd_sasl_local_domain=\$myhostname
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_sender_restrictions=permit_sasl_authenticated,reject
  -o smtpd_recipient_restrictions=permit_mynetworks,permit_sasl_authenticated,reject_unauth_destination
EOF
fi

# 5. Verificar configuração Dovecot para SASL
echo "🐦 Configurando Dovecot SASL..."
if [ -f /etc/dovecot/conf.d/10-master.conf ]; then
    # Ativar socket para Postfix
    sed -i 's|#unix_listener /var/spool/postfix/private/auth|unix_listener /var/spool/postfix/private/auth|' /etc/dovecot/conf.d/10-master.conf
    sed -i 's|#mode = 0666|mode = 0666|' /etc/dovecot/conf.d/10-master.conf
    sed -i 's|#user = postfix|user = postfix|' /etc/dovecot/conf.d/10-master.conf
    sed -i 's|#group = postfix|group = postfix|' /etc/dovecot/conf.d/10-master.conf
fi

# 6. Criar socket se não existir
mkdir -p /var/spool/postfix/private
touch /var/spool/postfix/private/auth
chown postfix:postfix /var/spool/postfix/private/auth
chmod 666 /var/spool/postfix/private/auth

# 7. Restart serviços
echo "🔄 Reiniciando serviços..."
systemctl restart postfix
systemctl restart dovecot

# 8. Testar configuração
echo "🧪 Testando configuração Postfix..."
postfix check

# 9. Verificar se portas estão abertas
echo "🔍 Verificando portas..."
netstat -tlnp | grep -E ':(25|587|465)'

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📋 Resumo:"
echo "   - Porta 25: SMTP (sem auth)"
echo "   - Porta 587: Submission (STARTTLS + auth)"
echo "   - Porta 465: SMTPS (SSL + auth)"
echo ""
echo "🧪 Para testar, execute:"
echo "   echo 'Teste de email' | mail -s 'Assunto' -a 'From: admin@visualdesigne.com' seuemail@gmail.com"
echo ""
echo "⚠️  IMPORTANTE: O servidor deve permitir ligações externas na porta 587"
echo "   Verifique se o firewall do Contabo (painel web) também permite estas portas."
