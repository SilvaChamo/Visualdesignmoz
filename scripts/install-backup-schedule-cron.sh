#!/bin/bash
# Instala/actualiza a tarefa periódica que corre os agendamentos de backup
# (panel_backup_schedules) — antes desta linha não existia em NENHUM dos
# dois servidores (Hetzner nem Contabo): o endpoint /api/cron/run-backup-schedules
# já existia mas nunca era chamado por ninguém, por isso nenhum agendamento
# de backup alguma vez corria sozinho. Corre a partir do próprio
# deploy-contabo.yml, sempre depois do build+restart — mesmo padrão de
# install-hestia-cron.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

CRON_SECRET_VALUE=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)
if [ -z "$CRON_SECRET_VALUE" ]; then
  echo "ERRO: CRON_SECRET vazio em .env.local" >&2
  exit 1
fi

MARKER="# visualdesign-backup-schedules"
# Host explícito: sem isto o Next.js devolve um redirect 308 para si mesmo em
# vez de correr a rota (mesma armadilha documentada em install-hestia-cron.sh).
# De 15 em 15 min — suficiente para nunca atrasar um agendamento por mais de
# 15 min sem sobrecarregar o servidor com backups completos de conta.
CRON_LINE="*/15 * * * * curl -fsS -H \"Host: teste.visualdesignmoz.com\" -H \"Authorization: Bearer ${CRON_SECRET_VALUE}\" http://127.0.0.1:3002/api/cron/run-backup-schedules >> /var/log/visualdesign-cron.log 2>&1 ${MARKER}"

CRON_FILE=$(mktemp)
trap 'rm -f "$CRON_FILE"' EXIT
crontab -l 2>/dev/null | grep -v "$MARKER" > "$CRON_FILE" || true
echo "$CRON_LINE" >> "$CRON_FILE"
crontab "$CRON_FILE"

if ! crontab -l | grep -qF "$MARKER"; then
  echo "ERRO: linha de cron dos agendamentos de backup não ficou instalada" >&2
  exit 1
fi

echo "OK: cron dos agendamentos de backup instalado."
