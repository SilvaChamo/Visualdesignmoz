#!/bin/bash
# Upload File — configuração global autónoma no DirectAdmin.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN=/usr/local/directadmin/plugins/uploadfile
HOOKS=$PLUGIN/hooks
IMAGES=$PLUGIN/images
ADMIN_MENU=/usr/local/directadmin/data/users/admin/skin_customizations/evolution/files/menu-v4.json
MENU_SRC=/usr/local/directadmin/scripts/uploadfile-menu-v4.json
MENU_FALLBACK="$SCRIPT_DIR/menu-v4-clean.json"
DA_SCRIPTS=/usr/local/directadmin/scripts

mkdir -p "$HOOKS" "$IMAGES" "$(dirname "$ADMIN_MENU")"

cat > "$HOOKS/user_txt.html" <<'EOF'
<a href="/CMD_PLUGINS/uploadfile">Upload File</a>
EOF
cat > "$HOOKS/reseller_txt.html" <<'EOF'
<a href="/CMD_PLUGINS_RESELLER/uploadfile">Upload File</a>
EOF
cat > "$HOOKS/admin_txt.html" <<'EOF'
<a href="/CMD_PLUGINS_ADMIN/uploadfile">Upload File</a>
EOF

cat > "$IMAGES/user_icon.svg" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect x="10" y="14" width="44" height="36" rx="5" stroke="#1d4ed8" stroke-width="3"/>
  <path d="M32 38V26M32 26l-7 7M32 26l7 7" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20 46h24" stroke="#60a5fa" stroke-width="3" stroke-linecap="round"/>
</svg>
EOF
cp "$IMAGES/user_icon.svg" "$IMAGES/reseller_icon.svg"
cp "$IMAGES/user_icon.svg" "$IMAGES/admin_icon.svg"

mkdir -p "$PLUGIN/private"
if [ -f /var/www/html/files/private/sso_secret ]; then
  cp /var/www/html/files/private/sso_secret "$PLUGIN/private/sso_secret"
  chmod 444 "$PLUGIN/private/sso_secret"
  chown diradmin:diradmin "$PLUGIN/private/sso_secret"
fi

chown -R diradmin:diradmin "$PLUGIN"
chmod 755 "$HOOKS"/*.html "$PLUGIN"/*/index.html "$PLUGIN/scripts/upload_ui.php" 2>/dev/null || true
chmod 644 "$IMAGES"/*.svg

# Menu canónico (admin) — herda para todo o servidor
if [ -f "$MENU_FALLBACK" ]; then
  cp "$MENU_FALLBACK" "$MENU_SRC"
fi
cp "$MENU_SRC" "$ADMIN_MENU"
chown admin:admin "$ADMIN_MENU" 2>/dev/null || chown diradmin:diradmin "$ADMIN_MENU"
chmod 644 "$ADMIN_MENU"

# Remover menus locais: bloqueiam herança do admin
while IFS= read -r -d '' local_menu; do
  [ "$local_menu" = "$ADMIN_MENU" ] && continue
  rm -f "$local_menu"
done < <(find /usr/local/directadmin/data/users -path '*/skin_customizations/evolution/files/menu-v4.json' -print0 2>/dev/null)

# Pacotes admin: garantir comando plugins
for pkg in /usr/local/directadmin/data/users/admin/packages/*.pkg; do
  [ -f "$pkg" ] || continue
  grep -q '^feature_sets=' "$pkg" || echo 'feature_sets=core_functions' >> "$pkg"
done

# Cron autónomo (idempotente)
CRON_FILE=/etc/cron.d/directadmin-uploadfile
cat > "$CRON_FILE" <<EOF
# Mantém Upload File global — sem acção manual
*/10 * * * * root $DA_SCRIPTS/ensure-uploadfile-global.sh >/dev/null 2>&1
EOF
chmod 644 "$CRON_FILE"

echo "OK: Upload File global + cron autónomo"
