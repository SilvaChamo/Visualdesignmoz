#!/bin/bash
# Expõe phpMyAdmin em https://teste.visualdesignmoz.com/phpmyadmin/
# O template nginx "nodejs" do painel envia todo o "/" para o Next.js (3002);
# sem esta location o botão MySQL do painel não chega ao MariaDB.

set -euo pipefail

CONFDIR="${PMA_NGINX_CONFDIR:-/home/vdadmin/conf/web/teste.visualdesignmoz.com}"
PMA_SNIPPET="$CONFDIR/nginx.ssl.conf_phpmyadmin"

if [[ ! -d "$CONFDIR" ]]; then
  echo "ERRO: pasta nginx do domínio do painel não existe: $CONFDIR" >&2
  exit 1
fi

cat > "$PMA_SNIPPET" <<'NGINX'
# phpMyAdmin no hostname do painel. O template nodejs envia "/" para o
# Next.js (porta 3002); sem esta location o /phpmyadmin nunca chega ao MySQL.
location /phpmyadmin {
	alias /usr/share/phpmyadmin/;
	index index.php;

	location ~ /(libraries|setup|templates|locale) {
		deny   all;
		return 404;
	}

	location ~ /(.+\.(json|lock|md)) {
		deny   all;
		return 404;
	}

	location ~ ^/phpmyadmin/(.*\.php)$ {
		alias         /usr/share/phpmyadmin/$1;
		include       /etc/nginx/fastcgi_params;
		fastcgi_index index.php;
		fastcgi_param HTTP_EARLY_DATA $rfc_early_data if_not_empty;
		fastcgi_param SCRIPT_FILENAME $request_filename;
		fastcgi_pass  unix:/run/php/www.sock;
	}

	location ~* ^/phpmyadmin/(.+\.(jpg|jpeg|gif|css|png|webp|js|ico|html|xml|txt))$ {
		alias /usr/share/phpmyadmin/$1;
	}
}
NGINX

chmod 644 "$PMA_SNIPPET"
nginx -t
systemctl reload nginx

KEY_FILE=/etc/phpmyadmin/vd-panel-sso.key
TICKET_DIR=/var/lib/phpmyadmin/sso
SCRIPT_SRC="$(cd "$(dirname "$0")" && pwd)"

install -d -m 775 -o root -g www-data "$TICKET_DIR" 2>/dev/null || install -d -m 775 -o root -g hestiamail "$TICKET_DIR"
if [[ ! -s "$KEY_FILE" ]]; then
  openssl rand -hex 32 > "$KEY_FILE"
fi
chmod 644 "$KEY_FILE"
chown root:www-data "$KEY_FILE" 2>/dev/null || chown root:hestiamail "$KEY_FILE"

install -m 644 -o root -g hestiamail "$SCRIPT_SRC/phpmyadmin-vd-panel-sso.php" /usr/share/phpmyadmin/vd-panel-sso.php
install -m 644 -o root -g hestiamail "$SCRIPT_SRC/phpmyadmin-vd-panel-sso.inc.php" /etc/phpmyadmin/vd-panel-sso.inc.php

if ! grep -q "vd-panel-sso.inc.php" /etc/phpmyadmin/config.inc.php; then
  if grep -q "//Add Hestia SSO code here" /etc/phpmyadmin/config.inc.php; then
    sed -i "s|//Add Hestia SSO code here|//Add Hestia SSO code here\n     include ('/etc/phpmyadmin/vd-panel-sso.inc.php');|g" /etc/phpmyadmin/config.inc.php
  else
    printf "\ninclude ('/etc/phpmyadmin/vd-panel-sso.inc.php');\n" >> /etc/phpmyadmin/config.inc.php
  fi
fi

echo "phpMyAdmin activo em /phpmyadmin/ (SSO do painel instalado)"
