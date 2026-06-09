#!/bin/bash
# Remove Akismet e Hello Dolly — plugins default do WordPress que o stack Visual Design substitui.
# Uso: ./wp-remove-default-plugins.sh /caminho/public_html [user]
set -euo pipefail

WP_PATH="${1:-}"
WP_USER="${2:-}"
WP=/usr/local/bin/wp
DEFAULT_SLUGS=(akismet hello-dolly)

[[ -f "$WP_PATH/wp-config.php" ]] || exit 0
[[ -z "$WP_USER" ]] && WP_USER="$(stat -c '%U' "$WP_PATH")"

for slug in "${DEFAULT_SLUGS[@]}"; do
  dir="$WP_PATH/wp-content/plugins/$slug"
  if [[ -d "$dir" ]]; then
    chown -R "$WP_USER:$WP_USER" "$dir" 2>/dev/null || true
    chmod -R u+rwX "$dir" 2>/dev/null || true
    chattr -R -i "$dir" 2>/dev/null || true
  fi
done

sudo -u "$WP_USER" "$WP" --path="$WP_PATH" plugin deactivate akismet hello-dolly 2>/dev/null || true

sudo -u "$WP_USER" "$WP" --path="$WP_PATH" plugin delete akismet hello-dolly 2>/dev/null || true

for slug in "${DEFAULT_SLUGS[@]}"; do
  dir="$WP_PATH/wp-content/plugins/$slug"
  [[ -d "$dir" ]] && chattr -R -i "$dir" 2>/dev/null || true
  rm -rf "$dir" 2>/dev/null || true
done

# Resíduos antigos (hello.php solto na pasta plugins)
rm -f "$WP_PATH/wp-content/plugins/hello.php" 2>/dev/null || true

sync_mu_stack() {
  local MU_ROOT="${MU_PLUGIN_SRC:-/usr/local/share/wordpress-mu-plugins}"
  if [[ ! -f "$MU_ROOT/00-visualdesign-loader.php" ]]; then
    return 0
  fi
  local MU_DIR="$WP_PATH/wp-content/mu-plugins"
  mkdir -p "$MU_DIR/visualdesign"
  cp "$MU_ROOT/00-visualdesign-loader.php" "$MU_DIR/"
  cp "$MU_ROOT/visualdesign/stack.php" "$MU_DIR/visualdesign/"
  chown -R "$WP_USER:$WP_USER" "$MU_DIR/00-visualdesign-loader.php" "$MU_DIR/visualdesign" 2>/dev/null || true
}

sync_mu_stack
