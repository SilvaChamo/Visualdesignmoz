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
   (lsof -ti tcp:3003 -sTCP:LISTEN | xargs kill -9 2>/dev/null; sleep 1; true); git stash -u -m "antes de RAMO" ; git fetch origin RAMO && git checkout -B RAMO origin/RAMO && npm install && rm -rf .next && npm run dev
   ```
   O fecho é só do servidor que escuta na 3003 (`-sTCP:LISTEN`, para não apanhar as ligações do navegador), à força
   (`kill -9`) e com 1 s de espera antes de arrancar — com o `kill` simples a porta continuava ocupada e o arranque
   falhava com `EADDRINUSE` (Silva, 14/10/2026).
   O `rm -rf .next` apaga a cache do servidor local antes de arrancar (uma cache velha depois de mudar de ramo fazia o
   site local piscar e não abrir — Silva, 14/10/2026); a primeira página demora um pouco mais a compilar.

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
- **Listas no telemóvel numa só coluna** (pedido do Silva, 13/10/2026): cada linha passa a um bloco — a caixa de seleção
  e o dado principal (ex.: o IP) em cima, com o botão da linha (ex.: Desbloquear) à direita dele; as outras
  informações por baixo, cada uma com o nome da coluna. No
  VisualHost: `DataTable` com `empilhar` (já ligado nas tabelas da Força bruta).
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
