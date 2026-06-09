#!/bin/bash
# Melhorar headers de email para evitar spam

echo "📧 MELHORANDO HEADERS DE EMAIL"
echo "==============================="
echo ""

SERVER="37.27.17.25"
PHP_FILE="/usr/local/CyberCP/public/send-email-api.php"

echo "📋 Criando backup..."
ssh root@$SERVER "cp $PHP_FILE ${PHP_FILE}.backup.headers.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup criado"
echo ""

echo "📝 Aplicando melhorias nos headers..."

ssh root@$SERVER "cat > /tmp/patch_headers.php << 'PATCH'
<?php
\$file = '/usr/local/CyberCP/public/send-email-api.php';
\$content = file_get_contents(\$file);

// Encontrar e substituir a seção de headers
\$old_headers = <<<'OLD'
    \$headers_mail = "From: <{\$from}>\\r\\n";
    \$headers_mail .= "Reply-To: {\$from}\\r\\n";
    \$headers_mail .= "MIME-Version: 1.0\\r\\n";
    \$headers_mail .= "Content-Type: text/html; charset=UTF-8\\r\\n";
OLD;

\$new_headers = <<<'NEW'
    // Headers melhorados para evitar spam
    \$fromName = \$input['fromName'] ?? 'Marketing';
    \$domain = explode('@', \$from)[1] ?? 'visualdesignmoz.com';
    \$messageId = '<' . uniqid() . '@' . \$domain . '>';
    
    \$headers_mail = "From: \"" . \$fromName . "\" <{\$from}>\\r\\n";
    \$headers_mail .= "Reply-To: {\$from}\\r\\n";
    \$headers_mail .= "Return-Path: {\$from}\\r\\n";
    \$headers_mail .= "Message-ID: " . \$messageId . "\\r\\n";
    \$headers_mail .= "Date: " . date('r') . "\\r\\n";
    \$headers_mail .= "MIME-Version: 1.0\\r\\n";
    \$headers_mail .= "Content-Type: text/html; charset=UTF-8\\r\\n";
    \$headers_mail .= "X-Mailer: DirectAdmin Marketing API\\r\\n";
    \$headers_mail .= "Precedence: bulk\\r\\n";
    \$headers_mail .= "X-Auto-Response-Suppress: OOF, AutoReply\\r\\n";
    \$headers_mail .= "X-Priority: 3\\r\\n";
    // List-Unsubscribe ajuda MUITO a não ir para spam
    \$headers_mail .= "List-Unsubscribe: <mailto:unsubscribe@" . \$domain . "?subject=unsubscribe>\\r\\n";
NEW;

// Fazer a substituição
\$content = str_replace(\$old_headers, \$new_headers, \$content);

// Também melhorar o X-Mailer no header HTTP
\$content = str_replace(
    "header('X-Mailer: DirectAdmin Marketing API');",
    "header('X-Mailer: DirectAdmin Marketing API/2.0');",
    \$content
);

if (file_put_contents(\$file, \$content)) {
    echo \"✅ Headers melhorados aplicados!\\n\";
    echo \"   • From com nome amigável\\n\";
    echo \"   • Message-ID único\\n\";
    echo \"   • Date header\\n\";
    echo \"   • Precedence: bulk\\n\";
    echo \"   • List-Unsubscribe\\n\";
    echo \"   • X-Auto-Response-Suppress\\n\";
} else {
    echo \"❌ Erro ao salvar arquivo\\n\";
}
PATCH
php /tmp/patch_headers.php"

echo ""
echo "🔄 Reiniciando serviço..."
ssh root@$SERVER "systemctl restart lscpd 2>/dev/null || service lscpd restart 2>/dev/null"
echo "✅ Serviço reiniciado"
echo ""

echo "==============================="
echo "✅ Headers melhorados!"
echo ""
echo "🧪 Teste enviando um email e verifique:"
echo "   • Se chegou na caixa de entrada"
echo "   • Headers novos no código fonte do email"
echo ""
echo "📋 Dicas adicionais para evitar spam:"
echo "   1. Use assuntos sem palavras de spam (FREE, URGENT, $$, etc.)"
echo "   2. Mantenha texto/imagem equilibrado"
echo "   3. Evite muitos links (máx 2-3 por email)"
echo "   4. Use fromName reconhecível (ex: 'Visual Design' não 'marketing@...')"
echo "   5. Peça aos destinatários para adicionar aos contactos"
