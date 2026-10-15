# Esta é a pasta de trabalho — e o site em produção

Este projecto (pasta local `visualdesign-producao`, branch `fix/contabo-websites-audit`, dev server na porta 3003) é
onde todo o trabalho acontece. **O site em produção é o do Contabo** (Silva, 14/10/2026: "esqueça Hetzner… agora o site
em produção é da Contabo"; o servidor foi reforçado para 200 GB de disco, 12 GB de RAM e 6 núcleos): cada merge em
`fix/contabo-websites-audit` publica no Contabo (`.github/workflows/deploy-contabo.yml`, que já publica com
`NEXT_PUBLIC_SITE_URL=https://visualdesignmoz.com`). Como cada publicação vai directa à produção, a regra "só se
publica quando o Silva disser 'publica'" é ainda mais importante.

**O Hetzner já não faz parte do projecto.** Ignorar o ramo `main`, a pasta irmã `../visualdesign`, o
`deploy-hetzner.yml` e tudo o que fale de produção no Hetzner — incluindo a memória
`project_dual-folder-git-topology`, que descreve a topologia antiga. Não propor nem fazer alterações para lá.

A pasta de trabalho no Mac do Silva é `visualdesign-producao` (antes `visualdesign-teste`, que deixa de se usar).

# Como se trabalha com o Silva (combinado a 13/10/2026)

1. O trabalho novo faz-se num ramo de trabalho (o do agente; nunca directamente em `fix/contabo-websites-audit` nem
   em `main`).
2. Antes de publicar, mostra-se ao Silva: screenshots numerados (Ecrã 1, Ecrã 2, …) e os comandos para ele ver o
   ramo no projecto local. **Nunca ficheiros HTML de pré-visualização** (Silva, 13/10/2026: "só me confunde") — só as
   imagens e o comando.
3. **Só se publica quando o Silva disser "publica"/"publique"** — é a chave para lançar as correcções. Publicar =
   PR do ramo de trabalho para `fix/contabo-websites-audit` + merge (o deploy no Contabo corre sozinho).
4. Alterações ao servidor também são descritas primeiro e só avançam com o "avança"/"publica" dele.
5. **Sempre que o Silva disser "publica"/"publique"**, depois de publicar, mandar-lhe o commit publicado (o hash do
   merge em `fix/contabo-websites-audit`) e os comandos para actualizar o projecto local (pedido dele, 13/10/2026).
6. **Os comandos para o projecto local vão sempre num único comando — e só um por mensagem** (Silva, 14/10/2026:
   "tem que parar o servidor, publicar e arrancar com um comando, nas próximas vezes") — que fecha o servidor que estiver na porta 3003,
   guarda à parte alterações locais por gravar (stash, recuperáveis com `git stash pop`), põe a pasta exactamente no
   ramo do GitHub e volta a arrancar o servidor (pedido do Silva, 13/10/2026 — o `checkout`/`pull` simples falhava e o
   site local não actualizava). Modelo (trocar `RAMO`), corrido dentro da pasta `visualdesign-producao`:
   ```
   pkill -9 -f "next dev --port [3]003"; lsof -ti tcp:3003 -sTCP:LISTEN | xargs kill -9 2>/dev/null; sleep 1; git stash -u -m "antes de RAMO"; git fetch origin RAMO && git checkout -B RAMO origin/RAMO && npm install && rm -rf .next && (nohup npm run dev > /tmp/visualdesign-dev.log 2>&1 &) && for i in $(seq 60); do lsof -ti tcp:3003 -sTCP:LISTEN >/dev/null && break; sleep 1; done; echo "Servidor ligado: http://localhost:3003 (mensagens do servidor em /tmp/visualdesign-dev.log)"; open http://localhost:3003
   ```
   O fecho começa pelo `next dev` (o processo pai, `pkill -f`; o `[3]` impede o comando de se apanhar a si próprio) e
   só depois o servidor que escuta na 3003 (`-sTCP:LISTEN`, para não apanhar as ligações do navegador), à força
   (`kill -9`) e com 1 s de espera. Fechar só a porta não chegava: o `next dev` voltava a arrancar o servidor e a porta
   continuava ocupada (`EADDRINUSE`), e o Silva tinha de o desligar à mão (Silva, 14/10/2026). O servidor arranca em
   segundo plano (`nohup`, mensagens em `/tmp/visualdesign-dev.log`, ver com `tail -f /tmp/visualdesign-dev.log`), por
   isso a janela do Terminal fica livre para o comando seguinte; o comando espera que a porta 3003 abra e abre o site
   no navegador.
   O `rm -rf .next` apaga a cache do servidor local antes de arrancar (uma cache velha depois de mudar de ramo fazia o
   site local piscar e não abrir — Silva, 14/10/2026); a primeira página demora um pouco mais a compilar.

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
  nome da coluna; **os botões da linha no fundo do bloco, uns por baixo dos outros, a toda a largura**. No
  VisualHost: `DataTable` empilha por defeito (`empilhar` ligado em todas as tabelas).
- **Telemóvel = uma só coluna em tudo** (Silva, 14/10/2026): itens uns por baixo dos outros. **Exceções: o Menu (grelha
  de ícones) e os cartões (ex.: números da Dashboard) ficam em duas colunas**, ícone em cima e nome por baixo (Silva, 14/10/2026: "coloque duas colunas no menu"). **Botões dos rodapés de
  formulários e janelas e das barras de botões: mais de um → lado a lado (dois por linha, divididos por igual); um
  sozinho → metade do ecrã, à esquerda, quando o texto está alinhado à esquerda, ou ao centro e a toda a largura quando
  o conteúdo está centrado (classe `.centro`)** (Silva, 15/10/2026). Botões das linhas das listas: no fundo do bloco.
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
  página anterior fica à vista até a seguinte estar pronta. Entrada pelo **login do site**: o login lê os dados do
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
  do ecrã. Antes de entregar, screenshots nos 5 (1920, 1440, 1280, 1024, 390).
- **Nunca duas linhas de botões.**
- **Nunca cortar texto com "…"** (regra do Silva, 13/10/2026: "não pode fechar dados, reduzir sempre"): quando um
  texto não cabe (ex.: título e descrição da barra de cima no telemóvel), a letra diminui até caber; se nem assim
  couber, passa à linha de baixo. No VisualHost o título/descrição da barra de cima já fazem isto sozinhos
  (`useTituloAjustado` em `src/components/vhost/titulo-ajustado.ts`).
- **Modelo de página = a página Domínios do painel.** Toda a página nova segue-o: um título na barra de cima com uma
  descrição pequena por baixo (nunca dois títulos grandes juntos — números e resumos vão na descrição, ex.:
  "Todas as mensagens | 3 por ler"); o conteúdo dentro do cartão principal; os separadores abrem o cartão (faixa
  cinzenta em cima) e a tabela fica por baixo.
- **Screenshots enviados ao Silva vão numerados** ("Ecrã 1", "Ecrã 2", …, também no nome do ficheiro) para ele
  poder dizer qual quer mudar.
- **Primeiro só a vista de computador.** A vista de telemóvel (largura 390px) só se mostra depois de todas as
  alterações estarem feitas e aprovadas pelo Silva (revisto a 13/10/2026).
- **Antes de publicar:** fazer todas as rectificações, mostrar as imagens, esperar que o Silva diga que está bom, e
  só publicar quando ele disser "publica" (ver "Como se trabalha com o Silva").

# Verificação visual de alterações de UI

Antes de reportar qualquer alteração visual (CSS/layout/alinhamentos) como concluída,
confirma-a com um screenshot real — "compila sem erros" só garante que o TypeScript
aceita o código, não que o resultado visual está correcto.

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
