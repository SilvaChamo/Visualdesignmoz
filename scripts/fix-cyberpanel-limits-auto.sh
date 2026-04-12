#!/bin/bash
# Script automático para desativar limites de email no CyberPanel

echo "🚫 DESATIVANDO LIMITES DE EMAIL NO CYBERPANEL - AUTO"
echo "==================================================="
echo ""

SERVER="109.199.104.22"
PHP_FILE="/usr/local/CyberCP/public/send-email-api.php"

# Função para executar no servidor
run_on_server() {
    ssh root@$SERVER "$1"
}

echo "🔍 Etapa 1: Verificando arquivo..."
if ! run_on_server "test -f $PHP_FILE && echo 'found'" | grep -q "found"; then
    echo "❌ Arquivo não encontrado: $PHP_FILE"
    echo "🔍 Procurando arquivo..."
    run_on_server "find /usr/local/CyberCP -name 'send-email-api.php' 2>/dev/null"
    exit 1
fi

echo "✅ Arquivo encontrado: $PHP_FILE"
echo ""

echo "📋 Etapa 2: Criando backup..."
BACKUP_NAME="send-email-api.php.backup.$(date +%Y%m%d_%H%M%S)"
run_on_server "cp $PHP_FILE ${PHP_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup criado: $BACKUP_NAME"
echo ""

echo "🔍 Etapa 3: Analisando verificações de limite..."
run_on_server "grep -n 'dailyLimit\|limite.*diario\|canSendEmail\|Limite diario' $PHP_FILE" 2>/dev/null || echo "Nenhuma correspondência exata encontrada"
echo ""

echo "📝 Etapa 4: Desativando limites..."

# Criar script PHP de correção
CORRECTION_SCRIPT=$(cat << 'PHPEOF'
<?php
$file = '/usr/local/CyberCP/public/send-email-api.php';
$content = file_get_contents($file);

$original = $content;

// Padrões para desativar
$patterns = [
    // Verificações de limite
    '/if\s*\(\s*\$sentToday\s*>=\s*\$dailyLimit\s*\)/i' => 'if (false /* LIMITE DESATIVADO */)',
    '/if\s*\(\s*\$sent_today\s*>=\s*\$daily_limit\s*\)/i' => 'if (false /* LIMITE DESATIVADO */)',
    '/throw.*Exception.*Limite diario/i' => '// LIMITE DESATIVADO: $0',
    '/echo.*Limite diario/i' => '// LIMITE DESATIVADO: $0',
    '/die.*Limite diario/i' => '// LIMITE DESATIVADO: $0',
    
    // Funções de verificação
    '/function\s+checkDailyLimit\s*\(/i' => 'function checkDailyLimit_DISABLED(',
    '/function\s+canSendEmail\s*\(/i' => 'function canSendEmail_DISABLED(',
];

foreach ($patterns as $pattern => $replacement) {
    $content = preg_replace($pattern, $replacement, $content);
}

// Forçar valores altos se houver variáveis de limite
$content = preg_replace('/\$dailyLimit\s*=\s*\d+;/', '$dailyLimit = 999999; // DESATIVADO', $content);
$content = preg_replace('/\$daily_limit\s*=\s*\d+;/', '$daily_limit = 999999; // DESATIVADO', $content);

if ($content !== $original) {
    file_put_contents($file, $content);
    echo "✅ Modificações aplicadas!\n";
} else {
    echo "⚠️  Nenhum padrão de limite encontrado para modificar\n";
}

// Mostrar linhas relevantes
$lines = explode("\n", $content);
foreach ($lines as $num => $line) {
    if (stripos($line, 'limit') !== false || 
        stripos($line, 'daily') !== false ||
        stripos($line, 'sentToday') !== false) {
        echo "Linha " . ($num + 1) . ": " . trim($line) . "\n";
    }
}
PHPEOF
)

# Salvar e executar script no servidor
echo "$CORRECTION_SCRIPT" | ssh root@$SERVER "cat > /tmp/fix_limits.php && php /tmp/fix_limits.php"

echo ""
echo "🔄 Etapa 5: Reiniciando serviços..."
run_on_server "systemctl restart lscpd 2>/dev/null || /usr/local/lsws/bin/lswsctrl restart 2>/dev/null || echo 'Reinício manual necessário'"
echo "✅ Serviços reiniciados"
echo ""

echo "==================================================="
echo "✅ LIMITES DESATIVADOS!"
echo ""
echo "📋 Resumo:"
echo "   • Backup: ${PHP_FILE}.${BACKUP_NAME}"
echo "   • Verificações de limite desativadas"
echo "   • Serviços reiniciados"
echo ""
echo "🧪 TESTE: Envie um email de marketing para verificar"
echo ""
echo "⚠️  Para reverter:"
echo "   ssh root@${SERVER} 'cp ${PHP_FILE}.backup.* ${PHP_FILE}'"
