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

# nice/ionice: o servidor é partilhado, o trabalho de um site não deve atrasar os outros
wpu() { sudo -u "$WP_USER" nice -n 10 ionice -c3 "$WP" --path="$WP_PATH" "$@"; }
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

# VD_SO_REDIS=1: para um site que já tem a cache de objectos em Redis (o drop-in) e só lhe faltam o prefixo próprio, o esvaziar só as chaves
# do site e a validade das chaves. Não mexe em plugins, no mu-plugin nem na cache de página.
if [[ "${VD_SO_REDIS:-}" == "1" ]]; then
  if [[ "$(redis-cli ping 2>/dev/null)" == "PONG" ]]; then
    passo "prefixo do Redis" cfg WP_REDIS_PREFIX "$PREFIXO"
    passo "esvaziar só as chaves do site" cfg WP_REDIS_SELECTIVE_FLUSH true --raw
    passo "validade das chaves (7 dias)" cfg WP_REDIS_MAXTTL 604800 --raw
  else
    echo "[AVISO] Redis não responde: nada a fazer"
  fi
  exit 0
fi

# VD_REPARAR=1: um site que passou de uma conta do servidor para outra (31/10/2026, entrecamposblog.com: de vdadmin para entrecampos). Não mexe em
# plugins, na cache de página nem no Redis: só corrige o que a mudança deixou para trás — (1) o caminho de `uploads` guardado na configuração da
# cache do WP-Optimize (o `open_basedir` da conta nova bloqueia o da conta antiga a cada pedido), (2) os ficheiros de `uploads` que ficaram com
# dono root, (3) o agendador do WordPress passa a ser um cron do sistema, como nos outros sites, e (4) o xmlrpc.php fica bloqueado no nginx se o
# site não usa o Jetpack. As cópias do que muda ficam em $VD_COPIA_DIR (a pasta do workflow); nada se apaga.
if [[ "${VD_REPARAR:-}" == "1" ]]; then
  COPIA="${VD_COPIA_DIR:-/root}"
  UPL="$WP_PATH/wp-content/uploads"
  if wpu plugin is-active wp-optimize >/dev/null 2>&1; then
    wpu option get wpo_cache_config --format=json > "$COPIA/wpo_cache_config.$DOMINIO.json" 2>/dev/null || true
    echo "[..] caminho de uploads na cache do WP-Optimize:"
    wpu eval '
$cfg = WPO_Cache_Config::instance();
$c = $cfg->get();
$novo = wp_normalize_path(wp_upload_dir()["basedir"]);
$velho = isset($c["uploads"]) ? $c["uploads"] : "";
if ($velho === $novo) { echo "já certo: " . $novo; return; }
$c["uploads"] = $novo;
$r = $cfg->update($c);
if (is_wp_error($r)) { echo "erro: " . $r->get_error_message(); exit(1); }
echo "de " . $velho . " para " . $novo;
' 2>&1 | tail -n 3 | cut -c1-240 | sed 's/^/     /'
  else
    echo "[--] WP-Optimize inactivo: nada a corrigir na cache de página"
  fi

  N=$(find "$UPL" -xdev ! -user "$WP_USER" 2>/dev/null | wc -l)
  echo "[..] ficheiros de uploads com outro dono: $N"
  if [[ "$N" -gt 0 ]]; then
    find "$UPL" -xdev ! -user "$WP_USER" -printf '%u:%g %p\n' > "$COPIA/donos.$DOMINIO.txt" 2>/dev/null
    find "$UPL" -xdev ! -user "$WP_USER" -exec chown -h "$WP_USER:$WP_USER" {} + 2>&1 | tail -n 3
    echo "     depois: $(find "$UPL" -xdev ! -user "$WP_USER" 2>/dev/null | wc -l) com outro dono (lista de antes em $COPIA/donos.$DOMINIO.txt)"
  fi

  HESTIA=/usr/local/hestia/bin
  CMD="flock -n /tmp/vd-wpcron-${DOMINIO//[^a-z0-9]/_}.lock nice -n 10 $WP --path=$WP_PATH cron event run --due-now >/dev/null 2>&1"
  EXISTE=$("$HESTIA/v-list-cron-jobs" "$WP_USER" plain 2>/dev/null | grep -F "cron event run" | grep -cF "$WP_PATH")
  if [[ "$EXISTE" -eq 0 ]]; then
    "$HESTIA/v-add-cron-job" "$WP_USER" "4,19,34,49" "*" "*" "*" "*" "$CMD" 2>&1 | tail -n 2
    EXISTE=$("$HESTIA/v-list-cron-jobs" "$WP_USER" plain 2>/dev/null | grep -F "cron event run" | grep -cF "$WP_PATH")
  fi
  if [[ "$EXISTE" -gt 0 ]]; then
    echo "[ok] cron do sistema de 15 em 15 minutos para o WordPress de $DOMINIO"
    passo "DISABLE_WP_CRON (as tarefas passam a correr pelo cron do sistema)" cfg DISABLE_WP_CRON true --raw
  else
    echo "[AVISO] não consegui criar o cron do sistema: o agendador do WordPress fica como estava"
  fi

  LISTA=/etc/nginx/vd-xmlrpc-bloquear.lista
  if wpu plugin is-active jetpack >/dev/null 2>&1; then
    echo "[--] Jetpack activo: o xmlrpc.php não se bloqueia"
  elif [[ -f "$LISTA" ]]; then
    if grep -qx "$DOMINIO" "$LISTA"; then
      echo "[ok] xmlrpc.php: $DOMINIO já está na lista de bloqueio"
    else
      cp -p "$LISTA" "$COPIA/vd-xmlrpc-bloquear.lista.bak" && echo "$DOMINIO" >> "$LISTA" && echo "[ok] xmlrpc.php: $DOMINIO juntado à lista de bloqueio (o instalador aplica em até 10 minutos)"
    fi
  else
    echo "[AVISO] a lista de bloqueio do xmlrpc.php não existe neste servidor"
  fi
  exit 0
fi

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
