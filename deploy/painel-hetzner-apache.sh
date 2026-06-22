#!/bin/bash
# Configura painel.visualdesignmoz.com → Next.js local (PM2)
# Executar no Hetzner como root.

set -euo pipefail

DOMAIN=visualdesignmoz.com
USER=admin
SUB=painel
PORT="${PANEL_PORT:-3002}"
CUST_HTTPD="/usr/local/directadmin/data/users/${USER}/domains/${DOMAIN}.cust_httpd"
SUBDOMAINS="/usr/local/directadmin/data/users/${USER}/domains/${DOMAIN}.subdomains"

# Registar subdomínio no DirectAdmin (se ainda não existir)
if ! grep -qx "${SUB}" "$SUBDOMAINS" 2>/dev/null; then
  echo "${SUB}" >> "$SUBDOMAINS"
  chown diradmin:access "$SUBDOMAINS"
  chmod 600 "$SUBDOMAINS"
fi

# Proxy Apache (mesmo padrão que supabase)
cat > "$CUST_HTTPD" <<EOF
|*if SUB="supabase"|
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Host "supabase.visualdesignmoz.com"
ProxyPass / http://127.0.0.1:8000/
ProxyPassReverse / http://127.0.0.1:8000/
|*endif|
|*if SUB="${SUB}"|
RewriteEngine On
RewriteCond %{REQUEST_URI} ^/.well-known/acme-challenge/ [NC]
RewriteRule ^ - [L]
ProxyPass /.well-known/acme-challenge !
Alias /.well-known/acme-challenge /var/www/html/.well-known/acme-challenge
<Directory "/var/www/html/.well-known/acme-challenge">
Require all granted
</Directory>
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"
RequestHeader setifempty X-Forwarded-Host "painel.visualdesignmoz.com"
ProxyPass / http://127.0.0.1:${PORT}/
ProxyPassReverse / http://127.0.0.1:${PORT}/
|*endif|
EOF

# Docroot mínimo (DirectAdmin + Let's Encrypt)
mkdir -p "/home/${USER}/domains/${DOMAIN}/public_html/${SUB}"
chown -R "${USER}:${USER}" "/home/${USER}/domains/${DOMAIN}/public_html/${SUB}"

chown diradmin:access "$CUST_HTTPD"
chmod 600 "$CUST_HTTPD"

# SSL dedicado do subdomínio painel
CONF="/usr/local/directadmin/data/users/${USER}/domains/${SUB}.${DOMAIN}.conf"
if [[ -f "/usr/local/directadmin/data/users/${USER}/domains/${SUB}.${DOMAIN}.cert.combined" ]]; then
  cat > "$CONF" <<EOF
SSLCACertificateFile=/usr/local/directadmin/data/users/${USER}/domains/${SUB}.${DOMAIN}.cacert
SSLCertificateFile=/usr/local/directadmin/data/users/${USER}/domains/${SUB}.${DOMAIN}.cert.combined
SSLCertificateKeyFile=/usr/local/directadmin/data/users/${USER}/domains/${SUB}.${DOMAIN}.key
UseCanonicalName=OFF
active=yes
defaultdomain=no
domain=${SUB}.${DOMAIN}
force_ssl=yes
ip=37.27.17.25
open_basedir=ON
php=ON
ssl=ON
suspended=no
username=${USER}
EOF
  chown diradmin:access "$CONF"
  chmod 600 "$CONF"
fi

if command -v custombuild >/dev/null 2>&1; then
  custombuild rewrite_confs
else
  /usr/local/directadmin/custombuild/build rewrite_confs
fi

# DirectAdmin por vezes reescreve o certificado do pai — forçar o do subdomínio painel
HTTPD="/usr/local/directadmin/data/users/${USER}/httpd.conf"
if [[ -f "$HTTPD" ]] && [[ -f "/usr/local/directadmin/data/users/${USER}/domains/${SUB}.${DOMAIN}.cert.combined" ]]; then
  python3 - "$HTTPD" "$SUB" "$DOMAIN" "$USER" <<'PY'
import sys
from pathlib import Path
httpd, sub, domain, user = sys.argv[1:5]
p = Path(httpd)
text = p.read_text()
cert = f"/usr/local/directadmin/data/users/{user}/domains/{sub}.{domain}.cert.combined"
key = f"/usr/local/directadmin/data/users/{user}/domains/{sub}.{domain}.key"
parent_cert = f"/usr/local/directadmin/data/users/{user}/domains/{domain}.cert.combined"
parent_key = f"/usr/local/directadmin/data/users/{user}/domains/{domain}.key"
blocks = text.split("<VirtualHost")
out = []
for block in blocks:
    if f"{sub}.{domain}" in block and ":443" in block.split(">")[0]:
        block = block.replace(f"SSLCertificateFile {parent_cert}", f"SSLCertificateFile {cert}")
        block = block.replace(f"SSLCertificateKeyFile {parent_key}", f"SSLCertificateKeyFile {key}")
    out.append(block)
p.write_text("<VirtualHost".join(out))
PY
fi

systemctl reload httpd

echo "OK: painel.visualdesignmoz.com → 127.0.0.1:${PORT}"
