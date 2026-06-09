#!/usr/bin/env bash
# Executar NO SERVIDOR (como root): bash server-activate-mail-queue.sh
# Ou: APP_DIR=/caminho/da/app bash server-activate-mail-queue.sh
set -euo pipefail

SITE_URL="${SITE_URL:-https://visualdesignmoz.com}"
CRON_EVERY_MIN="${CRON_EVERY_MIN:-2}"

find_app_dir() {
  if [ -n "${APP_DIR:-}" ] && [ -f "$APP_DIR/package.json" ]; then
    echo "$APP_DIR"
    return 0
  fi

  local candidates=()
  if command -v pm2 >/dev/null 2>&1; then
    while IFS= read -r line; do
      [ -n "$line" ] && candidates+=("$line")
    done < <(pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
  for p in json.load(sys.stdin):
    cwd=p.get('pm2_env',{}).get('pm_cwd') or p.get('pm_cwd')
    if cwd: print(cwd)
except Exception: pass
" 2>/dev/null || true)
  fi

  for d in \
    /home/visualdesignmoz.com/public_html \
    /home/visualdesignmoz.com/domains/visualdesignmoz.com/public_html \
    /var/www/visualdesignmoz.com \
    /var/www/html; do
    [ -f "$d/package.json" ] && candidates+=("$d")
  done

  while IFS= read -r d; do
    [ -n "$d" ] && candidates+=("$d")
  done < <(find /home -maxdepth 4 -name package.json -path '*/public_html/package.json' 2>/dev/null | while read -r f; do dirname "$f"; done)

  local seen="" dir
  for dir in "${candidates[@]}"; do
    case "$seen" in *"|$dir|"*) continue ;; esac
    seen="${seen}|$dir|"
    if [ -f "$dir/package.json" ] && grep -q '"next"' "$dir/package.json" 2>/dev/null; then
      echo "$dir"
      return 0
    fi
  done

  for dir in "${candidates[@]}"; do
    [ -f "$dir/package.json" ] && echo "$dir" && return 0
  done
  return 1
}

if ! APP_DIR="$(find_app_dir)"; then
  echo "❌ Não encontrei a app Next.js neste servidor."
  echo ""
  echo "Corra estes comandos e envie o resultado:"
  echo "  pm2 list"
  echo "  pm2 describe visualdesign 2>/dev/null | grep -E 'exec cwd|script path'"
  echo "  ls -la /home/"
  echo "  find /home -maxdepth 3 -name package.json 2>/dev/null | head -20"
  echo ""
  echo "Depois:"
  echo "  APP_DIR=/caminho/correto bash $0"
  exit 1
fi

ENV_FILE="$APP_DIR/.env.local"
echo "📁 App: $APP_DIR"
cd "$APP_DIR"

if [ ! -f "$ENV_FILE" ]; then
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)"

if grep -q '^MAILMARKETING_QUEUE_SECRET=' "$ENV_FILE" 2>/dev/null; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^MAILMARKETING_QUEUE_SECRET=.*|MAILMARKETING_QUEUE_SECRET=$SECRET|" "$ENV_FILE"
  else
    sed -i "s|^MAILMARKETING_QUEUE_SECRET=.*|MAILMARKETING_QUEUE_SECRET=$SECRET|" "$ENV_FILE"
  fi
else
  echo "MAILMARKETING_QUEUE_SECRET=$SECRET" >> "$ENV_FILE"
fi

append_if_missing() {
  local key="$1" val="$2"
  if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}
append_if_missing "MAILMARKETING_BATCH_SIZE" "50"
append_if_missing "MAILMARKETING_BATCH_PAUSE_MS" "500"
append_if_missing "MAILMARKETING_MAX_RETRIES" "3"
append_if_missing "MAILMARKETING_PROCESS_LIMIT" "10"

echo "✅ MAILMARKETING_QUEUE_SECRET em $ENV_FILE"

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart visualdesign 2>/dev/null || pm2 restart all 2>/dev/null || true
  pm2 save 2>/dev/null || true
  echo "✅ PM2 reiniciado"
fi

CRON_LINE="*/${CRON_EVERY_MIN} * * * * curl -fsS \"${SITE_URL}/api/mailmarketing-send?action=process-queue&secret=${SECRET}\" >/dev/null 2>&1"
MARK="# visualdesign-mail-queue"
(crontab -l 2>/dev/null | grep -v "$MARK" | grep -v 'mailmarketing-send?action=process-queue' || true; echo "$CRON_LINE $MARK") | crontab -
echo "✅ Cron (cada ${CRON_EVERY_MIN} min)"

echo ""
echo "Teste:"
echo "curl -s \"${SITE_URL}/api/mailmarketing-send?action=process-queue&secret=${SECRET}\""
echo ""
echo "Segredo (só no servidor): $SECRET"
