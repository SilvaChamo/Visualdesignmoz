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

- **Nunca duas linhas de botões.** Se uma página precisa de botões, ficam todos na mesma linha. A pesquisa também
  fica nessa linha, nunca numa linha à parte por cima ou por baixo dos botões. Nas tabelas do painel VisualHost
  (`DataTable` em `src/components/vhost/paginas/componentes.tsx`) usa-se `umaLinha`: "Ações" e os botões da página à
  esquerda, a pesquisa à direita.
- **A pesquisa ocupa 30% da largura da secção** (com um mínimo de 200px; no telemóvel ocupa a largura toda).
- **Modelo de página = a página Domínios do painel.** Toda a página nova segue-o: um título na barra de cima com uma
  descrição pequena por baixo (nunca dois títulos grandes juntos — números e resumos vão na descrição, ex.:
  "Todas as mensagens | 3 por ler"); o conteúdo dentro do cartão principal; os separadores abrem o cartão (faixa
  cinzenta em cima) e a tabela fica por baixo.
- **Pesquisa e botões por cima do cartão, fora da faixa dos separadores**: pesquisa sempre à esquerda, botões de
  ações sempre à direita, numa linha só. No VisualHost: `DataTable` com `umaLinha` e `barraFora` (vai para a faixa
  `BarraPagina` por cima do cartão).
- **Screenshots enviados ao Silva vão numerados** ("Ecrã 1", "Ecrã 2", …, também no nome do ficheiro) para ele
  poder dizer qual quer mudar.
- **Mostrar sempre também a vista de telemóvel** (largura 390px) de cada página/alteração, além da do computador
  (pedido do Silva, 13/10/2026).

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
