#!/usr/bin/env bash
# Instala rotas S3 para wp-content/uploads (MU-plugin + .htaccess) em sites com AS3CF_SETTINGS.
set -uo pipefail

MU_SRC="${MU_SRC:-/usr/local/share/wordpress-mu-plugins}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MARKER_BEGIN="# BEGIN VD-HETZNER-UPLOADS"
MARKER_END="# END VD-HETZNER-UPLOADS"

mkdir -p "$MU_SRC"
cp "${SCRIPT_DIR}/vd-hetzner-media-urls.php" "$MU_SRC/"

install_site() {
	local wp_path="$1"
	local domain="$2"
	local cfg="$wp_path/wp-config.php"
	local ht="$wp_path/.htaccess"
	local wp_user
	wp_user="$(stat -c '%U' "$wp_path")"

	[[ -f "$cfg" ]] || return 0
	grep -q 'AS3CF_SETTINGS' "$cfg" || return 0

	local bucket prefix target
	bucket="$(grep -oP "'bucket'\s*=>\s*'\K[^']+" "$cfg" | head -1)"
	prefix="$(grep -oP "'object-prefix'\s*=>\s*'\K[^']+" "$cfg" | head -1)"
	[[ -n "$bucket" && -n "$prefix" ]] || {
		echo "SKIP $domain (AS3CF incompleto)"
		return 0
	}

	local target="https://${bucket}.hel1.your-objectstorage.com/${prefix}"

	mkdir -p "$wp_path/wp-content/mu-plugins"
	cp "$MU_SRC/vd-hetzner-media-urls.php" "$wp_path/wp-content/mu-plugins/"
	chown "$wp_user:$wp_user" "$wp_path/wp-content/mu-plugins/vd-hetzner-media-urls.php"

	python3 - "$ht" "$target" "$MARKER_BEGIN" "$MARKER_END" <<'PY'
import re, sys, subprocess
ht, target, begin, end = sys.argv[1:5]
block = f"""{begin}
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{{REQUEST_URI}} ^/wp-content/uploads/(.*)$ [NC]
RewriteCond %{{DOCUMENT_ROOT}}%{{REQUEST_URI}} !-f
RewriteRule .* {target}%1 [R=302,L]
</IfModule>
{end}
"""
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

	chown "$wp_user:$wp_user" "$ht" 2>/dev/null || true
	echo "OK $domain → ${target}{path}"
}

while IFS= read -r cfg; do
	wp_path="$(dirname "$cfg")"
	domain="$(basename "$(dirname "$wp_path")")"
	install_site "$wp_path" "$domain"
done < <(find /home -path '*/domains/*/public_html/wp-config.php' 2>/dev/null | grep -vi backup | sort)

echo "Concluído."
