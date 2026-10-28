#!/bin/bash
# Instala/actualiza a tarefa periódica dos avisos de força bruta (/api/cron/forca-bruta): de 10 em 10 minutos lê os
# IPs bloqueados pelo fail2ban do Hestia e põe uma mensagem nas Mensagens dos administradores quando há novos —
# como o DirectAdmin fazia no Hetzner. Corre a partir do deploy-visualdesign.yml, depois do build+restart, como os
# outros install-*-cron.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

CRON_SECRET_VALUE=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)
if [ -z "$CRON_SECRET_VALUE" ]; then
  echo "ERRO: CRON_SECRET vazio em .env.local" >&2
  exit 1
fi

MARKER="# visualdesign-forca-bruta"
# Host explícito (sem ele o Next.js responde com um redirect para si mesmo — ver instalar-cron-servidor.sh)
CRON_LINE="*/10 * * * * curl -fsS -H \"Host: visualdesignmoz.com\" -H \"Authorization: Bearer ${CRON_SECRET_VALUE}\" http://127.0.0.1:3002/api/cron/forca-bruta >> /var/log/visualdesign-cron.log 2>&1 ${MARKER}"

CRON_FILE=$(mktemp)
trap 'rm -f "$CRON_FILE"' EXIT
crontab -l 2>/dev/null | grep -v "$MARKER" > "$CRON_FILE" || true
echo "$CRON_LINE" >> "$CRON_FILE"
crontab "$CRON_FILE"

if ! crontab -l | grep -qF "$MARKER"; then
  echo "ERRO: linha de cron dos avisos de força bruta não ficou instalada" >&2
  exit 1
fi

echo "OK: cron dos avisos de força bruta instalado."
