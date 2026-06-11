<?php
$secretFile = __DIR__ . '/private/sso_secret';
if (!is_readable($secretFile)) {
    http_response_code(500);
    die('SSO not configured');
}
$secret = trim(file_get_contents($secretFile));
$t = $_GET['t'] ?? '';
if (!str_contains($t, '.')) {
    http_response_code(400);
    die('Invalid token');
}
[$b64, $sig] = explode('.', $t, 2);
if (!hash_equals(hash_hmac('sha256', $b64, $secret), $sig)) {
    http_response_code(403);
    die('Invalid signature');
}
$data = json_decode(base64_decode(strtr($b64, '-_', '+/')), true);
if (!$data || ($data['exp'] ?? 0) < time()) {
    http_response_code(403);
    die('Token expired');
}
$homedir = $data['homedir'] ?? '';
if (!is_dir($homedir)) {
    http_response_code(404);
    die('Directory not found');
}

require __DIR__ . '/vendor/autoload.php';

use Filegator\Services\Auth\User;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\Handler\NativeFileSessionHandler;
use Symfony\Component\HttpFoundation\Session\Storage\NativeSessionStorage;

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || ((int) ($_SERVER['SERVER_PORT'] ?? 0) === 443)
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

$handler = new NativeFileSessionHandler('/var/www/tmp');
$storage = new NativeSessionStorage([
    'cookie_lifetime' => 28800,
    'cookie_path' => '/',
    'cookie_domain' => '',
    'cookie_secure' => $isHttps,
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
], $handler);
$session = new Session($storage);
$session->setName('filegator');
$session->start();

$user = new User();
$user->setUsername($data['user']);
$user->setName($data['user']);
$user->setRole('user');
$user->setHomedir($homedir);
$user->setPermissions('read|write|upload|download|batchdownload|zip|chmod', true);

$hash = sha1($user->getUsername() . $user->getHomeDir() . $user->getRole());
$session->set('ftp_auth', $user);
$session->set('ftp_auth_hash', $hash);
$session->save();

$target = ($isHttps ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'host.visualdesignmoz.com') . '/files/dist/';
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Location: ' . $target, true, 302);
exit;
