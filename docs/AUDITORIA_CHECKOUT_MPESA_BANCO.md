# Auditoria ao checkout — M-Pesa e transferência bancária (29/10/2026)

> **Estado (29/10/2026, mesmo dia):** corrigidos A1–A5, A7 e M2, M4, M5, M6 (A6 fica como estava, por decisão do Silva: o passo do número M-Pesa mantém-se) (nos commits do ramo `auditoria-fluxo-checkout-mpesa-banco`) e o percurso por produto no painel (ver `regras.md`). Ficam por decidir/fazer: M1 (depende da API verdadeira da operadora), M3 («não sou um robô» no checkout — decisão de política do Silva), M7 (confirmar no servidor que as migrações do checkout estão aplicadas) e M8 (texto de aviso sobre o preço/disponibilidade do domínio até à confirmação).

Só o **fluxo** (não a API de teste da operadora). Auditoria de leitura: li as regras (`AGENTS.md`, `regras.md` inteiros) e depois o código de ponta a ponta, sem correr o site nem tocar na base de dados. Nada foi alterado no código.

## 1. Como corre hoje (compras do carrinho: domínio, alojamento, e-mail)

1. `/checkout/dominio` (se há alojamento ou e-mail sem domínio) → `/checkout`. Quem não tem conta preenche o formulário e `/api/auth/register` cria a conta (e-mail dado como confirmado, sem prova) e inicia a sessão.
2. «Pagar» → `POST /api/checkout/manual-session`: o servidor **recalcula os preços** (`resolveCartItems`), acrescenta 16 % de IVA e grava `checkout_sessions` (`pending`, `metodo_pagamento` = `mpesa` ou `transferencia`). O carrinho é **limpo logo aqui**, antes de haver pagamento.
3. M-Pesa: passo do número (`MpesaTesteStep`) → `POST /api/checkout/mpesa-teste` (só com `MPESA_ENV=sandbox`, que o deploy **põe sempre**). Nada é cobrado nem activado. Transferência: salta este passo.
4. Passo do comprovativo (`ManualPaymentUploadStep`) → `POST /api/checkout/[id]/comprovativo` (ficheiro no balde privado; avisa a equipa).
5. Equipa: Contabilidade › Domínios / Hospedagem / E-mails → `PATCH /api/admin/checkout-pagamentos/[id]` **item a item**: «Confirmar» corre `fulfillCheckout` para esse item; «Rejeitar» marca `failed`. A sessão só passa a `paid` quando todos os itens estão `paid`.
6. Cliente: Gestão › Compras (`/api/client/minhas-compras`) e recibo (`/recibo/[id]`, só com a sessão `paid`).

Encomendas (`/checkout?encomenda=1`): o rascunho local é gravado em `quotation_requests` no «Pagar» (`payment_selected`), o comprovativo vai para `/api/cotacoes/[id]/anexos` (fase `adiantamento`) e a equipa confirma em Contabilidade › Encomendas (factura, livro de pagamentos, e-mail ao cliente). Este lado está bem mais completo do que o do carrinho.

## 2. Problemas — por gravidade

### Altos

| # | Problema | Onde | Porquê é real |
|---|---|---|---|
| A1 | **O preço do domínio é validado por `id`, o registo é feito por `name`.** | `package-catalog.ts` (`item.id \|\| item.name` para achar a extensão) vs `checkout-fulfillment.ts` (`item.name`) | Um pedido com `id: "x.com"` e `name: "outro.co.mz"` paga o preço de `.com` e regista `.co.mz` no registador, com custo real. No cartão é automático; na transferência só a equipa o apanha. Correcção: exigir `id === name` (minúsculas) nos domínios. |
| A2 | **A equipa pode «Confirmar» sem comprovativo.** | `ContabilidadeTable.tsx` (`CheckoutItemsByType`, `EncomendaPagamentosTable`) | O botão aparece em todo o item `pending`, mesmo com «Sem comprovativo». Confirmar regista um domínio **a sério** (o registador está em produção) e cria contas. Os contadores (`contabilidade-pendentes`) também contam pedidos ainda sem comprovativo (e as encomendas contam desde o «Pagar»). |
| A3 | **Rejeitar é definitivo e silencioso.** | `checkout-pagamentos/[id]` PATCH; `comprovativo` (409 se `status != pending`); `MinhasComprasSection` | Nenhum aviso ao cliente (nem e-mail, nem notificação) ao confirmar ou rejeitar. Depois de rejeitado (ex.: foto ilegível) o cliente **não pode reenviar** (409) e a lista só mostra «Rejeitado», sem motivo (a rota até devolve `rejection_reason`, o ecrã ignora-o). Nas encomendas é o contrário: volta a pendente e fica uma mensagem na conversa. |
| A4 | **Um pedido pendente fica sem caminho de volta.** | `CheckoutContent.tsx` (carrinho limpo no passo 2); `MinhasComprasSection` | Quem fecha o separador antes de anexar só volta se souber o endereço `?pendingId=…`. Gestão › Compras mostra o pedido «Pendente» **sem** botão para anexar o comprovativo, ver os dados de pagamento ou cancelar. Também não há e-mail com valor/dados/referência. Os pedidos nunca expiram (o estado `expired` existe mas nada o põe). |
| A5 | **Confirmar item a item parte a lógica «só domínio».** | `checkout-pagamentos/[id]` chama `fulfillCheckout(..., [item], ...)`; `checkout-fulfillment.ts` (`soDominios`) | Num pedido domínio + alojamento, ao confirmar só o domínio o código vê «sem alojamento nem e-mail» e cria a conta `VD-Dominio`; depois o alojamento cria **outra** conta. Resultado: duas contas, DNS numa e site na outra. Além disso `pagamentos.valor` regista o preço sem IVA, por item. |
| A6 | **O passo do número M-Pesa está ligado em produção.** | `deploy-visualdesign.yml` (`MPESA_ENV=sandbox`), `CheckoutContent.tsx` (`MpesaTesteStep`), `mpesa-teste` | Todo o cliente real que escolhe M-Pesa pede o número, espera (cada tentativa até 65 s, duas tentativas: ~2 min, sem botão de saltar) e só depois lê «ambiente de teste: o valor não foi deduzido». O número dele é enviado à operadora de teste. O botão «Pagar Agora m-pesa» promete uma cobrança que não existe. |
| A7 | **No passo de pagar não aparece o valor nem uma referência.** | `CheckoutContent.tsx` (`ManualPaymentUploadStep` do carrinho sem `valorMt`) | O carrinho é limpo e o passo mostra a conta/NIB (ou o número M-Pesa) **sem o montante** a transferir. As renovações mostram «Nº de referência», o carrinho não: a equipa só casa a transferência pelo nome e valor. |

### Médios

| # | Problema | Onde |
|---|---|---|
| M1 | **O M-Pesa em produção não existe em código.** `mpesa-pay` e `webhook/mpesa` só respondem com `MPESA_ENV=sandbox`; `mpesa-pay` (só administradores, só alojamento) não tem nenhum chamador; `NEXT_PUBLIC_MPESA_ENV` não é lida em lado nenhum. Tirar o sandbox desliga o passo do número e fica só o comprovativo manual — passar a produção é **construir** a cobrança do cliente, não só trocar credenciais. O `webhook/mpesa` também **não autentica** o pedido (qualquer corpo com `INS-0` e a referência activa os produtos): tem de ter assinatura ou confirmação à operadora antes de se abrir a produção. |
| M2 | **Dados que o formulário pede e perde:** província, «Endereço 2» e código postal nunca são enviados a `/api/auth/register`; o indicativo do telefone (`+258/+244/+351/+55`) não tem estado — é ignorado. Morada e cidade são opcionais, mas comprar um domínio exige-as: o erro só aparece **depois** de a conta ser criada. |
| M3 | **Conta criada sem prova do e-mail e sem «não sou um robô»** (`email_confirm: true`, regra documentada). Quem escreve o e-mail de outra pessoa reserva-lhe a conta (a pessoa depois ouve «já existe»); um robô enche a base de contas e de pedidos `pending` que nunca expiram. |
| M4 | **«Entrar como» + transferência/M-Pesa:** `manual-session` grava o pedido na conta imitada, mas `comprovativo`, `mpesa-teste` e `session-status` comparam com o administrador real (403/404). O pagamento por saldo e cartão funciona; este não. |
| M5 | **Aviso à equipa pode não chegar à notificação interna:** `notifyQuoteTeam` grava a notificação com `profiles.id` do administrador; em `checkout-fulfillment.ts` está documentado que isso viola a chave estrangeira (`notifications.user_id` é `auth.users.id`) e que foi corrigido **só** em `alertAdminOfTrackingFailure`. Fica o e-mail e o contador da Contabilidade. |
| M6 | **Duplicados ao confirmar:** não há bloqueio entre ler o estado do item e gravá-lo. Dois cliques/dois administradores, ou uma falha a meio de `fulfillCheckout`, repetem `hosting_renewals` (sem unicidade) e `pagamentos`. |
| M7 | **As migrações do checkout não correm no deploy** (só `supabase-vhost-activity-history.sql`): `checkout_sessions` base, `manual-payment`, colunas `mpesa_*` e os recibos. Pelo repositório não consigo provar que estão aplicadas no servidor; `mpesa-teste` ignora o erro do `update`. Convém uma leitura só de verificação. |
| M8 | **Preço fixo só no momento do pedido:** o domínio é verificado ao escolher e só é registado quando a equipa confirma (horas ou dias depois); se entretanto foi tomado, o dinheiro já entrou. O aviso existe (notificação), mas o cliente não é avisado de que isto pode acontecer. |

### Baixos (texto, regras e arrumação)

- **Regra «sem fornecedores nas mensagens públicas»:** «Cartão (Stripe)», «A abrir o pagamento seguro da Stripe…», «página segura da Stripe», selo «PCI Compliant» (CheckoutContent, RenewalCheckout).
- **Grafia/língua:** «Fatura/Faturado Por/Faturado Para/Imprimir Fatura» (o resto do projecto escreve «Factura»), «Ações Rápidas» (a regra é «Acção»), «Sobrenome» (Apelido), «Download PDF» (Descarregar PDF), «Endereço» em vez de «Morada».
- «Imprimir Fatura» e «Download PDF» chamam ambos `window.print()` e imprimem a página do checkout; nesta fase não existe factura.
- `SUPORTE_TELEFONES` tem um segundo número com ar de exemplo (`+258 84 123 4567`) — confirmar.
- `/checkout` mostra por instantes «O seu carrinho está vazio» a cada carregamento (o carrinho vem do `localStorage` depois do primeiro desenho). Em `/checkout/dominio`, recarregar a página volta a `/precos/hospedagem` por causa do mesmo atraso (`items.length === 0` no primeiro efeito).
- `router.push` chamado durante o desenho (ramo `renewalId` sem sessão).
- A palavra-passe «segura» gera-se com `Math.random`.
- O comprovativo aceita qualquer tipo de ficheiro no servidor (só o `accept` do navegador limita); convém lista de tipos (imagem/PDF).
- A taxa de IVA existe em três sítios (`iva.ts`, `encomenda-checkout.ts`, `admin/cotacoes`).
- «Conta BCI» está escrito à mão em `EncomendasPagamentosSection` e `cotacao/[id]/pagamento`; o checkout usa só `BANK_NAME`.
- `CheckoutContent.tsx` tem 1 756 linhas (formulário, resumo, três métodos, dois passos, impersonação, encomendas): difícil de manter e de testar.
- `checkout/sucesso/page.tsx` já se diz removível.

## 3. O que está bem feito (não mexer)

- Os preços são sempre recalculados no servidor (`resolveCartItems`; excepto o ponto A1) e o IVA é acrescentado no servidor; `total_mt` já é o total a pagar.
- Balde de comprovativos privado, com ligações assinadas de 1 h; cada rota confirma o dono do pedido.
- Saldo do revendedor: débito com bloqueio optimista e devolução automática se a activação falhar.
- Cartão e saldo são idempotentes (`status === 'paid'`) e o webhook do cartão confirma a assinatura.
- Encomendas: «descartar» só antes de haver comprovativo/factura; rejeição devolve a encomenda a pendente com mensagem; factura e livro de pagamentos idempotentes.
- Mensagens de erro do servidor ao cliente sem pormenores internos (`/api/cotacoes`).

## 4. Ordem de correcção que proponho

1. **A1** (segurança do preço) e **A2** (esconder/avisar «Confirmar» sem comprovativo) — pequenas e urgentes.
2. **A3 + A4**: avisar o cliente (e-mail/notificação) ao criar, ao receber o comprovativo, ao confirmar e ao rejeitar; permitir reenviar depois de rejeitado; em Gestão › Compras mostrar valor, dados de pagamento, «Anexar comprovativo» e motivo da rejeição; expirar pedidos antigos.
3. **A7**: mostrar o valor e uma referência (ex.: 8 primeiros caracteres do pedido, como nas renovações) no passo da transferência/M-Pesa.
4. **A6**: decisão do Silva — esconder o passo do número enquanto o M-Pesa for só teste (ou pôr «Saltar» e um limite de 15–20 s).
5. **A5**: confirmar o pedido inteiro de uma vez, ou passar o contexto do pedido a `fulfillCheckout` para a lógica «só domínio» olhar para todos os itens.
6. **M2, M3, M5**: enviar os campos que se perdem, tornar morada/cidade obrigatórias quando há domínio, juntar «não sou um robô», corrigir `notifyQuoteTeam`.
7. **M1** antes de qualquer passagem do M-Pesa a produção.

## 5. Limites desta auditoria

Não corri o site, o `npm run i18n` (não há `node_modules` nesta sessão) nem leituras ao servidor/base de dados. Não li por inteiro `domain-check`, `email-plan-provision`, `domain-purchase-provision`, `notify-quote-client` nem os componentes da lista de encomendas (`EncomendasListSection`, `CotacaoContent`). Os pontos M5 e M7 dependem do estado real da base de dados.
