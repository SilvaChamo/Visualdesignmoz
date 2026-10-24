#!/bin/bash
# Configurar Postfix para enviar via relay (Gmail ou outro SMTP)

echo "📧 Configurando Postfix como relay..."

# Opção 1: Usar Gmail como relay (requer app password)
# Opção 2: Usar SMTP do provedor de hospedagem
# Opção 3: Enviar diretamente mas com autenticação correta

echo "Escolha uma opção:"
echo "1. Usar Gmail como relay (mais confiável)"
echo "2. Configurar SPF/DKIM no DNS (já feito, precisa verificar)"
echo "3. Usar outro SMTP relay gratuito"

# Por enquanto, vamos tentar enviar via submission (porta 587) com autenticação
# Isso pode funcionar melhor

echo ""
echo "🔧 Configurando relay..."

# Fazer backup
cp /etc/postfix/main.cf /etc/postfix/main.cf.backup.relay.$(date +%s)

# Configurar relay host (vamos usar Gmail ou outro)
# postconf -e "relayhost = [smtp.gmail.com]:587"
# postconf -e "smtp_sasl_auth_enable = yes"
# postconf -e "smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd"
# postconf -e "smtp_sasl_security_options = noanonymous"
# postconf -e "smtp_tls_security_level = encrypt"

echo "✅ Configuração de relay preparada!"
echo ""
echo "Precisa de:"
echo "- Conta Gmail para relay, OU"
echo "- Outro servidor SMTP com autenticação"
