# Plano para o Copilot — trazer para o painel actual o que falta do painel antigo (Fases 2 e 3)

Pedido do Silva (17/10/2026): estas duas fases passam ao Copilot. Este documento tem tudo o que é preciso para as
implementar e publicar. Ler antes `regras.md` (regras do Silva, todas valem) e o `AGENTS.md`.

## O que já está feito (Fase 1) e serve de modelo

A Fase 1 trouxe para o painel actual (VisualHost, `/host:2026`) as páginas do cliente **Encomendas** e
**Facturação**, sem reescrever nada: os componentes que já existiam são **chamados dentro do painel**. Só os
separadores passam ao modelo do painel. Silva, 17/10/2026: "não rescrever de zero… apenas chamar para o painel actual".

Ficheiros-modelo, para copiar o padrão:

- `src/components/vhost/paginas/encomendas.tsx`: página com separadores (`Tabs`) que chama as secções existentes.
- `src/components/vhost/paginas/facturacao.tsx`: página sem separadores que chama uma secção existente.
- `src/components/vhost/screens.tsx`: onde cada página se regista (`'nível/id': funcaoDaPagina`).
- `src/components/vhost/paginas/paginas.css`: regras `.vh .vh-site`, que dão às secções do site as cores do painel
  (claro e escuro), escondem as rodas (`animate-spin`), tiram o "…" e repõem as margens do Tailwind dentro do painel.

O padrão de cada página nova:

1. **Menu.** No topo do ficheiro, um bloco `{ … }` acrescenta o item ao `MENU.admin`, no grupo indicado em baixo.
   - Ver como `ligados.tsx` e `sites-contas.tsx` o fazem: `MENU.admin.find(([g]) => g === '…')` e depois `splice`.
   - Cada item tem `id`, `fa`, `t`, `c`, `da: '—'`, `f: [...]` e `hx: { s: 'app', cmd: '', n: '…' }`.
2. **Descrição** da barra de cima: `DESC['admin/<id>'] = ['texto PT', 'texto EN']`.
3. **Inglês do painel.** As frases novas entram no `EN`, só se ainda não existirem:
   `for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;`.
4. **Corpo.** `<div className="vh-site vh-<id>"> <SecçãoExistente /> </div>`.
   - O componente existente fica **intacto**; não se copia o código dele.
   - Se a secção tiver separadores próprios, passam a `Tabs` do painel (`./componentes`), com sub-endereços
     (ex.: `/admin/contabilidade/pendentes`), e a secção recebe a aba escolhida por propriedade.
   - Ver `encomendas.tsx`: `vh.s.sub[0]` e `vh.nav(...)`.
5. **Registo** em `screens.tsx`.
6. **Só o administrador.** Estas páginas são todas do menu Admin, que já é só para o administrador. Não é preciso
   `soAdminPorAgora`.

## Fase 2 — Admin: Encomendas e Contabilidade

| Página nova (menu Admin) | Grupo do menu | id | Componente existente (não mexer) | Rotas que ele usa (já existem) |
|---|---|---|---|---|
| Encomendas (gestão) | novo grupo "Encomendas e contabilidade", antes de "Suporte" | `encomendas-gestao` | `CotacoesSection` em `src/app/dashboard/CotacoesSection.tsx` | `/api/admin/cotacoes`, `/api/cotacoes/[id]` |
| Clientes das encomendas | o mesmo grupo | `encomendas-clientes` | `EncomendasClientesSection` em `src/components/dashboard/EncomendasClientesSection.tsx` (recebe `isActive`: passar `true`) | `/api/admin/cotacoes/clientes` (+ `/entrar`, `/fundir`), `/api/mailmarketing-send` |
| Contabilidade | o mesmo grupo | `contabilidade` | `ContabilidadeTable` em `src/components/quotations/ContabilidadeTable.tsx` | `/api/admin/contabilidade` (+ `/fechar`), `/api/admin/contabilidade-pendentes`, `/api/admin/checkout-pagamentos`, `/api/admin/encomendas-pagamentos`, `/api/admin/renewal-pagamentos`, `/api/admin/reseller-creditos`, `/api/admin/cotacoes` |

No painel antigo (`src/app/dashboard/page.tsx`) estas secções são os casos `'cotacoes'`, `'cotacoes-contas'` e
`'contabilidade'`. Ver como lá são chamadas: as mesmas propriedades servem no painel novo.

Cuidados da Fase 2:

- **`ContabilidadeTable`** é grande (1669 linhas) e tem separadores e filtros próprios.
  - Na primeira entrega, chamá-la como está, dentro de `vh-site`.
  - Os separadores dela passam aos `Tabs` do painel numa segunda entrega, só se o Silva pedir.
  - Nunca dois conjuntos de separadores à vista.
- **"Entrar como" cliente** em `EncomendasClientesSection` (`/api/admin/cotacoes/clientes/entrar`) usa o cookie
  `vd_impersonate_client` do site; não é o "entrar como" do painel. Deixar como está e confirmar que volta ao painel.
- **Depois de pagar, volta-se ao painel:** já está feito para o cliente (`src/lib/voltar-ao-painel.ts`). Se alguma
  destas páginas abrir o checkout, chamar `marcarVoltaAoPainel('/…')` como em `encomendas.tsx`.

## Fase 3 — Admin: Renovações e Hospedagens pendentes

| Página nova (menu Admin) | Grupo do menu | id | Componente existente (não mexer) | Rotas que ele usa (já existem) |
|---|---|---|---|---|
| Renovações | novo grupo "Renovações", a seguir a "Encomendas e contabilidade" | `renovacoes` | `RenewalsSection` em `src/app/dashboard/RenewalsSection.tsx`, com `initialTab="overview" hideTabs` | `/api/renewals?admin=true`, `/api/renewals`, `/api/admin/packages`, `/api/admin/renewals/domain-lookup`, `/api/users/search`, `/api/cron/renewal-check` |
| Registar renovação | o mesmo grupo | `renovacoes-registar` | `RenewalsSection` com `initialTab="add" hideTabs` | as mesmas |
| Modelos de renovação | o mesmo grupo | `renovacoes-modelos` | `TemplatesSection` em `src/app/dashboard/TemplatesSection.tsx` | (lê e grava os modelos dos avisos de renovação) |
| Hospedagens pendentes | grupo "Gestão de contas", a seguir a "Todos os utilizadores" | `hospedagens-pendentes` | `HostingPendingSection` em `src/app/dashboard/HostingPendingSection.tsx` | `/api/admin/hosting-pending` |

No painel antigo são os casos `'templates-renovacao'`, `'cadastrar-renovacao'` (RenewalsSection com `initialTab="add"`)
e `'hospedagem-pendentes'`. Em vez de três páginas, as Renovações podem ser **uma página com separadores**:
Renovações | Registar | Modelos. É o melhor, segue o modelo das Encomendas.

## Regras do Silva a confirmar em cada página (de `regras.md`)

- **Separadores:** a faixa cinzenta de separadores só aparece com vários separadores. Não ter separadores soltos nem
  filtros numa linha de botões por cima da tabela.
- **Rodas e esqueletos:** nunca dentro do painel. O `.vh-site` já esconde `animate-spin`; confirmar que não aparece
  outra coisa a piscar.
- **Tela branca:** nunca. Ao abrir, a página anterior fica à vista até a nova ter os dados.
  - Se a secção existente faz `fetch` ao abrir, a página nova lê primeiro a mesma rota com `useGet`
    (`src/components/vhost/carga.tsx`), como `encomendas.tsx` faz com `/api/cotacoes`.
- **Texto cortado:** nunca com "…". Nada passa da largura, a partir de 320 px.
- **Tamanhos de ecrã:** confirmar nos 5 tamanhos (1920, 1440, 1280, 1024, 390). Se uma tabela não couber:
  - as colunas menos importantes saem em CSS em `paginas.css`, dentro de `.vh .vh-<id>`;
  - no telemóvel, as linhas passam a blocos.
  - Ver como ficou a `.vh-facturacao`.
- **Imagens:** confirmar com medições (Playwright, `getBoundingClientRect`), nunca mandar imagens ao Silva.
- **Inglês:** `npm run i18n` tem de dar 0 textos sem inglês. As frases do painel vão para o `EN` do próprio ficheiro.
- **Não mexer** nos componentes do painel antigo nem nas rotas: só se chamam. O painel antigo (`/dashboard`) continua a
  funcionar como está e não se apaga nada dele (Silva).

## Como publicar (sem tocar no trabalho de outro agente)

1. Ramo próprio a partir de `fix/contabo-websites-audit` actualizado, por exemplo `work/admin-fases-2-3`.
2. Antes de pedir para publicar, mandar ao Silva o comando único do ponto 6 de `regras.md` para ver o ramo.
   **Atenção:** esse comando muda o ramo da pasta `visualdesign-producao`. Se outro agente estiver a trabalhar nessa
   pasta, avisar antes; as alterações dele ficam no stash.
3. Só com o "publica" do Silva:
   - PR para `fix/contabo-websites-audit` e merge;
   - título do merge **sem nome de IA** (ponto 7 de `regras.md`);
   - o deploy no Contabo corre sozinho.
4. Depois de publicar: mandar ao Silva o hash do merge e o comando para actualizar o projecto local.

## Ordem sugerida

1. Fase 2: Contabilidade, Encomendas (gestão) e Clientes das encomendas (uma entrega).
2. Fase 3: Renovações, com separadores, e Hospedagens pendentes (outra entrega).

Cada entrega vista e aprovada pelo Silva antes da seguinte.
