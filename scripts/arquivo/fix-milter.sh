#!/bin/bash
# Verificar e corrigir configuração milter

echo "🔍 Verificando configuração milter..."

# Ver todas as configurações de milter
echo "1. Configurações milter:"
postconf -n | grep -E "^milter|^smtpd_milter|^non_smtpd" 2>/dev/null | grep -v warning

echo ""
echo "2. Verificar protocolo:"
postconf milter_protocol 2>/dev/null | grep -v warning

echo ""
echo "3. Configurar corretamente:"
# Protocolo 6 é o mais compatível
postconf -e "milter_protocol = 6"
postconf -e "milter_default_action = accept"
postconf -e "smtpd_milters = inet:127.0.0.1:8891"
postconf -e "non_smtpd_milters = inet:127.0.0.1:8891"

echo ""
echo "4. Verificar se o email passa pelo cleanup com milter:"
# O mail command usa pickup -> cleanup -> qmgr -> smtp
# O milter deve ser chamado no cleanup

echo "✅ Configuração atualizada!"

# Recarregar
/usr/sbin/postfix -c /etc/postfix reload
sleep 2

echo ""
echo "📧 Testando envio..."
echo "Teste Milter $(date)" | mail -s "Teste DKIM $(date +%H:%M:%S)" silva.chamo@gmail.com

echo "⏳ Aguardando 10s..."
sleep 10

echo ""
echo "📊 Verificando se milter foi chamado:"
tail -15 /var/log/mail.log | grep -E "(cleanup.*milter|dkim|sign)" | tail -5
