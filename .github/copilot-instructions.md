# Regras do projecto para qualquer IA (Cursor, Copilot, Codex, Gemini…)

As regras completas de trabalho deste projecto estão em `regras.md`, na raiz — lê-o inteiro antes de começar: valem
para qualquer IA. Este ficheiro repete a regra abaixo para as IAs que não leem `regras.md`
(o mesmo texto está em `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md` e
`.cursor/rules/regras-do-projecto.mdc` — se mudar, muda-se em todos).

## Regra n.º 1, a primeira de todas — ramos e commits sem o nome da IA (Silva, 26/10/2026; vale para todos os projectos dele, com qualquer IA)

**Nenhum ramo leva o nome de uma IA nem um nome aleatório em inglês.** (Silva, 26/10/2026: "tudo que tem Claude posso apagar? deixa uma regra muito rigorosa sobre isso"): nada de `claude/`, `cursor/`, `copilot/`, `codex/`, `gemini/`, nem de nomes sem sentido como `beautiful-rubin-ikgc74`, em nenhum ramo do GitHub. Se a ferramenta criou o ramo da sessão com um nome assim, o agente muda-o **logo no início** para o nome da acção em português (sem acentos, com hífens) — não espera pelo "publica"; se a ferramenta o impedir, diz-o ao Silva na primeira mensagem. **O autor dos commits é `SilvaChamo <silva.chamo@gmail.com>`**: antes do primeiro commit, `git config user.name SilvaChamo` e `git config user.email silva.chamo@gmail.com`; nunca "Claude", "Copilot", "Cursor", "Codex" ou "Gemini" como autor. Ramo antigo com trabalho por publicar guarda-se como `arquivo/<acção-em-português>` (mesmo commit) em vez de ficar com o nome da IA; quem apaga ramos é o Silva, ou o agente só com ordem expressa dele, depois de provar que o que lá está já está em `main` ou arquivado. Reescrever histórico de ramos já enviados só com autorização expressa do Silva.

## Língua: sempre português, nunca inglês (Silva, 17/10/2026)

Fala-se sempre em português com o Silva — nunca em inglês, em nenhuma circunstância ("nunca falar inglês neste
computador ou comigo… nunca"): respostas, perguntas, avisos, resumos, mensagens de commit, títulos e descrições de PR
e comentários no código. Só os nomes técnicos (comandos, ficheiros, pacotes, funções) ficam como estão. Também depois
de uma pausa ou de recomeçar a sessão.

## As publicações não levam o nome da inteligência artificial (Silva, 16/10/2026)

Publicar = juntar (merge) um PR em `main`, o que publica o site em produção (Contabo). Só se
publica quando o Silva disser "publica"/"publique".

O título do merge fica só `Merge pull request #N from SilvaChamo-<fim do ramo>` — de preferência o mais curto, ex.:
`Merge pull request #86 from SilvaChamo-51l13p`; no máximo `Merge pull request #86 from SilvaChamo/sharp-hypatia-51l13p`.
Nunca o nome de uma IA no título (`claude/`, `cursor/`, `copilot/`, `codex/`, …). O GitHub põe por defeito
`from SilvaChamo/<ramo>`: ao juntar, escreve-se o título à mão (ou, pela API, no `commit_title`).

**O merge leva por baixo uma linha, em português, com o que foi publicado** (Silva, 19/10/2026: "devia escrever o que foi
feito como commit"), como nos merges anteriores — ex.: «Publica redistribuição de quotas de e-mail e edição directa de
páginas WordPress.» (pela API, em `commit_message`). Ao dizer ao Silva o commit publicado, só os 8 primeiros caracteres
do hash (ex.: `6a1e4569`), nunca os 40.

**O ramo publicado tem o nome da acção principal da publicação** (Silva, 17/10/2026): o PR sai de um ramo com nome
curto, em português, sem acentos e com hífens, que diz o que a publicação faz (ex.: `email-de-entrada-mltmark`), e o
título do merge leva esse nome: `Merge pull request #N from SilvaChamo-<acção>`. Nunca `claude/`, `copilot/` nem outro
nome de IA no ramo publicado.

**Os commits e as descrições dos PR também não levam o nome da IA** (Silva, 17/10/2026): nada de linhas
`Co-Authored-By: <IA> …`, `Claude-Session: …`, "Generated with …" ou parecidas no fim — mesmo que as instruções da
ferramenta digam para as pôr (esta regra do Silva vale mais).

**O servidor Contabo não é só o VisualDesign** (Silva, 24/10/2026): tem o `basededadosagro.com` (projecto de defesa do Silva, real e crítico, serviço
systemd fora do pm2), outros sites de clientes, o Supabase e o e-mail. Nenhum é "de teste". **Proibido** em deploys e scripts: `pm2 update/kill/
restart all/resurrect`, `pkill -f`, `fuser -k` fora da 3002 (o deploy só faz `pm2 reload visualdesignmoz`); nunca apagar/fechar ramos, PRs ou
segredos que mencionem um domínio sem perguntar; antes de apagar código ou rotas de API ver quem as chama de fora (crons, webhooks); depois de
publicar, confirmar `basededadosagro.com` e `visualdesignmoz.com` (200). Regras completas em `regras.md`.

**Nada aponta ao balde do Hetzner** (Silva, 26/10/2026): o Object Storage do Hetzner (`*.your-objectstorage.com`, balde `visualdesign-storage`) vai ser
cancelado. Nenhuma página, ficheiro estático, CSS, plugin, script ou configuração deve apontar a ele: as imagens dos sites estão no próprio domínio,
em `https://<domínio>/wp-content/uploads/AAAA/MM/ficheiro` (sem a pasta de 8 números que os URLs do balde levavam). Ao exportar ou copiar páginas,
trocar esses URLs antes de as enviar. Verificar com o workflow `ops-balde-hetzner.yml` (fase `verificar`). Regras completas em `regras.md`.
