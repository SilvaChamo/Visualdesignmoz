#!/bin/bash
# Visual Design — stack completo ao instalar WordPress (servidor todo).
# Uso: ./wp-cache-on-site.sh /caminho/public_html [user]
set -euo pipefail

WP_PATH="${1:-}"
WP_USER="${2:-}"
WP=/usr/local/bin/wp
MU_ROOT="${MU_PLUGIN_SRC:-/usr/local/share/wordpress-mu-plugins}"
ENABLE_WPO="/root/wp-enable-wpo-cache.sh"
REMOVE_SCRIPT="${REMOVE_SCRIPT:-/root/wp-remove-default-plugins.sh}"

[[ -f "$WP_PATH/wp-config.php" ]] || exit 0
[[ -z "$WP_USER" ]] && WP_USER="$(stat -c '%U' "$WP_PATH")"

if [[ -x "$REMOVE_SCRIPT" ]]; then
  "$REMOVE_SCRIPT" "$WP_PATH" "$WP_USER"
else
  for slug in akismet hello-dolly; do
    dir="$WP_PATH/wp-content/plugins/$slug"
    [[ -d "$dir" ]] && chown -R "$WP_USER:$WP_USER" "$dir" 2>/dev/null || true
  done
  sudo -u "$WP_USER" "$WP" --path="$WP_PATH" plugin delete akismet hello-dolly 2>/dev/null \
    || rm -rf "$WP_PATH/wp-content/plugins/akismet" "$WP_PATH/wp-content/plugins/hello-dolly" 2>/dev/null || true
fi

sudo -u "$WP_USER" "$WP" --path="$WP_PATH" plugin install redis-cache wp-optimize honeypot --activate 2>/dev/null \
  || sudo -u "$WP_USER" "$WP" --path="$WP_PATH" plugin activate redis-cache wp-optimize honeypot 2>/dev/null || true

if [[ -f "$MU_ROOT/00-visualdesign-loader.php" ]]; then
  MU_DIR="$WP_PATH/wp-content/mu-plugins"
  mkdir -p "$MU_DIR/visualdesign"
  cp "$MU_ROOT/00-visualdesign-loader.php" "$MU_DIR/"
  cp "$MU_ROOT/visualdesign/stack.php" "$MU_DIR/visualdesign/"
  rm -f "$MU_DIR/visualdesign-site-stack.php" "$MU_DIR/aamihe-"*.php "$MU_DIR/serv-"*.php
  chown -R "$WP_USER:$WP_USER" "$MU_DIR/00-visualdesign-loader.php" "$MU_DIR/visualdesign" 2>/dev/null || true
fi

sudo -u "$WP_USER" "$WP" --path="$WP_PATH" redis enable 2>/dev/null || true

if [[ -x "$ENABLE_WPO" ]]; then
  "$ENABLE_WPO" "$WP_PATH" "$WP_USER"
else
  chown "$WP_USER:$WP_USER" "$WP_PATH/wp-config.php" 2>/dev/null || true
  chmod 640 "$WP_PATH/wp-config.php" 2>/dev/null || true
  sudo -u "$WP_USER" "$WP" config set WP_CACHE true --raw --path="$WP_PATH" 2>/dev/null || true
  sudo -u "$WP_USER" "$WP" --path="$WP_PATH" eval '
$c = get_option("wpo_page_cache_config", array());
if (!is_array($c)) $c = array();
$c["enable_page_caching"] = true;
update_option("wpo_page_cache_config", $c);
if (class_exists("WPO_Page_Cache")) { WPO_Page_Cache::instance()->enable(); }
do_action("wpo_cache_config_updated");
' 2>/dev/null || true
  echo "OK: $WP_PATH"
fi

touch "$WP_PATH/.wp-cache-bootstrap-done"
chown "$WP_USER:$WP_USER" "$WP_PATH/.wp-cache-bootstrap-done" 2>/dev/null || true
