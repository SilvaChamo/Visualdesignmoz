#!/bin/bash
# Configura www-teste.visualdesignmoz.com → Next.js local (PM2), sem tocar
# nos blocos já existentes (supabase, painel) do mesmo ficheiro cust_httpd.
# Executar no Hetzner como root.

set -euo pipefail

DOMAIN=visualdesignmoz.com
USER=admin
SUB="${SITE_SUB:-www-teste}"
PORT="${SITE_PORT:-3003}"
CUST_HTTPD="/usr/local/directadmin/data/users/${USER}/domains/${DOMAIN}.cust_httpd"
SUBDOMAINS="/usr/local/directadmin/data/users/${USER}/domains/${DOMAIN}.subdomains"

# Registar subdomínio no DirectAdmin (se ainda não existir)
if ! grep -qx "${SUB}" "$SUBDOMAINS" 2>/dev/null; then
  echo "${SUB}" >> "$SUBDOMAINS"
  chown diradmin:access "$SUBDOMAINS"
  chmod 600 "$SUBDOMAINS"
fi

# Acrescentar o bloco deste subdomínio ao cust_httpd SEM apagar os existentes
if [[ -f "$CUST_HTTPD" ]] && grep -q "SUB=\"${SUB}\"" "$CUST_HTTPD"; then
  echo "Bloco de ${SUB} já existe em cust_httpd — a saltar."
else
  cat >> "$CUST_HTTPD" <<EOF
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
RequestHeader setifempty X-Forwarded-Host "${SUB}.${DOMAIN}"
ProxyPass / http://127.0.0.1:${PORT}/
ProxyPassReverse / http://127.0.0.1:${PORT}/
|*endif|
EOF
fi

# Docroot mínimo (DirectAdmin + Let's Encrypt)
mkdir -p "/home/${USER}/domains/${DOMAIN}/public_html/${SUB}"
chown -R "${USER}:${USER}" "/home/${USER}/domains/${DOMAIN}/public_html/${SUB}"

chown diradmin:access "$CUST_HTTPD"
chmod 600 "$CUST_HTTPD"

if command -v custombuild >/dev/null 2>&1; then
  custombuild rewrite_confs
else
  /usr/local/directadmin/custombuild/build rewrite_confs
fi

systemctl reload httpd

echo "OK: ${SUB}.${DOMAIN} → 127.0.0.1:${PORT} (sem SSL ainda — pedir certificado no DirectAdmin depois de o DNS propagar)"
