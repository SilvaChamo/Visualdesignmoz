<?php
/**
 * SSO do painel Visual Design → phpMyAdmin.
 * O Next.js cria um ticket de uso único; este script lê-o, inicia a sessão
 * Signon do phpMyAdmin e redirecciona. Sem ticket válido não há login automático.
 */

declare(strict_types=1);

$sessionName = 'SignonSession';
$cookiePath = '/phpmyadmin/';
$ticketDir = '/var/lib/phpmyadmin/sso';
$keyFile = '/etc/phpmyadmin/vd-panel-sso.key';

session_set_cookie_params([
	'lifetime' => 0,
	'path' => $cookiePath,
	'secure' => true,
	'httponly' => true,
	'samesite' => 'Lax',
]);
session_name($sessionName);

function vd_sso_leave(): void {
	$sessionName = 'SignonSession';
	$cookiePath = '/phpmyadmin/';
	if (session_status() !== PHP_SESSION_ACTIVE) {
		@session_start();
	}
	$_SESSION = [];
	session_destroy();
	setcookie($sessionName, '', [
		'expires' => time() - 3600,
		'path' => $cookiePath,
		'secure' => true,
		'httponly' => true,
		'samesite' => 'Lax',
	]);
	setcookie('vd_pma_sso', '', [
		'expires' => time() - 3600,
		'path' => $cookiePath,
		'secure' => true,
		'httponly' => true,
		'samesite' => 'Lax',
	]);
	header('Location: index.php');
	exit;
}

if (isset($_GET['logout'])) {
	if (session_status() !== PHP_SESSION_ACTIVE) {
		@session_start();
	}
	$_SESSION = [];
	session_destroy();
	setcookie($sessionName, '', [
		'expires' => time() - 3600,
		'path' => $cookiePath,
		'secure' => true,
		'httponly' => true,
		'samesite' => 'Lax',
	]);
	vd_sso_leave();
}

$nonce = preg_replace('/[^a-f0-9]/', '', (string) ($_GET['n'] ?? ''));
$exp = (int) ($_GET['exp'] ?? 0);
$mac = preg_replace('/[^a-f0-9]/', '', (string) ($_GET['mac'] ?? ''));

if ($nonce === '' || $mac === '' || $exp < 1 || $exp < time() - 5) {
	vd_sso_leave();
}
if ($exp > time() + 300) {
	vd_sso_leave();
}

$secret = is_readable($keyFile) ? trim((string) file_get_contents($keyFile)) : '';
if ($secret === '') {
	vd_sso_leave();
}

$expected = hash_hmac('sha256', $nonce . '|' . $exp, $secret);
if (!hash_equals($expected, $mac)) {
	vd_sso_leave();
}

$ticketPath = $ticketDir . '/' . $nonce . '.json';
if (!is_readable($ticketPath)) {
	vd_sso_leave();
}

$raw = (string) file_get_contents($ticketPath);
@unlink($ticketPath);
$data = json_decode($raw, true);
$user = is_array($data) ? (string) ($data['user'] ?? '') : '';
$password = is_array($data) ? (string) ($data['password'] ?? '') : '';
$host = is_array($data) ? (string) ($data['host'] ?? 'localhost') : 'localhost';
$db = is_array($data) ? (string) ($data['db'] ?? '') : '';
if ($user === '' || $password === '') {
	vd_sso_leave();
}

@session_start();
$_SESSION['PMA_single_signon_user'] = $user;
$_SESSION['PMA_single_signon_password'] = $password;
$_SESSION['PMA_single_signon_host'] = $host;
$id = session_id();
session_write_close();
$cookieOpts = [
	'expires' => 0,
	'path' => $cookiePath,
	'secure' => true,
	'httponly' => true,
	'samesite' => 'Lax',
];
setcookie($sessionName, $id, $cookieOpts);
setcookie('vd_pma_sso', '1', $cookieOpts);

$target = 'index.php';
if ($db !== '' && preg_match('/^[A-Za-z0-9_]+$/', $db)) {
	$target .= '?route=/database/structure&db=' . rawurlencode($db);
}
header('Location: ' . $target);
exit;
