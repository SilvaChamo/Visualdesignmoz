#!/bin/bash

# Script para ativar contas de email no CyberPanel via SSH (com password fallback)
# Se a chave SSH configurada não funcionar, este script pode usar password

REMOTE_HOST="root@109.199.104.22"
DOMAIN="visualdesigne.com"
PASSWORD="Ad.Vd#2425?*"

echo "🔐 Conectando via SSH para ativar contas no CyberPanel..."
echo "Host: $REMOTE_HOST"
echo "Domain: $DOMAIN"
echo ""

# Tentar usando a chave SSH primeiro
if ssh -i ~/.ssh/id_rsa -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$REMOTE_HOST" "echo 'SSH KEY OK'" 2>/dev/null; then
  echo "✅ Conexão via chave SSH bem-sucedida"
  SSH_AVAILABLE=1
else
  echo "⚠️ SSH com chave falhou. Será necessária password."
  SSH_AVAILABLE=0
fi

if [ $SSH_AVAILABLE -eq 1 ]; then
  echo ""
  echo "📧 Criando contas de email..."
  
  ssh "$REMOTE_HOST" <<'SSH_COMMANDS'
set -e
echo "=== Ativando Contas de Email no CyberPanel ==="

# Criar contas
/usr/local/CyberCP/bin/cyberpanel createEmail --domainName visualdesigne.com --userName admin --password 'Ad.Vd#2425?*' 2>&1
echo "✓ Conta admin criada/ativada"

/usr/local/CyberCP/bin/cyberpanel createEmail --domainName visualdesigne.com --userName suporte --password 'Ad.Vd#2425?*' 2>&1
echo "✓ Conta suporte criada/ativada"

/usr/local/CyberCP/bin/cyberpanel createEmail --domainName visualdesigne.com --userName geral --password 'Ad.Vd#2425?*' 2>&1
echo "✓ Conta geral criada/ativada"

# Reiniciar serviços
echo ""
echo "=== Reiniciando Serviços de Email ==="
systemctl restart postfix 2>/dev/null || service postfix restart
echo "✓ Postfix restarted"

systemctl restart dovecot 2>/dev/null || service dovecot restart
echo "✓ Dovecot restarted"

# Listar contas
echo ""
echo "=== Contas de Email Ativas ==="
/usr/local/CyberCP/bin/cyberpanel listEmails --domainName visualdesigne.com 2>&1 || echo "⚠️ Não foi possível listar emails (possível erro)"

echo ""
echo "✅ Ativação concluída!"
SSH_COMMANDS

else
  echo ""
  echo "❌ SSH não disponível com chave. Abra uma janela de terminal e execute:"
  echo ""
  echo "ssh root@109.199.104.22 << 'SSH'"
  echo "/usr/local/CyberCP/bin/cyberpanel createEmail --domainName visualdesigne.com --userName admin --password 'Ad.Vd#2425?*'"
  echo "/usr/local/CyberCP/bin/cyberpanel createEmail --domainName visualdesigne.com --userName suporte --password 'Ad.Vd#2425?*'"
  echo "/usr/local/CyberCP/bin/cyberpanel createEmail --domainName visualdesigne.com --userName geral --password 'Ad.Vd#2425?*'"
  echo "systemctl restart postfix dovecot"
  echo "SSH"
fi
