#!/usr/bin/env bash
# Corre no início de cada sessão (SessionStart). O que escreve aqui entra no contexto do agente.
# Regra n.º 1 do Silva (26/10/2026): nenhum ramo leva o nome de uma IA nem um nome aleatório em inglês.
ramo=$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")

case "$ramo" in
  claude/*|cursor/*|copilot/*|codex/*|gemini/*|*claude*|*cursor*|*copilot*|*codex*|*gemini*)
    ruim=1 ;;
  *) ruim=0 ;;
esac

if [ "$ruim" = 1 ]; then
  printf '\n\033[1;31m=== ALERTA VERMELHO — REGRA N.º 1 DO SILVA ===\033[0m\n'
  printf '\033[1;31mO ramo desta sessão chama-se "%s": tem o nome de uma IA ou um nome aleatório em inglês.\033[0m\n' "$ramo"
  cat <<TXT
ANTES DE QUALQUER OUTRA COISA (antes de ler código, antes de responder ao pedido):
 1. Escolhe um nome em português, sem acentos e com hífens, que diga a acção (ex.: fecho-do-projecto).
 2. git config user.name SilvaChamo && git config user.email silva.chamo@gmail.com
 3. git checkout -b <nome-em-portugues>   (os commits saem desse ramo; nunca "Co-Authored-By" de IA)
 4. Na PRIMEIRA mensagem ao Silva diz, em português: "O ramo da sessão tinha nome de IA (<ramo>); criei <novo>".
    Se a ferramenta te impedir de enviar o ramo novo, diz isso ao Silva na primeira mensagem.
Regras completas: AGENTS.md e regras.md (raiz). Fala-se sempre em português.
TXT
else
  printf 'Ramo da sessão: %s (nome aceitável). Regras: AGENTS.md e regras.md; fala-se sempre em português.\n' "$ramo"
fi
