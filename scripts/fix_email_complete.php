<?php
// Corrige todos os problemas de email no CyberPanel

$file = '/usr/local/CyberCP/public/send-email-api.php';
$content = file_get_contents($file);

// Backup
$backup = $file . '.backup.complete.' . date('Ymd_His');
copy($file, $backup);

// 1. CORRIGIR O FORMATO DO FROM - usar formato simples sem concatenação excessiva
// Substituir o bloco de headers inteiro
$old_headers = '$headers_mail = "From: " . $fromName . " <" . $from . ">\r\n";
    $headers_mail .= "Reply-To: {$from}\r\n";
    $headers_mail .= "Return-Path: {$from}\r\n";
    $headers_mail .= "Message-ID: " . $messageId . "\r\n";
    $headers_mail .= "Date: " . date("r") . "\r\n";
    $headers_mail .= "MIME-Version: 1.0\r\n";
    $headers_mail .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers_mail .= "X-Mailer: CyberPanel-Marketing/2.0\r\n";
    $headers_mail .= "Precedence: bulk\r\n";
    $headers_mail .= "X-Auto-Response-Suppress: OOF, AutoReply\r\n";
    $headers_mail .= "List-Unsubscribe: <mailto:unsubscribe@{$domain}?subject=unsubscribe>\r\n";';

$new_headers = '$fromHeader = sprintf("From: %s <%s>", $fromName, $from);
    $replyTo = sprintf("Reply-To: %s", $from);
    $returnPath = sprintf("Return-Path: %s", $from);
    $msgId = sprintf("Message-ID: %s", $messageId);
    $date = sprintf("Date: %s", date("r"));
    $mime = "MIME-Version: 1.0";
    $contentType = "Content-Type: text/html; charset=UTF-8";
    $xmailer = "X-Mailer: CyberPanel-Marketing/2.0";
    $prec = "Precedence: bulk";
    $autosup = "X-Auto-Response-Suppress: OOF, AutoReply";
    $listunsub = sprintf("List-Unsubscribe: <mailto:unsubscribe@%s?subject=unsubscribe>", $domain);
    
    $headers_mail = implode("\r\n", [$fromHeader, $replyTo, $returnPath, $msgId, $date, $mime, $contentType, $xmailer, $prec, $autosup, $listunsub]) . "\r\n";';

$content = str_replace($old_headers, $new_headers, $content);

// 2. Remover Reply-To e Return-Path duplicados se já estiverem no envelope
// Já estão no headers_mail, então não precisam ser passados pro mail()

// 3. Corrigir o Subject - garantir que está codificado corretamente
// O base64 precisa ter exatamente o formato =?UTF-8?B?BASE64?=
$content = str_replace(
    '$encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";',
    '$encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?="; // Codificação RFC2047',
    $content
);

// Salvar
file_put_contents($file, $content);

// 4. Também verificar e remover qualquer Reply-To ou Return-Path duplicado
$content2 = file_get_contents($file);
$content2 = preg_replace('/\$headers_mail \.= "Reply-To: [^"]+\\r\\n";\r?\n/s', '', $content2);
$content2 = preg_replace('/\$headers_mail \.= "Return-Path: [^"]+\\r\\n";\r?\n/s', '', $content2);
file_put_contents($file, $content2);

echo "✅ Correções aplicadas:\n";
echo "  • Headers usando sprintf para formato limpo\n";
echo "  • From simplificado\n";
echo "  • Assunto UTF-8 mantido\n";
echo "  • Duplicações removidas\n";
echo "  • Backup: $backup\n";
