#!/bin/bash
# Actualiza o projecto local e volta a pôr o servidor a correr, num só comando (Silva, 24/10/2026).
#   bash scripts/atualizar-local.sh            → actualiza o ramo em que está
#   bash scripts/atualizar-local.sh <ramo>     → muda para esse ramo e actualiza
# Pára sozinho o servidor que estiver na porta 3003, instala dependências só se mudaram e arranca o `npm run dev`.
set -e
cd "$(dirname "$0")/.."

RAMO="${1:-$(git rev-parse --abbrev-ref HEAD)}"
git fetch origin "$RAMO"
[ "$(git rev-parse --abbrev-ref HEAD)" = "$RAMO" ] || git checkout "$RAMO"

ANTES="$(git rev-parse HEAD)"
git pull --ff-only origin "$RAMO"

# dependências: só quando o package-lock mudou (ou ainda não há node_modules)
if [ ! -d node_modules ] || ! git diff --quiet "$ANTES" HEAD -- package-lock.json; then
  npm install
fi

# pára o servidor que já estiver a correr na 3003 e começa de novo, com a cache limpa
PIDS="$(lsof -ti tcp:3003 2>/dev/null || true)"
[ -z "$PIDS" ] || kill $PIDS 2>/dev/null || true
rm -rf .next
exec npm run dev
