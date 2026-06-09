#!/bin/bash
set -euo pipefail
CFG=/var/www/html/files/configuration.php
python3 <<'PY'
from pathlib import Path
p = Path('/var/www/html/files/configuration.php')
text = p.read_text()
old = """                    $save_path = null; // use default system path
                    //$save_path = __DIR__.'/private/sessions';
                    $handler = new \\Symfony\\Component\\HttpFoundation\\Session\\Storage\\Handler\\NativeFileSessionHandler($save_path);

                    return new \\Symfony\\Component\\HttpFoundation\\Session\\Storage\\NativeSessionStorage([
                            "cookie_samesite" => "Lax",
                            "cookie_secure" => null,
                            "cookie_httponly" => true,"""
new = """                    $save_path = '/var/www/tmp';
                    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
                        || ((int) ($_SERVER['SERVER_PORT'] ?? 0) === 443)
                        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
                    $handler = new \\Symfony\\Component\\HttpFoundation\\Session\\Storage\\Handler\\NativeFileSessionHandler($save_path);

                    return new \\Symfony\\Component\\HttpFoundation\\Session\\Storage\\NativeSessionStorage([
                            'cookie_lifetime' => 28800,
                            'cookie_path' => '/',
                            'cookie_domain' => '',
                            "cookie_samesite" => "Lax",
                            "cookie_secure" => $isHttps,
                            "cookie_httponly" => true,"""
if old not in text:
    raise SystemExit('pattern not found in configuration.php')
p.write_text(text.replace(old, new, 1))
print('ok')
PY
