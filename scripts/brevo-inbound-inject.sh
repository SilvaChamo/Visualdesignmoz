#!/usr/bin/env bash
# Injeta email recebido (Brevo webhook) na caixa local DirectAdmin/Dovecot
# Uso: echo "$RAW" | brevo-inbound-inject.sh <to> <from> [subject]
set -euo pipefail
TO="${1:?to required}"
FROM="${2:-<>}"
SUBJECT="${3:-(sem assunto)}"
TMP=$(mktemp /tmp/brevo-inject.XXXXXX.eml)
trap 'rm -f "$TMP"' EXIT

{
  printf 'From: %s\n' "$FROM"
  printf 'To: %s\n' "$TO"
  printf 'Subject: %s\n' "$SUBJECT"
  printf 'Date: %s\n' "$(date -R)"
  printf 'Content-Type: text/plain; charset=UTF-8\n\n'
  cat
} > "$TMP"

/usr/sbin/exim -oi -f "$FROM" "$TO" < "$TMP"
echo "injected:$TO"
