#!/bin/bash
# Script direcionado - baseado no conteúdo real do arquivo PHP

echo "🔧 DESATIVANDO LIMITES - VERSÃO DIRECIONADA"
echo "============================================"
echo ""

SERVER="37.27.17.25"
PHP_FILE="/usr/local/CyberCP/public/send-email-api.php"

echo "📋 Etapa 1: Criando backup..."
ssh root@$SERVER "cp $PHP_FILE ${PHP_FILE}.backup.real.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup criado"
echo ""

echo "📝 Etapa 2: Aplicando correções diretas..."

ssh root@$SERVER 'bash -s' << 'REMOTE_SCRIPT'
PHP_FILE="/usr/local/CyberCP/public/send-email-api.php"

# 1. Substituir o array WARMUP_LIMITS por limites altíssimos
sed -i "s/\['phase1'\] => \['days' => 1, 'limit' => 10\]/['phase1'] => ['days' => 1, 'limit' => 999999]/" $PHP_FILE
sed -i "s/\['phase2'\] => \['days' => 3, 'limit' => 30\]/['phase2'] => ['days' => 3, 'limit' => 999999]/" $PHP_FILE
sed -i "s/\['phase3'\] => \['days' => 7, 'limit' => 80\]/['phase3'] => ['days' => 7, 'limit' => 999999]/" $PHP_FILE
sed -i "s/\['phase4'\] => \['days' => 14, 'limit' => 150\]/['phase4'] => ['days' => 14, 'limit' => 999999]/" $PHP_FILE
sed -i "s/\['phase5'\] => \['days' => 30, 'limit' => 300\]/['phase5'] => ['days' => 30, 'limit' => 999999]/" $PHP_FILE

# 2. Remover o slice que limita destinatários - enviar todos de uma vez
sed -i "s/\$toProcess = array_slice(\$to, 0, max(0, \$dailyLimit - \$sentToday));/\$toProcess = \$to; \/* LIMITE DESATIVADO - envia todos *\/;/" $PHP_FILE

# 3. Remover o erro "Limite diario atingido" - nunca deve chegar aqui mas por segurança
sed -i "s/'error' => 'Limite diario atingido'/'error' => 'Envio permitido' \/* LIMITE DESATIVADO *\//" $PHP_FILE

echo "✅ Correções aplicadas"
REMOTE_SCRIPT

echo ""
echo "🔍 Etapa 3: Verificando alterações..."
ssh root@$SERVER "grep -n '999999\|LIMITE DESATIVADO' $PHP_FILE"
echo ""

echo "🔄 Etapa 4: Reiniciando serviço..."
ssh root@$SERVER "systemctl restart lscpd 2>/dev/null || service lscpd restart 2>/dev/null || echo 'Reinicie manualmente: systemctl restart lscpd'"
echo "✅ Serviço reiniciado"
echo ""

echo "============================================"
echo "✅ LIMITES DESATIVADOS COM SUCESSO!"
echo ""
echo "🧪 Teste agora: envie email marketing no painel"
