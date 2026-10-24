#!/bin/bash
# Proxy supabase.visualdesignmoz.com → Kong :8000 (Supabase Docker)
# Executar no Hetzner como root após rebuild do DirectAdmin se o login Google voltar a 404/503.
#
# DirectAdmin ignora ficheiros .subdomains.*.cust para Apache; usar cust_httpd com |*if SUB=...|.

set -euo pipefail

DOMAIN=visualdesignmoz.com
USER=admin
CUST_HTTPD="/usr/local/directadmin/data/users/${USER}/domains/${DOMAIN}.cust_httpd"

cat > "$CUST_HTTPD" <<'EOF'
|*if SUB="supabase"|
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Host "supabase.visualdesignmoz.com"
ProxyPass / http://127.0.0.1:8000/
ProxyPassReverse / http://127.0.0.1:8000/
|*endif|
EOF

chown diradmin:access "$CUST_HTTPD"
chmod 600 "$CUST_HTTPD"

if command -v custombuild >/dev/null 2>&1; then
  custombuild rewrite_confs
else
  /usr/local/directadmin/custombuild/build rewrite_confs
fi

systemctl reload httpd
echo "OK: proxy supabase.visualdesignmoz.com → 127.0.0.1:8000 (cust_httpd SUB=supabase)"
