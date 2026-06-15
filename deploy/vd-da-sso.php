<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method']);
    exit;
}

$secretFile = '/home/admin/.vd-da-sso-secret';
if (!is_readable($secretFile)) {
    $secretFile = '/root/.vd-da-sso-secret';
}
if (!is_readable($secretFile)) {
    http_response_code(503);
    echo json_encode(['error' => 'unconfigured']);
    exit;
}

$secret = trim((string) file_get_contents($secretFile));
$user = strtolower(trim((string) ($_GET['user'] ?? '')));
$ts = (int) ($_GET['ts'] ?? 0);
$sig = (string) ($_GET['sig'] ?? '');

if (!preg_match('/^[a-z0-9._-]{1,64}$/', $user)) {
    http_response_code(400);
    echo json_encode(['error' => 'user']);
    exit;
}

if ($ts < 1 || abs(time() - $ts) > 90) {
    http_response_code(403);
    echo json_encode(['error' => 'expired']);
    exit;
}

$payload = $ts . '.' . $user;
$expected = hash_hmac('sha256', $payload, $secret);
if (!hash_equals($expected, $sig)) {
    http_response_code(403);
    echo json_encode(['error' => 'invalid']);
    exit;
}

$line = '';
$ch = curl_init('http://127.0.0.1:39171/login-url?user=' . rawurlencode($user));
if ($ch !== false) {
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 2,
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code === 200 && is_string($raw)) {
        $data = json_decode($raw, true);
        if (is_array($data) && isset($data['url']) && is_string($data['url'])) {
            $line = trim($data['url']);
        }
    }
}

if (!str_starts_with($line, 'http') || !str_contains($line, '/api/login/')) {
    http_response_code(500);
    echo json_encode(['error' => 'da']);
    exit;
}

echo json_encode(['url' => $line]);
