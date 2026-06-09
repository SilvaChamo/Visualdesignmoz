#!/bin/bash
# Actualiza variáveis Vercel para Supabase Hetzner + SMTP recuperação de senha
# Requer: npx vercel login (uma vez)
# Uso: bash scripts/migrate-vercel-env.sh

set -e
PROJECT="${VERCEL_PROJECT:-visualdesign}"

echo "📦 Projeto Vercel: $PROJECT"
echo "Copie os valores de /opt/supabase-aamihe/docker/.env no servidor Hetzner"
echo ""

read -p "NEXT_PUBLIC_SUPABASE_URL [https://supabase.visualdesignmoz.com]: " SUPA_URL
SUPA_URL=${SUPA_URL:-https://supabase.visualdesignmoz.com}
read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " ANON_KEY
read -sp "SUPABASE_SERVICE_ROLE_KEY: " SERVICE_KEY; echo
read -p "SMTP_USER [noreply@visualdesignmoz.com]: " SMTP_USER
SMTP_USER=${SMTP_USER:-noreply@visualdesignmoz.com}
read -sp "SMTP_PASS (noreply): " SMTP_PASS; echo

for name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  val="${!name}"
  echo "$val" | npx vercel env add "$name" production --force 2>/dev/null || true
done

echo "host.visualdesignmoz.com" | npx vercel env add SMTP_HOST production --force 2>/dev/null || true
echo "587" | npx vercel env add SMTP_PORT production --force 2>/dev/null || true
echo "false" | npx vercel env add SMTP_SECURE production --force 2>/dev/null || true
echo "$SMTP_USER" | npx vercel env add SMTP_USER production --force 2>/dev/null || true
echo "$SMTP_PASS" | npx vercel env add SMTP_PASS production --force 2>/dev/null || true
echo "true" | npx vercel env add PASSWORD_RESET_USE_SITE_SMTP production --force 2>/dev/null || true
echo "https://visualdesignmoz.com" | npx vercel env add NEXT_PUBLIC_SITE_URL production --force 2>/dev/null || true
echo "Visualdesign <noreply@visualdesignmoz.com>" | npx vercel env add SITE_EMAIL_FROM production --force 2>/dev/null || true

echo "✅ Variáveis definidas. Execute: npx vercel --prod"
