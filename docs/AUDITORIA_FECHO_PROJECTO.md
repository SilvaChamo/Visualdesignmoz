# Auditoria para fechar o projecto — 27/10/2026

> **O Hetzner já está fechado** (servidor desligado a 19/10/2026; do balde de ficheiros só falta cancelar a conta). Nada no projecto depende dele e não se propõe nem se faz
> nenhuma alteração para ele. Tudo o que ainda o menciona (comentários, secrets, histórico do git) é resto a limpar, não dependência.

Levantamento do que falta em configurações gerais, tradução, facturação e segurança do servidor. Feito a partir do código, dos
workflows, de `regras.md` e de `ESTADO_PROJECTO.md` no ramo `main` (commit `b8a75df9`). **Nada foi alterado no código nem no servidor.**

**O que esta auditoria não consegue ver:** o estado real do servidor (crons, firewall, certificados, Docker), os secrets do GitHub
e a consola da Cloudflare/Brevo/Stripe. Esses pontos vão marcados «a confirmar no servidor» e só se confirmam com um workflow de leitura
(regra 4 de `regras.md`: só leitura primeiro, com pedido do Silva).

Legenda: **A** = bloqueia o fecho · **B** = fazer antes de dar por fechado · **C** = melhoria, pode ficar para depois.

---

## 1. Resumo — o que falta, por ordem

| # | Área | Ponto | Nível |
|---|------|-------|-------|
| 1 | Facturação | M-Pesa ainda em sandbox (`MPESA_ENV=sandbox`) — pendente da Vodacom | A |
| 2 | Facturação | Recibos/facturas sem certificação AT/SAF-T e sem IVA discriminado nas compras do carrinho — decidir com o contabilista | A |
| 3 | Segurança | Cópias fora do servidor (R2): o cron diário **não está ligado**; só há envio manual | A |
| 4 | Segurança | Rotas de API sem autenticação que usam a chave de serviço do Supabase (`get-all-contacts`, `migrate-contacts`) | A |
| 5 | Segurança | Troca do endereço do Supabase marcada para 23/10 e **ainda por fazer** segundo `regras.md` | B |
| 6 | Segurança | Secrets e credenciais do tempo do Hetzner ainda no GitHub e no histórico do git | B |
| 7 | Segurança | Webhook M-Pesa sem autenticação (hoje desligado fora do sandbox; tem de ser resolvido antes do go-live) | A (com o #1) |
| 8 | Tradução | 1 texto do painel sem inglês + resíduos de português do Brasil + varrimento dinâmico por fazer | B |
| 9 | Geral | Sem verificação automática em PR (tsc, lint, `i18n`) e sem Dependabot | B |
| 10 | Geral | Privacidade/Termos genéricos, sem identificação do responsável nem política de cookies | B |
| 11 | Segurança | DNS de e-mail: DMARC a 100 %, basededadosagro.com, elimservicos.com, shalomdeco.com | B |
| 12 | Geral | Restos do Hetzner/DirectAdmin no código, pendentes do painel (managers, nginx 2026, caixa `servidor@`) | C |

---

## 2. Facturação

### Já feito
- Três séries sequenciais, sem falhas e imutáveis, numeradas por ano: facturas de encomendas (`quotation_invoices`, função
  `assign_quotation_invoice_number`), renovações (`renewal_invoices`) e recibos do carrinho (`checkout_receipts`, emitido uma só vez na
  primeira abertura de `/recibo/[id]`).
- IVA de 16 % fixo nas encomendas (`ENCOMENDA_IVA_RATE`, `encomenda-checkout.ts`), calculado depois de retirar os custos de produção;
  adiantamento 70 % / remanescente 30 % sobre o total com IVA; fecho de ano na contabilidade (`accounting-year-lock.ts`, `contabilidade/fecho`).
- Cabeçalho oficial dos documentos (`VisualDesignDocument.tsx`): NUIT 400597243, Maputo, contactos.
- Stripe: webhook valida a assinatura (`constructEvent`). Pagamento manual (M-Pesa/e-Mola/transferência) com comprovativo e confirmação humana.
- Avisos de renovação (90 a 1 dia), suspensão com travões e período de recuperação de 30 dias.
- Gestão › Facturação (cliente) e Admin › Contabilidade existem no painel.

### Falta
1. **M-Pesa em produção** (A). `deploy-contabo.yml` fixa `MPESA_ENV` e `NEXT_PUBLIC_MPESA_ENV` em `sandbox`. Passos, por esta ordem:
   enviar `docs/mpesa-pedido-vodacom.md` (faltam os campos `[nome legal]`, `[NUIT]`, contacto) → receber API Key, Public Key, Service Provider
   Code, host e porta de produção → actualizar os 5 secrets `MPESA_*` → mudar as duas variáveis para `production` → pagamento de teste de
   valor mínimo. Só com o «avança» do Silva (dinheiro real).
2. **Webhook M-Pesa** (A, depende do #1). `src/app/api/webhook/mpesa/route.ts` responde 403 quando `MPESA_ENV` não é `sandbox` e **não tem
   nenhuma autenticação**: no sandbox qualquer pedido com uma referência válida activa produtos. Em produção o retorno assíncrono nem existe
   (o fluxo síncrono `mpesa-pay` cobre quase tudo, mas uma ligação cortada aos 60 s fica sem confirmação). Antes do go-live: decidir se o
   retorno assíncrono é preciso (a Vodacom exige uma porta entre 11000 e 19000, ainda sem listener no nginx) e, se for, autenticar por lista de
   IPs da Vodacom ou por segredo; ou deixar desligado e tratar as ligações cortadas com uma consulta de estado da transacção.
3. **Stripe em modo real** (a confirmar). O deploy lê `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` dos secrets;
   confirmar que são `sk_live_`/`pk_live_`/`whsec_` do endpoint de produção e fazer um pagamento real mínimo com reembolso.
4. **Certificação fiscal e IVA** (A, decisão do Silva com o contabilista). Os próprios SQL dizem «sem certificação AT/SAF-T». Pontos a decidir:
   - se a AT exige software de facturação certificado para as vendas do site (e a partir de quando);
   - **as compras do carrinho (domínios, hospedagem, e-mail) não têm IVA discriminado** (`grep` a `checkout` e ao recibo: nenhuma referência a IVA). Só as
     encomendas o têm. Decidir se os preços do site já incluem IVA e mostrá-lo no recibo;
   - o carrinho só emite **Recibo**, não Factura (o recibo diz «Pago na Totalidade»); decidir se o cliente precisa de uma factura/factura-recibo;
   - o cabeçalho tem NUIT mas **não tem morada completa nem nome legal da empresa**.
5. **Recibos e facturas só em português.** `ReciboDocument` e os documentos de cotação usam texto fixo em português e datas `pt-PT`. Se clientes
   internacionais pagarem, decidir se o recibo segue a língua escolhida.
6. **Dados de facturação do cliente** (empresa, NUIT, morada) estão em Perfil › Dados pessoais, mas nada obriga a preenchê-los antes de comprar.
   Decidir se o NUIT é obrigatório para empresas no checkout.
7. **Domínios de teste na Dynadot** (PR #3, aberto desde 09/08): workflow para desligar a renovação automática dos 3 domínios `claude-*` e repor
   `basededadosagro.com` em `domain_renewals`. **Nunca fechar** (regras). Precisa do OK do Silva para correr (escreve na base de dados).
8. **Reconciliação**: não há relatório que cruze Stripe/M-Pesa com `checkout_sessions` e com a contabilidade (pagamentos recebidos sem recibo ou
   recibos sem pagamento). Útil antes de abrir ao público.

---

## 3. Tradução

### Estado medido hoje
- Site público: `npm run i18n` → **93 ficheiros, 0 textos sem inglês**.
- Painel: `npm run i18n:painel` → **164 ficheiros, 1 texto sem inglês**:
  `src/components/quotations/ContabilidadeTable.tsx:1396` — «O cliente ainda não indicou o domínio.» (falta a linha no dicionário do painel).
- Inglês britânico respeitado nos dicionários (`organisation`, `colour`, `customised` — sem formas americanas, excepto o nome de produto «Customizer»).

### Falta
1. **Acrescentar a linha inglesa em falta** (B) e voltar a correr `npm run i18n:painel` até dar 0.
2. **Português do Brasil que ficou nos textos visíveis** (B) — a regra de 27/10 manda português de Portugal / Moçambique:
   | Onde | Texto actual | Deve ser |
   |------|--------------|----------|
   | `traducoes/03-comuns-a.ts` (chaves do código) | «Salvar» | «Guardar» |
   | idem | «Cadastrar», «Cadastrar Email», «Erro ao cadastrar», «✅ Cadastrado com sucesso!» | «Registar…» |
   | idem | «Falha ao salvar no servidor», «Erro ao salvar templates:», «Erro desconhecido ao salvar» | «guardar» |
   | `traducoes/03-comuns-a.ts:420` | «Tem certeza que deseja restaurar os templates padrão? Todas as customizações…» | «Tem a certeza… modelos predefinidos… personalizações» |
   | `src/app/api/renewals/route.ts:216` | «Domínio/Hospedagem cadastrado com sucesso» | «registado» |
   | `src/app/api/notifications/admin/route.ts:174` | «Usuário sem email cadastrado» | «Utilizador sem e-mail registado» |
   | `src/app/pagamento/renovacao/[id]/page.tsx:246` | «Nenhum método de pagamento cadastrado» | «…registado» |
   | `vhost/paginas/email.tsx:783-784`, `EmailConfigResultModal.tsx:89` | «Baixar …» | «Descarregar …» (ou «Baixar» onde for comprido, excepção de 27/10) |
   Cada alteração mexe no texto do código **e** na chave do dicionário (têm de ser iguais).
3. **Varrimento dinâmico por fazer** (B). Os dois verificadores são estáticos; a regra de 27/10 pede percorrer o painel em PT e em EN e listar o
   que fica igual (três níveis de menu e sub-ecrãs: `…/dominios/transferir`, `…/email/uso`, perfil, preferências), com os 3 papéis
   (cliente, revendedor, administrador).
4. **O que a tradução automática não alcança** (a verificar):
   - e-mails transaccionais e **modelos guardados na base de dados** (renovações, notificações, mensagem a todos) — escritos uma vez, na língua de quem os criou;
   - mensagens de erro devolvidas pelas rotas `/api/*` (vêm em português; só se traduzem se passarem pelo dicionário no ecrã);
   - recibos, facturas e cotações (ver Facturação #5);
   - e-mail de confirmação/recuperação de palavra-passe do Supabase (`supabase-auth-email.ts`).
5. **Página de erro 404 / manutenção / offline** (`not-found.tsx`, `manutencao`, `public/offline.html`): confirmar que as três respeitam o botão EN/PT (o `offline.html` é estático e fica fora do dicionário).

---

## 4. Segurança do servidor e da aplicação

### Já feito (confirmado em `regras.md` e nos ficheiros do repositório)
SSH só na 2234; FTP e painel do Hestia fechados; bloqueio no nginx antes do PHP; guarda de sites por comportamento; fail2ban do `wp-login`;
CPU e memória por conta (PHP-FPM próprio); IP verdadeiro do visitante em todos os sites; certificados Let's Encrypt a renovar sozinhos;
`CRON_SECRET` mudado a 22/10; bloqueio de login (5 falhas → 15 min); 2 passos opcional; cabeçalhos de segurança no `next.config.ts` (HSTS com preload,
CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy); Turnstile no registo; auditoria P0/P1 do painel (`docs/AUDITORIA_PAINEL_PLANO_CORRECAO.md`)
com todos os pontos corrigidos; deploy sem corte com reversão; isenção do IP do Silva em todos os mecanismos.

### Falta

**A — bloqueia o fecho**
1. **Cópias de segurança fora do servidor** (`regras.md`, «Cópias… Cloudflare R2»): o primeiro envio e o teste de restauro passaram, mas o cron
   `/etc/cron.d/vd-backup-externo` (`0 7 * * *`) **não foi instalado** (a protecção do ambiente recusou; espera a ordem expressa do Silva). Sem ele só há
   cópias manuais e a cópia mais recente do R2 envelhece. Dar a ordem, instalar, e confirmar com `vd-backup-externo estado` no dia seguinte.
   Confirmar também que o Silva guardou a palavra-passe de cifra num gestor de palavras-passe (sem ela as cópias não se abrem).
2. **Rotas de API sem autenticação e com a chave de serviço do Supabase.** **Resolvido no código em 27/10/2026 (ver «Ponto 3 — feito» no fim); falta publicar.** Heurística sobre as 185 rotas (procura de qualquer verificação de sessão,
   `CRON_SECRET` ou assinatura); as seguintes não têm nenhuma e **li o código das três primeiras**:
   - `GET /api/get-all-contacts?domain=…` — devolve nomes e e-mails de `email_contas` dos domínios `visualdesignmoz.com`, `anap.co.mz`,
     `entrecampos.co.mz`, `aamihe.com` a qualquer visitante. Sem chamadores no repositório.
   - `POST /api/migrate-contacts` — migração pontual que reescreve `newsletter_subscribers` de qualquer pessoa que a chame. Sem chamadores no repositório.
   - `GET /api/check-smtp-config` — mostra a configuração de envio (servidor, porta, prefixo do utilizador, remetentes, SPF calculado).
   - **Não li** (a confirmar quem as chama e se têm protecção própria): `auth/email-livre` (permite saber se um e-mail está registado), `auth/reset-password`,
     `submit-ticket`, `domain-check`, `domain-tld-prices`, `public/site-news`, `mozserver-proxy`, `whmcs-proxy`, `my-products`, `vhost/dados`, `vhost/aquecer`,
     `webmail-redirect`, `versao`, e as `cotacoes/[id]/*` (estas usam `resolveQuotationAccess`).
   - **Regra 5 de `regras.md`:** nada se apaga sem ver quem chama de fora (crons, webhooks, outros sites). Primeiro ver os registos do nginx dos últimos 30
     dias para estas rotas; depois proteger (sessão de administrador ou `CRON_SECRET`) ou apagar com redirecção.
3. **Webhook M-Pesa sem autenticação** — ver Facturação #2.

**B — antes de dar por fechado**
4. **Troca do endereço do Supabase** (`supabase-contabo.…` → `supabase.…`): agendada para 23/10 às 00:00 e a nota «Feito» de `regras.md` continua a dizer
   «(ainda não)». Confirmar no servidor (`/opt/supabase-contabo/docker/.env`, secret `CONTABO_SUPABASE_URL`, `/auth/v1/health`). Se já foi feita, escrever a data
   na nota; se não, fazer (todos os utilizadores voltam a entrar uma vez) e acrescentar o URL de retorno no Google.
5. **Credenciais do Hetzner.** O repositório ainda lista nos workflows secrets como `DIRECTADMIN_HOST/USER/PASSWORD/LOGIN_KEY/PORT/PROTOCOL` e `HESTIA_ADMIN_*`;
   `ESTADO_PROJECTO.md` regista que a chave `service_role` do Supabase antigo, o MySQL e o DirectAdmin do Hetzner estiveram no código (decidido em 22/10 não as
   mudar). **O Hetzner já está fechado, por isso a razão de 22/10 (não afectar clientes) acabou — mudar de decisão:** confirmar que o Supabase antigo já não existe (a chave deixa de valer) ou rodá-la; apagar os secrets
   que nenhum workflow usa (`CONTABO_ROOT_PASSWORD`, os do DirectAdmin se o deploy os escreve só por herança); decidir se se limpa o histórico do git
   (reescrever histórico só com autorização expressa do Silva — alternativa: manter privado e rodar tudo o que lá esteve).
6. **O site liga-se ao servidor como `root` por SSH** (`SERVER_SSH_KEY_PATH=/root/.ssh/app_self_key`, a mesma chave do deploy `CONTABO_SSH_KEY`). Uma falha
   de execução no painel dá acesso total ao servidor, incluindo o `basededadosagro.com`. Reduzir: chave própria da aplicação, num utilizador com `sudo`
   limitado aos comandos `v-*` e ao necessário, e a chave do deploy separada (restrita a `/opt/visualdesign-releases` e `pm2 reload visualdesignmoz`).
7. **Limites de tentativas só em três rotas** (`panel-login`, `vhost/entrar`, `vhost/perfil`). Confirmar em produção que o 6.º erro seguido devolve 429
   (item 11 de `ESTADO_PROJECTO.md`) e que o login por e-mail (que vai directo ao Supabase em `supabase-client.ts`) também fica limitado; pôr Turnstile
   (hoje só no registo) no pedido de recuperação de palavra-passe, no `submit-ticket` e no contacto.
8. **DNS de e-mail** (`ESTADO_PROJECTO.md`, item 13): passar o DMARC de `quarantine; pct=25` a 100 % ao fim de uma semana sem queixas (desde 26/10 → decidir a partir
   de 02/11); `basededadosagro.com` precisa da chave DKIM do servidor antes de sair de `p=none`; `elimservicos.com` (e-mail Google, decidir); `shalomdeco.com`
   (DNS no ibspark, decisão da dona). Certificados de e-mail do `mltmark.com` e `basededadosagro.com` precisam do registo A `webmail.<domínio>`.
9. **Porta 2026**: correr `ops-nginx-porta-2026.yml` (sem «aplicar» e depois com) para o nginx apontar a `/vhost:2026`.
10. **Managers (`manager`)** em `/api/da` e `/api/server-exec`: bloqueados (seguro) mas incompletos; testar com conta real ou decidir tirar o papel.
11. **CSP** com `'unsafe-inline'` e `'unsafe-eval'` em `script-src` (por causa do Next, do editor e do Turnstile): aceitável, mas anotar como risco conhecido; `X-XSS-Protection`
    é obsoleto (inofensivo). Subir a CSP para nonces só vale a pena se houver tempo.
12. **Monitorização**: existem `watchdog`, `server-ram-watch.sh` e o aviso por e-mail das cópias. Falta um aviso externo (ex.: verificação de
    `visualdesignmoz.com` e `basededadosagro.com` de fora do servidor) para o caso de o próprio servidor cair — o 502 de 33 horas de 23/10 só se descobriu tarde.

**C — melhorias**
13. fail2ban sobre os registos do Apache já é possível (IP real em todos os sites, 26/10) — opcional.
14. Caixa `servidor@visualdesignmoz.com` (criar no Hestia, tirar do bloqueio do Brevo); os avisos de erro vão entretanto para `geral@`.
15. Quota do pacote `VD-Email-Basico` no Hestia (PR #105 só corrigiu o ficheiro do site).

---

## 5. Configuração geral e qualidade

1. **Sem verificação antes de publicar** (B). Só existe o workflow de deploy (corre em cada merge em `main`); nenhum workflow corre `tsc`, `lint`
   ou `npm run i18n`/`i18n:painel` nos PR, e há **um único teste** (`email-quota-allocation.test.mjs`). Acrescentar um workflow de PR com `tsc --noEmit`,
   `next lint`, `npm run i18n` e `npm run i18n:painel`, e um teste de fumo (login, checkout de teste, `/recibo`).
2. **Sem Dependabot** (`.github/dependabot.yml` não existe). Os alertas críticos de Next e nodemailer já foram resolvidos (Next 16.4.3, nodemailer ^10.2.1;
   os PR #180 e #181 de `ESTADO_PROJECTO.md` já não estão abertos — esse documento está desactualizado neste ponto). Ligar Dependabot de segurança.
3. **Política de Privacidade e Termos genéricos** (B): 6 secções curtas, «Última actualização: Julho de 2026», sem identificar o responsável pelo tratamento
   (nome legal, NUIT, morada, contacto), sem prazos de conservação, sem lista de categorias de dados de pagamento e sem página de **cookies**. Não há faixa de
   consentimento de cookies. Rever com um jurista à luz da legislação moçambicana aplicável e da dos clientes no estrangeiro.
4. **Documentação desactualizada**: `ESTADO_PROJECTO.md` (PR #180/#181, itens já feitos), `README.md`, `SERVICOS_REFERENCIA.md`, `GOOGLE-OAUTH-SETUP.md` e
   `SUPABASE_CONTABO_SETUP_MANUAL.md` precisam de uma passagem; a lista «Falta para fechar» tem 18 itens, vários já cumpridos.
5. **Ficheiros SQL soltos na raiz** (≈ 60 `supabase-*.sql`) e em `scripts/`: não há registo de quais já foram aplicados (o deploy aplica só alguns). Criar uma
   pasta `supabase/migrations` com ordem e estado, ou uma tabela de controlo, para recriar a base do zero se for preciso.
6. **Ramos antigos**: o GitHub tem ~95 ramos (16 `arquivo/…`, vários `ops/…` e de trabalho já publicados). Limpar só pelo Silva (regra n.º 1), depois de provar que
   cada um está em `main`; guardar os SHAs. **O ramo `claude/focused-turing-p63thb` desta sessão ainda existe no GitHub** — a regra n.º 1 manda que nenhum ramo leve
   o nome de uma IA; esta auditoria foi enviada para `auditoria-fecho-projecto` e o antigo fica para o Silva apagar.
7. **Restos do Hetzner/DirectAdmin no código** (C): comentários em ~20 ficheiros de `src/lib` e `src/app/api` e os ramos DirectAdmin ainda vivos em
   `/api/da`, `server-exec`, `panel-dns`. Só saem retirando esses ramos (trabalho à parte, com a análise de chamadores da regra 5).
8. **Telemóvel**: varrido a 320/390/980/1280 px (#191); falta a aprovação do Silva. O menu «Importar do cPanel» da revenda está desenhado mas **sem ligação** ao servidor
   remoto (precisa de decisão do Silva sobre limites e registo).
9. **Variáveis de ambiente**: `deploy/env.production.template` e os `set_env_var` do deploy devem ser a única lista; confirmar que não há variáveis só no
   `.env.local` do servidor que se perderiam numa reinstalação (listar chaves sem valores com um workflow de leitura).

---

## 6. Ordem sugerida para fechar

1. Decisões do Silva (não dependem de código): contabilista/AT e IVA; ordem para instalar o cron das cópias; envio do pedido à Vodacom; texto legal e responsável de privacidade.
2. Ler (sem alterar) os registos do nginx para as rotas sem autenticação e, a seguir, protegê-las ou removê-las.
3. Confirmar no servidor, só em leitura: Supabase (endereço), cron de cópias, certificados de e-mail, Stripe em modo real.
4. Limpar secrets e credenciais do Hetzner; separar a chave SSH da aplicação da do deploy.
5. Workflow de verificação nos PR + Dependabot.
6. Tradução: 1 texto, português de Portugal nos resíduos, varrimento dinâmico nos três papéis.
7. M-Pesa em produção (último, com pagamento de teste de valor mínimo), depois reconciliação.
8. Actualizar `ESTADO_PROJECTO.md` e fechar a lista.

---

## 7. Ponto 3 — rotas sem autenticação: feito no ramo (27/10/2026)

Não se apagou nenhuma rota (regra 5: não há como ver, daqui, quem as chama de fora); protegeram-se.

| Rota | Antes | Agora |
|------|-------|-------|
| `GET /api/get-all-contacts` | qualquer visitante lia nomes e e-mails de clientes | administrador com sessão, ou `Authorization: Bearer ${CRON_SECRET}` (para um chamador de fora) |
| `POST /api/migrate-contacts` | qualquer visitante reescrevia `newsletter_subscribers` | só administrador |
| `GET /api/check-smtp-config` | configuração de envio à vista | só administrador |
| `POST /api/mozserver-proxy` | qualquer visitante corria pedidos à API de um fornecedor externo com uma **chave escrita no código** | só administrador; a chave vem de `MOZSERVER_API_TOKEN` |
| `POST /api/auth/email-livre` | limite por IP lia o primeiro valor de `x-forwarded-for` (o visitante podia variá-lo e fugir ao limite) | lê `x-real-ip` posto pelo nginx |

**A chave que estava em `mozserver-proxy` está no histórico do git: tem de se considerar comprometida** — pedir uma nova ao fornecedor (ou confirmar que a conta
já não existe) e só depois pô-la, se for preciso, em `MOZSERVER_API_TOKEN` no `.env.local` do servidor.

**Ainda por tratar (não alterado):**
- `POST /api/auth/reset-password` — sem limite nem Turnstile: dá para encher a caixa de qualquer pessoa de e-mails de recuperação.
- `POST /api/submit-ticket` — o «captcha» compara duas respostas **enviadas pelo próprio cliente** (`captchaAnswer` e `captchaResult`), por isso não protege de nada; pôr Turnstile.
- `POST /api/domain-check` — pública e sem limite; cada pedido pode ir ao registador (custo e abuso).
- Antes de dar o assunto por fechado: ler, no servidor e só em leitura, os registos do nginx dos últimos 30 dias para `get-all-contacts`, `migrate-contacts`,
  `check-smtp-config` e `mozserver-proxy`, para ver se alguém de fora as chamava (quem as chamar passa a levar 401/403).
- Lidas e sem problema: `whmcs-proxy` (já exige administrador), `webmail-redirect` (só acrescenta ao endereço do webmail), `versao`, `vhost/aquecer`,
  `domain-tld-prices` e `public/site-news` (públicas por desenho).
