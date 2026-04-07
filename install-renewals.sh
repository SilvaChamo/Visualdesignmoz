#!/bin/bash
# Script de Instalação Rápida - Sistema de Notificações de Renovação

echo "🚀 Instalando Sistema de Notificações de Renovação..."
echo "=================================================="

# 1. Copiar script para o servidor
echo "📁 Copiando script para o servidor..."
scp cyberpanel-renewals.py root@109.199.104.22:/usr/local/bin/

# 2. Tornar executável
echo "🔧 Definindo permissões..."
ssh root@109.199.104.22 "chmod +x /usr/local/bin/cyberpanel-renewals.py"

# 3. Instalar dependências
echo "📦 Instalando dependências..."
ssh root@109.199.104.22 "apt update && apt install -y python3 python3-pip mailutils"

# 4. Testar script
echo "🧪 Testando script..."
ssh root@109.199.104.22 "python3 /usr/local/bin/cyberpanel-renewals.py"

# 5. Instalar cron
echo "⏰ Configurando verificação diária..."
ssh root@109.199.104.22 "echo '0 8 * * * /usr/local/bin/cyberpanel-renewals.py >> /var/log/cyberpanel-renewals.log 2>&1' | crontab -"

# 6. Verificar instalação
echo "✅ Verificando instalação..."
ssh root@109.199.104.22 "crontab -l | grep renewals"

echo ""
echo "🎉 Sistema instalado com sucesso!"
echo ""
echo "📋 Resumo da instalação:"
echo "• Script: /usr/local/bin/cyberpanel-renewals.py"
echo "• Log: /var/log/cyberpanel-renewals.log"
echo "• Cron: Diário às 08:00"
echo "• Alertas: /tmp/cyberpanel_renewal_alerts.json"
echo ""
echo "🔧 Para testar manualmente:"
echo "ssh root@109.199.104.22 'python3 /usr/local/bin/cyberpanel-renewals.py'"
echo ""
echo "📊 Para ver logs:"
echo "ssh root@109.199.104.22 'tail -f /var/log/cyberpanel-renewals.log'"
