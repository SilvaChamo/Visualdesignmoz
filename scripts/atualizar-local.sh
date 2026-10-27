#!/usr/bin/env bash
# Actualiza o projecto local para um ramo do GitHub SEM parar o servidor (Silva, 27/10/2026: "nem o servidor local pode parar").
# Uso (dentro da pasta visualdesign-producao):  bash scripts/atualizar-local.sh [RAMO] [/caminho-da-pagina]
# Sem RAMO, actualiza o ramo em que está. Também corre com `npm run atualizar`.
# Guarda à parte o que estiver por gravar (git stash, recupera-se com `git stash pop`), põe a pasta no ramo, só faz `npm install`
# se o package-lock.json mudou, só liga o servidor (porta 3003) se estiver parado, e recarrega a aba do Chrome que já tiver
# o localhost:3003 aberto (se não houver, abre a pré-visualização de computador e telemóvel).
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
RAMO="${1:-$(git rev-parse --abbrev-ref HEAD)}"
CAMINHO="${2:-/}"

git stash -u -m "antes de $RAMO"
ANTES=$(git rev-parse HEAD:package-lock.json 2>/dev/null)
git fetch origin "$RAMO" && git checkout -B "$RAMO" "origin/$RAMO" || { echo "Não consegui passar para o ramo $RAMO."; exit 1; }
[ "$ANTES" = "$(git rev-parse HEAD:package-lock.json 2>/dev/null)" ] || npm install || exit 1

if ! lsof -ti tcp:3003 -sTCP:LISTEN >/dev/null; then
  (nohup npm run dev > /tmp/visualdesign-dev.log 2>&1 &)
fi
for _ in $(seq 90); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://localhost:3003$CAMINHO")" != "000" ] && break
  sleep 1
done

# Sem recarregar a página (Silva, 27/10/2026: «aplica as alterações sem ser necessário fazer reload da página… só as mudanças no projecto local»):
# mudar de ramo já chega — o `next dev` apanha os ficheiros alterados e põe-nos na página aberta (Fast Refresh e CSS ao vivo), sem recarregar nem
# perder o que está no ecrã. Por isso, se a aba que já tem o localhost:3003 está na pré-visualização de computador e telemóvel (duas vistas), NÃO se
# lhe toca. Só se uma aba aberta estiver noutra página é que passa, uma vez, para as duas vistas (Silva, 27/10/2026: «duas vistas»); sem aba, abre-se.
ALVO="http://localhost:3003/dev-preview-telemovel?p=$CAMINHO"
ABA=$(osascript \
  -e 'set achou to false' \
  -e 'if application "Google Chrome" is running then' \
  -e 'tell application "Google Chrome"' \
  -e 'repeat with w in windows' -e 'repeat with t in tabs of w' \
  -e 'if achou is false and URL of t contains "localhost:3003" then' \
  -e 'if URL of t does not contain "dev-preview-telemovel" then' -e "set URL of t to \"$ALVO\"" -e 'end if' \
  -e 'set achou to true' -e 'end if' \
  -e 'end repeat' -e 'end repeat' -e 'end tell' -e 'end if' -e 'return achou' 2>/dev/null)
[ "$ABA" = "true" ] || open "$ALVO"
echo "Pronto: $RAMO em http://localhost:3003$CAMINHO (mensagens do servidor em /tmp/visualdesign-dev.log)"
