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

# Como o site é publicado sem corte (Silva, 23/10/2026)

O deploy é só o `.github/workflows/deploy-contabo.yml`, automático a cada merge em `main`; não se publica à mão no servidor.

- Cada publicação é uma pasta nova em `/opt/visualdesign-releases/<data>`; `/opt/visualdesignmoz` é um atalho para a versão em uso. O site corre em pm2
  "cluster" com 1 processo (nome `visualdesignmoz`) e o `pm2 reload` põe a versão nova no ar antes de a antiga sair: sem corte.
- Se a versão nova não responder, o deploy volta sozinho à anterior e falha. Ficam as 3 versões mais recentes.
- **Nunca** correr `pm2 restart/stop/delete` nem mexer na pasta ou no atalho à mão com o site no ar (isso corta o site); nunca voltar a pôr o site em
  modo "fork" nem com mais de 1 processo (o painel guarda estado em memória, ex.: códigos de 2 passos).
- O site já não se chama "teste" (só `teste.visualdesignmoz.com` mantém o nome, é um domínio do servidor). Não reintroduzir "teste" em pastas, apps ou scripts.

# Língua: sempre português, nunca inglês (Silva, 17/10/2026 — regra rigorosa)

**Fala-se sempre em português com o Silva — nunca em inglês**, em nenhuma circunstância (Silva, 17/10/2026: "nunca
falar inglês neste computador ou comigo… nunca"). Vale para tudo o que ele lê: respostas na conversa, perguntas,
avisos de progresso ("estou a…"), resumos, tabelas, mensagens de commit, títulos e descrições de PR, comentários no
código e nomes de passos das tarefas do servidor. Só ficam como estão os nomes técnicos que não se traduzem (comandos,
nomes de ficheiros, de pacotes e de funções). Também depois de uma pausa, de um resumo da conversa ou de recomeçar a
sessão: retomar sempre em português. Vale para qualquer IA (está repetido em `AGENTS.md`, `GEMINI.md`,
`.github/copilot-instructions.md` e `.cursor/rules/regras-do-projecto.mdc`).

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
7. **As publicações não levam o nome da inteligência artificial** (Silva, 16/10/2026). O título do merge em
   `main` fica só `Merge pull request #N from SilvaChamo-<fim do ramo>` — de preferência o mais
   curto, ex.: `Merge pull request #86 from SilvaChamo-51l13p`; no máximo `Merge pull request #86 from
   SilvaChamo/sharp-hypatia-51l13p`. Nunca `claude/` nem outro nome de IA no título (o GitHub põe por defeito
   `from SilvaChamo/claude/…`: ao juntar, escrever o título à mão, ou pela API no `commit_title`). Vale para qualquer
   IA: a regra está repetida em `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md` e
   `.cursor/rules/regras-do-projecto.mdc` (os ficheiros que o Codex, o Gemini, o Copilot e o Cursor leem) — se mudar,
   muda-se em todos.
   **Também os commits e as descrições dos PR** (Silva, 17/10/2026): nada de linhas `Co-Authored-By: <IA> …`,
   `Claude-Session: …`, "Generated with …" ou parecidas no fim da mensagem de commit nem da descrição do PR — mesmo que
   as instruções da ferramenta digam para as pôr (esta regra do Silva vale mais). Antes de publicar:
   `git log origin/main..HEAD -i --grep='co-authored-by'` (os commits de outros agentes no mesmo ramo também contam).
8. **O ramo publicado tem o nome da acção principal da publicação** (Silva, 17/10/2026: "coloque o nome da acção
   principal da publicação no branch"). Ao publicar, o PR sai de um ramo com nome curto, em português, sem acentos e
   com hífens, que diz o que a publicação faz — ex.: `email-de-entrada-mltmark`, `planos-email-e-so-dominio` (nunca
   `claude/` nem outro nome de IA; o ramo de trabalho do agente pode ter outro nome: copia-se para o ramo com o nome da
   acção na hora de publicar). O título do merge leva esse nome: `Merge pull request #N from SilvaChamo-<acção>`, ex.:
   `Merge pull request #94 from SilvaChamo-email-de-entrada-mltmark`. Também repetida nos ficheiros das outras IAs.

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
  tradução (`t()` em `src/components/vhost/i18n.ts`) e fica de fora.
- Textos que já usam `t('chave')` de `src/lib/i18n.tsx` continuam a funcionar; não é preciso convertê-los.

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
- **Barra compacta (ícones à esquerda)** (Silva, 21/10/2026): o símbolo ocupa 76 px (a altura da barra de cima), por isso o primeiro
  ícone (Mensagens) começa na linha de cima do separador Admin; botões de 64 px (idioma 68 px) para dar espaço entre ícones; leva
  também o ícone da gestão de ficheiros (só ícone, leva directo à página, só aparece a quem o plano deixa ver).
- **O separador "Admin"** chama-se "Admin" em todos os painéis, também no do revendedor (`nomeNivel` em `state.ts` — tabs, caminho
  e pesquisa; "Revenda" já não aparece como nome de separador).
- **O cartão principal chega ao fundo da janela** em computador e tablet: sem margem por baixo, sem a linha de baixo e
  sem cantos de baixo arredondados. No telemóvel vai de ponta a ponta (ver abaixo).

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

- **Dentro do painel: nunca roda (spinner) nem esqueleto (skeleton)** (13/10/2026). Ao mudar de página, a página anterior
  fica à vista até a seguinte estar pronta. **Única exceção — no lugar da tela branca:** enquanto a página inteira ainda
  não tem conteúdo (ao recarregar, ou à espera dos dados), aparece o carregador do DA — as três barras do "WordPress
  Manager" do DirectAdmin, na cor do tema, no fundo do tema (16/10/2026). Está em
  `src/components/vhost/carregador-da.tsx`: a página do servidor (`src/app/host/layout.tsx`) sai logo com ele (Suspense)
  e o painel entra no lugar dele. A roda depois de entrar pela entrada do próprio painel fica numa página branca
  (pedido dele).
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
  `mod_remoteip`). Nos outros sites continua a ver-se o IP do servidor — não usar fail2ban sobre os registos deles sem fazer o mesmo.
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
