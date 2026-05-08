<?php
/**
 * API de Envio de Email via CyberPanel SMTP Local
 * Colocar em: /usr/local/CyberCP/public/send-email-api.php
 * 
 * Endpoint: POST https://109.199.104.22:8090/send-email-api.php
 * Headers: Content-Type: application/json
 * Auth: Bearer token ou Basic Auth
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 🛡️ Autenticação simples (token fixo para segurança básica)
$VALID_TOKEN = 'vd_api_2024_secure_token';

$headers = getallheaders();
$auth_header = $headers['Authorization'] ?? '';

if (!str_contains($auth_header, $VALID_TOKEN)) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized', 'message' => 'Token inválido']);
    exit;
}

// 📧 Receber dados
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['to']) || empty($input['subject']) || empty($input['html'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Dados inválidos', 'required' => ['to', 'subject', 'html']]);
    exit;
}

$to = $input['to']; // Array de emails
$subject = $input['subject'];
$html = $input['html'];
$from = $input['from'] ?? 'noreply@visualdesignmoz.com';
$fromName = $input['fromName'] ?? 'VisualDesign';

// 🌡️ SISTEMA DE AQUECIMENTO (Warm-up)
// Limites por fase (limitados pela configuração do servidor)
$WARMUP_LIMITS = [
    'phase1' => ['days' => 1, 'limit' => 10, 'label' => 'Fase 1 - Inicial'],
    'phase2' => ['days' => 3, 'limit' => 30, 'label' => 'Fase 2 - Crescimento'],
    'phase3' => ['days' => 7, 'limit' => 80, 'label' => 'Fase 3 - Aceleração'],
    'phase4' => ['days' => 14, 'limit' => 150, 'label' => 'Fase 4 - Estabilização'],
    'phase5' => ['days' => 30, 'limit' => 300, 'label' => 'Fase 5 - Produção']
];

// 📝 Log de envios (arquivo simples)
$LOG_FILE = '/tmp/email_warmup_log.json';
$today = date('Y-m-d');
$domain = explode('@', $from)[1] ?? 'unknown';

// Carregar logs
$logs = ['domains' => [], 'daily' => []];
if (file_exists($LOG_FILE)) {
    $logs = json_decode(file_get_contents($LOG_FILE), true) ?: $logs;
}

// Calcular fase atual baseada no primeiro envio
$domainKey = preg_replace('/[^a-z0-9]/', '_', $domain);
$firstSend = $logs['domains'][$domainKey]['first_send'] ?? $today;
$daysSinceFirst = (strtotime($today) - strtotime($firstSend)) / 86400;

// Determinar fase
$currentPhase = 'phase1';
foreach ($WARMUP_LIMITS as $phase => $config) {
    if ($daysSinceFirst >= $config['days']) {
        $currentPhase = $phase;
    }
}

$dailyLimit = $WARMUP_LIMITS[$currentPhase]['limit'];
$phaseLabel = $WARMUP_LIMITS[$currentPhase]['label'];

// Verificar envios de hoje
$dailyKey = $domainKey . '_' . $today;
$sentToday = $logs['daily'][$dailyKey] ?? 0;
$remaining = $dailyLimit - $sentToday;

// Limitar envios
$toProcess = array_slice($to, 0, min(count($to), max(0, $remaining)));

if (empty($toProcess)) {
    echo json_encode([
        'success' => false,
        'error' => 'Limite diário atingido',
        'phase' => $currentPhase,
        'phaseLabel' => $phaseLabel,
        'dailyLimit' => $dailyLimit,
        'sentToday' => $sentToday,
        'message' => "Limite de {$dailyLimit} emails/dia atingido. Aguarde até amanhã."
    ]);
    exit;
}

// 📧 Enviar emails via SMTP local (Postfix)
$results = [
    'success' => 0,
    'failed' => 0,
    'errors' => [],
    'phase' => $currentPhase,
    'phaseLabel' => $phaseLabel,
    'dailyLimit' => $dailyLimit,
    'sentToday' => $sentToday + count($toProcess),
    'remaining' => $dailyLimit - ($sentToday + count($toProcess))
];

foreach ($toProcess as $recipient) {
    try {
        // Usar sendmail local do Postfix
        $boundary = md5(time());
        $headers_mail = "From: {$fromName} <{$from}>\r\n";
        $headers_mail .= "Reply-To: {$from}\r\n";
        $headers_mail .= "MIME-Version: 1.0\r\n";
        $headers_mail .= "Content-Type: text/html; charset=UTF-8\r\n";
        
        $success = mail($recipient, $subject, $html, $headers_mail);
        
        if ($success) {
            $results['success']++;
        } else {
            $results['failed']++;
            $results['errors'][] = "{$recipient}: Falha no mail()";
        }
    } catch (Exception $e) {
        $results['failed']++;
        $results['errors'][] = "{$recipient}: " . $e->getMessage();
    }
}

// 💾 Salvar logs
if (!isset($logs['domains'][$domainKey])) {
    $logs['domains'][$domainKey] = [
        'first_send' => $today,
        'domain' => $domain
    ];
}
$logs['daily'][$dailyKey] = $sentToday + $results['success'];
file_put_contents($LOG_FILE, json_encode($logs, JSON_PRETTY_PRINT));

// 📊 Retornar resultado
http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => "Enviados {$results['success']} emails via CyberPanel",
    'details' => $results,
    'method' => 'cyberpanel-local-smtp',
    'warmup' => [
        'phase' => $currentPhase,
        'phaseLabel' => $phaseLabel,
        'dailyLimit' => $dailyLimit,
        'sentToday' => $results['sentToday'],
        'remainingToday' => $results['remaining'],
        'daysActive' => ceil($daysSinceFirst)
    ]
]);
