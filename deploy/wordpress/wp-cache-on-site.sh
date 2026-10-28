#!/bin/bash
# Visual Design — prepara um WordPress no servidor (Silva, 28/10/2026): WP-Optimize activo com a cache de página ligada, cache de objectos
# em Redis com prefixo próprio do site, mu-plugin do stack e sem Akismet nem Hello Dolly. É a única fonte desta preparação: o painel
# chama-o a seguir à instalação (installWordPressSite, em src/lib/wp-cli-server.ts) e o workflow ops-wordpress-cache-aplicar.yml usa-o
# nos sites que já existiam. Vive na pasta da versão em uso (/opt/visualdesignmoz/deploy/wordpress/), por isso cada deploy o actualiza.
# Uso: wp-cache-on-site.sh /home/CONTA/web/DOMINIO/public_html [conta] [dominio]
# Só mexe nesse site, pode correr mais de uma vez e nunca imprime segredos. Um passo que falha só avisa: o resto segue.
set -u

WP_PATH="${1:-}"
WP_USER="${2:-}"
DOMINIO="${3:-}"
WP="${WP_BIN:-/usr/local/bin/wp}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ -f "$WP_PATH/wp-config.php" ]] || { echo "Sem wp-config.php em $WP_PATH: nada a fazer."; exit 0; }
[[ -z "$WP_USER" ]] && WP_USER="$(stat -c '%U' "$WP_PATH")"
[[ -z "$DOMINIO" ]] && DOMINIO="$(echo "$WP_PATH" | cut -d/ -f5)"
case "$WP_USER$DOMINIO" in (*[!A-Za-z0-9._-]*) echo "Conta ou domínio inválidos."; exit 1;; esac

wpu() { sudo -u "$WP_USER" "$WP" --path="$WP_PATH" "$@"; }
passo() {
  local titulo="$1" out rc; shift
  out=$("$@" 2>&1); rc=$?
  if [[ $rc -eq 0 ]]; then echo "[ok] $titulo"; else echo "[AVISO] $titulo"; echo "$out" | tail -n 3 | cut -c1-200 | sed 's/^/        /'; fi
  return 0
}

# wp config set com a âncora normal; se o wp-config não a tem (ex.: entrecamposblog.com), põe antes do require do wp-settings.php
cfg() {
  wpu config set "$@" 2>/dev/null && return 0
  wpu config set "$@" --anchor="require_once ABSPATH . 'wp-settings.php';" --placement=before 2>&1
}

# o WP-Optimize costuma pôr o WP_CACHE sozinho ao ligar a cache; só se não o pôs é que se define aqui
garantir_wp_cache() { wpu config has WP_CACHE >/dev/null 2>&1 || cfg WP_CACHE true --raw; }

# Prefixo das chaves do Redis: um por site (e por pasta, se o WordPress não está na raiz). Isola os sites que partilham o Redis.
RAIZ_SITE="/home/$WP_USER/web/$DOMINIO/public_html"
REL="${WP_PATH#"$RAIZ_SITE"}"
PREFIXO="vd_$(echo "$DOMINIO$REL" | tr 'A-Z./-' 'a-z___' | tr -cd 'a-z0-9_')_"

echo "=== $DOMINIO (conta $WP_USER) · prefixo do Redis: $PREFIXO"

# 1. mu-plugin do stack (versão desta pasta; se faltar, a que está em /usr/local/share)
MU_ROOT="$AQUI"; [[ -f "$MU_ROOT/00-visualdesign-loader.php" && -f "$MU_ROOT/visualdesign/stack.php" ]] || MU_ROOT="${MU_PLUGIN_SRC:-/usr/local/share/wordpress-mu-plugins}"
if [[ -f "$MU_ROOT/00-visualdesign-loader.php" && -f "$MU_ROOT/visualdesign/stack.php" ]]; then
  MU_DIR="$WP_PATH/wp-content/mu-plugins"
  passo "mu-plugin do stack" bash -c "mkdir -p '$MU_DIR/visualdesign' && cp '$MU_ROOT/00-visualdesign-loader.php' '$MU_DIR/' && cp '$MU_ROOT/visualdesign/stack.php' '$MU_DIR/visualdesign/' && chown -R '$WP_USER:$WP_USER' '$MU_DIR/00-visualdesign-loader.php' '$MU_DIR/visualdesign'"
else
  echo "[AVISO] mu-plugin do stack: ficheiros não encontrados"
fi

# VD_SO_MU=1: só actualiza o mu-plugin do stack (ex.: para um site antigo receber o que mudou nele) e sai
[[ "${VD_SO_MU:-}" == "1" ]] && exit 0

# 2. fora Akismet e Hello Dolly (o slug do segundo é «hello»; o ficheiro solto também sai)
passo "sem Akismet nem Hello Dolly" bash -c "sudo -u '$WP_USER' '$WP' --path='$WP_PATH' plugin delete akismet hello 2>&1; rm -f '$WP_PATH/wp-content/plugins/hello.php'; true"

# 3. WP-Optimize activo e cache de página ligada (opção + advanced-cache.php + WP_CACHE)
passo "WP-Optimize instalado" wpu plugin install wp-optimize
passo "WP-Optimize activo" wpu plugin activate wp-optimize
passo "cache de página ligada" wpu eval '
$c = get_option("wpo_page_cache_config", array());
if (!is_array($c)) $c = array();
$c["enable_page_caching"] = true;
update_option("wpo_page_cache_config", $c);
if (class_exists("WPO_Page_Cache")) { WPO_Page_Cache::instance()->enable(); }
'
passo "WP_CACHE definido" garantir_wp_cache

# 4. cache de objectos em Redis, só se o Redis responder; prefixo próprio, esvaziar só as chaves deste site e todas com validade (para o
#    limite de memória do Redis, política volatile-lru, só poder apagar chaves de cache e nunca dados de outras aplicações)
if [[ "$(redis-cli ping 2>/dev/null)" == "PONG" ]]; then
  passo "Redis Cache instalado" wpu plugin install redis-cache
  passo "Redis Cache activo" wpu eval 'require_once ABSPATH."wp-admin/includes/plugin.php"; $r = activate_plugin("redis-cache/redis-cache.php"); if (is_wp_error($r)) { echo $r->get_error_message(); exit(1); }'
  passo "prefixo do Redis" cfg WP_REDIS_PREFIX "$PREFIXO"
  passo "esvaziar só as chaves do site" cfg WP_REDIS_SELECTIVE_FLUSH true --raw
  passo "validade das chaves (7 dias)" cfg WP_REDIS_MAXTTL 604800 --raw
  passo "cache de objectos ligada" wpu redis enable
else
  echo "[AVISO] Redis não responde: cache de objectos por ligar"
fi

touch "$WP_PATH/.wp-cache-bootstrap-done"
chown "$WP_USER:$WP_USER" "$WP_PATH/.wp-cache-bootstrap-done" 2>/dev/null || true

echo "--- estado final"
echo "plugins activos: $(wpu plugin list --status=active --field=name 2>/dev/null | paste -sd' ')"
echo "drop-ins: $(ls "$WP_PATH/wp-content" 2>/dev/null | grep -E '^(object-cache|advanced-cache)\.php$' | paste -sd' ')"
wpu redis status 2>/dev/null | grep -E '^(Status|Drop-in|Errors|Ping):' | sed 's/^/redis: /'
