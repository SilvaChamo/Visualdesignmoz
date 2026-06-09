#!/usr/bin/env bash
# Sincroniza credenciais DirectAdmin para Vercel production.
set -euo pipefail
cd "$(dirname "$0")/.."

read_env() {
  grep -E "^${1}=" .env.local | head -1 | cut -d= -f2- | tr -d '"'
}

LOGIN_KEY="$(read_env DIRECTADMIN_LOGIN_KEY)"
HOST="$(read_env DIRECTADMIN_HOST)"
PORT="$(read_env DIRECTADMIN_PORT)"
PROTO="$(read_env DIRECTADMIN_PROTOCOL)"
USER="$(read_env DIRECTADMIN_USER)"

if [[ -z "$LOGIN_KEY" ]]; then
  echo "❌ DIRECTADMIN_LOGIN_KEY em falta em .env.local"
  exit 1
fi

upsert() {
  local name="$1" value="$2" sensitive="${3:-}"
  if [[ "$sensitive" == "1" ]]; then
    npx vercel env update "$name" production --value "$value" -y --sensitive 2>&1 \
      || npx vercel env add "$name" production --value "$value" -y --sensitive 2>&1
  else
    npx vercel env update "$name" production --value "$value" -y 2>&1 \
      || npx vercel env add "$name" production --value "$value" -y 2>&1
  fi
  echo "OK: $name"
}

upsert DIRECTADMIN_HOST "${HOST:-host.visualdesignmoz.com}"
upsert DIRECTADMIN_PORT "${PORT:-2026}"
upsert DIRECTADMIN_PROTOCOL "${PROTO:-https}"
upsert DIRECTADMIN_USER "${USER:-admin}"
upsert DIRECTADMIN_URL "https://${HOST:-host.visualdesignmoz.com}:${PORT:-2026}"
upsert NEXT_PUBLIC_DIRECTADMIN_HOST "${HOST:-host.visualdesignmoz.com}"
upsert NEXT_PUBLIC_DIRECTADMIN_PORT "${PORT:-2026}"
upsert NEXT_PUBLIC_SERVER_IP "37.27.17.25"
upsert DIRECTADMIN_LOGIN_KEY "$LOGIN_KEY" 1

echo "✅ DirectAdmin env na Vercel. Execute: npx vercel --prod"
