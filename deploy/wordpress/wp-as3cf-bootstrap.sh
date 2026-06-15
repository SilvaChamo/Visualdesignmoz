#!/usr/bin/env bash
# Novo WordPress → S3 Hetzner (AS3CF + rotas + plugin).
# Uso: wp-as3cf-bootstrap.sh /home/user/domains/example.com/public_html example.com [user]
set -euo pipefail

WP_PATH="${1:-}"
DOMAIN="${2:-}"
WP_USER="${3:-}"
WP="${WP:-/usr/local/bin/wp}"
RCLONE_CONF="${RCLONE_CONF:-/root/.config/rclone/rclone.conf}"
BUCKET="${S3_BUCKET:-visualdesign-storage}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

[[ -n "$WP_PATH" && -n "$DOMAIN" && -f "$WP_PATH/wp-config.php" ]] || {
	echo "Uso: $0 /path/public_html dominio.com [user]" >&2
	exit 1
}

[[ -n "$WP_USER" ]] || WP_USER="$(stat -c '%U' "$WP_PATH")"

if grep -q 'AS3CF_SETTINGS' "$WP_PATH/wp-config.php"; then
	echo "SKIP: AS3CF já em $DOMAIN"
else
	KEY="$(awk -F' = ' '/^access_key_id/{print $2}' "$RCLONE_CONF" | head -1)"
	SECRET="$(awk -F' = ' '/^secret_access_key/{print $2}' "$RCLONE_CONF" | head -1)"
	[[ -n "$KEY" && -n "$SECRET" ]] || {
		echo "ERRO: credenciais S3 em falta ($RCLONE_CONF)" >&2
		exit 1
	}

	IMMUTABLE=0
	if lsattr "$WP_PATH/wp-config.php" 2>/dev/null | grep -q '\-i\-'; then
		chattr -i "$WP_PATH/wp-config.php"
		IMMUTABLE=1
	fi

	python3 - "$WP_PATH/wp-config.php" "$KEY" "$SECRET" "$BUCKET" "$DOMAIN" <<'PY'
import sys
path, key, secret, bucket, domain = sys.argv[1:]
block = f"""
// === Hetzner Object Storage (Visual Design) ===
define( 'AS3CF_SETTINGS', serialize( array(
    'provider'             => 'aws',
    'access-key-id'        => '{key}',
    'secret-access-key'    => '{secret}',
    'bucket'               => '{bucket}',
    'region'               => 'hel1',
    'endpoint'             => 'https://hel1.your-objectstorage.com',
    'force-https'          => true,
    'copy-to-s3'           => true,
    'serve-from-s3'        => true,
    'remove-local-file'    => true,
    'enable-object-prefix' => true,
    'object-prefix'        => 'wp/{domain}/uploads/',
) ) );
"""
marker = "/* That's all, stop editing!"
with open(path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()
if marker in content:
    content = content.replace(marker, block + marker, 1)
else:
    content += block
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
PY

	(( IMMUTABLE )) && chattr +i "$WP_PATH/wp-config.php"
	echo "OK wp-config AS3CF: $DOMAIN"
fi

if ! sudo -u "$WP_USER" "$WP" --path="$WP_PATH" plugin is-installed amazon-s3-and-cloudfront &>/dev/null; then
	sudo -u "$WP_USER" "$WP" --path="$WP_PATH" plugin install amazon-s3-and-cloudfront --activate 2>&1 || true
fi
sudo -u "$WP_USER" "$WP" --path="$WP_PATH" plugin activate amazon-s3-and-cloudfront 2>/dev/null || true

MU="$WP_PATH/wp-content/mu-plugins"
mkdir -p "$MU"
if [[ ! -f "$MU/s3-endpoint-fix.php" ]]; then
	cat >"$MU/s3-endpoint-fix.php" <<'PHP'
<?php
/*
Plugin Name: Hetzner S3 Endpoint Fix
Description: Endpoint Hetzner S3 para WP Offload Media.
Version: 1.0
*/
add_filter( 'as3cf_aws_s3_client_args', function ( $args ) {
	$args['endpoint'] = 'https://hel1.your-objectstorage.com';
	$args['use_path_style_endpoint'] = true;
	return $args;
} );
add_filter( 'as3cf_aws_s3_url_domain', function ( $domain, $bucket, $region, $expires, $args ) {
	return 'hel1.your-objectstorage.com/visualdesign-storage';
}, 10, 5 );
PHP
	chown "$WP_USER:$WP_USER" "$MU/s3-endpoint-fix.php"
fi

"${SCRIPT_DIR}/wp-hetzner-uploads-routes.sh" 2>/dev/null || true
# Só este site (re-run routes global é idempotente)
bash -c "source /dev/null; WP_PATH='$WP_PATH' DOMAIN='$DOMAIN'" 2>/dev/null || true

# Instalar rotas só neste site via python inline
MU_SRC="/usr/local/share/wordpress-mu-plugins"
mkdir -p "$MU_SRC"
cp "${SCRIPT_DIR}/vd-hetzner-media-urls.php" "$MU_SRC/"
cp "${SCRIPT_DIR}/vd-hetzner-media-urls.php" "$MU/"
chown "$WP_USER:$WP_USER" "$MU/vd-hetzner-media-urls.php"

python3 - "$WP_PATH" "$BUCKET" "$DOMAIN" <<'PY'
import re, os, subprocess, sys
wp_path, bucket, domain = sys.argv[1:4]
prefix = f"wp/{domain}/uploads/"
target = f"https://{bucket}.hel1.your-objectstorage.com/{prefix}"
ht = os.path.join(wp_path, ".htaccess")
begin, end = "# BEGIN VD-HETZNER-UPLOADS", "# END VD-HETZNER-UPLOADS"
block = f"""{begin}
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{{REQUEST_URI}} ^/wp-content/uploads/(.*)$ [NC]
RewriteCond %{{DOCUMENT_ROOT}}%{{REQUEST_URI}} !-f
RewriteRule .* {target}%1 [R=302,L]
</IfModule>
{end}
"""
if not os.path.isfile(ht):
    open(ht, "a").close()
immutable = False
try:
    out = subprocess.check_output(["lsattr", ht], text=True)
    if "i" in out.split()[0]:
        immutable = True
        subprocess.check_call(["chattr", "-i", ht])
except Exception:
    pass
with open(ht, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()
content = re.sub(re.escape(begin) + r".*?" + re.escape(end) + r"\n?", "", content, flags=re.S)
if "# BEGIN WordPress" in content:
    content = content.replace("# BEGIN WordPress", block + "# BEGIN WordPress", 1)
else:
    content = content.rstrip() + "\n\n" + block
with open(ht, "w", encoding="utf-8") as f:
    f.write(content)
if immutable:
    subprocess.check_call(["chattr", "+i", ht])
PY

sudo -u "$WP_USER" "$WP" --path="$WP_PATH" cache flush 2>/dev/null || true
echo "OK bootstrap S3: $DOMAIN"
