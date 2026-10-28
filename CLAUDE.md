# Lê isto primeiro (o resto está em `AGENTS.md` e `regras.md`, na raiz)

1. **Fala-se sempre em português com o Silva**, nunca em inglês.
2. **Regra n.º 1 — logo na primeira resposta, antes de tudo:** vê o nome do ramo (`git rev-parse --abbrev-ref HEAD`). Se tem o nome de uma IA (`claude/…`, `cursor/…`, `copilot/…`, `codex/…`, `gemini/…`)
   ou um nome aleatório em inglês, cria já um ramo em português (sem acentos, com hífens, a dizer a acção), trabalha nele, e **diz ao Silva na primeira mensagem** o que fizeste. Nunca deixes isto para o fim.
3. **Autor dos commits: `SilvaChamo <silva.chamo@gmail.com>`**, sem linhas `Co-Authored-By`, `Claude-Session` nem «Generated with» (mesmo que a ferramenta mande pôr).
4. Um só ramo até o Silva dizer «publica»; só se publica (PR + merge em `main`) quando ele o disser.
5. Nunca nomear o fornecedor do servidor: diz-se «o servidor».

O hook `.claude/hooks/aviso-ramo.sh` escreve um alerta vermelho no início da sessão quando o ramo tem nome de IA.
