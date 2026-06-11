<?php
function vd_parse_session_file(string $sid): array {
    $path = '/usr/local/directadmin/data/sessions/da_sess_' . preg_replace('/[^a-zA-Z0-9]/', '', $sid);
    if (!is_readable($path)) return [];
    $session = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES) as $line) {
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) $session[trim($parts[0])] = trim($parts[1]);
    }
    return $session;
}

function vd_cookie_session_id(): ?string {
    $cookie = $_SERVER['HTTP_COOKIE'] ?? '';
    if (preg_match('/(?:^|;\s*)session=([^;]+)/', $cookie, $m)) {
        return trim($m[1]);
    }
    return null;
}

function vd_da_session_user(): ?string {
    $username = getenv('USERNAME');
    if ($username && preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
        return $username;
    }

    $sid = getenv('SESSION_ID') ?: ($_SERVER['SESSION_ID'] ?? '') ?: (vd_cookie_session_id() ?? '');
    $skey = getenv('SESSION_KEY') ?: ($_SERVER['SESSION_KEY'] ?? '');
    $rip = getenv('REMOTE_ADDR') ?: ($_SERVER['REMOTE_ADDR'] ?? ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));

    if (!$sid) return null;

    $session = vd_parse_session_file($sid);
    if (!$session) return null;

    $expires = (int)($session['expires'] ?? 0);
    if ($expires > 0 && $expires < time()) return null;

    if ($skey !== '') {
        if (($session['key'] ?? '') !== $skey) return null;
        if (($session['ip'] ?? '') !== '' && $rip !== '' && ($session['ip'] ?? '') !== $rip) return null;
    }

    $users = explode('|', $session['username'] ?? '');
    $user = $users ? end($users) : '';
    return $user && preg_match('/^[a-zA-Z0-9_]+$/', $user) ? $user : null;
}

function vd_is_upload_domain(string $name): bool {
    if ($name === '' || $name[0] === '.') return false;
    $skip = ['default', 'sharedip', 'suspended'];
    if (in_array($name, $skip, true)) return false;
    if (str_starts_with($name, 'webmail.')) return false;
    return (bool) preg_match('/^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/', $name);
}

function vd_domains_from_home(string $user): array {
    $home = "/home/$user/domains";
    if (!is_dir($home)) return [];

    $domains = [];
    foreach (scandir($home) ?: [] as $entry) {
        if (!vd_is_upload_domain($entry)) continue;
        $publicHtml = "$home/$entry/public_html";
        if (is_dir($publicHtml)) {
            $domains[] = $entry;
        }
    }
    sort($domains, SORT_NATURAL | SORT_FLAG_CASE);
    return $domains;
}

function vd_domains_from_list(string $user): array {
    $list = "/usr/local/directadmin/data/users/$user/domains.list";
    if (!is_readable($list)) return [];

    $domains = [];
    foreach (file($list, FILE_IGNORE_NEW_LINES) as $line) {
        $line = trim($line);
        if (str_contains($line, '=')) {
            $line = trim(explode('=', $line, 2)[1] ?? '');
        }
        if (!vd_is_upload_domain($line)) continue;
        if (is_dir("/home/$user/domains/$line/public_html")) {
            $domains[] = $line;
        }
    }
    return array_values(array_unique($domains));
}

function vd_user_domains(string $user): array {
    $domains = vd_domains_from_home($user);
    if ($domains) return $domains;
    return vd_domains_from_list($user);
}

function vd_make_sso_token(string $user, string $domain, string $secret, int $ttl = 1800): string {
    $homedir = "/home/$user/domains/$domain/public_html/";
    if (!is_dir($homedir)) return '';
    $payload = json_encode([
        'user' => $user,
        'domain' => $domain,
        'homedir' => $homedir,
        'exp' => time() + $ttl,
    ], JSON_UNESCAPED_SLASHES);
    $b64 = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    $sig = hash_hmac('sha256', $b64, $secret);
    return $b64 . '.' . $sig;
}

function vd_sso_secret(): string {
    foreach ([
        '/usr/local/directadmin/plugins/uploadfile/private/sso_secret',
        '/var/www/html/files/private/sso_secret',
    ] as $path) {
        if (is_readable($path)) {
            $secret = trim((string) file_get_contents($path));
            if ($secret !== '') return $secret;
        }
    }
    return '';
}

$secret = vd_sso_secret();
$daUser = vd_da_session_user();
if (!$daUser) {
    http_response_code(403);
    echo '<p>Sessão DirectAdmin inválida. Faça login de novo e abra Upload File no menu.</p>';
    exit;
}

$domains = vd_user_domains($daUser);
$ssoUrls = [];
$configError = '';

if ($secret === '') {
    $configError = 'SSO não configurado no servidor. Contacte o administrador.';
} else {
    foreach ($domains as $d) {
        $token = vd_make_sso_token($daUser, $d, $secret);
        if ($token !== '') {
            $ssoUrls[$d] = 'https://host.visualdesignmoz.com/files/sso.php?t=' . urlencode($token);
        }
    }
}

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Upload File</title>
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{height:100%;margin:0}
body{
  font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  color:#0f172a;
  background:#f8fafc;
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:100%;
  padding:24px;
}
.card{
  width:100%;
  max-width:440px;
  border:1px solid #e2e8f0;
  border-radius:14px;
  padding:28px 28px 24px;
  background:#fff;
  box-shadow:0 10px 30px rgba(15,23,42,.08);
}
.card h2{margin:0 0 8px;font-size:1.35rem;font-weight:700}
.user{margin:0 0 20px;color:#475569;font-size:.95rem}
.user strong{color:#0f172a}
label{display:block;margin-bottom:8px;font-weight:600;font-size:.9rem}
select,button{
  width:100%;
  padding:12px 14px;
  font-size:15px;
  border-radius:10px;
  border:1px solid #cbd5e1;
}
select{background:#fff}
button{
  background:#2563eb;
  color:#fff;
  border:none;
  font-weight:600;
  margin-top:18px;
  cursor:pointer;
  transition:background .15s ease;
}
button:hover:not(:disabled){background:#1d4ed8}
button:disabled{opacity:.55;cursor:not-allowed}
.err{color:#b91c1c;margin-top:14px;font-size:.9rem}
.hint{color:#64748b;font-size:.82rem;margin:16px 0 0;line-height:1.45}
.empty{color:#94a3b8;font-size:.9rem;margin:0 0 12px}
</style>
</head>
<body>
<div class="card">
  <h2>Upload File</h2>
  <p class="user">Utilizador: <strong><?= htmlspecialchars($daUser) ?></strong></p>
  <?php if (!$domains): ?>
    <p class="empty">Nenhum domínio com public_html encontrado nesta conta.</p>
  <?php endif; ?>
  <?php if ($configError): ?>
    <p class="err"><?= htmlspecialchars($configError) ?></p>
  <?php endif; ?>
  <div>
    <label for="domain">Domínio / website</label>
    <select id="domain" <?= $domains && !$configError ? '' : 'disabled' ?>>
      <option value="">— Seleccionar —</option>
      <?php foreach ($domains as $d): ?>
        <option value="<?= htmlspecialchars($d) ?>"><?= htmlspecialchars($d) ?></option>
      <?php endforeach; ?>
    </select>
    <button type="button" id="openBtn" <?= $domains && !$configError ? '' : 'disabled' ?>>Abrir gestor de upload</button>
  </div>
  <p class="hint">Upload até 2 GB por ficheiro, sem voltar a pedir password — usa a sua sessão DirectAdmin. O tempo restante aparece durante o upload no gestor de ficheiros.</p>
</div>
<script>
(function () {
  var urls = <?= json_encode($ssoUrls, JSON_UNESCAPED_SLASHES) ?>;
  var select = document.getElementById('domain');
  var btn = document.getElementById('openBtn');
  if (!select || !btn) return;

  btn.addEventListener('click', function () {
    var domain = select.value;
    if (!domain || !urls[domain]) {
      alert('Seleccione um domínio.');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'A abrir…';
    var url = urls[domain];
    try { window.top.location.assign(url); } catch (e) { window.location.assign(url); }
  });
})();
</script>
</body>
</html>
