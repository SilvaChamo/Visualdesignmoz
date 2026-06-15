#!/bin/bash
# Visual Design — WordPress uploads → Hetzner Object Storage (S3 Uploads).
# Uso no servidor:
#   ./wp-s3-hetzner-setup.sh              # sites prioritários
#   ./wp-s3-hetzner-setup.sh --all        # todos os sites WP
#   ./wp-s3-hetzner-setup.sh /path/public_html domain.com
set -euo pipefail

WP=/usr/local/bin/wp
RCLONE_CONF="${RCLONE_CONF:-/root/.config/rclone/rclone.conf}"
S3_PLUGIN_SRC="${S3_PLUGIN_SRC:-/usr/local/share/wordpress-plugins/s3-uploads}"
MU_SRC="${MU_SRC:-/usr/local/share/wordpress-mu-plugins}"
BUCKET="visualdesign-storage"
DELETE_LOCAL="${DELETE_LOCAL:-1}"

PRIORITY_SITES=(
	"/home/admin/domains/mltmark.com/public_html|mltmark.com"
	"/home/admin/domains/aamihe.com/public_html|aamihe.com"
	"/home/oshercollective/domains/msdnmoz.org/public_html|msdnmoz.org"
	"/home/admin/domains/entrecampos.co.mz/public_html|entrecampos.co.mz"
)

ensure_rclone_region() {
	if ! grep -q '^region' "$RCLONE_CONF" 2>/dev/null; then
		sed -i '/^\[hetzner-s3\]/a region = hel1' "$RCLONE_CONF"
	fi
}

write_user_creds() {
	local user="$1"
	local creds_file="/home/${user}/.config/wp-s3-hetzner.php"
	if [[ -f "$creds_file" ]]; then
		return 0
	fi
	local key secret
	key="$(awk -F' = ' '/^access_key_id/{print $2}' "$RCLONE_CONF" | head -1)"
	secret="$(awk -F' = ' '/^secret_access_key/{print $2}' "$RCLONE_CONF" | head -1)"
	[[ -n "$key" && -n "$secret" ]] || {
		echo "ERRO: credenciais S3 não encontradas em $RCLONE_CONF" >&2
		exit 1
	}
	mkdir -p "/home/${user}/.config"
	cat >"$creds_file" <<PHP
<?php
return [
	'key'    => '${key}',
	'secret' => '${secret}',
];
PHP
	chown "${user}:${user}" "$creds_file"
	chmod 600 "$creds_file"
	echo "OK credenciais: $creds_file"
}

install_s3_uploads_plugin() {
	if [[ -f "$S3_PLUGIN_SRC/vendor/autoload.php" ]]; then
		return 0
	fi
	mkdir -p "$(dirname "$S3_PLUGIN_SRC")"
	if [[ ! -d "$S3_PLUGIN_SRC/.git" ]]; then
		git clone --depth 1 https://github.com/humanmade/S3-Uploads.git "$S3_PLUGIN_SRC"
	fi
	(
		cd "$S3_PLUGIN_SRC"
		composer install --no-dev --optimize-autoloader --no-interaction
	)
	echo "OK plugin S3 Uploads em $S3_PLUGIN_SRC"
}

deploy_mu_plugin() {
	local wp_path="$1"
	local wp_user="$2"
	local mu_dir="$wp_path/wp-content/mu-plugins"
	mkdir -p "$mu_dir"
	cp "$MU_SRC/hetzner-s3-uploads.php" "$mu_dir/"
	chown "$wp_user:$wp_user" "$mu_dir/hetzner-s3-uploads.php"
}

link_plugin() {
	local wp_path="$1"
	local wp_user="$2"
	local dest="$wp_path/wp-content/plugins/s3-uploads"
	mkdir -p "$wp_path/wp-content/plugins"
	if [[ -L "$dest" ]]; then
		return 0
	fi
	rm -rf "$dest"
	ln -sfn "$S3_PLUGIN_SRC" "$dest"
	chown -h "$wp_user:$wp_user" "$dest" 2>/dev/null || true
}

setup_site() {
	local wp_path="$1"
	local domain="$2"
	[[ -f "$wp_path/wp-config.php" ]] || {
		echo "SKIP (sem wp-config): $wp_path"
		return 0
	}
	local wp_user
	wp_user="$(stat -c '%U' "$wp_path")"
	echo ""
	echo "=== $domain ($wp_user) ==="

	write_user_creds "$wp_user"
	deploy_mu_plugin "$wp_path" "$wp_user"
	link_plugin "$wp_path" "$wp_user"

	sudo -u "$wp_user" "$WP" --path="$wp_path" plugin activate s3-uploads 2>/dev/null || true

	local uploads="$wp_path/wp-content/uploads"
	local size="0"
	if [[ -d "$uploads" ]]; then
		size="$(du -sh "$uploads" 2>/dev/null | cut -f1)"
	fi
	echo "Uploads locais antes: ${size:-?}"

	echo "A enviar para s3://${BUCKET}/wp-sites/${domain}/ …"
	if [[ "$DELETE_LOCAL" == "1" ]]; then
		sudo -u "$wp_user" "$WP" --path="$wp_path" s3-uploads upload --delete-local 2>&1 || {
			echo "AVISO: upload com --delete-local falhou; a tentar sem apagar local…" >&2
			sudo -u "$wp_user" "$WP" --path="$wp_path" s3-uploads upload 2>&1
		}
	else
		sudo -u "$wp_user" "$WP" --path="$wp_path" s3-uploads upload 2>&1
	fi

	sudo -u "$wp_user" "$WP" --path="$wp_path" s3-uploads verify 2>&1 || true

	if [[ -d "$uploads" ]]; then
		echo "Uploads locais depois: $(du -sh "$uploads" 2>/dev/null | cut -f1)"
	fi
	echo "OK: $domain"
}

discover_all_sites() {
	find /home -path '*/domains/*/public_html/wp-config.php' 2>/dev/null \
		| grep -v '/Backup/' \
		| grep -v '/BackUp/' \
		| grep -v '/trash/' \
		| while read -r cfg; do
			local wp_path
			wp_path="$(dirname "$cfg")"
			local domain
			domain="$(basename "$(dirname "$wp_path")")"
			echo "${wp_path}|${domain}"
		done
}

ensure_rclone_region
install_s3_uploads_plugin
mkdir -p "$MU_SRC"
cp "$(dirname "$0")/hetzner-s3-uploads.php" "$MU_SRC/" 2>/dev/null \
	|| cp /root/wp-s3-hetzner-setup.sh "$MU_SRC/" 2>/dev/null || true

if [[ "${1:-}" == "--all" ]]; then
	while IFS='|' read -r path domain; do
		[[ -n "$path" ]] && setup_site "$path" "$domain"
	done < <(discover_all_sites)
elif [[ -n "${1:-}" && -n "${2:-}" ]]; then
	setup_site "$1" "$2"
else
	for entry in "${PRIORITY_SITES[@]}"; do
		IFS='|' read -r path domain <<<"$entry"
		setup_site "$path" "$domain"
	done
fi

echo ""
echo "Concluído. Balde: ${BUCKET} (prefixo wp-sites/<domínio>/)"
