#!/bin/bash
# MSDN — configurar tradução automática TRP (Google + Argos fallback) + cron.
set -euo pipefail

SITE="${1:-/home/oshercollective/domains/msdnmoz.org/public_html}"
USER="${2:-oshercollective}"
LIMIT="${3:-200}"
GOOGLE_KEY="${4:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARE=/usr/local/share/wordpress-mu-plugins
CRON=/etc/cron.d/vd-trp-auto-translate
ARGOS_DIR=/opt/vd-translate

install -d -m 755 "$SHARE"
install -m 644 "$SCRIPT_DIR/vd-trp-google-translate.php" "$SHARE/"
install -m 644 "$SCRIPT_DIR/vd-trp-argos-translate.php" "$SHARE/"
install -m 644 "$SCRIPT_DIR/vd-trp-mymemory-translate.php" "$SHARE/" 2>/dev/null || true
install -m 755 "$SCRIPT_DIR/vd-argos-translate.py" "$SHARE/"
install -m 755 "$SCRIPT_DIR/vd-argos-batch.py" "$SHARE/"

# Argos offline (fallback gratuito)
if [ ! -x "$ARGOS_DIR/bin/python" ]; then
  python3 -m venv "$ARGOS_DIR"
  "$ARGOS_DIR/bin/pip" install -q --upgrade pip
  "$ARGOS_DIR/bin/pip" install -q argostranslate
  mkdir -p "$ARGOS_DIR/share"
  chmod -R a+rX "$ARGOS_DIR/share" 2>/dev/null || true
  VD_ARGOS_DATA="$ARGOS_DIR/share" "$ARGOS_DIR/bin/python" - <<'PY'
import os
import argostranslate.package as pkg
import argostranslate.settings
argostranslate.settings.package_data_dir = os.environ["VD_ARGOS_DATA"]
pkg.update_package_index()
for p in pkg.get_available_packages():
    if p.from_code == "pt" and p.to_code == "en":
        path = p.download()
        pkg.install_from_path(path)
        print("OK: pacote pt→en instalado em", argostranslate.settings.package_data_dir)
        break
else:
    raise SystemExit("ERRO: pacote pt→en não encontrado")
PY
  chmod -R a+rX "$ARGOS_DIR/share"
fi

# TRP: Google Cloud Translation API
if [ -n "$GOOGLE_KEY" ]; then
  sudo -u "$USER" /usr/local/bin/wp --path="$SITE" eval "
\$s = get_option('trp_machine_translation_settings', []);
\$s['machine-translation'] = 'yes';
\$s['translation-engine'] = 'google_translate_v2';
\$s['google-translate-key'] = '$GOOGLE_KEY';
\$s['automatically-translate-slug'] = 'yes';
\$s['machine_translation_limit_enabled'] = 'no';
update_option('trp_machine_translation_settings', \$s);
echo 'TRP Google configurado\n';
" 2>/dev/null
else
  sudo -u "$USER" /usr/local/bin/wp --path="$SITE" eval "
\$s = get_option('trp_machine_translation_settings', []);
\$s['machine-translation'] = 'yes';
\$s['translation-engine'] = 'google_translate_v2';
\$s['automatically-translate-slug'] = 'yes';
\$s['machine_translation_limit_enabled'] = 'no';
update_option('trp_machine_translation_settings', \$s);
echo 'TRP Google engine activo (key existente)\n';
" 2>/dev/null
fi

# Cron: Google primeiro, Argos se Google falhar; purge cache
cat > "$CRON" <<EOF
# TRP auto-translate MSDN — cada hora, Google API + Argos fallback (~6 min/lote de 200)
0 * * * * root VD_TRP_LIMIT=$LIMIT VD_TRP_DELAY_MS=300 VD_ARGOS_DATA=$ARGOS_DIR/share \\
  /usr/local/bin/wp --path=$SITE --allow-root eval-file $SHARE/vd-trp-google-translate.php >> /var/log/vd-trp-translate.log 2>&1 \\
  || /usr/local/bin/wp --path=$SITE --allow-root eval-file $SHARE/vd-trp-argos-translate.php >> /var/log/vd-trp-translate.log 2>&1; \\
  /usr/local/bin/wp --path=$SITE --allow-root eval "if (class_exists('WPO_Page_Cache')) WPO_Page_Cache::instance()->purge();" >/dev/null 2>&1 || true
EOF
chmod 644 "$CRON"
touch /var/log/vd-trp-translate.log
chmod 644 /var/log/vd-trp-translate.log

# Primeira corrida: Argos (Google pode estar com billing/rate limit)
VD_TRP_LIMIT="$LIMIT" /usr/local/bin/wp --path="$SITE" --allow-root eval-file "$SHARE/vd-trp-argos-translate.php" | tee -a /var/log/vd-trp-translate.log

echo "OK: TRP tradução automática configurada ($CRON)"
