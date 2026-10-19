# Esta é a pasta de trabalho — e o site em produção

**NOTA PARA QUALQUER AGENTE (19/10/2026) — LER ANTES DE COMEÇAR.** Só existe um ramo que publica: **`main`**, e é o do
**Contabo**. O Hetzner foi desligado e já não faz parte do projecto: os seus workflows, scripts e documentos foram
apagados e o antigo `main` (o do Hetzner) ficou guardado em `arquivo/main-hetzner` — **não usar, não trazer nada de lá
e não propor nem fazer alterações para o Hetzner** (Silva, 19/10/2026: "tudo o que é sobre Hetzner está fechado").
O ramo que se chamava `fix/contabo-websites-audit` passou a chamar-se `main`: se alguma nota, comando ou memória antiga
falar dele, da pasta `../visualdesign`, da pasta `visualdesign-teste` ou do `deploy-hetzner.yml`, está desactualizada.
Se um agente se enganou e trabalhou no sítio errado, não se repete: **trabalha-se sempre num ramo de trabalho e
publica-se por PR para `main`**.

Este projecto (pasta local `visualdesign-producao`, dev server na porta 3003) é onde todo o trabalho acontece.
**O site em produção é o do Contabo** (Silva, 14/10/2026: "esqueça Hetzner… agora o site em produção é da Contabo"; o
servidor foi reforçado para 200 GB de disco, 12 GB de RAM e 6 núcleos): cada push em `main` (ou seja, cada merge de PR)
publica no Contabo (`.github/workflows/deploy-contabo.yml`, que publica com `NEXT_PUBLIC_SITE_URL=https://visualdesignmoz.com`).
Como cada publicação vai directa à produção, a regra "só se publica quando o Silva disser 'publica'" é ainda mais
importante.

A pasta de trabalho no Mac do Silva é `visualdesign-producao` (antes `visualdesign-teste`, que deixa de se usar).

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
8. **O ramo publicado tem o nome da acção principal da publicação** (Silva, 17/10/2026: "coloque o nome da acção
   principal da publicação no branch"). Ao publicar, o PR sai de um ramo com nome curto, em português, sem acentos e
   com hífens, que diz o que a publicação faz — ex.: `email-de-entrada-mltmark`, `planos-email-e-so-dominio` (nunca
   `claude/` nem outro nome de IA; o ramo de trabalho do agente pode ter outro nome: copia-se para o ramo com o nome da
   acção na hora de publicar). O título do merge leva esse nome: `Merge pull request #N from SilvaChamo-<acção>`, ex.:
   `Merge pull request #94 from SilvaChamo-email-de-entrada-mltmark`. Também repetida nos ficheiros das outras IAs.

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

- **Nunca pesquisa à esquerda por cima do cartão principal** (regra do Silva, 13/10/2026: "não coloque mais"). A
  "Busca" da barra de cima já procura na página aberta. Sem exceções (a Força bruta também segue o modelo).
- **MODELO GLOBAL DO PAINEL — vale para TODAS as páginas, não só para a que se está a mexer** (o Silva já teve de o
  repetir várias vezes). Antes de entregar qualquer página, confirmar estes pontos um a um.
- **Toda a página com tabela de caixas de seleção abre o cartão principal com a faixa cinzenta de separadores.** Se a
  página não tem separadores mas tem filtros (ex.: DNS — Todos, A, CNAME, MX…), **os filtros são os separadores** e
  vão para essa faixa (`Tabs`). Nunca filtros soltos numa linha de botões por cima da tabela.
- **Faixa dos separadores (cabeçalho do cartão principal) = só o botão "Ações", à direita**, sempre visível nas
  tabelas da página. **Nenhum botão por cima do cartão nem na faixa:** todas as ações da página vão para **dentro do
  menu "Ações"** (regra do Silva, 13/10/2026), por exemplo "Adicionar subdomínio", "Marcar todas como lidas" ou
  "Apagar". As opções que precisam de caixas assinaladas ficam **inativas** no menu enquanto nenhuma linha estiver
  escolhida; as que não precisam (adicionar, marcar todas…) estão sempre ativas e vêm primeiro no menu.
- **O "+ Adicionar…" principal da página fica na barra de cima** (a do título, `actions` do ecrã), quando esse espaço
  está livre (ex.: "Adicionar domínio"). Um segundo "+ Adicionar…" vai para dentro do "Ações".
- **Paginação só no fundo do cartão principal**, quando é precisa (mais de uma página): setas e "Página x de y", sem o
  texto "1–20 de 67". Nunca em cima, nunca na faixa dos separadores.
- No VisualHost tudo isto é automático no `DataTable` com `umaLinha` + `barraFora`: o "Ações" vai para o lugar que os
  `Tabs` guardam à direita (`FaixaAbas` em `src/components/vhost/context.tsx`); as ações da página passam-se em `bulk`
  (`sempre: true` nas que não precisam de linhas escolhidas, `inativo` para as desligar); a paginação sai no fundo.
- **No telemóvel os separadores passam a uma caixa de escolha** (selector), à esquerda da faixa, com o "Ações" à
  direita — assim vêem-se todos, mesmo quando são muitos (pedido do Silva, 13/10/2026). Automático nos `Tabs`.
- **Listas no telemóvel numa só coluna** (pedido do Silva, 13/10/2026; revisto a 14/10/2026): cada linha passa a um
  bloco — a caixa de seleção e o dado principal (ex.: o IP) em cima; as outras informações por baixo, cada uma com o
  nome da coluna; **os botões da linha no fundo do bloco, lado a lado** (Silva, 15/10/2026); se o texto de algum não
  cabe, ficam numa coluna a toda a largura. No
  VisualHost: `DataTable` empilha por defeito (`empilhar` ligado em todas as tabelas).
- **Telemóvel = uma só coluna em tudo** (Silva, 14/10/2026): itens uns por baixo dos outros. **Exceções: o Menu (grelha
  de ícones) e os cartões (ex.: números da Dashboard) ficam em duas colunas**, ícone em cima e nome por baixo (Silva, 14/10/2026: "coloque duas colunas no menu"). **Botões dos rodapés de
  formulários e janelas e das barras de botões: mais de um → lado a lado (dois por linha, divididos por igual); um
  sozinho → metade do ecrã, à esquerda, quando o texto está alinhado à esquerda, ou ao centro e a toda a largura quando
  o conteúdo está centrado (classe `.centro`); se o texto de algum botão não cabe em meia largura (iria para duas ou
  três linhas), os botões dessa barra ficam todos numa coluna, a toda a largura** (Silva, 15/10/2026; automático em
  `src/components/vhost/botoes-telemovel.ts`). Botões das linhas das listas: no fundo do bloco, com a mesma regra.
  Ficam de fora só as barras de ferramentas (editor, gestor de ficheiros), separadores, interruptores (ex.: Visual |
  HTML) e botões colados a um campo.
- **Telemóvel: o cartão principal vai de ponta a ponta** (Silva, 14/10/2026: "não se pode ver os limites do card
  principal"): sem margem, bordas dos lados, cantos nem sombra; o limite do conteúdo é o do ecrã (12 px de folga).
- **Telemóvel: nada passa da largura, a partir de 320 px** (Silva, 14/10/2026): tudo cabe a 320 px e estica até ao
  tamanho do ecrã. Antes de entregar, varrer as páginas a 320 px (nada fora, nada cortado, nenhum "…").
- **Faixa por baixo da barra de cima, no telemóvel** (Silva, 14/10/2026): à esquerda só a casa (volta ao Início; o nome
  da página já está na barra de cima), à direita o domínio, encostado à direita e numa só linha — se não couber, a
  letra diminui e o globo sai sozinho (`titulo-ajustado.ts`); só no limite passa a duas linhas, encostado à direita.
- **Dentro do painel: nunca roda (spinner) nem esqueleto (skeleton)** (Silva, 13/10/2026). Ao mudar de página, a
  página anterior fica à vista até a seguinte estar pronta. **Única exceção — no lugar da tela branca:** enquanto a página
  inteira ainda não tem conteúdo (ao recarregar, ou à espera dos dados), aparece o carregador do DA — as três barras do
  "WordPress Manager" do DirectAdmin, na cor do tema, no fundo do tema (Silva, 16/10/2026: "quando tenta surgir a tela
  branca coloque o spinner do DA … com o mesmo efeito"). Está em `src/components/vhost/carregador-da.tsx`: a página do
  servidor (`src/app/host/layout.tsx`) sai logo com ele (Suspense) e o painel entra no lugar dele. A roda depois de
  entrar pela entrada do próprio painel fica numa página branca (pedido dele).
- **NUNCA TELA BRANCA, em nenhuma circunstância e em todas as páginas** (regra rigorosa do Silva, 16/10/2026 — vale para
  todas as páginas que se criarem): ao abrir uma página, a anterior fica à vista até a nova ter o conteúdo; ao recarregar,
  o conteúdo continua visível e só "pisca" quando chega o novo. Como cumprir no VisualHost:
  - toda a leitura que uma página faz ao abrir usa `useGet` (`src/components/vhost/carga.tsx`) ou, se for um `fetch`
    próprio, chama `useContext(EsperaPagina)?.comecar()` e o "acabou" no fim — senão a página aparece vazia e enche depois;
  - **nunca recarregar a página inteira à frente de quem está a usar** (`location.reload`/`location.assign` num clique):
    era a tela branca com o "salto" para o início depois de cada publicação. Com versão nova, recarrega-se só com o
    separador escondido (`VisualHostApp.tsx`, `aoEsconder`). Entrada pelo **login do site**: o login lê os dados do
  painel antes de sair do ecrã de login (`preCarregarDadosVhost` em `src/lib/vhost-cache.ts`) e o painel abre logo,
  sem o ecrã branco com o círculo. Entrada pelo **login do próprio painel**: fica como está. Não mexer no
  carregamento sem o Silva pedir.
- **"Ações" só onde há caixas de seleção** (Silva, 13/10/2026: as ações aplicam-se ao que se escolhe). Com
  separadores, fica à direita da faixa deles; sem separadores, **aparece no lugar do título da 1.ª coluna quando se
  assinala uma caixa** (ex.: "Conta" nas Contas de e-mail) e o título volta quando nada está escolhido (automático no
  `DataTable` com `umaLinha` + `barraFora`). Sem caixas de seleção não há "Ações": só o "+ Novo…" na barra de cima.
- **Tabelas compactas nos ecrãs de computador** (Silva, 13/10/2026, 769–1600 px): 12 px entre colunas, linhas baixas,
  números dos cartões pequenos. Se uma tabela mesmo assim não couber, as colunas menos importantes saem até essa
  largura (`ate: 1600 | 1300` na coluna do `DataTable`; no telemóvel, em blocos, voltam) e o que elas davam fica
  acessível noutro sítio (ex.: menu "⋯" da linha). Nunca barra de deslocar na tabela.
- **A faixa de separadores só aparece com vários separadores** — nunca um separador sozinho com o título da página.
- **Responsividade: os 5 pontos de quebra do painel** (os mesmos da maquete, `generated/maquete.css`): ecrã grande
  (>1600), computador (1301–1600), portátil (1051–1300), tablet (769–1050) e telemóvel (≤768). Cada página fica
  organizada da mesma forma nos 3 de computador (ex.: a coluna da direita das Contas de e-mail e da Dashboard fica à
  direita, só mais estreita); no tablet e no telemóvel as colunas passam a uma. Nenhuma página pode passar da largura
  do ecrã. Antes de entregar, confirma-se do nosso lado nos 5 (1920, 1440, 1280, 1024, 390), sem mostrar imagens ao Silva.
- **Nunca duas linhas de botões.**
- **Nunca cortar texto com "…"** (regra do Silva, 13/10/2026: "não pode fechar dados, reduzir sempre"): quando um
  texto não cabe (ex.: título e descrição da barra de cima no telemóvel), a letra diminui até caber; se nem assim
  couber, passa à linha de baixo. No VisualHost o título/descrição da barra de cima já fazem isto sozinhos
  (`useTituloAjustado` em `src/components/vhost/titulo-ajustado.ts`).
- **Modelo de página = a página Domínios do painel.** Toda a página nova segue-o: um título na barra de cima com uma
  descrição pequena por baixo (nunca dois títulos grandes juntos — números e resumos vão na descrição, ex.:
  "Todas as mensagens | 3 por ler"); o conteúdo dentro do cartão principal; os separadores abrem o cartão (faixa
  cinzenta em cima) e a tabela fica por baixo.
- **Imagens nunca vão para o Silva** (confirma-se do nosso lado com medições) — ver "Verificação visual de alterações de UI".
- **Primeiro só a vista de computador.** A vista de telemóvel (largura 390px) só se mostra depois de todas as
  alterações estarem feitas e aprovadas pelo Silva (revisto a 13/10/2026).
- **Antes de publicar:** fazer todas as rectificações, mandar o comando do ponto 6 (dois ecrãs), esperar que o Silva diga que está bom, e
  só publicar quando ele disser "publica" (ver "Como se trabalha com o Silva").

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
