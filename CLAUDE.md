# Esta é a pasta de trabalho prioritária

Este projecto (`visualdesign-teste`, branch `fix/contabo-websites-audit`, deploy em
`teste.visualdesignmoz.com` via Contabo, dev server na porta 3003) é onde o trabalho
novo deve acontecer por defeito. Existe uma segunda pasta irmã, `../visualdesign`
(branch `main`, produção real em `visualdesignmoz.com` no Hetzner, dev server na
porta 3002) — **não é a mesma pasta, não partilha ficheiros automaticamente**, e um
`git push` lá despoleta deploy imediato para produção.

As duas pastas partilham a mesma base de dados Supabase, mas código/UI só existe onde
foi escrito. Se pedires para "adicionar X" sem dizer onde, o agente deve assumir esta
pasta (`visualdesign-teste`), a não ser que o pedido seja claramente sobre produção
(ex: "o site principal está em baixo") ou o utilizador diga expressamente "no Hetzner"/
"em produção". Alterações que façam sentido nos dois sítios só devem ir para `main`
depois de confirmadas aqui, através do fluxo normal de PR
(`fix/contabo-websites-audit` → `main`) — nunca directamente.

Detalhe completo desta topologia (portas, branches, como trazer alterações de um lado
para o outro) fica na memória `project_dual-folder-git-topology`.

# Como se trabalha com o Silva (combinado a 13/10/2026)

1. O trabalho novo faz-se num ramo de trabalho (o do agente; nunca directamente em `fix/contabo-websites-audit` nem
   em `main`).
2. Antes de publicar, mostra-se ao Silva: screenshots numerados (Ecrã 1, Ecrã 2, …) e os comandos para ele ver o
   ramo no projecto local.
3. **Só se publica quando o Silva disser "publica"/"publique"** — é a chave para lançar as correcções. Publicar =
   PR do ramo de trabalho para `fix/contabo-websites-audit` + merge (o deploy no Contabo corre sozinho).
4. Alterações ao servidor também são descritas primeiro e só avançam com o "avança"/"publica" dele.
5. **Sempre que o Silva disser "publica"/"publique"**, depois de publicar, mandar-lhe o commit publicado (o hash do
   merge em `fix/contabo-websites-audit`) e os comandos para actualizar o projecto local (pedido dele, 13/10/2026).

# Regras de layout do Silva (valem para todas as páginas, sempre)

- **Nunca pesquisa à esquerda por cima do cartão principal** (regra do Silva, 13/10/2026: "não coloque mais"). A
  "Busca" da barra de cima já procura na página aberta. Sem exceções (a Força bruta também segue o modelo).
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
  e o dado principal (ex.: o IP) em cima, as outras informações por baixo, cada uma com o nome da coluna. No
  VisualHost: `DataTable` com `empilhar` (já ligado nas tabelas da Força bruta).
- **Nunca duas linhas de botões.**
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
