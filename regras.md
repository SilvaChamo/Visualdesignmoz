**Este é o ficheiro único de regras do projecto** (Silva, 27/10/2026: «uma regra única para todos os agentes ver, sem nome de nenhuma IA»): toda a regra nova escreve-se só aqui.
`AGENTS.md` é apenas a porta de entrada e não há ficheiros de regras por marca de ferramenta (os de cada marca foram apagados).

# Regra n.º 1, a primeira de todas — ramos e commits sem o nome da IA (Silva, 26/10/2026)

**Vale para todos os projectos do Silva, com qualquer IA** (Claude, Cursor, Copilot, Codex, Gemini…): antes de qualquer outra regra deste ficheiro. **Nenhum ramo leva o nome de uma IA nem um nome aleatório em inglês.** (Silva, 26/10/2026: "tudo que tem Claude posso apagar? deixa uma regra muito rigorosa sobre isso"): nada de `claude/`, `cursor/`, `copilot/`, `codex/`, `gemini/`, nem de nomes sem sentido como `beautiful-rubin-ikgc74`, em nenhum ramo do GitHub. Se a ferramenta criou o ramo da sessão com um nome assim, o agente muda-o **logo no início** para o nome da acção em português (sem acentos, com hífens) — não espera pelo "publica"; se a ferramenta o impedir, diz-o ao Silva na primeira mensagem. **O autor dos commits é `SilvaChamo <silva.chamo@gmail.com>`**: antes do primeiro commit, `git config user.name SilvaChamo` e `git config user.email silva.chamo@gmail.com`; nunca "Claude", "Copilot", "Cursor", "Codex" ou "Gemini" como autor. Ramo antigo com trabalho por publicar guarda-se como `arquivo/<acção-em-português>` (mesmo commit) em vez de ficar com o nome da IA; quem apaga ramos é o Silva, ou o agente só com ordem expressa dele, depois de provar que o que lá está já está em `main` ou arquivado. Reescrever histórico de ramos já enviados só com autorização expressa do Silva.

**Alerta automático no início da sessão (Silva, 28/10/2026: «para ser alerta vermelha»).** O `CLAUDE.md` (raiz) repete a regra em poucas linhas e o hook `SessionStart` (`.claude/settings.json` → `.claude/hooks/aviso-ramo.sh`) escreve um **alerta vermelho** no contexto do agente sempre que o ramo da sessão tem o nome de uma IA. O nome `claude/…` é posto pela plataforma da nuvem antes de o agente arrancar, por isso o agente tem de criar logo o ramo em português e dizê-lo na **primeira** mensagem (nunca só no fim).

# Nunca nomear o fornecedor do servidor (Silva, 27/10/2026)

Em qualquer projecto do Silva, com qualquer IA: nas conversas, relatórios, documentos, commits e PR fala-se sempre **«o servidor»**, nunca o nome da empresa que o aloja
(«o estado real do Contabo» está errado; «o estado real do servidor» está certo). Os nomes técnicos que já existem (ficheiros como `deploy-contabo.yml`, caminhos, secrets) ficam como
estão, mas não se repetem em texto novo. Do Hetzner diz-se só que **já está fechado**, quando for preciso lembrá-lo (README e `regras.md` já o dizem).

# Esta é a pasta de trabalho — e o site em produção

**NOTA PARA QUALQUER AGENTE (19/10/2026) — LER ANTES DE COMEÇAR.** Só existe um ramo que publica: **`main`**, e é o do
**Contabo**. O Hetzner foi desligado e já não faz parte do projecto: os seus workflows, scripts e documentos foram
apagados e o antigo `main` (o do Hetzner) ficou guardado em `arquivo/main-hetzner` — **não usar, não trazer nada de lá
e não propor nem fazer alterações para o Hetzner** (Silva, 19/10/2026: "tudo o que é sobre Hetzner está fechado").
Tudo o que estava no ramo `fix/contabo-websites-audit` está agora em `main` (esse ramo deixa de se usar): se alguma nota,
comando ou memória antiga falar dele, da pasta `../visualdesign`, da pasta `visualdesign-teste` ou do `deploy-hetzner.yml`, está desactualizada.
Se um agente se enganou e trabalhou no sítio errado, não se repete: **trabalha-se sempre num ramo de trabalho e
publica-se por PR para `main`**.

Este projecto (pasta local `visualdesign-producao`, dev server na porta 3003) é onde todo o trabalho acontece.
**O site em produção é o do Contabo** (Silva, 14/10/2026: "esqueça Hetzner… agora o site em produção é da Contabo"; o
servidor foi reforçado para 200 GB de disco, 12 GB de RAM e 6 núcleos): cada push em `main` (ou seja, cada merge de PR)
publica no Contabo (`.github/workflows/deploy-contabo.yml`, que publica com `NEXT_PUBLIC_SITE_URL=https://visualdesignmoz.com`).
Como cada publicação vai directa à produção, a regra "só se publica quando o Silva disser 'publica'" é ainda mais
importante.

A pasta de trabalho no Mac do Silva é `visualdesign-producao` (antes `visualdesign-teste`, que deixa de se usar).

# Actualizar o site local: SEMPRE o script `scripts/atualizar-local.sh`, qualquer agente (Silva, 27/10/2026)

**Para qualquer agente, com qualquer IA: para actualizar o site local usa-se sempre este script** (o mesmo de `npm run atualizar`), nunca comandos soltos, `git pull`, `checkout` à mão nem o «modelo gigante» do ponto 6 (esse só quando o servidor local está encravado e se diz porquê).
O script muda de ramo sem parar o servidor, sem apagar a cache e **sem recarregar a página** (o `next dev` põe as alterações na aba aberta); só liga o servidor se estiver parado, só faz `npm install` se o `package-lock.json` mudou, e abre/mantém a pré-visualização de computador e telemóvel
(`/dev-preview-telemovel`). **O comando que se dá ao Silva** é sempre esta única linha (trocar `RAMO` e o caminho da página):
```
git fetch -q origin RAMO && bash <(git show origin/RAMO:scripts/atualizar-local.sh) RAMO /CAMINHO
```
O agente que tem a pasta local faz o mesmo ele próprio (`bash scripts/atualizar-local.sh RAMO /CAMINHO`). Se o script precisar de mudar, muda-se o script (e esta regra), nunca se dá outro comando.

# O servidor local arranca SÓ com `npm run dev` — nunca com flags nem outro modo (Silva, 28/10/2026)

**Para qualquer agente, com qualquer IA, logo ao entrar no projecto:** o servidor local (porta 3003) é `npm run dev` (que corre `next dev --port 3003` com o Turbopack) e **nada mais**. Nunca `--webpack`, `--turbopack`, outra porta, `npx next dev` nem qualquer flag «para testar».
Porquê: em 28/10/2026 um agente sugeriu `next dev --webpack`; esse modo não compila o projecto (`UnhandledSchemeError: node:child_process`), o servidor ficou a dar erro 500 com as páginas penduradas e o site local ficou em baixo. O `--webpack` só existe no `build` de produção (`npm run build`), nunca em desenvolvimento.

- **Site local em baixo ou a piscar:** não se experimentam modos de arranque. O agente pede primeiro o registo (`tail -50 /tmp/visualdesign-dev.log`) e só depois propõe uma correcção. Quando é preciso reiniciar, dá-se só isto, que fecha o servidor e liga-o outra vez:
  `pkill -9 -f "next dev"; lsof -ti tcp:3003 -sTCP:LISTEN | xargs kill -9 2>/dev/null; sleep 1; rm -rf .next; npm run dev`
- **Não se muda o `dev` do `package.json`** (nem a configuração do Next) para tentar resolver um problema do site local sem o Silva pedir e sem o agente o ter testado na pasta local.
- **Um só servidor por pasta:** antes de ligar outro, ver se a 3003 já responde (`lsof -ti tcp:3003 -sTCP:LISTEN`). Dois `next dev` na mesma pasta disputam a cache `.next` e o site pisca.
- Nunca se dá ao Silva um comando que o agente não tenha confirmado; se não pode testar (agente na nuvem), diz-o.

# Agentes na nuvem (online): conversa curta, tudo nos bastidores (Silva, 23/10/2026)

**Só para os agentes que trabalham online (na nuvem, sem acesso à pasta local).** Os que trabalham no IDE (Cursor, Copilot, Codex, Gemini
no editor) seguem os pontos 2 e 6 de "Como se trabalha com o Silva" como estão. Para o agente na nuvem, esta secção vale sobre qualquer outra
nota deste ficheiro que fale de capturas ou de mensagens de progresso.

- **Nem uma frase entre ferramentas:** o texto fora das chamadas aparece na conversa, por isso não se escreve nada ali (nem "vou ver…", nem "falta…"). O único texto é o relatório final.
- **Tudo nos bastidores:** ler, editar, medir, testar e corrigir sem escrever mensagens de progresso, sem explicar etapas e sem mostrar
  medições, código ou comandos pelo caminho. A conversa fica curta: o Silva não quer uma conversa longa para ler.
- **Ao concluir, só duas coisas:** as capturas de ecrã do resultado (computador e telemóvel, do painel verdadeiro com dados fictícios) e um
  resumo **em muito poucas palavras** — o que mudou, onde, e numa linha o que ficou por decidir. Nunca mostrar capturas antes de a alteração estar
  concluída (uma captura a meio parece uma alteração já feita).
- **Não perguntar** o que se pode decidir com bom senso; nunca repetir o que o Silva acabou de dizer.
- **Ao publicar:** na mesma mensagem, só o commit, o estado do deploy e o comando único de actualização local (ponto 6).
- **O comando de actualização local só se dá quando o Silva o pede ou diz "publica"/"publique"** (Silva, 23/10/2026: "eu vou pedir o código, não é sempre que deves dar-me"). Nos relatórios a meio não se manda comando nenhum.

# O servidor Contabo não é só o VisualDesign: como não estragar nada (Silva, 24/10/2026 — lição de um 502 de 33 horas)

**O que aconteceu:** a 23/10 às 14:26 o deploy correu `pm2 update` (conversão para "sem corte") e parou, sem ninguém reparar, o
`basededadosagro.com` — o projecto de defesa do Silva, já apresentado ao MADER, tão importante como o VisualDesign — e o seu robô de
sincronização. Ficou em 502 até 24/10 à noite. Depois, numa limpeza, apagaram-se ramos e fechou-se um PR sobre esse domínio por o tomarem
por "de teste". Nada disto pode voltar a acontecer. Quem mexer em deploy, servidor, ramos, PRs ou segredos lê isto primeiro.

1. **O servidor tem muito mais do que o VisualDesign:** `basededadosagro.com` (serviço do sistema `basededadosagro-site`, porta 3010, FORA do pm2),
   `aamihe.com`, `oshercollective.com`, `mltmark.com` e outros sites de clientes, o Supabase (Docker), o e-mail (Hestia) e o nginx. **Nenhum é "de
   teste".** Antes de apagar, fechar ou mexer em qualquer coisa que mencione um domínio ou site, vê o que é e **pergunta ao Silva**.
2. **O deploy só pode mexer na app `visualdesignmoz`** (`pm2 reload visualdesignmoz`). **Proibido** nos deploys, scripts e workflows:
   `pm2 update`, `pm2 kill`, `pm2 restart all`, `pm2 delete all`, `pm2 resurrect`, `pkill -f`, `killall`, `fuser -k` fora da porta 3002,
   `systemctl restart nginx`/`stop` de serviços que não sejam do VisualDesign. O pm2 é partilhado: um `pm2 update` mata tudo o que não esteja
   no `dump.pm2`. Uma app nova do servidor corre **fora do pm2 e do deploy do VisualDesign** (unidade systemd própria, `Restart=always`).
3. **Depois de qualquer publicação ou mudança no servidor, confirma `https://basededadosagro.com` e `https://visualdesignmoz.com` (200).** O deploy
   já o faz no fim (passo "Verificar os outros sites") e falha se o basededadosagro não responder. Nunca digas "publicado" sem isto.
4. **Ações no servidor** só por workflows com a chave que já existe, só com pedido explícito do Silva, **só leitura primeiro**, e sem imprimir
   variáveis nem chaves. Ramos temporários de operações apagam-se no fim.
5. **Antes de apagar código:** análise do que ainda o usa (importações **e** quem o chama de fora: crons do servidor, outros sites, webhooks,
   `next.config`), `tsc`, `next build` completo, ensaio local das rotas e redirecção do que existia. **Uma rota de API sem chamadores no
   repositório pode ser chamada de fora**; `/api/cron/*`, webhooks, auth, checkout e autoconfig de e-mail nunca se apagam sem confirmar.
6. **Antes de publicar:** etiqueta `antes-<nome>` no `main` (para voltar atrás), um grupo de cada vez, e verificar depois. Mudar o deploy ou o proxy
   exige o ensaio (`ensaio=true`) e o ensaio local do proxy.
7. **Apagar ramos/PRs/segredos:** só o que se provou que é do VisualDesign e está obsoleto; guardar os SHAs; nunca `git push --delete` em massa sem
   ler a lista; um PR fechado reabre-se se o ramo existir.
8. **Contas e dados reais** (domínios em `domain_renewals`, contas Hestia, e-mails) nunca se alteram nem apagam por "limpeza".

# Nada aponta ao balde do Hetzner (Silva, 26/10/2026: "nada deve apontar ao balde do hetzner")

O Object Storage do Hetzner (balde `visualdesign-storage`, endereços `*.your-objectstorage.com`) vai ser cancelado. Os sites WordPress do servidor
(mltmark.com, oshercollective.com, lirandzojewelry.com, msdn-moz.org) já foram passados para o Contabo e já não o usam.

- **Nada** deve apontar a ele: páginas, ficheiros estáticos (HTML exportado, CSS, JS), plugins, mu-plugins, `.htaccess`, `wp-config`, scripts, e-mails.
  Não criar plugins nem scripts novos para o balde (os antigos saíram do git a 26/10/2026; ficam no histórico).
- As imagens e ficheiros de cada site estão no próprio domínio: `https://<domínio>/wp-content/uploads/AAAA/MM/ficheiro.ext`. Os URLs do balde levavam
  uma pasta de versão de 8 números a mais (`.../2026/08/02115232/ficheiro.webp`); essa pasta não existe no disco do Contabo.
- **Ao exportar ou copiar uma página** (HTML estático, clone, página "legacy"), trocar primeiro os URLs do balde pelos do próprio domínio. Aconteceu a
  26/10/2026: a página estática `oshercollective.com/legacy/` foi regravada três vezes, pela conta do próprio site (não pelo deploy nem pelo GitHub),
  sempre com o ícone do balde, a partir de uma cópia antiga. Ficou uma nota em comentário HTML nessa página.
- **O gestor de ficheiros do painel já não deixa entrar links do balde** (Silva, 26/10/2026: "resolva o problema do gestor de ficheiros para nunca mais voltar a
  acontecer, mas manter o ícone presente"). Ao guardar no editor ou enviar um ficheiro de texto (`.html`, `.htm`, `.css`, `.js`, `.json`, `.svg`, `.xml`, `.php`,
  `.txt`, `.md`), troca os links do balde pelos do próprio site (`https://<domínio>/wp-content/uploads/AAAA/MM/ficheiro`, sem a pasta de 8 números) quando o
  ficheiro existe em `web/<domínio>/public_html/wp-content/uploads` da conta; o ícone e as imagens continuam presentes. Se o ficheiro não existir, o link fica
  e o ecrã avisa. Código: `balde_fora` em `src/lib/vhost-ficheiros-py.ts` (corre como o utilizador da conta). Não olha dentro de arquivos `.zip` extraídos.
- **Como verificar** (só lê): workflow manual `ops-balde-hetzner.yml`, fase `verificar` (todas as páginas de todos os WordPress: links ao balde,
  ficheiros de `uploads` que não dão 200, sobras do Hetzner) e fase `varrer` (ficheiros do servidor que ainda mencionam o balde, crons, scripts
  instalados). A fase `migrar` (um domínio) traz do balde o que faltar e tira o Offload Media e os plugins do Hetzner; `limpar` apaga cópias de
  `wp-config` que mencionem o balde. Cópias de segurança de cada acção em `/root/balde-hetzner-troca/`, com os comandos para desfazer no registo.
- **Decisão do Silva (26/10/2026): não é preciso listar o que mais existe no balde** ("se nada está ligado ao balde e está a funcionar perfeitamente, não falta nada; já se fez esta medição milhões de vezes").
  O que conta é que nada aponte a ele e tudo funcione: `verificar` dá 0 links e 0 ficheiros em falta. As cópias antigas em `/root` que o mencionam
  (`backup_sync_20261012`, `backups-removidos`, `vh-passagens`, `aamihe-contabo-prewipe-20260906`) são cópias de segurança e não ligam nada ao balde.

# Como o site é publicado sem corte (Silva, 23/10/2026)

O deploy é só o `.github/workflows/deploy-contabo.yml`, automático a cada merge em `main`; não se publica à mão no servidor.

- Cada publicação é uma pasta nova em `/opt/visualdesign-releases/<data>`; `/opt/visualdesignmoz` é um atalho para a versão em uso. O site corre em pm2
  "cluster" com 1 processo (nome `visualdesignmoz`) e o `pm2 reload` põe a versão nova no ar antes de a antiga sair: sem corte.
- Se a versão nova não responder, o deploy volta sozinho à anterior e falha. Ficam as 3 versões mais recentes.
- **O site constrói-se no GitHub, não no servidor** (Silva, 24/10/2026: deploy de ~15 para ~4 a 5 minutos). O GitHub copia o `.env.local` do servidor (as
  `NEXT_PUBLIC_*` ficam dentro do código do site), constrói, e o rsync leva o `.next` (sem a cache); o servidor só instala as dependências (reaproveita o
  `node_modules` da versão em uso quando o `package-lock.json` e o Node não mudaram) e troca de versão. Nunca voltar a construir no servidor (a
  prioridade mínima fazia o mesmo build demorar 8 a 9 minutos). Uma variável `NEXT_PUBLIC_*` nova põe-se no `.env.local` do servidor (ou num `set_env_var` do
  passo "Prepare server environment"), nunca só no GitHub.
- **Ensaio sem publicar:** Actions › Deploy Visualdesign › Run workflow com `ensaio` marcado (qualquer ramo): constrói, envia e arranca a versão nova na
  porta 3099 para ver se responde, sem migrações e sem tocar no site, no pm2 nem no atalho. Fazer sempre que se mexer em `deploy-contabo.yml`.
- **Para voltar atrás:** antes de publicar um grupo, marca-se o `main` com uma etiqueta `antes-<nome>` (ex.: `antes-grupo-2`). Se algo correr mal, reverte-se o
  merge no GitHub (botão Revert do PR) e o deploy repõe o site em ~5 minutos; a reversão automática do deploy só apanha o site que deixa de responder.
- **Nunca** correr `pm2 restart/stop/delete` nem mexer na pasta ou no atalho à mão com o site no ar (isso corta o site); nunca voltar a pôr o site em
  modo "fork" nem com mais de 1 processo (o painel guarda estado em memória, ex.: códigos de 2 passos).
- O site já não se chama "teste" (só `teste.visualdesignmoz.com` mantém o nome, é um domínio do servidor). Não reintroduzir "teste" em pastas, apps ou scripts.

# Língua: sempre português, nunca inglês (Silva, 17/10/2026 — regra rigorosa)

**Fala-se sempre em português com o Silva — nunca em inglês**, em nenhuma circunstância (Silva, 17/10/2026: "nunca
falar inglês neste computador ou comigo… nunca"). Vale para tudo o que ele lê: respostas na conversa, perguntas,
avisos de progresso ("estou a…"), resumos, tabelas, mensagens de commit, títulos e descrições de PR, comentários no
código e nomes de passos das tarefas do servidor. Só ficam como estão os nomes técnicos que não se traduzem (comandos,
nomes de ficheiros, de pacotes e de funções). Também depois de uma pausa, de um resumo da conversa ou de recomeçar a
sessão: retomar sempre em português. Vale para qualquer agente (as regras de baixo estão também em `AGENTS.md`, a porta de entrada).

# Como se trabalha com o Silva (combinado a 13/10/2026)

1. O trabalho novo faz-se num ramo de trabalho (o do agente; nunca directamente em `main`).
2. Antes de publicar, se o agente tem acesso directo à pasta `visualdesign-producao`, ele próprio põe o projecto no
   ramo de trabalho, abre/actualiza a pré-visualização com computador e telemóvel e diz ao Silva onde se mexeu — nunca
   lhe manda comandos para actualizar a pasta local (Silva, 18/10/2026). **Sem screenshots** (Silva, 15/10/2026:
   "a partir de já não me dê mais screenshots, eu vou mandar para você") e **nunca ficheiros HTML de pré-visualização**
   (Silva, 13/10/2026: "só me confunde"). Se o agente não tem acesso local, pode indicar o comando conforme o ponto 6.
3. **Só se publica quando o Silva disser "publica"/"publique"** — é a chave para lançar as correcções. Publicar =
   PR do ramo de trabalho para `main` + merge (o deploy no Contabo corre sozinho).
4. Alterações ao servidor também são descritas primeiro e só avançam com o "avança"/"publica" dele.
5. **Sempre que o Silva disser "publica"/"publique"**, depois de publicar, mandar-lhe o commit publicado (o hash do
   merge em `main`) e confirmar o resultado do deploy. **Nunca lhe mandar comandos para actualizar
   o projecto local quando o agente tem acesso directo à pasta `visualdesign-producao`: o próprio agente faz e verifica
   a actualização local.** Só o agente que trabalha online sem acesso ao projecto local pode mandar esses comandos
   (Silva, 18/10/2026).
6. **Quando o agente trabalha online sem acesso ao projecto local e precisa de indicar uma actualização, o comando vai
   sempre num único comando — e só um por mensagem** (Silva, 14/10/2026:
   "tem que parar o servidor, publicar e arrancar com um comando, nas próximas vezes") — que fecha o servidor que estiver na porta 3003,
   guarda à parte alterações locais por gravar (stash, recuperáveis com `git stash pop`), põe a pasta exactamente no
   ramo do GitHub e volta a arrancar o servidor (pedido do Silva, 13/10/2026 — o `checkout`/`pull` simples falhava e o
   site local não actualizava). Modelo (trocar `RAMO`), corrido dentro da pasta `visualdesign-producao`:
   ```
   pkill -9 -f "next dev --port [3]003"; lsof -ti tcp:3003 -sTCP:LISTEN | xargs kill -9 2>/dev/null; sleep 1; git stash -u -m "antes de RAMO"; git fetch origin RAMO && git checkout -B RAMO origin/RAMO && npm install && rm -rf .next && (nohup npm run dev > /tmp/visualdesign-dev.log 2>&1 &) && for i in $(seq 60); do lsof -ti tcp:3003 -sTCP:LISTEN >/dev/null && break; sleep 1; done; echo "Servidor ligado: http://localhost:3003 (mensagens do servidor em /tmp/visualdesign-dev.log)"; [ "$(osascript -e 'set achou to false' -e 'if application "Google Chrome" is running then' -e 'tell application "Google Chrome"' -e 'repeat with w in windows' -e 'repeat with t in tabs of w' -e 'if URL of t contains "localhost:3003" then' -e 'reload t' -e 'set achou to true' -e 'end if' -e 'end repeat' -e 'end repeat' -e 'end tell' -e 'end if' -e 'return achou' 2>/dev/null)" = "true" ] || open http://localhost:3003/dev-preview-telemovel
   ```
   O fecho começa pelo `next dev` (o processo pai, `pkill -f`; o `[3]` impede o comando de se apanhar a si próprio) e
   só depois o servidor que escuta na 3003 (`-sTCP:LISTEN`, para não apanhar as ligações do navegador), à força
   (`kill -9`) e com 1 s de espera. Fechar só a porta não chegava: o `next dev` voltava a arrancar o servidor e a porta
   continuava ocupada (`EADDRINUSE`), e o Silva tinha de o desligar à mão (Silva, 14/10/2026). O servidor arranca em
   segundo plano (`nohup`, mensagens em `/tmp/visualdesign-dev.log`, ver com `tail -f /tmp/visualdesign-dev.log`), por
   isso a janela do Terminal fica livre para o comando seguinte; o comando espera que a porta 3003 abra e abre o site
   no navegador — **na aba que já estiver aberta** (recarrega as abas do Chrome com `localhost:3003`; nunca abre aba
   nova quando já há uma — Silva, 15/10/2026: "não crie outra aba, actualiza o aberto"). **Quando não há nenhuma, abre sempre a pré-visualização de computador e telemóvel
   lado a lado numa só aba: `http://localhost:3003/dev-preview-telemovel`** (computador à esquerda, moldura de
   telemóvel à direita, a mesma página nas duas, larguras 320/390/430 e "Seguir a navegação"; só existe com
   `npm run dev`) — regra estrita do Silva (15/10/2026: "a previsualização de computador e mobile no navegador deve ser
   estritamente e rigorosamente cumprido nos comandos"; "eu quero esta visualização"). Nenhum agente a pode tirar do
   modelo, dos comandos que manda nem do projecto (`src/app/dev-preview-telemovel/`). Para abrir logo uma página
   nas duas molduras, junta-se `?p=/caminho` ao endereço (ex.: `?p=/pagina-em-construcao/index.html`). Da primeira vez o macOS pergunta se o Terminal pode controlar o Chrome:
   responder "OK".
   O `rm -rf .next` apaga a cache do servidor local antes de arrancar (uma cache velha depois de mudar de ramo fazia o
   site local piscar e não abrir — Silva, 14/10/2026); a primeira página demora um pouco mais a compilar.
   **Actualizar não pára nada** (Silva, 27/10/2026: "o site online não pode se desligar porque está a actualizar… nem o servidor local pode parar… nem se pode ver que o site está a ser actualizado"):
   o comando por omissão **não fecha o servidor local nem apaga o `.next`** — muda de ramo e o `next dev` apanha as mudanças sozinho (a página recarrega, sem paragem); só faz `npm install` se o
   `package-lock.json` mudou; só liga o servidor se a porta 3003 estiver parada. A lógica está em `scripts/atualizar-local.sh` (o mesmo de `npm run atualizar`), por isso o comando que se
   dá ao Silva é **curto, numa linha** (trocar `RAMO` e o caminho da página; vai buscar o script ao próprio ramo, para funcionar mesmo que a pasta local ainda não o tenha):
   ```
   git fetch -q origin RAMO && bash <(git show origin/RAMO:scripts/atualizar-local.sh) RAMO /CAMINHO
   ```
   **Sempre as duas vistas, sem recarregar** (Silva, 27/10/2026: «duas vistas»; «aplica só as mudanças no projecto local, sem reload da página»): mudar de ramo chega, o `next dev` põe as alterações na página aberta sozinho (sem recarregar). Uma aba que já esteja em `/dev-preview-telemovel` **não se toca**; uma aba aberta noutra página passa, uma vez, para `/dev-preview-telemovel?p=/CAMINHO` (computador e telemóvel lado a lado); sem aba, abre-se. O comando completo acima (fecha, apaga a cache e liga) fica só para quando o servidor está encravado ou não responde, e diz-se ao Silva porquê. Nunca dar o modelo gigante por omissão.
   Online já é assim: o deploy constrói no GitHub, põe a versão nova numa pasta à parte e o `pm2 reload visualdesignmoz` só troca quando a nova já escuta (sem ecrã branco, ver `deploy-contabo.yml`);
   nenhuma alteração ao deploy pode introduzir paragem, `pm2 restart` ou `rm -rf .next` na pasta em uso.
6b. **Um único ramo até o Silva dizer «publica»** (Silva, 27/10/2026: «todos os assuntos que eu te peço para fazer coloque no mesmo ramo até eu dizer publique»; «costuma fazer tudo num único ramo para não termos que passar por isso»).
   Todos os pedidos de uma sessão vão para o mesmo ramo, um commit por assunto, sem criar um ramo novo por pedido (isso obrigava o Silva a actualizar o computador ramo a ramo). O ramo tem nome em
   português com a acção principal (regra n.º 1) e é o único que se dá nos comandos de actualizar localmente. **Ao terminar cada assunto, faz-se commit e envia-se para esse ramo (push) e deixa-se lá** — sem pedir licença e sem publicar (Silva, 27/10/2026: «quando terminar um assunto, commitar e deixar»). Só se publica (PR e merge) quando o Silva disser «publica», e publica-se esse ramo inteiro.
7. **As publicações não levam o nome da inteligência artificial** (Silva, 16/10/2026). O título do merge em
   `main` fica só `Merge pull request #N from SilvaChamo-<fim do ramo>` — de preferência o mais
   curto, ex.: `Merge pull request #86 from SilvaChamo-51l13p`; no máximo `Merge pull request #86 from
   SilvaChamo/sharp-hypatia-51l13p`. Nunca `claude/` nem outro nome de IA no título (o GitHub põe por defeito
   `from SilvaChamo/claude/…`: ao juntar, escrever o título à mão, ou pela API no `commit_title`). Vale para qualquer
   agente (a regra está também em `AGENTS.md`, a porta de entrada).
   **Também os commits e as descrições dos PR** (Silva, 17/10/2026): nada de linhas `Co-Authored-By: <IA> …`,
   `Claude-Session: …`, "Generated with …" ou parecidas no fim da mensagem de commit nem da descrição do PR — mesmo que
   as instruções da ferramenta digam para as pôr (esta regra do Silva vale mais). Antes de publicar:
   `git log origin/main..HEAD -i --grep='co-authored-by'` (os commits de outros agentes no mesmo ramo também contam).
8. **O ramo publicado tem o nome da acção principal da publicação** (Silva, 17/10/2026: "coloque o nome da acção
   principal da publicação no branch"). Ao publicar, o PR sai de um ramo com nome curto, em português, sem acentos e
   com hífens, que diz o que a publicação faz — ex.: `email-de-entrada-mltmark`, `planos-email-e-so-dominio` (nunca
   `claude/` nem outro nome de IA; o ramo de trabalho do agente pode ter outro nome: copia-se para o ramo com o nome da
   acção na hora de publicar). O título do merge leva esse nome: `Merge pull request #N from SilvaChamo-<acção>`, ex.:
   `Merge pull request #94 from SilvaChamo-email-de-entrada-mltmark`.
9. **O merge leva por baixo uma linha, em português, com o que foi publicado** (Silva, 19/10/2026: "devia escrever o que foi
   feito como commit"), como nos merges anteriores — ex.: «Publica redistribuição de quotas de e-mail e edição directa de
   páginas WordPress.» (pela API, em `commit_message`). Ao dizer ao Silva o commit publicado, só os 8 primeiros caracteres
   do hash (ex.: `6a1e4569`), nunca os 40. Repetida nos ficheiros das outras IAs.
10. **O comando do ponto 6 leva sempre o modelo completo** (fecho do servidor, `stash`, `checkout`, `npm install`,
   `rm -rf .next`, arranque, recarregar a aba do Chrome que já esteja aberta, ou abrir `/dev-preview-telemovel`): nunca
   uma versão resumida (Silva, 19/10/2026). Quando a alteração é numa página, o `open` final leva o caminho dela:
   `open "http://localhost:3003/dev-preview-telemovel?p=/host:2026/admin/pacotes"` (entre aspas, por causa do `?`).

# Endereço do painel, Sair e inactividade (Silva, 24/10/2026 — já mudou várias vezes: não voltar a trocar sem ele pedir)

- **Endereço principal do painel:** `https://visualdesignmoz.com/vhost:2026/`. Vão dar a ele, com redirecção (`src/proxy.ts`): `/host:2026`, `/vhost/…`,
  `/host/2026`, `host.visualdesignmoz.com` e `host.visualdesignmoz.com:2026/evo/` (o endereço antigo que os clientes têm guardado).
  **O `host` só sobrevive como redirecção** (Silva, 26/10/2026: "deixar vhost… quero o servidor limpo"): a pasta interna do painel passou de `src/app/host` a
  **`src/app/vhost`** (destino da reescrita em `src/proxy.ts`); o código, os e-mails, as notificações e os modelos guardados só usam `/vhost:2026` (os 16 avisos antigos
  de `/dashboard?section=…` passaram a `/vhost:2026/…` na base de dados). A redirecção de `/host:2026`, `/host`, `/host/2026`, `/vhost/…` (`PAINEL_ANTIGOS`) fica **de propósito**,
  só para casos omissos (favoritos, e-mails já enviados). O nginx da porta 2026 passa a apontar a `/vhost:2026` com o workflow `ops-nginx-porta-2026.yml` (sem "aplicar" só
  lê; com "aplicar" faz cópia, `nginx -t` e só então recarrega). `/vhost/2026` continua a dar 404 (rewrite para um caminho sem rota).
- **`visualdesignmoz.com:2026/vhost/` não existe e não pode existir:** o domínio principal passa pela Cloudflare, que só aceita certas portas (a 2026
  não); só `host.visualdesignmoz.com` (sem Cloudflare) responde na 2026.
- **Sair** (botão do painel) vai para o **login do site** (`/login`), que depois volta ao painel.
- **Terminar por inactividade** (ligado desde 24/10/2026; site e painel **30 min** desde 26/10/2026, pedido do Silva — o painel usa `PANEL_INACTIVITY_MS` de `session-inactivity.ts`, não um número à parte; `SAIR_POR_INATIVIDADE_ATIVO`) volta à **entrada (login) do próprio painel**
  (`/vhost:2026`, a página `entrada.tsx`), no mesmo ecrã onde estava; não vai para o login do site nem para a página inicial.
- **Sem sessão**, o endereço do painel mostra a entrada do próprio painel (nunca redirecciona para o login do site).

# Renovações de domínios e hospedagem no vhost (Silva, 24/10/2026)

- **Onde estão:** Admin › Renovações (todas as renovações: visão geral, domínios, hospedagem, registar uma nova) e Gestão › Renovações (as do próprio
  cliente) — `src/components/vhost/paginas/renovacoes.tsx`, que embute os componentes `RenewalsSection` e `ClientRenewalsSection` (em
  `vhost/comuns/`) com as mesmas rotas `/api/renewals…`. Os **modelos das mensagens** de renovação estão em Admin › Mensagem a todos › Templates, os
  **comprovativos e pagamentos** em Admin › Contabilidade, e a **renovação automática** do domínio no registador em Domínios (Renovação automática).
- **Avisos e suspensão** (Silva, 24/10/2026: "avisar desde os 3 meses; quando chegar o último dia, suspender"): o deploy instala um cron
  (`0 8 * * *`, hora de Moçambique) que chama `/api/cron/renewal-check` com o segredo no cabeçalho. **Avisa** (notificação + e-mail pelos modelos) aos
  90 (3 meses), 60, 45, 30, 15, 7, 3 e 1 dias. **Passado o último dia suspende** o serviço (reversível: pagar a renovação reactiva), com **travões** em
  `src/lib/overdue-hosting-suspend.ts`: só o que expirou há 30 dias ou menos (mais antigo avisa o admin), **no máximo 5 por dia**, **nunca**
  `basededadosagro.com` nem `visualdesignmoz.com` (`RENOVACOES_NUNCA_SUSPENDER`), e o admin recebe a lista. O interruptor é
  `RENOVACOES_SUSPENDER_ATRASADOS=1` (posto pelo deploy). **`/api/cron/renewal-check?simular=1`** (administrador com sessão) mostra o que seria
  suspenso sem fazer nada: ver antes de mexer nos dados. Nunca tirar os travões: a tabela esteve incompleta e já se parou um site real por engano.
- **Período de recuperação: 30 dias** (Silva, 26/10/2026: "o básico que todos usam"; é o mesmo período de graça de 30 dias dos domínios). Suspende-se no dia
  a seguir ao fim do prazo (como está) e durante 30 dias o serviço fica suspenso, sem apagar nada; pagar a renovação reactiva. O cliente é avisado
  (notificação + e-mail) no dia da suspensão, a meio (dia 15) e nos últimos dias (dia 27): `src/lib/recuperacao-renovacao.ts`, chamado pelo cron e
  incluído no `?simular=1`. Passado o período o serviço pode ser removido, mas a limpeza continua manual (avisos ao administrador aos 60 dias e a 1 ano).
- Os dados das renovações (`domain_renewals`, `renewals`) nunca se alteram nem apagam por "limpeza".

# Os painéis antigos já não existem (Silva, 24/10/2026: "o painel vhost é o principal")

- Apagados: `/dashboard`, `/cliente`, `/revendedor` e `/profissional` (páginas, componentes e as rotas de API que só eles chamavam; ~56 mil linhas).
  O **painel principal é só o vhost** (`/vhost:2026`) e não depende de nenhum deles. Nada de voltar a criar páginas nesses caminhos.
- **Redirecção total** (`src/proxy.ts`): qualquer endereço `/dashboard…`, `/cliente…`, `/revendedor…`, `/profissional…` ou `/admin…` (favoritos, e-mails,
  avisos já guardados) vai, num só salto (308), para `/vhost:2026`. O pagamento Stripe volta a `/vhost:2026/utilizador/encomendas`.
- Uma rota de API só se apaga se nada no repositório a chama (código, scripts, workflows, `next.config`) e não for de chamada externa (webhooks, cron,
  autoconfig de e-mail, auth, checkout).

# Entrar com o nome da conta, além do e-mail (Silva, 24/10/2026)

O login do site (`/login`) aceita o **nome da conta** (o nome de utilizador do servidor, ex.: `oshercollective`) **e** o e-mail
da própria pessoa, de qualquer domínio. Quem hoje entra com o nome **tem de continuar a entrar**: o `auth.signIn`
(`src/lib/supabase-client.ts`) manda o que não leva `@` para `/api/vhost/entrar`, que procura a conta em
`profiles.da_username` / `panel_users.username` e confirma a palavra-passe no servidor. Toda a conta nova (compra,
Adicionar cliente, conta importada) fica com o nome ligado ao login do site (`criarLoginDaConta`), para o nome entrar
sempre. O campo do login diz «email@dominio.com ou nome de utilizador»: nunca o tornar só de e-mail nem tirar esta entrada.

# Site em duas línguas — todo o conteúdo novo entra já traduzido (Silva, 14/10/2026)

O site público (tudo fora do painel `/host`) muda entre português e inglês no botão EN/PT. Escreve-se sempre em
português; a versão inglesa vem do dicionário `src/lib/i18n-textos.ts` (frase em português → frase em inglês), que a
tradução automática (`src/components/layout/TraducaoAutomatica.tsx`) aplica a toda a página — também ao que aparece
depois (menus, listas vindas do servidor). **Regra:** sempre que se acrescenta ou muda texto visível no site (páginas,
botões, placeholders, mensagens de erro, listas de dados como `src/lib/brand-landing-content.ts`), acrescenta-se na
mesma alteração a linha inglesa no dicionário — sem esperar que o Silva peça.

- Partes que mudam (número, preço, nome) escrevem-se `{0}`, `{1}`…: `"A partir de {0}": "From {0}"`.
- Nomes próprios, siglas e textos iguais nas duas línguas vão para a lista `IGUAIS` do mesmo ficheiro.
- Antes de dar uma alteração por concluída: `npm run i18n` tem de dar **0 textos sem inglês** (lista o que falta, com
  ficheiro e linha). Zonas que não se traduzem: `data-sem-traducao` no elemento. O painel (`.vh`) tem a sua própria
  tradução (`t()` em `src/components/vhost/i18n.ts`) e fica de fora desta verificação — ver a secção seguinte.
- Textos que já usam `t('chave')` de `src/lib/i18n.tsx` continuam a funcionar; não é preciso convertê-los.

# A língua de origem é o português e o inglês escolhido fica (Silva, 27/10/2026)

- **A língua de origem do site e do painel é sempre o português** (nunca o inglês, mesmo com o navegador em inglês). Só muda quando a pessoa escolhe o inglês, e essa escolha fica
  **para todas as sessões**: guarda-se no `localStorage` e num cookie de 1 ano, ambos `vd-lang` (`src/lib/lingua.ts`: `lerLinguaGuardada`, `guardarLingua`). **Nunca apagar a chave `vd-lang`**: a limpeza
  das caches do painel ao terminar a sessão (`panel-session-cache-clear.ts`) e a página `/auth/clear-storage` já a deixam ficar (antes apagavam-na e a escolha perdia-se).
- **Recuperar senha leva o «não sou um robô» (Turnstile)**, como o registo: o botão só liga depois da verificação e `/api/auth/reset-password` confirma-a na Cloudflare (`turnstileValido`).
- **Login do site** (Silva, 27/10/2026): campos e botões com a mesma altura (44 px no computador, 40 px no telemóvel; só no login, não nos outros formulários); cabeçalho do cartão (logótipo no telemóvel, título e
  descrição) com fundo muito suave e uma linha vermelha suave e transparente de lado a lado; a descrição tem duas linhas («…hospedagem / e e-mails da sua empresa.»).
- **Diagnóstico do Elementor** (só leitura): workflow `ops-elementor-diagnostico.yml` (Actions › Run workflow, com o domínio). Só corre com ordem expressa do Silva.

# Painel em duas línguas — nenhuma página fora da tradução (Silva, 27/10/2026)

Silva, 27/10/2026: «tem muitas páginas não traduzidas no painel… espero que não tenha nenhuma página fora da tradução». A auditoria
encontrou ~3 000 textos do painel sem inglês (o dicionário só tinha 445 linhas) e componentes inteiros (`comuns/…`, vindos dos painéis
antigos) sem nenhum `t()`. Ficou assim:

- **Dicionário do painel** = `EN` de `src/components/vhost/generated/data.ts` + as linhas `novas` de cada página + **`src/components/vhost/traducoes/`**
  (um ficheiro por zona, `chave em português → inglês`, juntos por `traducoes/index.ts`; `traducoes/iguais.ts` lista o que é igual nas duas línguas: código,
  nomes, siglas, texto já em inglês). Frases com partes que mudam escrevem-se `{0}`, `{1}`… (`"Pacote {0} criado": "Package {0} created"`); `translate()`
  (`i18n.ts`) aplica o modelo com mais texto fixo primeiro.
- **Rede de segurança:** `src/components/vhost/TraducaoPainel.tsx` (montada em `src/app/vhost/layout.tsx`) aplica o mesmo dicionário a todo o texto e a
  `placeholder`/`title`/`alt`/`aria-label` que chegam ao ecrã dentro de `.vh` (também janelas e listas que abrem depois) quando o inglês está escolhido; voltar ao
  português repõe os originais. Não mexe em `code`/`pre`/`textarea`, em `[data-sem-traducao]` nem em editores. Janelas pelo portal para o `body` leva
  `data-vh-portal` para entrarem na tradução.
- **Regra para todo o texto novo do painel** (como no site público): acrescentar a linha inglesa no dicionário na mesma alteração. Texto montado com `'…' + x`
  ou `` `…${x}` `` escreve-se no dicionário como modelo com `{0}` (o ecrã recebe a frase inteira). Antes de dar uma alteração ao painel por concluída:
  **`npm run i18n:painel` tem de dar 0 textos sem inglês** (lista o que falta, com ficheiro e linha; `-v` mostra cada texto, `--json` a lista para copiar).
- **As duas línguas são o português de Portugal e o inglês britânico** (Silva, 27/10/2026: «o português nem é do Brasil: é de Portugal, o dicionário antigo que Moçambique fala; o inglês deve ser de Inglaterra»).
  Português: `utilizador`, `ficheiro`, `descarregar` (nunca `usuário`, `arquivo`; «Baixar» fica onde «Descarregar» é comprido demais — Silva, 27/10/2026), `guardar` (nunca `salvar`), `registar` (nunca `cadastrar`), `gerir` (nunca `gerenciar`), «o seu
  domínio» com artigo (nunca «seu domínio»), nada de «você»; grafia de Moçambique: `actualizar`, `correcto`, `excepção`, `facturação`, `contacto`. Inglês: `colour`, `customise`, `organisation`,
  `authorise`, `centre`, `licence`, `cancelled` (nunca as formas americanas); nomes de produtos (WordPress «Customizer») ficam como são.
- **O verificador já não dá por traduzida uma lista de dois textos** (27/10/2026): uma lista `['título', 'texto']` ou `['pergunta', 'resposta']` era tomada por um par português/inglês e escondia
  textos por traduzir (a lista «Antes de transferir» e a Ajuda). Só conta como par quando o segundo texto parece inglês. Para ver o que falta na prática: percorrer as páginas com o painel
  em português e em inglês e listar o texto que fica igual nas duas (os três níveis e os sub-ecrãs: `…/dominios/transferir`, `…/email/uso`, perfil, preferências).

# Regras de layout do Silva (valem para todas as páginas, sempre)

Reescritas a 20/10/2026 a partir do layout aprovado pelo Silva nesse dia (domínios, subdomínios, linha de cima do cartão,
tabelas). Onde isto contradiz o que estava escrito antes, **vale isto**. Antes de entregar qualquer página, confirmar os
pontos um a um — o Silva já teve de os repetir várias vezes.

## Cartão principal e linha de cima

- **Zoom proporcional do painel** (Silva, 23/10/2026: "tudo ficou muito pequeno… só cresce o conteúdo, como o zoom do navegador"). Todas as medidas fixas
  em px do CSS do painel (alturas, larguras, margens, preenchimentos, espaços, letra) são `calc(Npx * var(--z, 1))`; `--z` está no fim do bloco
  de `--fs` em `paginas.css` (1 no telemóvel; 1,06 a 769 px, 1,1 a 1100, 1,15 a 1280, depois desce até 1 a 2000) e `--fs` = `--fs0` (escala antiga por
  ecrã) × `--z`. **Para mudar o tamanho de tudo muda-se só `--z`.** Medida nova em CSS escreve-se já assim (nunca px soltos). Não se usa a
  propriedade `zoom` do CSS (estraga os menus que se posicionam com `getBoundingClientRect`). As opções por baixo da linha (DNS: Todos | A | CNAME…;
  PHP: Definições | Extensões) não levam ícones (Silva, 23/10/2026), ficam sempre **numa só linha** (a pesquisa ao lado encolhe) e, abaixo de 1100 px, passam para cima da pesquisa.

- **A descrição de um título vai sempre junta ao título** (Silva, 21/10/2026: "nunca mais faça isso"). Em qualquer título —
  barra de cima, cabeçalho de um cartão, painel, janela — a descrição fica **encostada ao título, com no máximo 10 px de
  margem entre os dois, nunca mais**. Nunca uma descrição "perdida" mais abaixo, separada do título por outro bloco ou por
  um espaço grande. Se há botões na mesma linha, título e descrição ficam juntos, centrados na vertical com o botão, e a
  descrição passa para uma segunda linha em vez de tocar no botão.
- **Margem por cima e por baixo da linha do cartão: sempre 5 px, nunca mais** (Silva, 21/10/2026).
- **O botão base do painel é o "+ Adicionar registo" do DNS** (Silva, 21/10/2026): 32 px de altura, letra 12,5 px, 14 px de cada
  lado. Todos os botões (páginas, formulários, janelas) usam este tamanho; só ficam de fora os pequenos das linhas das tabelas
  (`.sm`), os de só um ícone e os da barra de cima. No telemóvel o botão da página fica **do lado direito**, no seu tamanho.
- **Páginas com um botão à direita usam o modelo de Domínios** (Silva, 21/10/2026): título da página em cima, linha, e por baixo
  a indicação do domínio (conta com vários domínios) ou a descrição da página à esquerda e o botão à direita. Faz-se no shell
  (`NoTopoCartao modelo`), por isso vale para toda a página que tem `actions`; não se inventam botões onde a página não tem.
- **Título e descrição do cartão (modelo de Domínios)** (Silva, 22/10/2026): o título dentro do cartão nunca repete o da barra de cima —
  escreve-se de outra forma (ficheiro `titulos-cartao.ts`). A descrição da página vai por baixo do título light, antes da linha, em letra
  de 11,5 px quase preta, e **sai da barra de cima**, que fica só com o título; se a página tem uma instrução, é ela que vai por baixo do
  título. Por baixo da linha ficam só a pesquisa (à esquerda, 440 px) e o botão (à direita). A indicação de trocar de domínio só existe na
  página de Domínios.
- **Pacotes do revendedor** (Silva, 22/10/2026): o revendedor só vê e só atribui os pacotes **Pro-…** (Pro-Basico, Pro-Premium, Pro-Business),
  nunca todos os que o servidor tem — na interface (`pacotesDeCliente`), nos dados (`vhost-dados`) e na API (`pacotePermitido`). Criar um
  pacote novo no Hestia é `v-add-user-package FICHEIRO NOME` **sem** o `yes` final: o `yes` é "regravar" e só serve para um pacote que já existe.
- **Segurança do servidor Contabo (22/10/2026):** SSH em `ssh root@169.58.148.144 -p 2234` (a porta 22 fica aberta só até os workflows do GitHub, já
  passados para a 2234, estarem publicados; depois fecha-se — `ssh.socket.d/porta.conf` + regra "SSH-2234" do Hestia + `chains.conf` com `22,2234`).
  Portas abertas ao exterior: 22/2234 (SSH), 25/465/587 (SMTP), 110/995 e 143/993 (POP3/IMAP: usados), 53 (DNS), 80/443 (web), 2026 (VisualHost).
  **Fechadas por não se usarem:** 21 e 12000-12100 (FTP: 0 entradas certas em 3 semanas, só varrimentos) e 8083 (painel do Hestia: o VisualHost
  fala com ele por dentro do servidor; para o abrir por fora, `ssh -p 2234 -L 8083:localhost:8083 root@169.58.148.144`). **aamihe.com só aceita o
  Cloudflare:** `vd-cloudflare-origem.conf` + `nginx.conf_vd-so-cloudflare` (quem pede ao IP do servidor leva 444). **CRON_SECRET** foi mudado a
  22/10/2026 (secret do GitHub + `.env.local` + crontab do root; os crons e os workflows usam o mesmo).
  **Porta 2026 (22/10/2026):** `host.visualdesignmoz.com:2026` só redireciona (307) para o painel, `https://visualdesignmoz.com/host:2026`, com
  certificado Let's Encrypt gerido pelo Hestia (renova sozinho; `v-add-letsencrypt-domain vdadmin host.visualdesignmoz.com`). **O IP
  (`https://169.58.148.144:2026/host:2026`) é só do programador, para resolver problemas, nunca para uso normal:** certificado próprio (um IP não
  tem certificado válido, o navegador avisa) e só abre para os endereços de `/etc/nginx/conf.d/vd-admin-ip.conf` (hoje o do Silva); os outros levam a
  ligação fechada (444). Para juntar um endereço acrescenta-se uma linha e recarrega-se o nginx.
- **TAREFA AGENDADA — troca do endereço do Supabase (23/10/2026 às 00:00, hora de Maputo; lembrar o Silva hoje às 23:30)** (Silva, 22/10/2026).
  Tirar o "contabo": a app passa de `https://supabase-contabo.visualdesignmoz.com` para `https://supabase.visualdesignmoz.com`. **Não se copia nada:**
  os dois nomes já apontam para o mesmo Supabase (nginx → `127.0.0.1:8000`). Já feito a 22/10: o Silva tirou o proxy do Cloudflare ao registo
  `supabase` (só DNS) e emitiu-se o certificado Let's Encrypt de `supabase.visualdesignmoz.com` (válido até 20/01/2027, o Hestia renova). Também se tirou o alias "no" que o Hestia tinha posto no site `supabase` (aparecia como `server_name … no;`).
  **Falta fazer (à meia-noite; qualquer agente que veja esta nota e ainda não a encontre feita, faz — ver "Feito" no fim):**
  1. *(Silva, antes)* Se há login Google: acrescentar `https://supabase.visualdesignmoz.com/auth/v1/callback` aos endereços de retorno na consola do
     Google (manter o antigo).
  2. No servidor, em `/opt/supabase-contabo/docker/.env`: `SUPABASE_PUBLIC_URL=https://supabase.visualdesignmoz.com` e
     `API_EXTERNAL_URL=https://supabase.visualdesignmoz.com/auth/v1`; depois `cd /opt/supabase-contabo/docker && docker compose up -d` (recria só o que
     mudou, uns segundos). `SITE_URL` e as listas de redirecionamento não mudam.
  3. `gh secret set CONTABO_SUPABASE_URL --body https://supabase.visualdesignmoz.com` e publicar de novo (`gh workflow run "Deploy Visualdesign"`): o
     deploy grava `NEXT_PUBLIC_SUPABASE_URL` no build e no `.env.local` (só se vê depois do deploy, ~15 min).
  4. Verificar: entrar no painel; `curl https://supabase.visualdesignmoz.com/auth/v1/health` (401 é normal sem chave).
  **Consequência avisada ao Silva:** o nome do cookie de sessão deriva do endereço (`sb-supabase-…` em vez de `sb-supabase-contabo-…`): **todos os
  utilizadores têm de voltar a entrar uma vez, com o mesmo e-mail e a mesma palavra-passe** (contas e dados não mudam; só se perdem as sessões abertas). O nome antigo fica a funcionar (nginx serve os dois): `/opt/basededadosagro-site` e
  `/opt/visualdesign-panel` ainda usam o antigo e não precisam de mudar já. Reverter: voltar `.env` do Supabase, o secret e publicar.
  **Feito:** (ainda não) — quem fizer, escreve aqui a data e o resultado.
- **TAREFA PENDENTE — M-Pesa em produção** (Silva, 22/10/2026): o M-Pesa está em sandbox (`MPESA_ENV` em `deploy-contabo.yml`). Fica pendente até a
  Vodacom entregar as credenciais de produção; a mensagem para a Vodacom está em `docs/mpesa-pedido-vodacom.md`. Passar a produção só com o "avança"
  do Silva (dinheiro real). **Feito:** (ainda não).
- **O CPU do servidor é um só** (Silva, 22/10/2026): tudo o que o mostra (janela de manutenção, cartão "Servidor" da barra lateral, cartão
  "Consumo CPU" do painel inicial) usa `useSystemStatus`, uma leitura ao vivo partilhada. Nunca outra medida ao lado.
- **Nunca pesquisa à esquerda por cima do cartão principal** (13/10/2026). A "Busca" da barra de cima já procura na
  página aberta. Sem exceções.
- **Modelo de página = a página Domínios do painel.** Barra de cima com o título e uma descrição pequena por baixo
  (nunca dois títulos grandes juntos; números e resumos vão na descrição, ex.: "Todas as mensagens | 3 por ler"); o
  conteúdo todo dentro do cartão principal; **a descrição não se repete por baixo do título dentro do cartão**.
- **Todo o cartão principal abre com a linha de cima** (`card-topo-slot`, no VisualHost `TopoCartao` +
  `NoTopoCartao` em `src/components/vhost/context.tsx`), por dentro do cartão, **com uma linha por baixo a toda a
  largura**:
  - **à esquerda, a indicação do domínio** nas páginas que dependem de um domínio: globo vermelho + nome do domínio a
    negrito + "· muda-se no seletor em cima, à direita" em letra pequena e cinzenta (`IndicacaoDominio`). Só o nome do
    domínio, nada mais; **no telemóvel não aparece** (o domínio já está na faixa de cima);
  - **à direita, o botão da página** (ex.: "+ Adicionar domínio", vermelho) **ou "Opções"** quando a página tem
    caixas de seleção. Nunca os dois, nunca mais do que um.
- **Nunca inventar botões nem indicações.** Cada página analisa-se pelo seu conteúdo: só leva botão na linha de cima se
  tiver uma ação própria (adicionar, criar…). **Páginas de Início, Gestão e Admin não levam a indicação do domínio nem
  o botão de adicionar domínio** (o Silva: "eu disse para não inventar"). Registar e Transferir não levam botão.
- **O seletor de domínio nunca muda sozinho** e guarda-se: depois de recarregar, reiniciar ou voltar a entrar, continua
  o mesmo domínio. Só o utilizador o muda.
- **Opções, não "Ações"** (menu e botão). Na coluna da tabela que tem os botões de cada linha o título é **"Acção"**
  (como o Silva escreve). As opções que precisam de linhas escolhidas ficam **inativas** no menu enquanto nenhuma estiver
  assinalada; as que não precisam estão sempre ativas e vêm primeiro.
- **Faixa de separadores** só aparece com vários separadores — nunca um sozinho com o título da página. Se a página não
  tem separadores mas tem filtros (DNS: Todos, A, CNAME, MX…), os filtros são os separadores (`Tabs`). Nunca filtros
  soltos numa linha de botões por cima da tabela.
- **Paginação só no fundo do cartão principal**, quando há mais de uma página: setas e "Página x de y", sem "1–20 de
  67". Nunca em cima, nunca na faixa dos separadores, nunca no cabeçalho da tabela. **A numeração das páginas vem
  sempre à direita, no fim da tabela, no canto inferior direito** (Silva, 20/10/2026), em todas as tabelas.
- **Alinhamento à esquerda** (`--recuo`, 12 px): texto, títulos, botões e campos alinham todos com a indicação do domínio
  e o ícone do primeiro separador; **as linhas vão a toda a largura do cartão**. Espaço **antes e depois de cada
  linha**, igual em todo o lado (nada colado a uma linha).
- **Menu da barra lateral esquerda**: categorias 15 px, páginas 13 px.
- **Barra compacta: o «Sair» do fundo realça-se (selecionado e ao passar o rato) até à beira de baixo da janela, sem margem por baixo** (Silva, 27/10/2026; a barra não tem `padding-bottom`).
- **Barra compacta (ícones à esquerda)** (Silva, 21/10/2026): o símbolo ocupa 76 px (a altura da barra de cima), por isso o primeiro
  ícone (Mensagens) começa na linha de cima do separador Admin; botões de 64 px (idioma 68 px) para dar espaço entre ícones; leva
  também o ícone da gestão de ficheiros (só ícone, leva directo à página, só aparece a quem o plano deixa ver).
- **O separador "Admin"** chama-se "Admin" em todos os painéis, também no do revendedor (`nomeNivel` em `state.ts` — tabs, caminho
  e pesquisa; "Revenda" já não aparece como nome de separador).
- **O cartão principal «não acaba» no fim do scroll** (Silva, 27/10/2026: «o card principal não deve mostrar a linha de baixo, nem onde termina no fim do scroll; só se tiver outro card dentro dele é que mostra a margem»; **substitui a regra de 26/10 logo abaixo, só no computador**):
  `main` sem margem por baixo e o cartão principal sem a linha nem os cantos de baixo (parece continuar para lá da janela). Só se houver outro cartão (`.card`) lá dentro é que o cartão principal mantém o espaço por baixo (o seu
  preenchimento); sem cartão lá dentro, nem esse espaço. No telemóvel fica como estava (barra de baixo + 12 px). CSS no fim de `paginas.css`. **«Outro cartão lá dentro» é qualquer caixa com contorno** (Silva, 28/10/2026: «o segundo card dentro do principal deve mostrar a margem de 20 ou 25 px no fim do scroll, igual à dos lados; vale para todos os cards dentro do principal, sem mexer no principal», na página de emissão de SSL): além do `.card`, contam os formulários com contorno (`.frm-lados` — «Certificados do domínio seleccionado» —, `.php-defs`, `.php-versao`, `.pf-senha` e qualquer `.frm` que não seja filho directo do cartão principal). Nesses casos o cartão principal mantém o seu preenchimento de baixo (a mesma margem dos lados); o cartão principal em si não muda.
- **Erros do PHP gravados na pasta do site** (Silva, 28/10/2026: «tentei muitas vezes abrir o elementor e sem sucesso, o sistema deveria ter gravado o erro criando o ficheiro error_log de processos falhados para consultar o problema real»): o pool PHP-FPM do domínio grava `public_html/error_log` (só erros graves, `error_reporting = 4437`) e `public_html/slow_log` (rasto de todo o pedido com mais de 15 s, `request_slowlog_timeout = 15s`), visíveis no gestor de ficheiros. Os dois são **negados à web** (`nginx.conf_erros` em `/home/CONTA/conf/web/DOMINIO/`; visto de fora dá 403, nunca 200) e rodam a 5 MB (`/etc/logrotate.d/vd-erros-site`). Aplica-se por domínio com o workflow `ops-php-erros-gravar.yml` (sem «aplicar» só mostra; com «aplicar» faz cópia, `php-fpm -t`, `nginx -t` e recarga suave); `ops-php-erros-leitura.yml` mostra onde os erros vão parar hoje. **Aplicado em entrecamposblog.com a 28/10/2026**; os outros sites e os novos ainda não (falta pôr a regra no `vd-php-conta`, só com ordem do Silva). Antes disto os erros graves perdiam-se (o pool não tinha `error_log`) e o que existia estava em `/var/log/apache2/domains/`, fora do alcance do gestor de ficheiros.
- **Todas as páginas têm margem por baixo do último conteúdo** (Silva, 28/10/2026: «dê espaço em baixo do conteúdo no fim do scroll de todas as páginas; o conteúdo não pode ficar colado à parte de baixo do ecrã; onde tiver um card no fim deve ter margem, à semelhança da página de SSL; onde não tem card, o próprio conteúdo deve ter margem»; **substitui, no computador, a excepção «sem cartão lá dentro, nem esse espaço» da regra de 27/10 acima**): o cartão principal mantém sempre o seu preenchimento de baixo (24 px × `--z`, `maquete.css`), tenha ou não um cartão lá dentro — foi retirada a regra que o zerava (era por isso que, nas Bases de dados, os botões de «Operações» ficavam colados ao fundo). O cartão principal continua sem a linha de baixo e `main` sem margem (só muda o espaço **dentro** do cartão). Conteúdo fora do cartão principal (páginas sem cartão) leva `margin-bottom` de 24 px × `--z` no último elemento, e a coluna `.cols-side` do Início leva o mesmo como `padding-bottom`. No telemóvel fica como estava (barra de baixo 64 px + 12 px). Medido em Playwright (computador 1440×900 e telemóvel 390×800): 24 px de espaço entre o último conteúdo e o fundo do ecrã em todos os tipos de página (cartão simples, cartão com `.card`, Início com coluna do lado, cartão com `.da-lado`, conteúdo solto). Ao criar uma página nova: nunca zerar o `padding-bottom` do cartão principal nem pôr margens negativas no fim.
- **No fim do scroll fica só a margem dos lados e de cima** (Silva, 26/10/2026: «no fim do último card… a mesma margem das
  laterais e do topo, em todos os cards, sem excepção»; substitui a regra de 20/10 «o cartão chega ao fundo da janela»): o
  `main` tem a mesma margem (`20px × --k`) dos quatro lados e o cartão principal volta a ter a linha e os cantos de baixo. O
  último elemento de cada contentor (`.pg-slot`, `.da-main-card`, `.da-lado`, `.cols-side`, `.dom-principal`) não leva margem
  por baixo (somava-se ao preenchimento do cartão: 50 px em vez de 25). Nunca voltar a pôr margens grandes no fim de uma
  página (o antigo `margin-bottom: 110px` era para um quadro "Maquete" que já não existe). No telemóvel: a altura da barra
  de baixo (64 px) mais 12 px.

## Tabelas

- **Sem linhas nas laterais**: só linhas horizontais, a toda a largura do cartão. Sem caixa à volta da tabela.
- **Todas as tabelas com lista, sem linhas laterais** (esquerda e direita) — também as que vivem num cartão próprio (ex.:
  "Pedidos abertos" em Transferir domínio) e as das páginas de administração. Antes de entregar, confirmar com o
  Playwright que nenhum elemento entre a tabela e o cartão principal tem borda à esquerda ou à direita (Silva, 20/10/2026).
- **Linha no início** (por cima dos títulos das colunas) **e no fim** (por baixo da última linha) — em computador e
  tablet; no telemóvel as linhas são blocos e ficam como estavam.
- **Linhas alternadas**: branca e cinzento suave (`--soft`), em **todas** as tabelas. Nunca cobre as linhas de grupo, a
  selecção, o realce nem a passagem do rato. No tema escuro a tabela fica sem fundo próprio (igual ao do cartão).
- **Barra dos títulos das colunas** com o fundo suave (`--soft`); os títulos em **texto normal, nunca em
  maiúsculas**, 14 px, numa cor mais escura do que o cinzento corrente.
- **A primeira coluna nunca parte o nome em duas linhas** (a coluna alarga conforme o nome mais comprido). Só em
  computador e tablet; no telemóvel não conta. O nome de uma linha tem a cor normal do texto e fica vermelho só ao
  passar o rato. Nada de subtítulos por baixo do nome (tipo de site, nome completo) nas listas de domínios e de
  utilizadores.
- **Tabelas compactas nos ecrãs de computador** (13/10/2026, 769–1600 px): 12 px entre colunas, linhas baixas, números
  dos cartões pequenos. Se mesmo assim não couber, as colunas menos importantes saem até essa largura (`ate: 1600 |
  1300` na coluna do `DataTable`; no telemóvel, em blocos, voltam) e o que davam fica acessível noutro sítio (ex.: menu
  "⋯" da linha). **Cada linha da tabela fica numa só linha** — o texto não parte em duas (nomes, pastas, caminhos). Se a
  tabela não cabe, **o conteúdo desliza na horizontal** (deslizar para a esquerda para ver o que está escondido à direita);
  não se parte texto em duas linhas para caber (Silva, 20/10/2026: "não há necessidade de termos duas linhas se podes
  deslizar o layout à esquerda"). Isto substitui a regra antiga "nunca barra de deslocar".
- **Botões de cada linha** (ex.: "Gerir" e o das setas): lado a lado, à direita, na coluna "Acção".

## Campos

- **Todo o campo leva sempre um ícone ao lado**, como o campo de adicionar/trocar palavra-passe (`Senha` em
  `src/components/vhost/paginas/componentes.tsx`: `.igrp` com o ícone `.ib` colado ao campo — o dado à esquerda, o olho
  à direita). Vale para campos de texto, palavra-passe, escolha (selector), número e e-mail, em formulários e janelas.
  O ícone diz o que o campo é (utilizador, e-mail, cadeado, globo, pasta…) — nunca um campo "nu".
- **Todo o campo onde se escreve um domínio leva o ícone de domínio (o globo) à esquerda** (Silva, 20/10/2026), em formulários,
  janelas e listas — `.igrp` com `<span className="ib"><i className="fa-solid fa-globe"/></span>` antes do campo (ou, sem fazer nada, o
  ícone automático da regra seguinte, que vale também para o motor de busca de domínios).
- **Ícone do campo numa caixa cinzenta colada à esquerda — automático** (Silva, 21/10/2026: "em todo o sítio onde pôr ícone, assim
  como está na imagem" — o desenho dos campos das Definições PHP: caixa `.ib` de 38 px com o ícone, colada ao campo). Todos os
  `input`, `select` e `textarea` do painel recebem sozinhos esse ícone: o hook `useIconesCampos`
  (`src/components/vhost/icones-campos.ts`, ligado no `VisualHostApp`) põe `data-ic="<ícone>"` no campo conforme o tipo, a
  etiqueta e o texto de exemplo, e a caixa é desenhada pelo CSS `src/components/vhost/paginas/icones-campos.css` (gerado por
  `node scripts/gerar-icones-campos.cjs`, dos SVG do Font Awesome — não editar à mão). Ícones: **nome → pessoa**, **domínio,
  subdomínio e servidores de nomes → globo** (também o campo de busca de Registar domínio, `DomainSearchPainel`),
  **palavra-passe → cadeado**, **NUIT → cartão**, **e-mail → vários** (envelope, arroba nos endereços `nome@…`, caixa de entrada,
  avião de papel nos reencaminhamentos, carta aberta no assunto/mensagem), pasta, servidor, chave, lista, etc. Ficam de fora só
  os que já têm a sua caixa (grupo `.igrp` com `span.ib` à frente — ex.: Definições PHP; o `Senha` leva à frente o **dado de gerar** no lugar do cadeado, depois
  o campo e o olho; com `semGerar` (repetir, palavra-passe anterior) leva o cadeado), as pesquisas com a sua lupa, os campos com menos de 110 px de largura, o terminal e as caixas de
  escolha dos separadores. Para forçar um ícone: `data-ic="globe"`; para dispensar: `data-ic-sem`. **Uma página nova não precisa de
  fazer nada** — mas confirmar que o ícone certo saiu (se não, ajustar `escolher()` ou pôr `data-ic` no campo).
- **Todos os ícones do painel são coloridos, cada um com a sua cor, sempre a mesma** (Silva, 23/10/2026: "todos os ícones coloridos, incluindo os dos
  campos"). Paleta do submenu (vermelho, azul, verde, laranja, roxo, turquesa, rosa; versão mais clara no tema escuro). A cor de cada ícone Font Awesome
  sai de `scripts/gerar-cores-icones.cjs` (por significado — lixo/proibir vermelho, certo/transferir verde, globo/ligação azul… — e, se não houver
  regra, por um cálculo fixo do nome) e é gravada em `src/components/vhost/paginas/icones-cores.css` (**gerado, não editar à mão**). Os ícones das
  caixas dos campos (`data-ic`) usam as cores de `scripts/cores-campos.json`, escritas pelo mesmo script, em `icones-campos.css`. **Ao usar um ícone
  novo no painel, correr `node scripts/gerar-cores-icones.cjs` e `node scripts/gerar-icones-campos.cjs`.** Ficam como estão os ícones de estrutura (setas,
  fechar, a rodar), a barra de cima, a barra de ícones e o menu da esquerda (têm as suas cores), e tudo o que já tem cor própria (botão vermelho,
  `btn-ed`/`btn-rm`, etiquetas, avisos, caixas de seleção, o gestor de ficheiros em `.fmda-icc`/`.fmda-raiz`) — a lista está em `FORA` no script.
- **Margens: as caixas vão até às margens das tabelas; só o texto, os ícones e as caixas de seleção ficam para dentro** (Silva, 23/10/2026). Motores
  de busca, cartões e botões alinham de beira a beira com as margens das tabelas (nada de 12 px para dentro); o texto, os ícones e os checkboxes
  levam o recuo (`--recuo`, 12 px) dos dois lados. No telemóvel: a indicação do domínio não aparece; em Domínios tudo numa só coluna (pesquisa e
  botão, um por linha, à largura toda); os botões do topo do cartão — um só fica à direita, no seu tamanho; dois ou mais ficam lado a lado quando
  cabem e, se o texto de algum não cabe em meia largura, todos ocupam a largura toda, um por linha; um botão dentro de um cartão de aviso
  (`.card.empty`) ocupa a largura toda; o cartão de pesquisa de Registar domínio leva só 12 px por dentro. Barra cinzenta de confiança (Transferir
  domínio): 30 px por cima e por baixo; numa só linha de 1300 px para cima (a letra diminui até caber), em duas entre 1051 e 1299 px (não cabe
  legível numa) e numa só coluna no tablet e no telemóvel.
- Formulários sem contornos laterais; títulos e campos alinhados à esquerda pelo `--recuo`.
- Janelas (popups): **o fundo é sempre transparente (escurece um pouco), sem desfoque** e os cantos dos cartões são os do painel (4 px, `--r`) — vale também para o popup do Painel de Manutenção do Servidor (a chave do cartão do servidor, `.vh-popup-manut`; Silva, 21/10/2026); **25 px de espaço nos 4 cantos**; largura dinâmica só quando o domínio é comprido; no computador o
  menu de opções de uma linha abre para a esquerda.
- Janelas (popups): **sem descrição por baixo do título**; o título em **letra menor** e **ao lado do ícone** (Silva, Outubro/2026).

## Telemóvel (≤ 768 px)

- **Uma só coluna em tudo.** Exceções: o Menu (grelha de ícones) e os cartões (ex.: números da Dashboard) em duas
  colunas, ícone em cima e nome por baixo.
- **Botões** (rodapés de formulários e janelas, barras de botões, botões das linhas das listas; automático em
  `src/components/vhost/botoes-telemovel.ts`):
  - **dois ou mais, cujo texto cabe em meia largura → lado a lado**, dois por linha, divididos por igual;
  - **um só, cujo texto cabe → metade do ecrã**, à esquerda (ao centro e a toda a largura se o conteúdo está centrado,
    classe `.centro`);
  - **o texto de algum não cabe em meia largura** (iria para duas ou três linhas) **→ todos os botões dessa barra
    numa coluna, a toda a largura**.
  - Ficam de fora só as barras de ferramentas (editor, gestor de ficheiros), separadores, interruptores (Visual | HTML)
    e botões colados a um campo.
- **Listas numa só coluna**: cada linha é um bloco — caixa de seleção e dado principal em cima; as outras informações
  por baixo, cada uma com o nome da coluna; os botões da linha no fundo do bloco, com a regra dos botões acima. No
  VisualHost o `DataTable` empilha por defeito (`empilhar`, classe `dt-empilhar`).
- **O "⋯" da linha é vertical e sem contorno**; o menu abre para dentro do ecrã (nunca cortado) e os ícones das opções
  vão coloridos, à direita.
- **Separadores numa caixa de escolha** (selector) à esquerda da faixa, com o botão da página/"Opções" à direita.
  As barras de separadores são mais altas para o dedo.
- **O cartão principal vai de ponta a ponta** (14/10/2026): sem margem, bordas dos lados, cantos nem sombra; o limite do
  conteúdo é o do ecrã (12 px de folga), alinhado pelo mesmo `--recuo`.
- **Nada passa da largura, a partir de 320 px**: tudo cabe a 320 px e estica até ao tamanho do ecrã. Antes de entregar,
  varrer as páginas a 320 px (nada fora, nada cortado, nenhum "…").
- **Faixa por baixo da barra de cima** (14/10/2026): à esquerda só a casa (volta ao Início); à direita o domínio,
  encostado à direita e numa só linha — se não couber, a letra diminui e o globo sai sozinho (`titulo-ajustado.ts`);
  só no limite passa a duas linhas, encostado à direita.

## Carregamento, texto e entrega

- **Mudar de página: a anterior fica à vista até a nova ter conteúdo; só uma animação de cada vez** (Silva, 24/10/2026). Sem limite curto de espera
  (o de 1,2 s, de 23/10, foi tirado: só resta uma rede de segurança de 10 s para um servidor que não responde), e uma página vazia nunca é dada
  como pronta (`PaginaSlot`, `verificar`). **A linha do topo** (`BarraTopo`) aparece enquanto a anterior está à vista à espera; **as barras do
  cartão** só na primeira carga (sem página anterior: entrada, recarregar). **Nunca as duas ao mesmo tempo:** com as barras no cartão, a linha
  do topo esconde-se (`html.vh-barras-no-cartao`). Não voltar a pôr um limite curto.
- **Dentro do painel: nunca roda (spinner) nem esqueleto (skeleton)** (13/10/2026). Ao mudar de página, a página anterior
  fica à vista até a seguinte estar pronta. **Única exceção — no lugar da tela branca:** enquanto a página inteira ainda
  não tem conteúdo (ao recarregar, ou à espera dos dados), aparece o carregador do DA — as três barras do "WordPress
  Manager" do DirectAdmin, na cor do tema, no fundo do tema (16/10/2026). Está em
  `src/components/vhost/carregador-da.tsx`: a página do servidor (`src/app/vhost/layout.tsx`) sai logo com ele (Suspense)
  e o painel entra no lugar dele. A roda depois de entrar pela entrada do próprio painel fica numa página branca
  (pedido dele).
  **A roda só existe depois de escrever os dados na entrada do próprio painel** (Silva, 27/10/2026: «a roda é só depois do formulário do painel para quem
  entra directo»): em todo o resto — recarregar, mudar de página, primeira carga do cartão — são as barras (`BarrasDa`), nunca a roda. **Entrada pelo login
  do site: nenhum carregador** — o login lê e guarda os dados enquanto o botão está em «A entrar…» e o painel abre pronto, sem ler outra vez. O login só marca a
  entrada (`marcarViaSite`) se o destino bater no padrão de `LoginForm.tsx` (`/v?host:2026`): quando a pasta passou de `host` a `vhost` (26/10) o padrão ficou
  para trás, a entrada passou a ser uma página nova com roda — se o endereço do painel mudar outra vez, mudar também esse padrão. A leitura guardada no navegador
  (`vh-dados-2`) leva o utilizador a quem pertence (`__uid`) e só serve a esse: noutra conta no mesmo navegador não se vê primeiro a do admin.
- **NUNCA TELA BRANCA, em nenhuma circunstância e em todas as páginas** (regra rigorosa, 16/10/2026 — vale para todas as
  páginas que se criarem): ao abrir uma página, a anterior fica à vista até a nova ter o conteúdo; ao recarregar, o
  conteúdo continua visível e só "pisca" quando chega o novo. Como cumprir no VisualHost:
  - toda a leitura que uma página faz ao abrir usa `useGet` (`src/components/vhost/carga.tsx`) ou, se for um `fetch`
    próprio, chama `useContext(EsperaPagina)?.comecar()` e o "acabou" no fim — senão a página aparece vazia e enche
    depois;
  - **nunca recarregar a página inteira à frente de quem está a usar** (`location.reload`/`location.assign` num clique).
    Com versão nova, recarrega-se só com o separador escondido (`VisualHostApp.tsx`, `aoEsconder`). Entrada pelo
    **login do site**: o login lê os dados do painel antes de sair do ecrã de login (`preCarregarDadosVhost` em
    `src/lib/vhost-cache.ts`) e o painel abre logo, sem o ecrã branco com o círculo. Entrada pelo **login do próprio
    painel**: fica como está. Não mexer no carregamento sem o Silva pedir.
  - **Nunca um cartão vazio** (20/10/2026): enquanto uma página ainda não tem conteúdo, o cartão mostra as barras do DA
    centradas na horizontal e no topo do cartão, por dentro, e o resto fica escondido. Está no `PaginaSlot`
    (`VisualHostApp.tsx`: classe `a-carregar` + cartão `pg-carga`), por isso vale para **todas** as páginas. Só até haver
    conteúdo pela primeira vez; depois, ao atualizar, o conteúdo continua à vista. Uma página nova não devolve `null` à
    espera dos dados sem passar por `useGet`/`comecar()`.
- **Nunca cortar texto com "…"** (13/10/2026): quando um texto não cabe, a letra diminui até caber; se nem assim couber,
  passa à linha de baixo. No VisualHost o título/descrição da barra de cima já fazem isto (`useTituloAjustado`).
- **Nunca duas linhas de botões.**
- **Responsividade: os 5 pontos de quebra do painel** (os mesmos da maquete, `generated/maquete.css`): ecrã grande
  (>1600), computador (1301–1600), portátil (1051–1300), tablet (769–1050) e telemóvel (≤768). Cada página fica
  organizada da mesma forma nos 3 de computador (a coluna da direita fica à direita, só mais estreita); no tablet e no
  telemóvel as colunas passam a uma. Antes de entregar, confirma-se do nosso lado nos 5 (1920, 1440, 1280, 1024, 390),
  sem mostrar imagens ao Silva.
- **Imagens nunca vão para o Silva** (confirma-se do nosso lado com medições) — ver "Verificação visual de alterações
  de UI".
- **Primeiro só a vista de computador.** A vista de telemóvel (390 px) só se mostra depois de todas as alterações
  estarem feitas e aprovadas pelo Silva (13/10/2026).
- **Antes de publicar:** fazer todas as rectificações, mandar o comando do ponto 6 (dois ecrãs), esperar que o Silva diga
  que está bom, e só publicar quando ele disser "publica" (ver "Como se trabalha com o Silva").

# Encomendas e contabilidade no painel (Silva, 21/10/2026)

- **Copia-se, não se redesenha**: os componentes do site/dashboard antigo (`EncomendasListSection`, `CotacoesSection`, `EncomendasClientesSection`,
  `ContabilidadeTable`…) entram no painel tal e qual, com as mesmas rotas; só muda o enquadramento (`.vh-site` / `.tw-livre`).
- **A gestão, incluindo a contabilidade, é sempre no Admin** (`encomendas-admin.tsx`: Admin › Encomendas e contabilidade › Encomendas
  (separadores Encomendas e Contas) e Contabilidade). **O menu Gestão é para o cliente**: Compras e encomendas › Encomendas e Facturação
  (`encomendas.tsx`, `facturacao.tsx`) — abertas a todos os clientes e profissionais.
- **O caminho que começa no site acaba no painel certo**: quem tem hospedagem ou domínio entra no painel (`/host:2026`) e vê as encomendas em
  Compras e encomendas; quem só tem encomendas fica no `/encomendas` do site, que tem a ligação "Domínios e hospedagem" (→ `/precos` →
  checkout) — ao pagar, a conta passa a cliente e o login leva ao painel. O checkout e o pagamento ficam como estão.
- **Quem só tem encomendas fica no `/encomendas`** (Silva, 26/10/2026: "é lá onde elas devem ficar"): o painel antigo, onde adiciona, gere, cancela e elimina
  encomendas, com uma faixa de publicidade de domínio, hospedagem e e-mail (`PromoProdutos`, só para o papel `guest`). O login e o `/guest` (que só redirecciona)
  levam para lá (`getRedirectPathForRole`). Ao comprar só um domínio passa para a vista compacta do vhost (a barra vermelha); ao comprar hospedagem, para o painel
  do pacote. Não se passa este painel para o vhost.

# Segurança dos sites do servidor (Silva, 21/10/2026)

- **Ficheiros em `deploy/seguranca/`**, instalados no Contabo: `vd-bloqueio.conf` + `vd-bloqueio.inc` + `vd-bloqueio-instalar` (nginx) e
  `vd-guarda-sites`. O cron `/etc/cron.d/vd-guarda` corre a guarda de 5 em 5 minutos (só o que mudou), o instalador do bloqueio de 10 em 10 (aplica-o
  também aos sites novos e desfaz tudo se o nginx ficar inválido) e um varrimento completo às 03:30.
- **Bloqueio no nginx, antes do PHP**: endereços de spam `?ITMCODE=` / `?sale/search…` → 410; sondas de portas dos fundos (`filefuns.php`,
  `/cache.php`, PHP em `images/`, `uploads/`…) → ligação fechada (444); `xmlrpc.php` e `wp-login.php` limitados por IP verdadeiro (30/min, folga de 20).
  **Não se usa fail2ban sobre os registos do Apache**: o tráfego que passa pelo proxy aparece lá com o IP do próprio servidor (169.58.148.144) e
  bloquearia o servidor a si mesmo.
  **Excepção, aamihe.com (22/10/2026):** o Apache já regista o IP verdadeiro do visitante (ficheiros `apache2.conf_vd-ip-real` e
  `apache2.ssl.conf_vd-ip-real` em `/home/aamihe/conf/web/aamihe.com/`: desligam o `mod_rpaf`, que com o `X-Forwarded-For` presente desfazia o
  `mod_remoteip`). **Desde 26/10/2026 todos os sites têm o IP verdadeiro** (ficheiro global, ver "Contas ligadas… IP"): o fail2ban sobre os registos do Apache já é possível.
  **WordPress:** `DISABLE_WP_CRON` só se usa com um cron do sistema que corra `wp cron event run --due-now` (aamihe.com: de 15 em 15 min, criado
  com `v-add-cron-job`); sem ele as tarefas do WordPress nunca correm. **Só Moçambique:** regra do Cloudflare "Só Moçambique" no aamihe.com
  (bloqueia tudo o que não vem de MZ, exceto o servidor e `/.well-known/`).
- **`xmlrpc.php` bloqueado por completo (444) nos domínios de `/etc/nginx/vd-xmlrpc-bloquear.lista`** (cópia em `deploy/seguranca/`), só enquanto o site
  não tiver o plugin Jetpack (que o usa). Hoje: os 6 sites da Osher. Para juntar um site, acrescenta-se o domínio à lista (o instalador aplica em
  10 minutos, ou corre-se `/usr/local/sbin/vd-bloqueio-instalar`).
- **A guarda procura por comportamento, não por assinaturas** (o Maldet/ClamAV deram 0 detecções neste código): pastas de nome repetido com
  `cache.php`/`index.php`, imagens/sons/fontes/vídeos que começam por `<?php`, `.htaccess` que só deixam correr `index.php|cache.php`, código ofuscado
  (goto + eval, md5(md5(md5()). Move para `/root/quarentena-guarda/<data>/` (nunca apaga, `chmod 000`), regista os hashes em `/var/log/vd-guarda.log` e
  avisa por e-mail. `VD_SIMULAR=1 /usr/local/sbin/vd-guarda-sites completo` mostra o que faria sem mover nada.
- **Maldet 1 vez por dia** (04:30, `nice`/`ionice`; era 3 vezes por dia, 43 a 97 minutos cada, com 0 detecções): `/etc/cron.d/vd-antivirus` (cópia do
  anterior em `/root/backups-removidos/`). A lista de zonas sensíveis (`vd-av-watchlist-scan`) continua 3 vezes por dia.
- **Pasta `app/` do mltmark apagada (21/10/2026)**: era uma instalação antiga do WordPress, quase sem uso, com um `wp-config.php.bak-hetzner-creds`;
  cópia comprimida só do root em `/root/backups-removidos/mltmark-app-2026-10-21.tar.gz`.
- **Quarentena do mltmark (17/08 e 26/05, restaurado de cópia de segurança)**: `/root/quarentena-mltmark-2026-10-21/` e `/root/quarentena-guarda/`.

# PHP: falhas críticas de 21/10/2026 — CVE-2026-109618 e CVE-2026-109619 (aviso recebido a 27/10/2026)

- **O que é:** duas falhas que dão execução remota de código sem login, já exploradas, em todo o PHP que serve pedidos (PHP-FPM incluído). Versões corrigidas: **8.5.12, 8.4.27, 8.3.36 e 8.2.35** (a 8.2 acaba a
  31/12/2026); a 8.1 e as anteriores não têm correcção oficial. Nos pacotes da distribuição a correcção chega **sem mudar o número da versão** (o changelog traz `CVE-2026-109618_109619.patch`): ver o changelog, não só a versão.
- **Só se corrige actualizando E reiniciando** todos os PHP-FPM; sem reinício o código velho continua a correr. Atenção aos **`vd-php-fpm-<versão>-<conta>` de cada conta** (`deploy/php-conta/`): correm o mesmo binário
  `/usr/sbin/php-fpm<versão>` mas o `apt` não os conhece, por isso não reiniciam sozinhos com a actualização.
- **Como se faz:** workflow manual `ops-php-seguranca.yml` (Actions › Run workflow), por fases: `verificar` (só lê: versões, changelog, processos ainda com o binário antigo, mod_php, estado dos sites), `indicios` (só lê: ficheiros PHP novos
  onde não devem estar, crons, chaves SSH, ligações de saída desde 21/10) e `actualizar` (só com «confirmar» marcado, ordem expressa do Silva: «avança»; simula e aborta se removesse pacotes, guarda o estado em
  `/root/php-seguranca-<data>/`, actualiza só `php*`, reinicia um a um os PHP-FPM partilhados e os de cada conta e confirma os sites; falha se `basededadosagro.com` ou `visualdesignmoz.com` não derem 200). Antes de «actualizar»,
  o Silva cria uma cópia/instantâneo do servidor no painel do servidor. Nunca se toca no pm2 nem no nginx.
- **Feito a 27/10/2026:** PHP 8.3.33 → **8.3.36** (única versão instalada) com os 6 PHP-FPM reiniciados (o partilhado e os das contas concordia, mltmark, oshercollective, provisualcorporate, vdadmin), 0 processos com o binário antigo, sites em 200; a lista de pacotes e a configuração de antes estão em `/root/php-seguranca-20261027-2258/`. **Por fazer:** o PHP vem de um repositório externo ao Ubuntu, que normalmente não entra nas actualizações de segurança automáticas — ver o PHP todos os meses (`ops-php-seguranca.yml`, fase `verificar`); a chave `/root/.ssh/app_self_key` apareceu alterada desde 21/10 e falta o Silva confirmar que foi ele ou o painel.

# Bloqueio por tentativas falhadas no login (Silva, 26/10/2026)

- **Ligado outra vez** (esteve desligado desde 13/10): depois de 5 tentativas falhadas em 5 minutos a
  mesma rede e conta ficam 15 minutos bloqueadas, com o aviso numa linha — "Bloqueado por tentativas falhadas. Volte a tentar daqui a N min." (`mensagemBloqueio` em
  `src/lib/login-rate-limit.ts`; vale para o login do site, o do painel e a mudança de palavra-passe). **Precisa da tabela e das funções na base de dados**
  (`scripts/migrate-login-rate-limit.sql`, com RLS e permissões só para o servidor; criadas a 26/10/2026): sem elas falha "aberto" e deixa entrar —
  confirmar depois de publicar que o 6.º erro seguido devolve 429. Nunca desligar sem o Silva pedir.

# DNS de e-mail: SPF, DKIM e DMARC de todos os domínios (Silva, 26/10/2026)

- **Um só SPF e um só DMARC por domínio** (dois registos invalidam-nos). O site garante-o em `upsertCloudflareRecord` (`src/lib/cloudflare-dns.ts`): compara sem as aspas que
  o Cloudflare põe nos TXT criados à mão e apaga o "órfão"; **nunca baixa um DMARC mais estrito** (`quarantine`/`reject`) para o padrão `p=none`.
- **Padrão de um domínio novo:** SPF `v=spf1 include:spf.brevo.com ip4:<servidor> ~all`, DKIM do Brevo (`brevo1`/`brevo2._domainkey`) e do servidor (`mail._domainkey`), DMARC
  `p=none; rua=mailto:rua@dmarc.brevo.com; fo=1`. Só se sobe a política depois de um e-mail de teste do Brevo ao Gmail mostrar SPF, DKIM e DMARC em PASS
  (Gmail › ⋮ › Mostrar original). Subida feita a 26/10/2026: `quarantine; pct=25` em 10 domínios, depois 100% se ninguém se queixar.
- Os nameservers contam: um domínio com o DNS fora do Cloudflare (ex.: shalomdeco.com em ibspark.com) não recebe nada do que o site escreve na zona. O "Reprocessar DNS" (Gestão
  de domínios) só dá os nameservers por certos se forem `ns1`…`ns4.visualdesignmoz.com` ou os do Cloudflare, e pede a verificação da zona parada quando já os usa.

# Contas ligadas: sessões do WordPress e do webmail, histórico por sessões e IP (Silva, 25/10/2026)

- **Caso que deu origem (Tatiana, oshercollective.com):** o ModSecurity (regra OWASP `932105`, "Unix Command Injection") bloqueava com 403 e a página "Access Denied" o CSS que
  ela guardava no Editor do Site e no WPCode (`{ top:` lido como o comando `top`). **Excepção só nesse site:** `/home/oshercollective/conf/web/oshercollective.com/apache2.ssl.conf_vd-modsec-css`
  (`SecRule` em fase 1 com `ctl:ruleRemoveTargetById=932105;ARGS:wpcode_snippet_code` e `…;ARGS:styles.css`, só em `/wp-admin/admin.php` e `/wp-json/wp/v2/global-styles/`).
  `SecRuleUpdateTargetById` não funciona dentro de um site ("no ruleset in this context"). Um 403 de cliente investiga-se em **Admin › Contas ligadas › Histórico**: mostra a regra e o campo.
- **Agora** mostra também as sessões abertas no WordPress (`/wp-admin` com resposta 200) e no webmail (Roundcube, `session.expires_at`), lidas do servidor por
  `src/lib/vhost-actividade-servidor.ts` (um script Python só de leitura, `nice`, 45 s de memória; os registos do Apache rodam à meia-noite, por isso há cerca de 24 a 48 h de história do servidor).
- **Histórico** = uma linha por sessão (painel: cliques de `vhost_activity_history`, pausa de 30 min separa sessões; WordPress: registos do servidor). Clicar abre o detalhe no próprio
  separador, como sub-endereço do painel (`/admin/ligados/historico/<sessão>`): o caminho **Contas ligadas › Histórico › Sessão de …** fica na barra do selector de domínios (`crumbs`) e há um
  "Voltar" discreto (nunca um caminho dentro da página). O mais recente fica sempre em cima (lista por última actividade; detalhe da hora mais recente para a mais antiga).
  Detalhe: **Acção | Hora | Resultado** de cada passo (OK, Bloqueado, Erro, Falhou), com a regra e o campo do ModSecurity, e as tentativas repetidas juntas
  ("Tentativas de guardar CSS… ×5"). Não há separador "Actividade". `src/lib/vhost-historico-sessoes.ts` e `/api/vhost/presenca/historico`.
- **Limpar histórico:** o PostgREST do Supabase recusa `DELETE` sem filtro (`safeupdate`), por isso "todas as contas" filtra por data. O que vem dos registos do servidor não se apaga:
  `vhost_history_limpeza` guarda uma marca e esconde o que for anterior (as duas tabelas/colunas novas estão em `supabase-vhost-activity-history.sql`, que o deploy aplica).
- **IP:** o painel mostra o IP de cada sessão. O do painel vem dos cabeçalhos do pedido e fica guardado com cada acção (`vhost_activity_history.ip`, depois do deploy): a presença em memória
  só dura 30 min e perde-se a cada reinício do site, por isso sem isto o IP desaparecia. **Nos sites WordPress o IP é o do visitante em TODOS os sites, também nos novos (26/10/2026):**
  `/etc/apache2/conf.d/vd-ip-real.conf` (global, lido depois dos módulos) desliga o `mod_rpaf`, que o Hestia deixa ligado e que fazia o Apache e o PHP verem sempre o IP do servidor; o
  `vd-bloqueio-instalar` (cron de 10 em 10 min, `deploy/seguranca/`) volta a criá-lo se alguém o apagar, sempre com `apache2ctl configtest` antes de recarregar. O nginx já resolvia o IP
  verdadeiro por trás da Cloudflare (`cloudflare.inc`). Os ficheiros `apache2.conf_vd-ip-real` por domínio (aamihe, Osher) ficam e são inofensivos.

# CPU e memória por conta, certificados e DNS (Silva, 26/10/2026)

- **Cada conta tem o seu CPU e a sua memória, vindos do pacote** — para uma conta não gastar o CPU de todo o servidor e afectar os outros sites. **Nenhum pacote fica "ilimitado"** (nem por
  defeito): o formulário de Pacotes cria pacotes novos com 100% / 100 ms / 1G / 512M (`PADRAO_RECURSOS`, `src/lib/pacote-hestia.ts`) e um campo em branco nunca vira ilimitado; só fica
  ilimitado se o administrador marcar "Ilimitado". Valores dos pacotes (CPU_QUOTA · memória · swap; período 100 ms): Starter 25% · 256M · 128M; Email-Basico 50% · 512M · 256M; Email-Premium
  75% · 768M · 384M; Email-Business 100% · 1G · 512M; VHost-Basico e Pro-Basico 150% · 1G · 512M; VHost-Pro 200% · 1536M · 768M; VHost-Premium e Pro-Premium 250% · 2G · 1G; VHost-Business e
  Pro-Business 300% · 3G · 1G; default 300% · 3G · 1G; system 100% · 1G · 512M (100% = 1 núcleo; o servidor tem 6). Cópia dos pacotes de antes: `/root/backups-removidos/pacotes-cpu-2026-10-26/`.
- **Como se aplica:** `RESOURCES_LIMIT='yes'` no Hestia (`v-add-sys-cgroups`) limita a shell e os crons da conta (fatia `user-<uid>.slice`), mas **o PHP dos sites corre num serviço partilhado e ficava
  de fora**. Por isso `vd-php-conta` (`deploy/php-conta/`) dá a **toda a conta com limites o seu PHP-FPM** (`vd-php-fpm-<versão>-<conta>`, com as mesmas extensões do partilhado) e põe nele
  `CPUQuota`, `MemoryHigh` (= MEMORY_LIMIT), `MemoryMax` (1,5×) e `MemorySwapMax`. Uma conta que passa o seu CPU fica mais lenta; as outras nem sentem. O cron de 5 em 5 minutos
  (`vd-php-conta sincronizar`) trata de contas novas e de limites que mudam; mudar um pacote no painel reaplica-o às contas dele (`v-change-user-package` com FORCE) e em minutos o
  serviço tem os limites novos. Conta com "unlimited" fica no PHP-FPM partilhado. **Desde 26/10/2026 as 6 contas** (aamihe, concordia, mltmark, oshercollective, provisualcorporate, vdadmin) **têm
  PHP-FPM próprio com limites**; o partilhado ficou só com os pools `dummy` e `www`. Para tirar uma conta: `vd-php-conta repor <conta>` (e pôr "unlimited" no user.conf). Nunca apagar à mão
  as unidades `vd-php-fpm-*`. Um 403 do nginx ao `wp-login.php` num pedido feito de dentro do servidor (IP do próprio servidor) é normal: confirma-se de fora.
- **Certificados:** o Hestia só renova (cron diário 06:50, `v-update-letsencrypt-ssl`) os domínios com `LETSENCRYPT='yes'`; os que ficaram `no` (certificados trazidos do servidor anterior) nunca renovavam.
  Em 26/10/2026 passaram a `yes` e a renovar sozinhos: oshercollective.com e menocrazy.app, mltmark.com, concordia.co.mz, visualdesignmoz.com e basededadosagro.com (site), e os certificados de
  e-mail da concordia.co.mz e da provisualcorporate.co.mz. Sites que estão na Vercel (ex.: o site da provisualcorporate) não precisam de certificado aqui (a Vercel emite o seu); só o e-mail
  (`mail.<domínio>`, `v-add-letsencrypt-domain <conta> <domínio> '' yes`). **Pendentes:** os certificados de e-mail do mltmark.com e do basededadosagro.com precisam do registo A `webmail.<domínio>`
  na Cloudflare (sem ele o Hestia recusa); o shalomdeco.com não está delegado na Cloudflare (nameservers `ns1/ns2.ibspark.com` no registador) e a dona vai tratar dele. Antes de renovar um domínio
  crítico (visualdesignmoz.com, basededadosagro.com): copiar `/home/<conta>/conf/web/<domínio>` e comparar a resposta (código e tamanho) antes e depois.
- **Sites na Vercel não levam SSL daqui** (Silva, 26/10/2026): `alojamentoVercel` (`src/lib/hospedagem-dns.ts`) vê pelo DNS se o site está na Vercel — nameservers `…vercel-dns.com`, ou o domínio/www
  com CNAME `…vercel-dns.com` ou IP 76.76.21.x / 66.33.60.x (com nameservers da Cloudflare só se vê pelo registo: é o caso de aamihe.com, provisualcorporate.co.mz e dos subdomínios
  community.oshercollective.com e app.menocrazy.app). `issueLetsEncrypt` e o pedido automático ao criar conta/site já não pedem certificado a esses domínios (respondem "está na Vercel"); o
  certificado de **e-mail** (`mail.<domínio>`) continua a pedir-se, porque o correio corre aqui.
- **Só o administrador altera CPU e memória dos pacotes** (`pacote-gravar`/`pacote-apagar` respondem 403 a quem não é administrador; o revendedor só atribui os Pro-…; "limites próprios" de uma
  conta ainda não chegam ao servidor). Um limite é um **tecto**, não uma reserva: a soma dos tectos pode passar os 600% do servidor; o que conta é o consumo real.
- **Spam de pesquisa do WordPress (`/?s=…` sem referer)** leva 403 no nginx, antes do PHP, nos domínios de `/etc/nginx/vd-busca-spam.lista` (cópia em `deploy/seguranca/`; o `vd-bloqueio-instalar`
  aplica-o): o mltmark.com chegava a 47 mil pesquisas por dia (74% de todo o tráfego, 84% robôs). Uma pesquisa verdadeira sai de uma página do próprio site e leva referer. Juntar um site =
  acrescentar o domínio à lista; não pôr aplicações que usem `?s=` sem referer.
- **Força bruta ao wp-login (fail2ban, 26/10/2026):** o jail `vd-wp-login` (cópias em `deploy/seguranca/fail2ban/`: filtro em `/etc/fail2ban/filter.d/vd-wp-login.conf`, jail em `/etc/fail2ban/jail.d/vd-wp-login.local`) bloqueia
  24 h nas portas 80/443 (cadeia `WEB` do Hestia) o IP com 6 logins falhados (POST `/wp-login.php` com resposta 200; um login com sucesso responde 302) em 6 horas (eram 8 em 5 minutos, mas os atacantes
  vão devagar: o 91.92.243.247 fez 90 tentativas em 5 h, no máximo 2 por 5 min, e nunca era apanhado). Só vale para sites **sem
  Cloudflare à frente** (oshercollective.com, msdn-moz.org, elimservicos.com): atrás da Cloudflare o iptables só vê os IPs dela e o bloqueio faz-se na Cloudflare. O fail2ban tira a data da linha antes de
  aplicar o filtro: não se escreve `[data]` na expressão. Para juntar um site, acrescentar o seu registo ao `logpath`. O primeiro bloqueio é de quem já atacava o msdn-moz.org (4 223 logins falhados num dia).
- **Cron do WordPress pelo sistema** (26/10/2026): oshercollective.com, msdn-moz.org, lirandzojewelry.com e mltmark.com têm `DISABLE_WP_CRON` e um cron do Hestia por site (de 15 em 15 min, minutos desfasados,
  `flock -n … nice -n 10 wp cron event run --due-now`, na conta do próprio site: gasta o CPU dela). Tira os `wp-cron.php` por visita (cerca de 500 por dia no Osher, 600 no mltmark). **Cuidado:**
  `wp cron event list --due-now --format=count` conta TODOS os eventos agendados, não só os que estão em atraso (e `next_run_relative` é o tempo até à próxima execução): não serve para medir atrasos.
- **Actualizações automáticas** (26/10/2026): plugins e temas dos 3 WordPress do Osher (inclui o Elementor); o WP Offload Media passou a 3.4.3 em todos. O WordPress em si segue as actualizações de segurança
  automáticas por defeito. Se uma actualização estragar um site: `wp plugin install <plugin> --version=<anterior> --force` e `wp plugin auto-updates disable <plugin>`.
- **Apagar um domínio: o popup pergunta o que apagar** (Silva, 26/10/2026; `apagar-site.tsx`, `dominios.tsx`, rota `dominio`). Antes o botão "Apagar" só apagava o site (vhost + ficheiros) e deixava e-mail, DNS e **bases de dados** (foi o que
  aconteceu com o aamihe). **É para todas as contas e todos os planos, cada uma nos seus domínios** (o revendedor nos dos seus clientes, o administrador em todos; o servidor confirma sempre com `verificar` que o domínio é da conta de quem
  pede) — nunca se restringe a administrador. As escolhas dependem do que o domínio tem: **site** → *Só o site* (o de sempre), *O site e a base de dados* (também a base do WordPress e os crons desse site) e *Tudo* (site, base, e-mail com as
  caixas e DNS, via `dominio-eliminar-tudo` com `bd`); **só e-mail** → *Só o e-mail* ou *Tudo*; **só domínio** (plano VD-Dominio) → *Tudo*. A base vem do `wp-config.php` do site (`DB_NAME`) e só se apaga se mais nenhum site da conta a usar;
  os crons são os que apontam para a pasta do site; se o site não for WordPress a base não se apaga e o aviso diz porquê. **Nunca** se apagam daqui o painel, o visualdesignmoz.com nem o basededadosagro.com (`PROTEGIDOS`). A página
  "Sites das contas" (administrador, contas de outros) continua com o seu "eliminar tudo" (sem a base).
- **Cópias de segurança fora do servidor: Cloudflare R2** (decidido pelo Silva a 26/10/2026). Balde **`arquivobackup`** (o R2 só aceita minúsculas, números e hífens: o nome pedido foi "ArquivoBackup"; região WEUR).
  `deploy/backup/vd-backup-externo` (instalado em `/usr/local/sbin`) envia as cópias do Hestia (`/backup/*.tar`) **cifradas no servidor** (rclone crypt: nome e conteúdo ilegíveis no R2; remotos `vd-backup-r2` e `vd-backup-cifrado` em
  `/root/.config/rclone/rclone.conf`, modo 600), com `nice`/`ionice` e limite de banda, guarda 14 dias e avisa por e-mail se falhar; `estado` e `testar-restauro` provam que funciona. A chave do R2 só tem acesso a este balde (token
  "vd-backup-externo (balde arquivobackup)" na conta Cloudflare). **Só IPv4** (`RCLONE_BIND=0.0.0.0` no script): pela ligação IPv6 deste servidor o R2 recusa o aperto de mão TLS ("tls: handshake failure"). A palavra-passe de cifra
  (password e password2) **existe também fora do servidor**: foi gravada no Mac do Silva em `~/Desktop/chave-cifra-backups-visualdesign.txt` para ele a guardar num gestor de palavras-passe; sem ela as cópias não se abrem. O R2 é grátis até 10 GB
  (as cópias ocupam cerca de 6 GB: acima disso paga-se cêntimos). O aamihe ficou com 12 MB (só correio); a cópia do site está em `/root/backups-removidos/aamihe-site-final/`.
  **Estado (26/10/2026):** primeiro envio feito (13 cópias, 5,9 GiB no R2) e `testar-restauro` passou. Só se enviam cópias com menos de 14 dias (`--max-age`), as mais velhas nem sobem. **O cron diário `/etc/cron.d/vd-backup-externo` (07:00) foi instalado a 27/10/2026 por ordem do Silva** (workflow `ops-php-seguranca.yml`, fase `cron-envio`; `enviar-copias` envia já); o envio já não é manual. **Confirmado a 28/10/2026:** correu às 07:00:11 e acabou às 07:01:25 (19 objectos, 7,773 GiB no R2), com as seis cópias de 27/10 lá.

- **Backup manual corre já, mesmo havendo agendamento** (Silva, 27/10/2026: «pode ser algo urgente… não podemos depender do programa do servidor»). Admin › Backups › «Backup de todas as contas» e «Fazer backup agora» (por
  conta) já não passam pela fila do servidor (`v-schedule-user-backup` recusava com «backup is already scheduled» quando havia um agendado): lançam `v-backup-user` em segundo plano, uma conta a seguir à outra, com
  `nice`/`ionice` (trabalho `backup-agora` em `vhost-admin-py.ts`), e a página mostra o registo do trabalho. **Cada cópia tem a coluna «Acção» com Restaurar, Baixar e Apagar** (Silva, 27/10/2026: «está a faltar acções»; as mesmas opções continuam em «Opções» para várias linhas) e cada conta, em Contas, «Fazer backup agora». «Baixar» é
  `/api/vhost/admin-servidor?ver=bk-descarregar&conta=…&f=…` (só administrador; só aceita nomes `<conta>.<data>.tar` que o próprio servidor lista para essa conta; envia por fluxo, há cópias de GB). **No telemóvel (Silva, 27/10/2026): a lista de cópias e a de contas ficam como no computador, com deslize horizontal para ver o que está escondido (`empilhar={false}`), cada linha numa só linha (o nome da cópia leva `ad-cmd-1l`: sem partir), e a descrição do cartão numa só linha (`Resumo baseNaoNoTelemovel`: sai o texto de base, ficam só «7 cópias | em /backup | guarda 2 por conta»).** **As duas tabelas (Cópias e Contas) levam `key` própria:** sem ela o React reaproveitava a mesma tabela ao mudar de separador e as colunas escolhidas na primeira escondiam «Conta» e «Última cópia» na segunda (Silva, 27/10/2026: «coloque o nome da conta e não apenas o número»). Nunca voltar a pôr a fila neste botão; o agendamento semanal (domingo 05:10) continua como estava. **Antes de lançar, o painel lê de novo o que o servidor está a copiar** (`ver=backups-fila`: processos `v-backup-user` e a fila dele): se houver uma fila a correr, abre um popup que diz o que está a copiar e o que espera na fila e pergunta «Continuar mesmo assim?»
  (as contas que já estão a ser copiadas ficam de fora, duas cópias da mesma conta ao mesmo tempo estragam-se); se já houver um backup manual a correr, só avisa.

- **As mensagens ao utilizador dizem "Vhost", nunca "Hestia"** (Silva, 26/10/2026: "em vez de dizer o Hestia, dizer Vhost"). Erros, avisos, toasts e textos do painel que falam do servidor
  usam "Vhost" (ex.: «O Vhost demorou a responder…»), e a tradução em inglês em `src/components/vhost/generated/data.ts` acompanha (a chave em português tem de ser igual ao texto do código).
  Só mudam os textos que se vêem: nomes de funções, ficheiros, comandos (`v-…`), variáveis (`HESTIA_HOST`), caminhos e registos internos (`[cron/hestia-sync] …`) ficam como estão. Ficaram
  de fora por trocarem o sentido (ver o relatório ao Silva): a tabela "o que o Hestia já faz / o que o VisualHost completa" (`data.ts`, `screens.tsx`, `ui.tsx`), «Atualizações › Hestia e VisualHost»,
  «Painel Hestia» (o painel do próprio Hestia) e «Hestia {versão}» em Sistema (a versão não é do Vhost).
- **Mensagens públicas não nomeiam fornecedores; as de administração vêm explícitas** (Silva, 26/10/2026: "não quero em nenhum lugar referência de fornecedores, nem Cloudflare, nem Brevo, nem Contabo" e, a seguir,
  "os erros para admin já devem vir explícitos, deve-se perceber que é o Supabase que quer configurações; apenas mensagens públicas"). **Público** (clientes, revendedores, visitantes: rótulos, avisos, toasts, e-mails ao
  cliente, relatório do DNS, respostas das rotas) diz «DNS», «envio de e-mail», «servidor» ou «Vhost» e, quando algo falha por causa de terceiros, uma frase genérica que diz o que fazer a seguir («O pedido não foi
  aprovado. Tente de novo dentro de instantes; se continuar, contacte o suporte.»); se o erro for do próprio utilizador, diz o caminho certo (ex.: «A palavra-passe precisa de pelo menos 8 caracteres.»), sem nomes de terceiros.
  **Administração** (rotas `/api/admin/*`, diagnósticos, crons, registos de consola) mantém o erro real e explícito («Supabase Service Role não configurado», «BREVO_API_KEY não configurada», «Sem zona Cloudflare…»).
  **Como se faz:** as bibliotecas devolvem sempre o erro real; é na fronteira da rota que se decide, com `mensagemPublica(erro, admin, quando)` de `src/lib/mensagem-publica.ts` (administrador: o erro tal como veio;
  os outros: a frase nossa se não tiver terceiros nem pormenores técnicos, senão `quando`). Aplicado em `/api/vhost/dominio` (incluindo o relatório do «Reprocessar DNS»), `/api/vhost/email` e `/api/panel-dns`;
  qualquer rota pública nova que devolva um erro de uma biblioteca tem de o passar por aqui. A tradução inglesa de `data.ts` acompanha (a chave em português tem de ser igual ao texto do código). Fica visível, por ser
  dado e não mensagem: os valores de registos DNS que o cliente tem de copiar (`include:spf.brevo.com`, os nameservers atribuídos), nomes de variáveis, identificadores e nomes de ficheiros. Dynadot saiu dos textos que
  o cliente vê («registador», «Recuperar o domínio»); Vercel aparece só no aviso do certificado de sites de clientes alojados lá.
  **A tabela técnica** («equivalente no painel anterior / situação no servidor», em `data.ts`, `screens.tsx` e `ui.tsx`) e as frases em impessoal dizem «o servidor», «o painel» e «o painel anterior», sem nomes de ninguém, nem de terceiros nem nossos (Silva, 27/10/2026: «não deixe nome de ninguém, nem em primeira nem em terceira pessoa»; ex.: «Bloqueado por tentativas falhadas. Volte a tentar daqui a 15 min.»). Ficam os nomes de comandos (`v-…`) e de tecnologias que o cliente usa (WordPress, PHP, Apache, Nginx).
- **Ligar o e-mail de um domínio faz o mesmo que o botão "Reprocessar DNS"** (Silva, 26/10/2026): no ecrã de e-mail, um domínio sem e-mail neste servidor mostra «Ligar o e-mail neste domínio» (o nome antigo), **sem nenhuma janela**: ao clicar processa logo (aviso rápido no ecrã) e faz o mesmo que o «Reprocessar DNS» de Domínios › Gerir domínio, que também já não pede confirmação (Silva, 26/10/2026: «não quero popup nenhum»). O pedido `dns-reprocessar` leva `ligarEmail: true`: liga primeiro o domínio de e-mail (`v-add-mail-domain`, 60 s de limite) e repõe a
  seguir os registos na Cloudflare (MX, SPF, DKIM, DMARC, mail/webmail). Os pedidos `v-add-mail-domain` e `v-delete-mail-domain` têm folga de 60 s (HTTP e SSH). **A falha «O Vhost demorou a responder» no painel local não era a demora:** a porta 8083 do Hestia só responde ao próprio servidor, por isso, a partir do computador do Silva, o pedido esperava 5 s e desistia sem sequer chegar ao Hestia (as leituras `v-list-*` caíam para SSH, as alterações não — confirmado a 26/10/2026 com o `hestiaCall` a correr no Mac). `hestia-client.ts` sonda a porta (`apiAlcancavel`: 2,5 s, com memória de 60 s) e, se não abre, vai logo por SSH, também nas alterações; em produção a porta abre e nada muda. **Um domínio de e-mail ligado no Hestia não chega:** sem MX/SPF/DKIM na Cloudflare o e-mail não entra nem sai bem
  (ver `producoes.visualdesignmoz.com`, 26/10/2026: só tinha o registo A e o servidor respondia «550 relay not permitted»).
  **Subdomínios:** os registos de e-mail de `sub.exemplo.com` vão para a zona do domínio principal (`exemplo.com`) com nomes relativos a essa zona (`nomeNaZona` em `domain-email-auth.ts`: MX/SPF em `sub`, `mail.sub`, `_dmarc.sub`, DKIM `…._domainkey.sub`). Antes procurava-se uma zona com o nome do próprio subdomínio, não se achava e os registos iam para o DNS interno do servidor, onde falhavam todos (26/10/2026: 11 falhas em `producoes.visualdesignmoz.com`).
- **O IP do Silva nunca se bloqueia** (Silva, 26/10/2026: "negar bloqueio do meu IP, nunca fazer isso"). Qualquer mecanismo que bloqueie, limite ou recuse IPs (fail2ban, firewall, nginx, Exim, ModSecurity,
  `vd-banir-ips`, limites do painel) **tem de isentar o IP dele desde o primeiro dia**; um bloqueio novo sem essa isenção é um erro. IPs conhecidos: `41.220.201.71` (o de 26/10) e `41.220.201.107`; mudam
  dentro da rede 41.220.201.x, por isso, se ele se queixar de um bloqueio, ver primeiro qual é o IP actual (`echo $SSH_CLIENT` numa sessão SSH) e acrescentá-lo **nos cinco sítios**: fail2ban
  (`/etc/fail2ban/jail.d/zzz-ip-silva.local`, mais o `ignoreip` de `vd-wp-login.local`; `phpmyadmin-auth` e `recidive` já ignoram os intervalos de Moçambique em `zz-mocambique.local`), Exim
  (`/etc/exim4/white-blocks.conf`: sem isto o Exim recusa por Spamhaus/SpamCop as ligações sem autenticação; o correio autenticado nunca foi recusado), `/etc/vd-banir.permitidos`, o `geo $vd_ip_livre`
  de `/etc/nginx/conf.d/vd-bloqueio.conf` (limite do `wp-login.php`/`xmlrpc.php`, que responde 429) e os ficheiros de `deploy/seguranca/`. O limite de tentativas de entrada do painel (`src/lib/login-rate-limit.ts`, 6 falhas em 5 min = 15 min bloqueado, chave IP+e-mail) também o isenta: lê os IPs de `/etc/vd-banir.permitidos` (o mesmo ficheiro do `vd-banir-ips`; memória de 60 s) e usa o `x-real-ip` posto pelo nginx, nunca o `x-forwarded-for`: o nginx acrescenta ao que o visitante escreveu, e ele podia fugir ao limite com um IP por tentativa ou bloquear outra pessoa de propósito (corrigido a 26/10/2026; a porta 3002 do painel não responde de fora, por isso o `x-real-ip` é de confiança). O IP do Silva (41.220.201.71) está na lista Spamhaus XBL: o Exim só o recusava nas ligações sem autenticação (SMTP directo, porta 25).
- **ModSecurity sem leitura das respostas só no oshercollective.com** (26/10/2026, o Silva confirmou): `apache2.ssl.conf_vd-modsec-resposta` (`SecResponseBodyAccess Off`) nesse site. As regras `RESPONSE-951`
  (fugas de erros de SQL) falhavam centenas de vezes por dia ("PCRE limits exceeded") nas páginas pesadas do Elementor, sem apanhar nada; não eram tentativas de acesso de ninguém. A protecção contra pedidos
  (o que quem visita envia) continua toda ligada: um `;cat /etc/passwd` e um `UNION SELECT` simulados continuam a dar 403. Nos outros sites não se mexeu (não têm essas falhas).
- **aamihe.com está na Vercel** (26/10/2026): a renovação Let's Encrypt do site no servidor foi desligada (`LETSENCRYPT='no'`; o certificado actual fica até expirar) e o cron `vd-banir` (que bloqueava IPs pelos registos
  do aamihe) saiu de `/etc/cron.d` (o script `deploy/seguranca/vd-banir-ips` fica, para outros sites atrás da Cloudflare). **A conta aamihe NÃO se apaga:** o correio do aamihe.com ainda é aqui (MX `mail.aamihe.com`, 3 caixas, 6,6 MB),
  há 2 crons de WordPress, a base `aamihe_aamihe_bd` e uma pessoa do painel ligada à conta.
  O Silva quer que a conta só ocupe espaço com correio (site de 623 MB e base de 71 MB a sair). **Cópia final verificada** em `/root/backups-removidos/aamihe-site-final/` (tar do Hestia de 25/10, dados do site em zstd testados, dump da
  base): o `v-delete-web-domain` só apaga o site (vhost, PHP, ficheiros), não toca no correio, nas caixas nem na zona DNS; a base e os 2 crons apagam-se à parte. **Feito a 26/10/2026 (o Silva confirmou por escrito):** crons, base `aamihe_aamihe_bd` e site apagados; a conta ficou com 59 MB (6,6 MB de correio, 3 caixas, IMAP e webmail iguais). O `Arquivo-AAMIHE.zip` (cópia do site que ele fez no gestor de ficheiros) ficou guardado em `/root/backups-removidos/aamihe-site-final/`.
- **"Reprocessar DNS"** cria agora também `webmail.<domínio>` (A, sem proxy), além de mail, ftp, pop, smtp, MX, SPF e DMARC: o Hestia exige-o para emitir o certificado de e-mail.
- **DNS:** o "Reprocessar DNS" não usa o servidor anterior (o IP vem do Hestia ou de `NEXT_PUBLIC_SERVER_IP`, que em produção é `169.58.148.144`); o IP do Hetzner (`37.27.17.25`) só podia vir de
  `deploy/env.production.template` e de `scripts/sync-directadmin-vercel-env.sh`, já corrigidos. Um domínio só tem o DNS da Cloudflare se os nameservers do registador forem os dela. Um domínio
  nunca leva dois registos SPF (o lirandzojewelry.com tinha um antigo, inválido, com o IPv6 do Hetzner: apagado).
- **msdn-moz.org:** `nginx.conf_vd-privado` e `nginx.ssl.conf_vd-privado` (em `/home/oshercollective/conf/web/msdn-moz.org/`) dão 404 ao `convidados.csv` (125 pessoas com e-mail), ao zip de instalação e às
  notas de instalação, que o nginx servia como ficheiros estáticos; os scripts PHP continuam a lê-los do disco.
- **Cartão «Registo do domínio» sem «—» quando o servidor sabe o valor** (Silva, 26/10/2026: «os espaços com dados em falta devem ser preenchidos porque existe no servidor»;
  `dominios.tsx`, rota `registrar/domain/manage`). Se a Dynadot não conhece o domínio (registado noutro registador), a rota devolve também `local`: datas e renovação
  automática do registo de renovações (`domain_renewals`), datas, trava de transferência e nameservers da consulta pública RDAP (`rdap.org`, 4 s de limite) e os contactos
  da conta (`contactPreview`). Os valores aparecem só para ver (interruptores e botões desativados); o que nenhuma fonte diz (ex.: privacidade WHOIS) fica «—», nunca
  inventado. O nome de cada informação do cartão (`.dom-info-l > span`) fica numa só linha (coluna de 176 px).

# Menu Admin do revendedor (Silva, 26/10/2026)
O revendedor só vê a sua conta e as dos clientes que criou (`vhost-dados.ts`, `visiveis`; `src/lib/vhost-revenda.ts` → `clientesDaRevenda`). Cada página do
nível Revenda parte dessa lista ou de uma rota que a aplica no servidor; **nunca** se liga um ecrã do Admin a `/api/vhost/admin-servidor` (só o administrador).
- Sem rota nova (usam `s.acc`): Uso por cliente, Estatísticas da revenda (sem histórico por mês: não é guardado) e Backups dos clientes (entra na conta do cliente e
  abre as cópias dele).
- `suporte-admin` (Tickets) e `notifications/admin` (Mensagem aos clientes) aceitam também o revendedor, limitados aos clientes dele (403/404 para os de fora).
- `/api/vhost/revenda`: IPs e Security.txt (só para ver) e Nameservers (`ns-conta`, só contas suas). Qualquer operação nova da revenda entra aqui, com o mesmo teste.
- **«Importar do cPanel»** (Silva, 27/10/2026: «permite o revendedor importar as contas que tem no cPanel para o painel; deve ser explícito»): é a importação a partir de um servidor
  cPanel **remoto** (como no DirectAdmin: lista de importações com «Nova importação» e, no início, servidor, porta, utilizador e palavra-passe). Não é a importação do Admin
  (ficheiros da pasta de backups do servidor, de todos). A página está desenhada (`revenda-paginas.tsx`, `importarCpanelPagina`) mas **a ligação ao servidor remoto ainda não
  existe**: o botão «Carregar contas» está desativado, diz-o na página e as credenciais não saem do navegador. Fazê-la é abrir ligações SSH do nosso servidor para servidores
  de fora a pedido de um utilizador — precisa de decisão do Silva (limites, registo e conta importada ligada à revenda por `parent_username`) antes de se escrever.
- «Zona DNS» é uma só entrada no menu da revenda (a mesma página da Gestão › DNS, do domínio escolhido): sem «dos clientes» no nome.

# Datas do painel: dia, mês e ano, com muitas formas à escolha (Silva, 27/10/2026)

- **Todas as datas do painel** (listas, cópias, mensagens, pedidos, ficheiros, renovações, encomendas) **seguem a escolha de Preferências › Idioma e data › Formato da data**, por omissão **dia/mês/ano** (`31/12/2026, 14:30`), nunca o ISO do servidor
  (`2026-12-31`). **Um só sítio**: `src/components/vhost/datas.ts` (`dataPt` para texto do servidor, `dataDe` para `Date`, `dataSo` para dias sem hora, `nomeCopia` para o nome das cópias). **Nunca** `toLocaleDateString('pt-PT')` nem fatiar
  (`slice(0, 10)`) uma data no ecrã: usar estas funções. A ordenação das tabelas continua a usar o texto original.
- **Formas à escolha** (`FORMATOS_DATA`, 15; o nome de cada uma na escolha é o exemplo de 31/12/2026 14:30): `31/12/2026, 14:30` · `31-12-2026 14:30` · `31.12.2026 14:30` · `31/12/26, 14:30` · `31/12/2026 14h30` · `31/12/2026, 2:30 PM` ·
  `31/12/2026` (sem hora) · `31 dez 2026, 14:30` · `31 dez 2026, 2:30 PM` · `qui, 31 dez 2026, 14:30` · `31 de dezembro de 2026, 14:30` · `12/31/2026, 2:30 PM` · `2026-12-31 14:30` · `2026/12/31 14:30` · `2026-12-31T14:30`. Os meses e os dias da semana
  seguem o idioma do painel. Para acrescentar uma forma: uma linha em `FORMATOS_DATA`, e o nome inglês dos meses já lá está.
- **Mudar a escolha vale logo**, sem recarregar: `gravarFormatoData` guarda e avisa (`vh-data-mudou`) e todas as tabelas (`DataTable` usa `useFormatoData`) desenham-se de novo.
- **Nome das cópias de segurança**: `vdadmin.2026-10-27_22-29-54.tar` mostra-se `vdadmin 27/10/2026:22.29.tar` (ou `vdadmin 27 out 2026, 22:29.tar` na forma curta…); só o que se vê, a cópia chama-se como no servidor. Leva sempre a hora.

# Páginas do WordPress no painel: edição rápida em cada linha e um só botão (Silva, 27/10/2026)

- **Gerir WordPress › Páginas** (`WpPaginas` em `avancado.tsx`) fica como está; só se acrescenta uma **seta (chevron) antes do nome da página**, como no WordPress, e o item **«Edição rápida»** ao menu «⋯» de cada página (Silva, 27/10/2026: «só o ícone antes do nome; o resto como está; no popup, «Edição rápida»; nunca descrições»). A seta e o item abrem por baixo
  da linha a **Edição rápida**, como a do WordPress: **Título, Endereço (slug), Estado** e, só nas páginas feitas com o **Elementor**, o **Modelo** (Predefinição do tema · Elementor Canvas · Elementor largura total = meta `_wp_page_template`: `default`, `elementor_canvas`,
  `elementor_header_footer`). Guarda por `wp-pagina-editar` (WP-CLI como administrador do site; o slug só aceita `a-z`, números e hífenes; «Agendada» não se muda daqui; o modelo só se grava se a página for do Elementor). Mudar o endereço muda o link: o ecrã avisa.
- **WordPress › Utilizadores no telemóvel: o botão «Entrar» de cada utilizador fica à esquerda** (Silva, 27/10/2026), com metade da largura; nas outras listas continua o que a regra de 23/10 diz.
- **Os campos da Edição rápida das páginas têm 32 px de altura** (a do botão base; Silva, 27/10/2026), redefinindo `--h-input` e `--h-campo` em `.wp-edicao`.
- **Nos menus «⋯» os itens levam só o nome** («Edição rápida», «Mudar nome», «Apagar»): **nunca descrições, frases ou explicações dentro do popup** (Silva, 27/10/2026: «nunca faça mais isso»). O que precisa de explicação vai para a janela ou para a linha que o item abre.
- **Um só botão por linha**: a lista de instalações (Gestor de WordPress) deixa de ter «Gerir» e «⋯» lado a lado; **«Gerir» é o primeiro item do menu «⋯»**, com as outras opções. Em listas novas, nunca um botão solto ao lado do menu «⋯».

# WordPress novo: sai com o WP-Optimize activo, a cache de página e o Redis ligados (Silva, 28/10/2026)

- **Regra:** todo o WordPress instalado pelo painel (`installWordPressSite`, em `src/lib/wp-cli-server.ts`, usado por Admin › `wp-install` e pelo Gestor de WordPress) fica no fim da instalação **preparado pelo servidor**: o painel só chama
  `/opt/visualdesignmoz/deploy/wordpress/wp-cache-on-site.sh <pasta> <conta> <domínio>` (a pasta da versão em uso, por isso cada deploy o actualiza; não depende de nada em `/root`). O script, que é a única fonte desta preparação: copia o mu-plugin do stack, apaga Akismet e Hello Dolly
  (o slug do segundo é `hello`), instala e activa o **WP-Optimize com a cache de página ligada** (`WPO_Page_Cache::instance()->enable()`; o plugin põe o `WP_CACHE` sozinho) e liga o **Redis com prefixo próprio do site** (`WP_REDIS_PREFIX=vd_<domínio>_`) e `WP_REDIS_SELECTIVE_FLUSH`
  (sem isto «esvaziar a cache» num site apagava a base 0 inteira, que o Redis partilha). Cada passo avisa e segue; pode correr outra vez no mesmo site. **Honeypot não entra** (não foi pedido e os sites preparados antes também não o têm).
- **Porquê:** a leitura do servidor de 28/10/2026 mostrou que os scripts antigos (`/root/wp-cache-on-site.sh`…) não estavam instalados no servidor e nada os chamava (o `wordpress_install_post.sh` é do tempo do DirectAdmin); um WordPress novo ficava só com o pacote do WordPress, sem cache.
- **Armadilhas já pisadas (não repetir):** (1) o mu-plugin esconde o `redis-cache` da lista de plugins, também do wp-cli: `wp plugin activate redis-cache` dá «plugin could not be found»; activa-se por `activate_plugin("redis-cache/redis-cache.php")` num `wp eval`.
  (2) Nunca `do_action("wpo_cache_config_updated")` sem argumento: o gancho do WP-Optimize espera a configuração e dá erro fatal (`class-wpo-cache-rules.php`, linha 465); o `enable()` já chega. (3) Há `wp-config.php` sem a linha «That's all, stop editing» (entrecamposblog.com): o `wp config set` falha com «Unable to locate placement anchor»; o script repete
  com `--anchor="require_once ABSPATH . 'wp-settings.php';" --placement=before` (função `cfg`). (4) O servidor **não consegue abrir o próprio `visualdesignmoz.com`** (ligação recusada na porta 443): confirmar este site sempre **de fora** (passo do GitHub), nunca a partir do servidor.
- **Sites que já existiam:** só com o «avança» do Silva, pelo workflow `ops-wordpress-cache-aplicar.yml` (sem «confirmar» só lê; com «confirmar» guarda cópia do wp-config e da lista de plugins em `/root/wp-cache-aplicar-<data>/`, aplica, mede o site antes e depois e desfaz sozinho se a página inicial deixar de dar 200).
  Aplicado a 28/10/2026 a producoes.visualdesignmoz.com, desporto.entrecamposblog.com e entrecamposblog.com (a página inicial deste passou de 4 a 7 s para menos de 1 s). mltmark, lirandzojewelry, msdn-moz e oshercollective já tinham WP-Optimize, cache de página e o drop-in do Redis de antes:
  receberam só o prefixo próprio, o esvaziar selectivo e a validade de 7 dias (`VD_SO_REDIS=1`, workflow com «so_redis»); antes, «esvaziar a cache» num site apagava a base 0 inteira (houve 30 `flushdb` numa semana), apagando a cache de todos os sites.
- **Redis do servidor (28/10/2026):** `maxmemory 256mb` e `maxmemory-policy volatile-lru`, em funcionamento e gravados em `/etc/redis/redis.conf` (cópia do ficheiro de antes em `/root/redis-memoria-*/`), pelo workflow `ops-redis-memoria.yml` (sem «aplicar» só lê; com «limpar» apaga cache órfã). O Redis usa 6 MB (pico de 30 MB em 7 dias), o servidor tem 12 GB.
  `volatile-lru` só apaga chaves com validade, por isso as chaves de cache têm 7 dias (`WP_REDIS_MAXTTL`); nunca `allkeys-lru` sem saber quem usa cada base. **Base 3 identificada:** 1 708 chaves `aamihe:Aimes:*`, cache do site aamihe.com, que já não existe no servidor (conta só com correio): sem actividade em 2 minutos e sem clientes ligados.
  A limpeza apaga só as chaves paradas há mais de 1 dia (base 3) e, na base 0, as que não começam por `vd_` e estão paradas há mais de 15 minutos.
- **Sites Node.js e Next.js: não levam Redis** (28/10/2026). Nenhuma das aplicações (visualdesignmoz.com no pm2, basededadosagro.com em serviço do sistema, painel) tem cliente de Redis nas dependências, e o Next.js já serve as páginas públicas pré-geradas (`x-nextjs-cache: HIT`, `s-maxage=31536000`; o basededadosagro.com
  com revalidação de 60 s, também pela Cloudflare). Um `cacheHandler` em Redis só serviria para partilhar a cache entre vários processos, e o site corre com 1. O que ainda se ganharia é pôr a Cloudflare a guardar o HTML (hoje `cf-cache-status: DYNAMIC` em visualdesignmoz.com): é uma regra na conta da Cloudflare, só com ordem do Silva.
- **entrecamposblog.com deu 504 durante cerca de 6 minutos (28/10/2026, 14:30 a 14:36, hora de Maputo):** os 8 trabalhadores do pool ficaram todos ocupados (cerca de 33% de CPU cada, o limite de CPU da conta a travá-los) e recuperou sozinho; o Redis estava saudável e a causa exacta não ficou provada.
  Medido depois: uma página que não vem da cache (`/robots.txt`) leva 5 a 9 s neste site (Elementor, JetEngine, Code Snippets…), por isso uma rajada de pedidos sem cache enche o pool. **Antes de reiniciar o PHP-FPM de uma conta, ver primeiro se já recuperou** (`ops-site-lento.yml`, sem «reiniciar» só lê): o reinício corta os pedidos em curso nos outros sites da conta (desporto e produções) e desta vez não foi preciso.
- **O servidor não se sobrecarrega (Silva, 28/10/2026):** o script e os fluxos correm com `nice -n 10 ionice -c3`, um site de cada vez e com 15 s de pausa entre sites; cache nova começa fria, por isso não se mexe em vários sites ao mesmo tempo.

# Cloudflare: cache do HTML do visualdesignmoz.com e limpeza em cada publicação (Silva, 28/10/2026)

- **A chave:** o painel usa a **Global API Key** (`CLOUDFLARE_EMAIL` + `CLOUDFLARE_GLOBAL_API_KEY`, no `.env.local` do servidor; acesso total à conta) quando existe; o token restrito (`CLOUDFLARE_API_TOKEN_ACCOUNT`) só lê definições e DNS e **não** vê Page Rules nem Cache Rules. Qualquer leitura ou escrita de regras faz-se com a Global Key, a partir do servidor, pelos fluxos
  `ops-cloudflare-cache-leitura.yml` (só lê) e `ops-cloudflare-cache-aplicar.yml` (fases «limpar», «aplicar» e «desfazer»). Nunca se imprime a chave.
- **Estado de partida (28/10/2026):** os três domínios são do plano gratuito, com `cache_level=simplified` e `browser_cache_ttl=0`. O visualdesignmoz.com, o basededadosagro.com e o entrecamposblog.com têm uma **Page Rule «bypass»** em `*dominio/*` (o padrão de segurança do painel,
  `applyCloudflareSafeCacheDefaults`, nascido do incidente do menocrazy.app a 10/09 em que o HTML de um cliente ficou antigo). O basededadosagro.com tem ainda duas Cache Rules («respeitar a origem» e «nunca guardar `/api/*`») e a Cloudflare guarda-lhe o HTML (`REVALIDATED`); as Cache Rules passam à frente da Page Rule.
- **Regra para os sites de clientes e para os WordPress: não se liga cache de HTML na Cloudflare** (o WP-Optimize e o Redis já servem a página rápido, e um HTML antigo num site de cliente é pior do que um site lento).
- **visualdesignmoz.com (Next.js):** duas Cache Rules (`ops-cloudflare-cache-aplicar.yml`, fase «aplicar», descrição «VD 28/10/2026…»): (1) «respeitar a origem»: só se guarda o que o Next.js marca como público (páginas já geradas, `s-maxage=31536000`; as dinâmicas trazem `private, no-store`);
  (2) «nunca guardar» as rotas privadas (`/api/`, `/vhost`, `/host`, `/auth`, `/login`, `/painel`, `/cliente`, `/guest`, `/checkout`, `/encomendas`, `/pagamento`, `/recibo`, `/webmail`, `/contabilidade`, `/renovacao`). O fluxo confirma de fora (as públicas dão HIT à segunda, as privadas nunca) e **desfaz sozinho** se falhar; «desfazer» repõe as regras de antes.
- **Obrigatório, no deploy:** como a validade das páginas é de 1 ano, o `deploy-contabo.yml` limpa a cache da Cloudflare no fim de cada publicação (`scripts/limpar-cache-cloudflare.sh`, último passo; fica a vermelho se a Cloudflare recusar). **Sem este passo não se ligam as regras**: depois de um deploy a Cloudflare serviria HTML antigo a apontar para ficheiros `_next/static` que já não existem.
  Ao mexer em `deploy-contabo.yml` faz-se sempre o ensaio (`ensaio` marcado).

# Plugins desactualizados que o painel não via (Silva, 28/10/2026)

- **Causa:** o painel lê as actualizações com `wp plugin list`, e o wp-cli só carrega os actualizadores que um plugin regista fora do administrador (no entrecamposblog.com só o Freemius e o JetEngine). Os plugins pagos (PRO Elements, LoginPress Pro, JetSmartFilters…) registam o seu só no administrador, por isso o WordPress mostrava 5 actualizações
  e o painel 0. Forçar a verificação no wp-cli não resolve (testado). Não era falha de ligação.
- **Correcção:** o mu-plugin do stack (`deploy/wordpress/visualdesign/stack.php`, `vd_guardar_actualizacoes_plugins`) guarda, de 10 em 10 minutos e **só quando há um pedido ao administrador** (`admin_init`), a lista que o administrador vê na opção `vd_plugin_updates`; `listWpPlugins` junta essa lista à do wp-cli
  (`juntarActualizacoesDoAdmin`) quando a versão guardada difere da instalada. **Só funciona em sites com o mu-plugin novo e depois de alguém abrir o administrador do WordPress uma vez.** Para pôr o mu-plugin novo num site antigo sem tocar no resto: `VD_SO_MU=1 bash wp-cache-on-site.sh <pasta>`.
  O botão «Actualizar» do painel continua a usar o wp-cli e não actualiza plugins pagos sem licença.

# Autenticação em 2 passos (opcional — Silva, 21/10/2026)

- **Nunca obrigatória**: só afecta quem a liga em Perfil › Autenticação em 2 passos (aplicação de autenticação, TOTP do Supabase;
  precisa de o MFA estar activo no projecto Supabase). Quem a ligou só abre o painel depois do código: as rotas do painel respondem
  428 a sessões só com a palavra-passe (`src/lib/mfa-sessao.ts`, `requirePanelBootstrapAccess`, `updateSession`) e o painel mostra o
  ecrã do código (`dois-passos.tsx`), seja qual for a porta de entrada. O nível da sessão lê-se do token só depois de o validar.
- **Códigos de recuperação** (8 de 16 caracteres, uso único, só os hashes em `app_metadata` — nunca em `user_metadata`, que a própria pessoa edita; como o `app_metadata` vai no token da sessão e quem só tem a palavra-passe o lê, o hash é uma HMAC com segredo só do servidor — `VH_2P_SEGREDO` ou a chave de serviço do Supabase — marcada `v2:`, nunca um SHA simples):
  `src/lib/dois-passos-codigos.ts`, rotas `/api/vhost/doisp` e `/api/vhost/doisp/recuperar` (a única que aceita a sessão só com a
  palavra-passe; 5 tentativas / 15 min). Usar um código desliga os 2 passos da conta. O administrador também desliga os 2 passos
  de uma conta de cliente ("entrar como" → Perfil › Autenticação em 2 passos).
- **Formato da página** (como o do DirectAdmin): faixa com o ícone num bloco à esquerda (âmbar desligada, verde ligada), título,
  estado e botão; por baixo "Códigos de recuperação" numa caixa suave e o botão à direita. Só linhas de cima e de baixo.

# Verificação visual de alterações de UI

**Confirmar sempre, mas nunca mostrar imagens ao Silva** (Silva, 15/10/2026: "não me mostre imagens… eu vou apenas
te mandar screenshots"; esclarecido a 16/10/2026: "confirmar deve confirmar… mas não me dar screenshot"). Cada
alteração visual é confirmada do nosso lado antes de se dizer que está feita — "compila sem erros" não chega. Mas as
imagens **nunca chegam ao Silva**: não se enviam, não se anexam e não se abrem na conversa (abrir uma imagem com a
ferramenta de leitura mostra-a ao Silva na app). A confirmação faz-se com o Playwright a **medir** a página (posições
`getBoundingClientRect()`, estilos calculados `getComputedStyle()`, larguras, sobreposições) e a escrever os números
no terminal; se for preciso gravar uma imagem para comparar, fica só na pasta temporária e apaga-se no fim. Na
resposta ao Silva diz-se só onde se mexeu e manda-se **o comando único do ponto 6**, que abre a pré-visualização com
**os dois ecrãs** (computador e telemóvel lado a lado, `/dev-preview-telemovel`) — essa janela de dois ecrãs
mantém-se sempre que se dá o código para ver alterações. O Silva vê no projecto local e manda os prints dele.

## Como tirar o screenshot neste Mac

O download automático do Chromium do Playwright falha aqui (`ERROR: Playwright does
not support chromium on mac13` — parece um bug da versão que o `npx playwright`
instala por defeito). Em vez disso:

1. O Playwright (`playwright@1.48.0`) já está instalado como devDependency permanente do projecto — não precisa reinstalar nem desinstalar a cada vez.
2. Usa o Google Chrome já instalado no Mac em vez do Chromium do Playwright
   (evita o download que falha): `chromium.launch({ channel: 'chrome' })`.
3. O servidor de dev já costuma estar a correr — confirma com
   `lsof -iTCP -sTCP:LISTEN -P | grep node` antes de arrancar outro.
4. Para páginas que exigem login (painel admin), cria uma página temporária
   (`src/app/dev-preview-x/page.tsx`) com dados fictícios que reproduza só o
   componente em causa, em vez de tentar autenticar. Apaga-a no fim.
5. Se a página herdar o header fixo do site (cobre o topo no screenshot), esconde
   elementos fixed/sticky antes do screenshot:
   ```js
   await page.evaluate(() => {
     document.querySelectorAll('*').forEach((el) => {
       const p = getComputedStyle(el).position;
       if (p === 'fixed' || p === 'sticky') el.style.display = 'none';
     });
   });
   ```
   ou tira o screenshot de um elemento específico (`locator(...).screenshot()`)
   em vez da página inteira.
6. Limpa no fim apenas a página de preview e o script `.mjs` temporário — o
   Playwright em si fica instalado (devDependency permanente, não desinstalar).

Repete isto para cada secção/UI em que trabalhares — não só para esta funcionalidade.
