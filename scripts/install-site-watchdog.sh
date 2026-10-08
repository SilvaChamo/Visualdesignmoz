#!/bin/bash
# Instala/actualiza um watchdog simples para o site de teste do Contabo.
# Quando o processo Node deixa de responder, o cron reinicia o PM2 e o app
# recupera sem intervenção manual.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="visualdesign-site-teste"
APP_PORT="3002"
APP_HOST="teste.visualdesignmoz.com"
MARKER="# visualdesign-site-watchdog"

CRON_LINE="*/5 * * * * if ! curl -fsS -m 20 -H \"Host: ${APP_HOST}\" http://127.0.0.1:${APP_PORT}/ >/dev/null 2>&1; then pm2 restart ${APP_NAME} >/dev/null 2>&1 || pm2 start npm --name \"${APP_NAME}\" -- start -- -p ${APP_PORT} >/dev/null 2>&1 || true; fi ${MARKER}"

CRON_FILE=$(mktemp)
trap 'rm -f "$CRON_FILE"' EXIT
crontab -l 2>/dev/null | grep -v "$MARKER" > "$CRON_FILE" || true
printf '%s\n' "$CRON_LINE" >> "$CRON_FILE"
crontab "$CRON_FILE"

if ! crontab -l | grep -qF "$MARKER"; then
  echo "ERRO: watchdog do site não ficou instalado" >&2
  exit 1
fi

echo "OK: watchdog do site instalado (verifica cada 5 minutos)."
