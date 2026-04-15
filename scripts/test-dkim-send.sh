#!/bin/bash
# Testar envio com DKIM

echo "🚀 Testando envio de email com DKIM..."

# Limpar processo novo
pkill -9 opendkim
sleep 1

# Iniciar OpenDKIM (o que já está rodando)
if ! pgrep opendkim > /dev/null; then
    echo "Iniciando OpenDKIM..."
    /usr/sbin/opendkim &
    sleep 2
fi

# Verificar
ps aux | grep opendkim | grep -v grep
ss -tlnp | grep 8891

echo ""
echo "📧 Enviando email de teste..."
echo "Teste DKIM $(date)" | mail -s "Teste Autenticação $(date +%H:%M)" silva.chamo@gmail.com

echo ""
echo "⏳ Aguardando 10 segundos..."
sleep 10

echo ""
echo "📊 Verificando:"
tail -10 /var/log/mail.log | grep -i "dkim\|status=sent\|gmail\|bounced"

echo ""
echo "📋 Fila:"
mailq
