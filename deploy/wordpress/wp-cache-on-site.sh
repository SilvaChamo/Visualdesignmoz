#!/bin/bash
# Visual Design — prepara um WordPress no servidor (Silva, 28/10/2026): cache de página (Cache Enabler por omissão desde 31/10/2026; o WP-Optimize só fica onde já estava), cache de objectos
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

# VD_SEM_WPO=1: deixa um site SEM o WP-Optimize (31/10/2026, entrecamposblog.com: sem ele as páginas sem cache passaram de 15-30 s a 1-5 s; nos outros sites com
# WP-Optimize não há esse problema). O plugin só fica desactivado (continua instalado, para voltar atrás com a opção «desfazer_troca»), sai o advanced-cache.php
# dele e o Redis fica como está. Nenhum outro site é tocado.
if [[ "${VD_SEM_WPO:-}" == "1" ]]; then
  cp -p "$WP_PATH/wp-config.php" "${VD_COPIA_DIR:-/root}/wp-config.sem-wpo.$DOMINIO.bak" 2>/dev/null
  wpu plugin deactivate wp-optimize 2>&1 | tail -n 1
  [[ -f "$WP_PATH/wp-content/advanced-cache.php" ]] && grep -q "WP-Optimize" "$WP_PATH/wp-content/advanced-cache.php" 2>/dev/null && rm -f "$WP_PATH/wp-content/advanced-cache.php" && echo "[ok] advanced-cache.php do WP-Optimize retirado"
  cfg WP_CACHE false --raw >/dev/null 2>&1 && echo "[ok] WP_CACHE desligado (sem cache de página)"
  echo "[ok] WP-Optimize desactivado (continua instalado); Redis como estava"
  exit 0
fi
# VD_REPOR_WP_CACHE=1: repõe a linha WP_CACHE no wp-config (31/10/2026: remover o WP-Optimize pelo painel do WordPress apagou-a e a pasta wp-content/cache, e
# sem ela o WordPress não carrega o motor do Cache Enabler: nenhuma página era guardada). Não mexe em mais nada.
if [[ "${VD_REPOR_WP_CACHE:-}" == "1" ]]; then
  cfg WP_CACHE true --raw >/dev/null 2>&1
  echo "[ok] WP_CACHE no wp-config: $(wpu config get WP_CACHE --type=constant 2>/dev/null)"
  exit 0
fi
# VD_TESTE_WPO=1: mede, num só site, quanto demora uma página que NÃO vem da cache (endereço com parâmetro e robots.txt) com o WP-Optimize activo e sem ele,
# e repõe-no (a cache de página volta a ser ligada mesmo que o script seja interrompido). Serve para provar se o WP-Optimize é o que torna o site lento.
if [[ "${VD_TESTE_WPO:-}" == "1" ]]; then
  IPSITE=$(/usr/local/hestia/bin/v-list-web-domain "$WP_USER" "$DOMINIO" json 2>/dev/null | grep -oE '"IP": *"[0-9.]+"' | head -1 | grep -oE '[0-9.]+' | head -1); IPSITE=${IPSITE:-127.0.0.1}
  medir() { local i; for i in 1 2 3; do echo "     ?vd_teste: $(curl -sk -m 40 --resolve "$DOMINIO:443:$IPSITE" -o /dev/null -w '%{http_code} · %{time_total}s' "https://$DOMINIO/?vd_teste=$RANDOM")  ·  robots.txt: $(curl -sk -m 40 --resolve "$DOMINIO:443:$IPSITE" -o /dev/null -w '%{http_code} · %{time_total}s' "https://$DOMINIO/robots.txt?vd_teste=$RANDOM")"; done; }
  repor_wpo() { wpu plugin activate wp-optimize >/dev/null 2>&1; wpu eval 'if (class_exists("WPO_Page_Cache")) { WPO_Page_Cache::instance()->enable(); }' >/dev/null 2>&1; cfg WP_CACHE true --raw >/dev/null 2>&1; echo "[ok] WP-Optimize reposto e cache de página ligada"; }
  echo "[..] COM o WP-Optimize activo (3 pedidos sem cache):"; medir
  trap repor_wpo EXIT
  wpu plugin deactivate wp-optimize 2>&1 | tail -n 1
  echo "[..] SEM o WP-Optimize (3 pedidos sem cache):"; medir
  exit 0
fi
# VD_TROCAR_CACHE=1: troca a cache de página do WP-Optimize pelo Cache Enabler num site (31/10/2026, entrecamposblog.com: o WP-Optimize serve as páginas
# guardadas pelo PHP, por isso com os trabalhadores todos presos até elas ficavam à espera e o site caía). O Cache Enabler guarda cada página em ficheiro e
# umas regras no .htaccess do site fazem o Apache entregá-lo SEM passar pelo PHP (cabeçalho X-VD-Cache: apache); quem tem sessão, comentou, envia dados ou
# usa parâmetros no endereço continua a ir ao PHP. Só mexe neste site; o Redis fica como está. Se a página inicial deixar de dar 200 ou um pedido com
# sessão for servido da cache, repõe o WP-Optimize (VD_DESFAZER_TROCA=1 faz só a reposição). Cópias em $VD_COPIA_DIR; nada se apaga (o WP-Optimize fica instalado).
# Regras no .htaccess do site para o Apache entregar a página guardada pelo Cache Enabler sem passar pelo PHP (cabeçalho X-VD-Cache: apache); quem tem
# sessão, comentou, envia dados, usa parâmetros no endereço ou não aceita text/html vai ao PHP. Põe-nas antes do bloco do WordPress; se já lá estão, não faz nada.
htaccess_cache_enabler() {
  local HT="$WP_PATH/.htaccess"
  if grep -q "# BEGIN VD-Cache-Enabler" "$HT" 2>/dev/null; then
    echo "     as regras já lá estavam"
  else
    BLK=$(mktemp)
    cat > "$BLK" <<'HTBLOCO'
# BEGIN VD-Cache-Enabler
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{REQUEST_METHOD} =GET
RewriteCond %{QUERY_STRING} ^$
RewriteCond %{HTTP:Cookie} !(wp-postpass|wordpress_logged_in|comment_author)_
RewriteCond %{REQUEST_URI} !^/(wp-admin|wp-json|wp-login\.php|xmlrpc\.php|wp-cron\.php)
RewriteCond %{REQUEST_URI} /$
RewriteCond %{HTTP:X-Forwarded-Proto} =https
RewriteCond %{DOCUMENT_ROOT}/wp-content/cache/cache-enabler/%{HTTP_HOST}%{REQUEST_URI}https-index.html -f
RewriteRule ^ /wp-content/cache/cache-enabler/%{HTTP_HOST}%{REQUEST_URI}https-index.html [L,E=VD_CACHE:1]
RewriteCond %{REQUEST_METHOD} =GET
RewriteCond %{QUERY_STRING} ^$
RewriteCond %{HTTP:Cookie} !(wp-postpass|wordpress_logged_in|comment_author)_
RewriteCond %{REQUEST_URI} !^/(wp-admin|wp-json|wp-login\.php|xmlrpc\.php|wp-cron\.php)
RewriteCond %{REQUEST_URI} /$
RewriteCond %{HTTP:X-Forwarded-Proto} !=https
RewriteCond %{DOCUMENT_ROOT}/wp-content/cache/cache-enabler/%{HTTP_HOST}%{REQUEST_URI}index.html -f
RewriteRule ^ /wp-content/cache/cache-enabler/%{HTTP_HOST}%{REQUEST_URI}index.html [L,E=VD_CACHE:1]
</IfModule>
<IfModule mod_headers.c>
Header set X-VD-Cache "apache" env=VD_CACHE
Header set X-VD-Cache "apache" env=REDIRECT_VD_CACHE
</IfModule>
# END VD-Cache-Enabler

HTBLOCO
    NOVO=$(mktemp)
    if grep -q "# BEGIN WordPress" "$HT" 2>/dev/null; then
      awk -v blk="$BLK" '/# BEGIN WordPress/ && !feito { while ((getline l < blk) > 0) print l; feito=1 } { print }' "$HT" > "$NOVO"
    else
      cat "$BLK" "$HT" > "$NOVO" 2>/dev/null || cat "$BLK" > "$NOVO"
    fi
    cat "$NOVO" > "$HT"; rm -f "$BLK" "$NOVO"
    chown "$WP_USER:$WP_USER" "$HT" 2>/dev/null
    echo "     regras postas antes do bloco do WordPress"
  fi
}

# Definições do Cache Enabler para um site de conteúdo: a cache dura 7 dias (168 h) e limpa-se ao mudar de plugin; ao gravar um artigo limpa-se só a página dele e as
# relacionadas (limpar o site inteiro a cada gravação esvaziava a cache sempre que o Elementor ou um plugin grava um artigo). O conteúdo NOVO (publicar, retirar) e os
# menus esvaziam o site inteiro: ver `vd_limpar_cache_do_site` em visualdesign/stack.php. O resto fica nos valores do plugin (sem minificar nada: o Elementor e os temas já o fazem).
configurar_cache_enabler() {
  wpu eval '
$o = get_option("cache_enabler", array());
if (!is_array($o)) { $o = array(); }
$o["cache_expires"] = 1;
$o["cache_expiry_time"] = 168;
$o["clear_site_cache_on_saved_post"] = 0;
$o["clear_site_cache_on_changed_plugin"] = 1;
update_option("cache_enabler", $o);
echo "definições gravadas";
' 2>&1 | tail -n 1
}

# Cache de página por omissão: Cache Enabler (instala, activa, configura e põe as regras). Num site que já tem o WP-Optimize activo mantém-se o que lá está
# (trocar é uma decisão por site: ver VD_TROCAR_CACHE).
instalar_cache_enabler() {
  wpu plugin install cache-enabler --activate 2>&1 | tail -n 2 | cut -c1-200
  wpu plugin is-active cache-enabler >/dev/null 2>&1 || return 1
  garantir_wp_cache
  configurar_cache_enabler
  htaccess_cache_enabler
  return 0
}

desfazer_troca() {
  echo "[ALERTA] a repor o WP-Optimize e a tirar as regras do Cache Enabler"
  [[ -f "$WP_PATH/.htaccess" ]] && sed -i '/# BEGIN VD-Cache-Enabler/,/# END VD-Cache-Enabler/d' "$WP_PATH/.htaccess"
  wpu plugin deactivate cache-enabler >/dev/null 2>&1
  [[ -f "$WP_PATH/wp-content/advanced-cache.php" ]] && grep -q "Cache Enabler" "$WP_PATH/wp-content/advanced-cache.php" 2>/dev/null && rm -f "$WP_PATH/wp-content/advanced-cache.php"
  wpu plugin activate wp-optimize 2>&1 | tail -n 1
  wpu eval 'if (class_exists("WPO_Page_Cache")) { WPO_Page_Cache::instance()->enable(); echo "cache de página do WP-Optimize ligada"; }' 2>&1 | tail -n 1
  cfg WP_CACHE true --raw >/dev/null 2>&1
}
if [[ "${VD_DESFAZER_TROCA:-}" == "1" ]]; then desfazer_troca; exit 0; fi
if [[ "${VD_TROCAR_CACHE:-}" == "1" ]]; then
  COPIA="${VD_COPIA_DIR:-/root}"
  HT="$WP_PATH/.htaccess"
  IPSITE=$(/usr/local/hestia/bin/v-list-web-domain "$WP_USER" "$DOMINIO" json 2>/dev/null | grep -oE '"IP": *"[0-9.]+"' | head -1 | grep -oE '[0-9.]+' | head -1); IPSITE=${IPSITE:-127.0.0.1}
  # o Cache Enabler só guarda pedidos que aceitam text/html (como os navegadores); o curl sem isto manda */* e a página nunca é guardada
  pedir() { curl -sk -m 40 --resolve "$DOMINIO:443:$IPSITE" -H 'Accept: text/html' -H 'Accept-Encoding: gzip' "$@"; }
  cp -p "$HT" "$COPIA/htaccess.$DOMINIO.bak" 2>/dev/null
  wpu plugin list --fields=name,status,version --format=csv > "$COPIA/plugins-troca.$DOMINIO.csv" 2>/dev/null
  echo "[..] 1/5 WP-Optimize desactivado (fica instalado)"
  wpu plugin deactivate wp-optimize 2>&1 | tail -n 1
  [[ -f "$WP_PATH/wp-content/advanced-cache.php" ]] && grep -q "WP-Optimize" "$WP_PATH/wp-content/advanced-cache.php" 2>/dev/null && rm -f "$WP_PATH/wp-content/advanced-cache.php" && echo "     advanced-cache.php do WP-Optimize retirado"
  echo "[..] 2/5 Cache Enabler instalado e activo"
  wpu plugin install cache-enabler --activate 2>&1 | head -n 6 | cut -c1-220 | sed 's/^/     /'
  if ! wpu plugin is-active cache-enabler >/dev/null 2>&1; then
    echo "[ALERTA] o Cache Enabler não ficou activo (mensagem acima)"; desfazer_troca; exit 1
  fi
  cfg WP_CACHE true --raw >/dev/null 2>&1
  echo "     definições do Cache Enabler: $(configurar_cache_enabler)"
  echo "     WP_CACHE: $(wpu config get WP_CACHE --type=constant 2>/dev/null) · advanced-cache.php: $(grep -c "Cache Enabler" "$WP_PATH/wp-content/advanced-cache.php" 2>/dev/null) marca(s) do Cache Enabler"
  echo "[..] 3/5 regras no .htaccess (o Apache entrega a página guardada, sem PHP)"
  htaccess_cache_enabler
  echo "[..] 4/5 a aquecer a cache (3 visitas à página inicial)"
  for i in 1 2 3; do pedir -o /dev/null "https://$DOMINIO/"; sleep 2; done
  echo "     ficheiros da cache do Cache Enabler: $(find "$WP_PATH/wp-content/cache/cache-enabler" -type f 2>/dev/null | wc -l)"
  echo "[..] 5/5 provas"
  C0=$(pedir -o /dev/null -w '%{http_code}' "https://$DOMINIO/")
  H1=$(pedir -D - -o /dev/null -w 'TEMPO=%{time_total}\n' "https://$DOMINIO/" | tr -d '\r')
  echo "     página inicial: $C0 · $(echo "$H1" | grep -E '^TEMPO=') · $(echo "$H1" | grep -i '^x-vd-cache' | head -1)"
  if echo "$H1" | grep -qi '^x-vd-cache: apache'; then echo "     [ok] a página guardada é entregue pelo Apache, sem PHP"; else echo "     [AVISO] a página não foi entregue pelo Apache (o Cache Enabler entrega-a pelo PHP, como o WP-Optimize); ver as regras do .htaccess"; fi
  H2=$(pedir -D - -o /dev/null -H 'Cookie: wordpress_logged_in_teste=1' "https://$DOMINIO/" | tr -d '\r')
  H3=$(pedir -D - -o /dev/null "https://$DOMINIO/?teste=1" | tr -d '\r')
  echo "     com sessão simulada: $(echo "$H2" | head -1) · $(echo "$H2" | grep -ci '^x-vd-cache') cabeçalho(s) da cache"
  echo "     com parâmetro no endereço: $(echo "$H3" | head -1) · $(echo "$H3" | grep -ci '^x-vd-cache') cabeçalho(s) da cache"
  if [[ "$C0" != "200" ]]; then echo "[ALERTA] a página inicial deu $C0"; desfazer_troca; exit 1; fi
  if echo "$H2$H3" | grep -qi '^x-vd-cache'; then echo "[ALERTA] um pedido com sessão ou com parâmetros foi servido da cache"; desfazer_troca; exit 1; fi
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

# 3. cache de página: Cache Enabler (activo, configurado e com a entrega pelo Apache). Se o site já tem o WP-Optimize activo, não se mexe (trocar é por site).
if wpu plugin is-active wp-optimize >/dev/null 2>&1; then
  echo "[--] cache de página: este site já tem o WP-Optimize activo e mantém-no (para trocar: VD_TROCAR_CACHE=1)"
  passo "WP_CACHE definido" garantir_wp_cache
else
  passo "Cache Enabler instalado, activo e configurado" instalar_cache_enabler
  echo "     WP_CACHE: $(wpu config get WP_CACHE --type=constant 2>/dev/null) · regras no .htaccess: $(grep -c 'BEGIN VD-Cache-Enabler' "$WP_PATH/.htaccess" 2>/dev/null)"
fi

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
