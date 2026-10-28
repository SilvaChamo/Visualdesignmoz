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
     `submit-ticket`, `domain-check`, `domain-tld-prices`, `public/site-news`, `my-products`, `vhost/dados`, `vhost/aquecer`,
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
| `POST /api/mozserver-proxy` | qualquer visitante corria pedidos à API de um fornecedor externo com uma **chave escrita no código** | **rota apagada** (27/10/2026, por ordem do Silva: não tem aplicação neste projecto, nem chamadores no repositório) |
| `POST /api/auth/email-livre` | limite por IP lia o primeiro valor de `x-forwarded-for` (o visitante podia variá-lo e fugir ao limite) | lê `x-real-ip` posto pelo nginx |

**A chave que estava em `mozserver-proxy` já não está no código.** Continua no histórico do git (reescrevê-lo só com autorização expressa do Silva); como a rota e a integração
saíram, basta ela não valer para nada — pedir ao fornecedor que a revogue, ou deixá-la morrer com a conta.

**Ainda por tratar (não alterado):**
- `POST /api/auth/reset-password` — sem limite nem Turnstile: dá para encher a caixa de qualquer pessoa de e-mails de recuperação.
- `POST /api/submit-ticket` — o «captcha» compara duas respostas **enviadas pelo próprio cliente** (`captchaAnswer` e `captchaResult`), por isso não protege de nada; pôr Turnstile.
- `POST /api/domain-check` — pública e sem limite; cada pedido pode ir ao registador (custo e abuso).
- Antes de dar o assunto por fechado: ler, no servidor e só em leitura, os registos do nginx dos últimos 30 dias para `get-all-contacts`, `migrate-contacts`,
  `check-smtp-config`, para ver se alguém de fora as chamava (quem as chamar passa a levar 401/403).
- `POST /api/whmcs-proxy` **apagada** (27/10/2026, por ordem do Silva): falava com o WHMCS do fornecedor antigo, ninguém a chamava. Lidas e sem problema: `webmail-redirect` (só acrescenta ao endereço do webmail), `versao`, `vhost/aquecer`,
  `domain-tld-prices` e `public/site-news` (públicas por desenho).

---

## 8. Ponto da situação — 27/10/2026, fim do dia

**Feito e publicado:** ponto 3 (rotas sem autenticação), regras num único ficheiro, lockfile, `verificar-pr.yml`, tradução do painel a 0 e português de Portugal.

**Feito no ramo `limites-nas-rotas-publicas-e-leituras-do-servidor` (por publicar):**
- `auth/reset-password`: limite de 20 pedidos por rede em 10 min e 3 por endereço por hora (o Turnstile já estava; trava programas, não uma pessoa a encher a caixa de outra).
- `submit-ticket`: limite de 5 por rede e 3 por endereço por hora; escapa o HTML de todos os campos nos dois e-mails; valida o endereço; tamanho máximo dos campos; só aceita anexos `https`. **Continua sem nenhum chamador no repositório** — se os registos do nginx disserem que ninguém de fora a usa, apaga-se.
- `domain-check`: limite de 400 pedidos por rede em 10 min (cada pesquisa do site faz cerca de 16).
- `.github/workflows/ops-auditoria-leitura.yml`: leitura do servidor, sem alterar nada nem mostrar segredos (registos do nginx das rotas protegidas, endereço do Supabase, cron das cópias, prefixo das chaves do Stripe, variáveis do fornecedor antigo, certificados de e-mail, nginx da porta 2026, portas, fail2ban, SSH, actualizações pendentes).
- `ESTADO_PROJECTO.md` actualizado; `SUPABASE_CONTABO_SETUP_MANUAL.md` (guia de uma instalação já feita) passou a `docs/arquivo/`.

**Tentado e não possível daqui:** correr essa leitura. Um workflow novo só se pode lançar depois de estar em `main`, e a protecção do ambiente recusou lançar leituras ao servidor por outra via. Fica à espera do «publica» e de o correres tu (Actions › Ops - Auditoria do servidor (só leitura) › Run workflow).

**Fica só para o Silva** (nada disto se resolve com código):
1. Dizer «publica» para este ramo e correr o workflow de leitura (ou autorizar-me a corrê-lo).
2. Decisões fiscais: certificação AT/SAF-T, IVA nas compras do carrinho, factura além do recibo, NUIT obrigatório às empresas, morada e nome legal nos documentos.
3. Ordem expressa para instalar o cron das cópias no R2.
4. Texto legal (responsável pelo tratamento, conservação, cookies) revisto por um jurista.
5. Dados da empresa para o pedido à Vodacom (nome legal, NUIT, contacto) e enviá-lo.
6. Nos Settings do GitHub: apagar os secrets que já ninguém usa (`CONTABO_ROOT_PASSWORD` e os do DirectAdmin, depois de eu confirmar pela leitura que nenhum workflow os usa) e ligar o Dependabot de segurança.
7. Pedir ao fornecedor antigo que revogue a chave que esteve no código, e decidir se se reescreve o histórico do git.
8. Decisões sobre DNS de e-mail: `elimservicos.com` e `shalomdeco.com` (a dona), DMARC a 100 % a partir de 02/11.
9. «Avança» para qualquer alteração ao servidor que a leitura mostre ser precisa (troca do endereço do Supabase, separar a chave SSH da aplicação da do deploy, registo A `webmail.` no DNS, nginx da porta 2026).
10. Apagar os ramos antigos, incluindo `claude/focused-turing-p63thb`, `auditoria-fecho-projecto` e `verificacao-nos-pr-e-traducao`.
11. M-Pesa (último): credenciais de produção, «avança» e pagamento de teste.

---

## 9. Resultado da leitura do servidor — 27/10/2026, 20:34 (workflow `Ops - Auditoria do servidor (só leitura)`, sem alterar nada)

| Ponto | Resultado | Estado |
|-------|-----------|--------|
| Site e outros sites | `visualdesignmoz` no pm2 «online»; `basededadosagro-site` activo; disco 26 % | ✔ |
| Certificados de e-mail `mltmark.com` e `basededadosagro.com` | emitidos a 26/10, válidos até 24/01/2027; registo `webmail.` existe nos dois | ✔ resolvido |
| nginx da porta 2026 | já responde 307 para `https://visualdesignmoz.com/vhost:2026` | ✔ resolvido |
| Variáveis do fornecedor antigo no `.env.local` | `WHMCS_*` e `MOZSERVER_*` **não existem**; ficam `DIRECTADMIN_HOST/LOGIN_KEY/PASSWORD/PORT/PROTOCOL/USER` (os ramos DirectAdmin do código ainda as lêem) | a limpar com a remoção dos ramos |
| **Endereço do Supabase** | `.env` do Supabase e `NEXT_PUBLIC_SUPABASE_URL` ainda em `supabase-contabo…`; os dois endereços respondem (401 = normal) | **troca de 23/10 por fazer** |
| **Cópias no R2** | `/etc/cron.d/vd-backup-externo` **não existe**; último envio 26/10 17:37 (13 objectos, 5,9 GiB); cópias do Hestia mais recentes de 25/10 | **falta o cron** |
| **Stripe** | `STRIPE_SECRET_KEY` = `sk_test_…`, chave pública = `pk_test_…` (**modo de teste**); `STRIPE_WEBHOOK_SECRET` definido | **pagamentos por cartão não são reais** |
| M-Pesa | `MPESA_ENV=sandbox` | último passo |
| Actualizações | 1 pacote de segurança por actualizar; `unattended-upgrades` activo; sem reinício pendente | baixo |
| fail2ban | 8 jails activas (ssh, exim, dovecot, hestia, phpmyadmin, recidive, vsftpd, vd-wp-login) | ✔ |
| **SSH** | `sshd -T` mostra `permitrootlogin yes` e `passwordauthentication yes` (a porta real é a 2234 pelo `ssh.socket`) | **endurecer: só chave** (a confirmar na 2.ª leitura) |
| Portas à escuta | 21, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 2026, 2234 e também 3306, 5432, 6379, 6543, 8000, 8080, 8081, 8083, 8084, 8443, 3002, 3010 (política de entrada `DROP`; a 2.ª leitura mostra quais estão mesmo abertas) | a confirmar |
| Registos do nginx | o caminho previsto não existia (**0 ficheiros lidos**): não se sabe se alguém de fora chamava as rotas protegidas | 2.ª leitura procura o caminho certo |

**Segunda leitura (ramo `resultados-da-auditoria-e-segunda-leitura`):** secções 13 a 15 do mesmo workflow: onde estão os registos de acesso e quem chamou as rotas, a firewall de entrada completa e a porta 21,
e a configuração efectiva do SSH. Só depois dela se decide o endurecimento do SSH e o fecho de portas.

---

## 10. Ponto da situação — 28/10/2026 (ramo `fecho-do-projecto`)

Resposta do Silva ponto a ponto e o que ficou feito está em `ESTADO_PROJECTO.md` («Falta para fechar»). Em resumo: IVA discriminado nos recibos do carrinho; lint, testes e build nos PR; Dependabot;
fluxos `Ops - Fecho do servidor` (Supabase, SSH só chave, chave própria da aplicação) e `Ops - DMARC` prontos a correr depois de publicar; português de Portugal nos últimos textos; fase 1 da saída do DirectAdmin
(10 rotas sem chamadores apagadas); lista dos ramos já fundidos em `docs/ramos-para-apagar-2026-10-28.md`. Por tratar: M-Pesa, Stripe, texto legal, facturação certificada.

