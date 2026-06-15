#!/usr/bin/env bash
# WordPress — apenas S3 (WP Offload Media). Sem duplicar com S3-Uploads Human Made.
set -uo pipefail

WP="${WP:-/usr/local/bin/wp}"
MU_REMOVE="${MU_REMOVE:-hetzner-s3-uploads.php}"
EVAL_SRC="${EVAL_SRC:-/usr/local/share/wordpress-scripts/wp-as3cf-remove-local.php}"

update_wp_config() {
	local cfg="$1"
	local immutable=0
	[[ -f "$cfg" ]] || return 0
	if grep -qE "'remove-local-file'[[:space:]]+=>[[:space:]]+false" "$cfg"; then
		if lsattr "$cfg" 2>/dev/null | grep -q '\-i\-'; then
			chattr -i "$cfg"
			immutable=1
		fi
		sed -i -E "s/'remove-local-file'[[:space:]]+=>[[:space:]]+false/'remove-local-file'  => true/" "$cfg"
		(( immutable == 1 )) && chattr +i "$cfg"
	fi
}

prune_local_uploads_on_s3() {
	local wp_path="$1"
	local domain="$2"
	local uploads="$wp_path/wp-content/uploads"
	local remote="hetzner-s3:visualdesign-storage/wp/${domain}/uploads"
	local removed=0
	local kept=0

	[[ -d "$uploads" ]] || return 0

	while IFS= read -r -d '' file; do
		local rel remote_path local_size remote_size
		rel="${file#"${uploads}/"}"
		[[ "$rel" == ".htaccess" || "$rel" == "index.php" || "$rel" == *"/.htaccess" ]] && continue
		# Elementor: manter local (fontes + CSS gerado) — evita FOUT e menu/header quebrados
		[[ "$rel" == elementor/google-fonts/* || "$rel" == elementor/css/* ]] && continue
		remote_path="${remote}/${rel}"
		local_size="$(stat -c '%s' "$file" 2>/dev/null || echo 0)"
		remote_size="$(rclone lsl "$remote_path" 2>/dev/null | awk '{print $1}' | head -1)"
		if [[ -n "$remote_size" && "$remote_size" == "$local_size" ]]; then
			rm -f "$file"
			removed=$((removed + 1))
		else
			kept=$((kept + 1))
		fi
	done < <(find "$uploads" -type f -print0 2>/dev/null)

	find "$uploads" -type d -empty -delete 2>/dev/null || true
	echo "Prune S3: removidos=${removed} mantidos_local=${kept}"
}

remove_s3_uploads_dup() {
	local wp_path="$1"
	local wp_user="$2"
	local mu="$wp_path/wp-content/mu-plugins/${MU_REMOVE}"
	local link="$wp_path/wp-content/plugins/s3-uploads"

	sudo -u "$wp_user" "$WP" --path="$wp_path" plugin deactivate s3-uploads 2>/dev/null || true
	[[ -L "$link" || -d "$link" ]] && rm -rf "$link"
	[[ -f "$mu" ]] && rm -f "$mu"
}

process_site() {
	local wp_path="$1"
	local domain="$2"
	local wp_user
	wp_user="$(stat -c '%U' "$wp_path")"
	local cfg="$wp_path/wp-config.php"

	[[ -f "$cfg" ]] || return 0

	echo ""
	echo "=== ${domain} (${wp_user}) ==="
	update_wp_config "$cfg"
	remove_s3_uploads_dup "$wp_path" "$wp_user"

	if ! sudo -u "$wp_user" "$WP" --path="$wp_path" plugin is-active amazon-s3-and-cloudfront &>/dev/null; then
		echo "SKIP: Offload Media inactivo"
		return 0
	fi

	local before after
	before="$(du -sh "$wp_path/wp-content/uploads" 2>/dev/null | cut -f1 || echo 0)"
	prune_local_uploads_on_s3 "$wp_path" "$domain" || echo "AVISO: prune parcial em ${domain}"
	if [[ -f "$EVAL_SRC" ]]; then
		sudo -u "$wp_user" "$WP" --path="$wp_path" eval-file "$EVAL_SRC" 2>&1 || echo "AVISO: AS3CF remove-local em ${domain}"
	fi
	after="$(du -sh "$wp_path/wp-content/uploads" 2>/dev/null | cut -f1 || echo 0)"
	echo "Uploads: ${before} → ${after}"
}

mkdir -p "$(dirname "$EVAL_SRC")"
cp "$(dirname "$0")/wp-as3cf-remove-local.php" "$EVAL_SRC"

while IFS= read -r cfg; do
	wp_path="$(dirname "$cfg")"
	domain="$(basename "$(dirname "$wp_path")")"
	process_site "$wp_path" "$domain"
done < <(find /home -path '*/domains/*/public_html/wp-config.php' 2>/dev/null | grep -vi backup | sort)

echo ""
echo "Concluído: uploads novos só S3 (remove-local-file=true); duplicado S3-Uploads removido."
