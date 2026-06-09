<?php
// Corrige encoding do email no DirectAdmin

$file = '/usr/local/CyberCP/public/send-email-api.php';
$content = file_get_contents($file);

// 1. Adicionar codificação UTF-8 ao assunto
$old_mail = 'if (mail($recipient, $subject, $html, $headers_mail))';
$new_mail = "// Codificar assunto em UTF-8\n    \$encodedSubject = \"=?UTF-8?B?\" . base64_encode(\$subject) . \"?=\";\n    \n    if (mail(\$recipient, \$encodedSubject, \$html, \$headers_mail))";

$content = str_replace($old_mail, $new_mail, $content);

// 2. Simplificar o From - remover aspas extras
$old_from = '$headers_mail = "From: \"" . $fromName . "\" <{$from}>\r\n";';
$new_from = '$headers_mail = "From: " . $fromName . " <" . $from . ">\r\n";';

$content = str_replace($old_from, $new_from, $content);

// 3. Adicionar Content-Transfer-Encoding
$old_ct = '$headers_mail .= "Content-Type: text/html; charset=UTF-8\r\n";';
$new_ct = '$headers_mail .= "Content-Type: text/html; charset=UTF-8\r\n";' . "\n" . '    $headers_mail .= "Content-Transfer-Encoding: base64\r\n";';

$content = str_replace($old_ct, $new_ct, $content);

file_put_contents($file, $content);

echo "✅ Correções aplicadas:\n";
echo "  • Assunto codificado em UTF-8 (Base64)\n";
echo "  • From simplificado\n";
echo "  • Content-Transfer-Encoding: base64\n";
