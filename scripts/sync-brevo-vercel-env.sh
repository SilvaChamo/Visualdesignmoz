#!/usr/bin/env bash
# Sincroniza variáveis Brevo na Vercel (projecto visualdesigne).
# Uso: bash scripts/sync-brevo-vercel-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BREVO_PASS="${BREVO_SMTP_PASS:-}"
if [[ -z "$BREVO_PASS" && -f .env.local ]]; then
  BREVO_PASS="$(grep -E '^SMTP_MASTER_PASSWORD=' .env.local | head -1 | cut -d= -f2- | tr -d '\"')"
fi
if [[ -z "$BREVO_PASS" && -f .env.local ]]; then
  BREVO_PASS="$(grep -E '^SMTP_PASS=' .env.local | head -1 | cut -d= -f2- | tr -d '\"')"
fi
if [[ -z "$BREVO_PASS" ]]; then
  echo "Defina BREVO_SMTP_PASS ou SMTP_MASTER_PASSWORD (chave xsmtpsib) em .env.local"
  exit 1
fi

upsert() {
  local name="$1" value="$2" sensitive="${3:-}"
  if [[ "$sensitive" == "1" ]]; then
    npx vercel env update "$name" production --value "$value" -y --sensitive 2>&1 || \
    npx vercel env add "$name" production --value "$value" -y --sensitive 2>&1
  else
    npx vercel env update "$name" production --value "$value" -y 2>&1 || \
    npx vercel env add "$name" production --value "$value" -y 2>&1
  fi
  echo "OK: $name"
}

upsert SMTP_HOST smtp-relay.brevo.com
upsert SMTP_PORT 587
upsert SMTP_SECURE false
upsert SMTP_USER ad3ca6001@smtp-brevo.com
upsert "SMTP_PASS" "$BREVO_PASS" 1
upsert DA_SMTP_HOST smtp-relay.brevo.com
upsert DA_SMTP_PORT 587
upsert DA_SMTP_USER ad3ca6001@smtp-brevo.com
upsert "DA_SMTP_PASS" "$BREVO_PASS" 1
upsert SITE_EMAIL_FROM "Visualdesign <noreply@visualdesignmoz.com>"
upsert SITE_NOTIFY_EMAIL geral@visualdesignmoz.com
upsert SITE_SUPPORT_EMAIL suporte@visualdesignmoz.com
upsert SERVER_EMAIL servidor@visualdesignmoz.com
upsert SMTP_MARKETING_FROM geral@visualdesignmoz.com
upsert SMTP_MASTER_EMAIL noreply@visualdesignmoz.com
upsert "SMTP_MASTER_PASSWORD" "$BREVO_PASS" 1
upsert BREVO_SMTP_USER ad3ca6001@smtp-brevo.com
if [[ -n "${BREVO_API_KEY:-}" ]]; then
  upsert "BREVO_API_KEY" "$BREVO_API_KEY" 1
fi
upsert PASSWORD_RESET_USE_SITE_SMTP true
upsert NEXT_PUBLIC_SITE_URL https://visualdesignmoz.com
echo "Feito. Faça Redeploy em Production na Vercel."
