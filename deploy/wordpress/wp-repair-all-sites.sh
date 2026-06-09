#!/bin/bash
# Repara sites WordPress existentes: remove Akismet/Hello Dolly e actualiza MU-plugin.
set -euo pipefail

REMOVE_SCRIPT="${REMOVE_SCRIPT:-/root/wp-remove-default-plugins.sh}"
LOG="${LOG:-/var/log/wp-repair-default-plugins.log}"

echo "=== $(date -Is) wp-repair-all-sites ===" | tee -a "$LOG"

find /home -path "*/Backup/*" -prune -o -name wp-config.php -type f -print 2>/dev/null | sort -u | while read -r cfg; do
  dir=$(dirname "$cfg")
  user=$(stat -c '%U' "$dir" 2>/dev/null || echo "")
  [[ -z "$user" ]] && continue
  echo "Reparar: $dir (user=$user)" | tee -a "$LOG"
  if [[ -x "$REMOVE_SCRIPT" ]]; then
    "$REMOVE_SCRIPT" "$dir" "$user" >> "$LOG" 2>&1 || echo "AVISO: falhou $dir" | tee -a "$LOG"
  fi
done

echo "=== Concluído $(date -Is) ===" | tee -a "$LOG"
