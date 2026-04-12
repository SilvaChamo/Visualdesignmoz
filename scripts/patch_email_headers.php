<?php
// Script para melhorar headers de email no CyberPanel

$file = '/usr/local/CyberCP/public/send-email-api.php';

if (!file_exists($file)) {
    die("Arquivo não encontrado: $file\n");
}

$content = file_get_contents($file);

// Headers antigos para substituir
$old_pattern = '/\$headers_mail = "From: <\{\$from\}>\\r\\n";\s*\$headers_mail \.= "Reply-To: \{\$from\}\\r\\n";\s*\$headers_mail \.= "MIME-Version: 1\.0\\r\\n";\s*\$headers_mail \.= "Content-Type: text\/html; charset=UTF-8\\r\\n";/s';

// Novos headers melhorados
$new_headers = <<<'HEADERS'
    // Headers melhorados para evitar spam
    $fromName = $input['fromName'] ?? 'Marketing';
    $domain = explode('@', $from)[1] ?? 'visualdesigne.com';
    $messageId = '<' . uniqid() . '@' . $domain . '>';
    
    $headers_mail = "From: \"" . $fromName . "\" <{$from}>\r\n";
    $headers_mail .= "Reply-To: {$from}\r\n";
    $headers_mail .= "Return-Path: {$from}\r\n";
    $headers_mail .= "Message-ID: " . $messageId . "\r\n";
    $headers_mail .= "Date: " . date('r') . "\r\n";
    $headers_mail .= "MIME-Version: 1.0\r\n";
    $headers_mail .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers_mail .= "X-Mailer: CyberPanel-Marketing/2.0\r\n";
    $headers_mail .= "Precedence: bulk\r\n";
    $headers_mail .= "X-Auto-Response-Suppress: OOF, AutoReply\r\n";
    $headers_mail .= "List-Unsubscribe: <mailto:unsubscribe@{$domain}?subject=unsubscribe>\r\n";
HEADERS;

if (preg_match($old_pattern, $content)) {
    $content = preg_replace($old_pattern, $new_headers, $content);
    file_put_contents($file, $content);
    echo "✅ Headers de email melhorados com sucesso!\n";
    echo "\nMelhorias aplicadas:\n";
    echo "  • From com nome amigável\n";
    echo "  • Message-ID único por email\n";
    echo "  • Date header\n";
    echo "  • X-Mailer identificação\n";
    echo "  • Precedence: bulk\n";
    echo "  • X-Auto-Response-Suppress\n";
    echo "  • List-Unsubscribe (MUITO importante!)\n";
} else {
    echo "⚠️  Padrão não encontrado. Verificando arquivo...\n";
    
    // Tentar encontrar a linha
    $lines = file($file);
    foreach ($lines as $num => $line) {
        if (strpos($line, 'headers_mail') !== false && strpos($line, 'From:') !== false) {
            echo "Encontrado na linha " . ($num + 1) . ": " . trim($line) . "\n";
        }
    }
}
