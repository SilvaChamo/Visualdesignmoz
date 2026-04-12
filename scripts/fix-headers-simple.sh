#!/bin/bash

echo "📝 Melhorando headers de email..."
SERVER="109.199.104.22"
FILE="/usr/local/CyberCP/public/send-email-api.php"

ssh root@$SERVER "
# Backup
cp \$FILE \${FILE}.backup.headers

# Verificar linhas dos headers
LINE=\
$(grep -n 'headers_mail.*=.*From:' \$FILE | head -1 | cut -d: -f1)

echo \"Linha dos headers: \$LINE\"

# Criar novo arquivo com headers melhorados
head -n \$((LINE-1)) \$FILE > /tmp/send-email-new.php

cat >> /tmp/send-email-new.php << 'NEWCODE'
    // Headers melhorados para evitar spam
    \$fromName = \$input['fromName'] ?? 'Marketing';
    \$domain = explode('@', \$from)[1] ?? 'visualdesigne.com';
    \$messageId = '<' . uniqid() . '@' . \$domain . '>';
    \$listId = '<' . \$domain . '.' . date('Ymd') . '>';
    
    \$headers_mail = "From: \"" . \$fromName . "\" <{\$from}>\\r\\n";
    \$headers_mail .= "Reply-To: {\$from}\\r\\n";
    \$headers_mail .= "Return-Path: {\$from}\\r\\n";
    \$headers_mail .= "Message-ID: " . \$messageId . "\\r\\n";
    \$headers_mail .= "Date: " . date('r') . "\\r\\n";
    \$headers_mail .= "List-Id: " . \$listId . "\\r\\n";
    \$headers_mail .= "MIME-Version: 1.0\\r\\n";
    \$headers_mail .= "Content-Type: text/html; charset=UTF-8\\r\\n";
    \$headers_mail .= "X-Mailer: CyberPanel-Marketing/2.0\\r\\n";
    \$headers_mail .= "Precedence: bulk\\r\\n";
    \$headers_mail .= "X-Auto-Response-Suppress: OOF, AutoReply\\r\\n";
    \$headers_mail .= "X-Priority: 3 (Normal)\\r\\n";
    \$headers_mail .= "List-Unsubscribe: <mailto:unsubscribe@{\$domain}?subject=unsubscribe>, <http://{\$domain}/unsubscribe>\\r\\n";
    \$headers_mail .= "X-Report-Abuse: <mailto:abuse@{\$domain}>\\r\\n";
NEWCODE

tail -n +\$((LINE+5)) \$FILE >> /tmp/send-email-new.php
mv /tmp/send-email-new.php \$FILE

echo \"✅ Headers melhorados aplicados!\"
"

echo "🔄 Reiniciando LSCPD..."
ssh root@$SERVER "systemctl restart lscpd 2>/dev/null || service lscpd restart"

echo "✅ Pronto! Teste enviando um email."
