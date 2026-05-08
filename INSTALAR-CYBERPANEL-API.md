# 🚀 Instalação API CyberPanel - Guia Completo

## 📋 O que foi criado

1. **API PHP** no CyberPanel (`send-email-api.php`) - envia emails via SMTP local
2. **Warm-up integrado** - limita envios por fase (10→30→80→150→300/dia)
3. **Site atualizado** - tenta CyberPanel SMTP → API PHP → Resend

---

## ⚡ Instalação (5 minutos)

### 1. Ligar ao servidor
```bash
ssh root@109.199.104.22
```

### 2. Criar o ficheiro PHP
```bash
cat > /usr/local/CyberCP/public/send-email-api.php << 'EOF'
<?php
/**
 * API de Envio de Email via CyberPanel SMTP Local
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 🛡️ Autenticação
$VALID_TOKEN = 'vd_api_2024_secure_token';
$headers = getallheaders();
$auth_header = $headers['Authorization'] ?? '';

if (!str_contains($auth_header, $VALID_TOKEN)) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// 📧 Receber dados
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['to'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Dados inválidos']);
    exit;
}

$to = $input['to'];
$subject = $input['subject'];
$html = $input['html'];
$from = $input['from'] ?? 'noreply@visualdesignmoz.com';

// 🌡️ SISTEMA DE AQUECIMENTO
$WARMUP_LIMITS = [
    'phase1' => ['days' => 1, 'limit' => 10],
    'phase2' => ['days' => 3, 'limit' => 30],
    'phase3' => ['days' => 7, 'limit' => 80],
    'phase4' => ['days' => 14, 'limit' => 150],
    'phase5' => ['days' => 30, 'limit' => 300]
];

$LOG_FILE = '/tmp/email_warmup_log.json';
$today = date('Y-m-d');
$domain = explode('@', $from)[1] ?? 'unknown';

$logs = ['domains' => [], 'daily' => []];
if (file_exists($LOG_FILE)) {
    $logs = json_decode(file_get_contents($LOG_FILE), true) ?: $logs;
}

$domainKey = preg_replace('/[^a-z0-9]/', '_', $domain);
$firstSend = $logs['domains'][$domainKey]['first_send'] ?? $today;
$daysSinceFirst = (strtotime($today) - strtotime($firstSend)) / 86400;

$currentPhase = 'phase1';
foreach ($WARMUP_LIMITS as $phase => $config) {
    if ($daysSinceFirst >= $config['days']) {
        $currentPhase = $phase;
    }
}

$dailyLimit = $WARMUP_LIMITS[$currentPhase]['limit'];
$dailyKey = $domainKey . '_' . $today;
$sentToday = $logs['daily'][$dailyKey] ?? 0;
$toProcess = array_slice($to, 0, max(0, $dailyLimit - $sentToday));

if (empty($toProcess)) {
    echo json_encode([
        'success' => false,
        'error' => 'Limite diário atingido',
        'phase' => $currentPhase,
        'dailyLimit' => $dailyLimit,
        'sentToday' => $sentToday
    ]);
    exit;
}

// 📧 Enviar via SMTP local
$results = ['success' => 0, 'failed' => 0, 'errors' => []];

foreach ($toProcess as $recipient) {
    $headers_mail = "From: <{$from}>\r\n";
    $headers_mail .= "Reply-To: {$from}\r\n";
    $headers_mail .= "MIME-Version: 1.0\r\n";
    $headers_mail .= "Content-Type: text/html; charset=UTF-8\r\n";
    
    if (mail($recipient, $subject, $html, $headers_mail)) {
        $results['success']++;
    } else {
        $results['failed']++;
        $results['errors'][] = "{$recipient}: Falha";
    }
}

// 💾 Salvar logs
if (!isset($logs['domains'][$domainKey])) {
    $logs['domains'][$domainKey] = ['first_send' => $today, 'domain' => $domain];
}
$logs['daily'][$dailyKey] = $sentToday + $results['success'];
file_put_contents($LOG_FILE, json_encode($logs));

// 📊 Retornar
http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => "Enviados {$results['success']} emails",
    'details' => $results,
    'method' => 'cyberpanel-local-smtp',
    'warmup' => [
        'phase' => $currentPhase,
        'dailyLimit' => $dailyLimit,
        'sentToday' => $results['success'] + $sentToday,
        'remaining' => $dailyLimit - ($results['success'] + $sentToday),
        'daysActive' => ceil($daysSinceFirst)
    ]
]);
EOF
```

### 3. Testar API
```bash
# Teste local no servidor
curl -X POST https://109.199.104.22:8090/send-email-api.php \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer vd_api_2024_secure_token" \
  -k \
  -d '{
    "to": ["silva.chamo@gmail.com"],
    "subject": "Teste CyberPanel API",
    "html": "<h1>Teste</h1><p>Funcionou!</p>",
    "from": "admin@visualdesignmoz.com"
  }'
```

---

## 🎯 Depois de Instalar

O site vai automaticamente:
1. Tentar CyberPanel SMTP direto
2. Se falhar → Chamar API PHP no CyberPanel
3. Se falhar → Usar Resend

**Sistema de Warm-up ativo:**
- Fase 1 (dia 1): 10 emails/dia
- Fase 2 (dia 3): 30 emails/dia
- Fase 3 (dia 7): 80 emails/dia
- Fase 4 (dia 14): 150 emails/dia
- Fase 5 (dia 30): 300 emails/dia

---

## 🧪 Testar no Site

Depois de instalar, vá ao painel cliente:
- Email Marketing → Enviar email
- O sistema vai usar CyberPanel API automaticamente

**Funcionou?** ✅
