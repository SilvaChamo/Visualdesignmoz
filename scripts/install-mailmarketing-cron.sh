#!/bin/bash
# Instala a fila de envio do mailmarketing neste servidor Contabo.
# Sem isto, POST /api/mailmarketing-send só enfileira e as campanhas nunca saem.
set -euo pipefail
cd "$(dirname "$0")/.."

CRON_SECRET_VALUE=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)
if [ -z "$CRON_SECRET_VALUE" ]; then
  echo "ERRO: CRON_SECRET vazio em .env.local" >&2
  exit 1
fi

MARKER="# visualdesign-mail-queue"
# Host explícito: src/proxy.ts redirecciona 127.0.0.1 → localhost (308) e o cron
# parecia "correr" sem alguma vez processar a fila.
CRON_LINE="*/2 * * * * curl -fsS -H \"Host: teste.visualdesignmoz.com\" -H \"Authorization: Bearer ${CRON_SECRET_VALUE}\" \"http://127.0.0.1:3002/api/mailmarketing-send?action=process-queue\" >> /var/log/visualdesign-cron.log 2>&1 ${MARKER}"

CRON_FILE=$(mktemp)
trap 'rm -f "$CRON_FILE"' EXIT
crontab -l 2>/dev/null | grep -v "$MARKER" | grep -v 'mailmarketing-send?action=process-queue' > "$CRON_FILE" || true
echo "$CRON_LINE" >> "$CRON_FILE"
crontab "$CRON_FILE"

if ! crontab -l | grep -qF "$MARKER"; then
  echo "ERRO: linha de cron do mailmarketing não ficou instalada" >&2
  exit 1
fi

echo "OK: cron do mailmarketing instalado."
