#!/bin/bash
# Configurar watchdog para manter serviços estáveis

echo "🛡️ Configurando watchdog..."

# 1. Watchdog para OpenDKIM
cat > /usr/local/bin/opendkim-watchdog.sh << 'EOF'
#!/bin/bash
if ! pgrep -x "opendkim" > /dev/null; then
    echo "$(date): OpenDKIM parado, reiniciando..." >> /var/log/watchdog.log
    /usr/sbin/opendkim \
        -d visualdesigne.com,vmi3097666.visualdesigne.com \
        -s default \
        -k /etc/opendkim/keys/visualdesigne.com/default.private \
        -p inet:8891@127.0.0.1 \
        -l &
fi
EOF
chmod +x /usr/local/bin/opendkim-watchdog.sh

# 2. Watchdog para Postfix
cat > /usr/local/bin/postfix-watchdog.sh << 'EOF'
#!/bin/bash
if ! pgrep -x "master" > /dev/null; then
    echo "$(date): Postfix parado, reiniciando..." >> /var/log/watchdog.log
    systemctl start postfix
fi
EOF
chmod +x /usr/local/bin/postfix-watchdog.sh

# 3. Adicionar ao crontab (verificar a cada 5 minutos)
(crontab -l 2>/dev/null | grep -v "watchdog"; \
 echo "*/5 * * * * /usr/local/bin/opendkim-watchdog.sh >/dev/null 2>&1"; \
 echo "*/5 * * * * /usr/local/bin/postfix-watchdog.sh >/dev/null 2>&1") | crontab -

echo "✅ Watchdog configurado!"
echo "📋 Verificação automática a cada 5 minutos"
echo "📝 Logs em: /var/log/watchdog.log"
