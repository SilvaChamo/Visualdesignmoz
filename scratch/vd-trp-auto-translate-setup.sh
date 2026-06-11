#!/bin/bash
# MSDN / TRP — tradução automática gratuita (MyMemory) + cron.
set -euo pipefail

SCRIPT_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/vd-trp-mymemory-translate.php"
SCRIPT_DST=/usr/local/share/wordpress-mu-plugins/vd-trp-mymemory-translate.php
CRON=/etc/cron.d/vd-trp-auto-translate
SITE="${1:-/home/oshercollective/domains/msdnmoz.org/public_html}"
USER="${2:-oshercollective}"
LIMIT="${3:-800}"

install -m 644 "$SCRIPT_SRC" "$SCRIPT_DST"

# Activar auto-tradução TRP (motor custom via script/cron; Google/DeepL keys inválidas)
sudo -u "$USER" /usr/local/bin/wp --path="$SITE" eval '
$s = get_option("trp_machine_translation_settings", []);
$s["machine-translation"] = "yes";
$s["translation-engine"] = "google_translate_v2";
$s["automatically-translate-slug"] = "yes";
$s["machine_translation_limit_enabled"] = "no";
update_option("trp_machine_translation_settings", $s);
' 2>/dev/null || true

# Cron: a cada 2h traduz lote pendente + purge cache
cat > "$CRON" <<EOF
# TRP auto-translate gratuito (MyMemory) — MSDN e futuros sites
0 */2 * * * root VD_TRP_LIMIT=$LIMIT sudo -u $USER /usr/local/bin/wp --path=$SITE eval-file $SCRIPT_DST >> /var/log/vd-trp-translate.log 2>&1; sudo -u $USER /usr/local/bin/wp --path=$SITE wpo cache flush >/dev/null 2>&1 || true
EOF
chmod 644 "$CRON"

# Primeira corrida imediata (vários lotes)
for i in 1 2 3 4 5; do
  VD_TRP_LIMIT="$LIMIT" sudo -u "$USER" /usr/local/bin/wp --path="$SITE" eval-file "$SCRIPT_DST" || true
  sleep 2
done

echo "OK: auto-tradução TRP + cron ($CRON)"
