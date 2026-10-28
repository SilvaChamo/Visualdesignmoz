#!/bin/bash
# Instala/actualiza a tarefa periódica que sincroniza o estado real do Hestia
# (contas/domínios/quotas) de volta para o espelho Supabase. Corre a partir
# do próprio deploy-visualdesign.yml, sempre depois do build+restart.
#
# Extraído do workflow para um ficheiro real de propósito: a versão anterior
# construía a linha de cron inline dentro do YAML (heredoc + pipe + aspas
# aninhadas) e falhava silenciosamente dentro do appleboy/ssh-action de forma
# não reproduzível manualmente por SSH directo — mover para um script normal,
# testável sozinho, elimina essa camada de fragilidade.
set -euo pipefail
cd "$(dirname "$0")/.."

CRON_SECRET_VALUE=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)
if [ -z "$CRON_SECRET_VALUE" ]; then
  echo "ERRO: CRON_SECRET vazio em .env.local" >&2
  exit 1
fi

MARKER="# visualdesign-hestia-sync"
# Host explícito: sem isto o Next.js devolve um redirect 308 para si mesmo em
# vez de correr a rota — "curl -f" não conta 3xx como erro, por isso isto já
# "funcionou" durante meses sem alguma vez invocar /api/cron/hestia-sync a sério.
CRON_LINE="*/20 * * * * curl -fsS -H \"Host: teste.visualdesignmoz.com\" -H \"Authorization: Bearer ${CRON_SECRET_VALUE}\" http://127.0.0.1:3002/api/cron/hestia-sync >> /var/log/visualdesign-cron.log 2>&1 ${MARKER}"

CRON_FILE=$(mktemp)
trap 'rm -f "$CRON_FILE"' EXIT
crontab -l 2>/dev/null | grep -v "$MARKER" > "$CRON_FILE" || true
echo "$CRON_LINE" >> "$CRON_FILE"
crontab "$CRON_FILE"

if ! crontab -l | grep -qF "$MARKER"; then
  echo "ERRO: linha de cron do hestia-sync não ficou instalada" >&2
  exit 1
fi

echo "OK: cron do hestia-sync instalado."
