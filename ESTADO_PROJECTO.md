# Estado do projecto — VisualDesign (auditoria de 22/10/2026, actualizado a 27/10/2026)

> **O Hetzner já está fechado** (servidor desligado a 19/10/2026; só falta cancelar a conta do balde de ficheiros). Nada depende dele.
> O que falta para fechar está abaixo; o levantamento original e o detalhe estão em `docs/AUDITORIA_FECHO_PROJECTO.md`.

## Em produção
- Site e painel no **Contabo** (Hestia), publicados por cada merge em `main`. Hetzner (servidor) desligado.
- Supabase próprio no Contabo. CI: últimos deploys todos verdes. Traduções: 0 textos sem inglês.
- Segurança do servidor: SSH na 2234, FTP e painel do Hestia fechados, bloqueio no nginx, guarda de sites, 2 passos opcional.

## Falta para fechar (28/10/2026, depois das decisões do Silva)

**Só o Silva (decisões ou contas externas)**
1. **M-Pesa em `sandbox`** — por tratar, pendente da Vodacom (`docs/mpesa-pedido-vodacom.md`); o webhook M-Pesa só se autentica no go-live.
2. **Stripe em modo de teste** (`sk_test_`/`pk_test_`) — por tratar.
3. **Texto legal** (Privacidade, Termos, cookies): fica como está até o Silva decidir; as decisões de pagamentos (1 e 2) ficam à frente.
4. **Facturação:** IVA de 16 % **acrescentado no checkout e discriminado nos recibos do carrinho** (feito, `src/lib/iva.ts`). Continuam por decidir com o contabilista: certificação AT/SAF-T, factura além do recibo, NUIT obrigatório às empresas, nome legal e morada nos documentos.
5. **Palavra-passe de cifra das cópias do R2:** existe, num ficheiro no Mac do Silva (`~/Desktop/chave-cifra-backups-visualdesign.txt`, gravado a 26/10). Falta só guardá-la num gestor de palavras-passe e apagar o ficheiro do ambiente de trabalho; sem ela as cópias do R2 não se abrem (o cron `vd-backup-externo` existe e corre às 07:00).
6. **GitHub › Settings:** `CONTABO_ROOT_PASSWORD` removido em 28/10/2026 (nenhum workflow o usa); alertas do Dependabot activos. Os secrets `DIRECTADMIN_*` ficam pendentes de confirmação individual.
7. ~~Brevo / caixa `servidor@`~~ — feito (o Silva confirmou a 28/10/2026).
8. **Google (login):** juntar `https://supabase.visualdesignmoz.com/auth/v1/callback` aos endereços de retorno **antes** de correr a troca do Supabase (manter o antigo).
9. ~~**Ramos:** os 25 ramos já fundidos em `main` foram apagados a 28/10/2026, depois de confirmar os SHAs; registo e recuperação em `docs/ramos-para-apagar-2026-10-28.md`.~~

**Prontos no ramo — depois de publicar, correr (Actions › Run workflow, primeiro sem «aplicar»)**
10. `Ops - Fecho do servidor`, fase **supabase** (troca do endereço; depois publicar), fase **ssh** (só chave; recusa se alguma conta sem ser root usou palavra-passe), fases **chave-app** e **chave-app-concluir** (chave própria da aplicação, só aceite a partir do servidor, separada da chave do deploy). O deploy foi mudado para usar o endereço novo do Supabase e a chave própria quando existe — **fazer o ensaio do deploy** (`ensaio` marcado) antes de publicar.
11. `Ops - DMARC de pct=25 para pct=100 (DNS)`: sobe só os domínios que já estão em `p=quarantine; pct=25`.
12. `Ops - Auditoria do servidor (só leitura)`: a secção 13 procura nos registos do nginx quem chamou as rotas protegidas; ler o resultado.
13. `Ops - Limite de disco de um pacote de alojamento`: quota do `VD-Email-Basico`.

**Feito nesta passagem (código)**
- **Monitorização externa activa** (`.github/workflows/vigiar-sites.yml`): de 15 em 15 minutos, a partir do GitHub, pede visualdesignmoz.com, basededadosagro.com e o login da base de dados; se falharem 3 tentativas seguidas abre o aviso «Site em baixo» (e-mail para quem vigia o repositório) e fecha-o quando voltarem. Começa a correr depois de publicado.
- **Checkout com IVA acrescentado** (Silva, 28/10/2026): o IVA de 16 % soma-se ao preço dos itens (subtotal, IVA e total no checkout, na Stripe como linha à parte, no saldo e nos pagamentos manuais); o recibo distingue as compras novas (IVA acrescentado) das antigas (IVA incluído).
- **Nomes genéricos:** ficheiros dos workflows e scripts sem nomes de fornecedores (`deploy-visualdesign.yml`, `preparar-servidor.yml`, `scripts/servidor/`…); regra em `regras.md`. Ficam por mudar, por serem identificadores técnicos: os nomes dos secrets do GitHub, variáveis de ambiente e módulos `src/lib/*-adapter.ts`.
- Lint a funcionar (estava partido: `eslint` 8 com configuração do 9; agora `eslint` 9 + `eslint-config-next` 16; `npm run lint` dá 0 erros e ~950 avisos que não travam), `npm test`, e o `verificar-pr.yml` passou a correr lint, testes e **build** além de tipos e traduções.
- Dependabot (`.github/dependabot.yml`): alertas de segurança activos; npm semanal e agrupado, Actions mensal; Next/React major só à mão. Em 28/10/2026 havia 4 alertas abertos (1 alto, 1 médio, 2 baixos).
- Português de Portugal nos últimos «usuário» e «padrão»; «Baixar» fica (decisão do Silva: é mais curto que «Descarregar»). Painel e site com 0 textos sem inglês.
- **Fase 1 da saída do DirectAdmin:** apagadas 10 rotas só do DirectAdmin sem nenhum chamador (`da-users`, `da-emails`, `filemanager-sso`, `admin/sync-directadmin-users`, `panel-bridge`, `directadmin-access`, `client-directadmin-access`, `reseller/da-profile`, `admin/reseller-provision`, `cron/da-sync`). **Por fazer (fase 2):** o resto do DirectAdmin já não corre em produção (`DEFAULT_HOSTING_PROVIDER=hestia` recusa-o), mas está entrelaçado com o caminho do Hestia: `directadmin-adapter.ts` (1 663 linhas, 78 comandos `CMD_`), `da-api-ssh.ts`, `directadmin.ts`, `directadmin-credentials.ts` e os ramos `daApi` de `/api/da`, `server-exec`, `admin/clientes`, `panel-dns`, `da-sync-engine`. O nome `/api/da`, o tipo `DirectAdminServerAPI` e o ficheiro `da-credential-store` são só nome herdado do painel: o conteúdo é o Hestia e fica. Faz-se por partes, com `tsc` e build, sem pressa.
- Chave que esteve em `mozserver-proxy`: nunca foi usada e a rota já não existe; assunto fechado (não se reescreve o histórico).

**Menores, ficam como estão (decisão do Silva): ** «Mudar nome» das páginas WordPress, confirmar o 429 do bloqueio de login em produção, importar do cPanel (sem ligação ao servidor remoto). **Telemóvel:** aprovado pelo Silva.

**Notas que continuam a valer**
- **Hetzner Object Storage:** nenhum site o usa (`verificar` dá 0 links e 0 ficheiros em falta); não é preciso listar o que mais existe no balde; a conta pode ser cancelada. A página estática `oshercollective.com/legacy/` foi regravada três vezes por quem a envia (conta do próprio site): tem de usar o URL do próprio domínio.
- **PRs abertos:** só o #3 (repõe o basededadosagro.com em `domain_renewals`; escrita na base de dados, só com o OK do Silva) — nunca fechar.
- **DMARC** (auditado a 26/10): `p=quarantine; pct=25` em aamihe.com, concordia.co.mz, entrecamposblog.com, lirandzojewelry.com, menocrazy.app, mltmark.com, msdn-moz.org, oshercollective.com, provisualcorporate.co.mz e visualdesignmoz.com (cópia dos antigos em `scratchpad/dmarc-antes-quarantine.json`; voltar atrás = repor `p=none`). Ficam em `p=none`: basededadosagro.com (falta a chave DKIM do servidor `mail._domainkey`), elimservicos.com (e-mail do Google, decidir) e shalomdeco.com (DNS fora do Cloudflare; o botão «Reprocessar DNS» repõe os registos quando a dona voltar). O site já não baixa um DMARC mais estrito.
- **Caixa `servidor@visualdesignmoz.com`:** criada e a funcionar (confirmado pelo Silva a 28/10/2026).
- **Quem só tem encomendas** (sem hospedagem nem domínio) fica no painel das encomendas (`/encomendas`), com a faixa `PromoProdutos`; ao comprar só domínio passa à vista compacta do vhost.
- **Endereço antigo `host`:** `/host:2026` e afins só redireccionam; o nginx da porta 2026 já aponta a `/vhost:2026` (resolvido, 307).
- **Período de recuperação das renovações:** 30 dias (`src/lib/recuperacao-renovacao.ts`).

## Credenciais que estiveram no código
Saíram do código (agora vêm do ambiente). Eram todas do tempo do Hetzner (chave `service_role` do Supabase antigo, MySQL e DirectAdmin do
Hetzner). O repositório é privado; decidido a 22/10/2026 não as mudar, para não afectar clientes.

## Arquivo
Notas e scripts antigos (Gmail/SMTP, DKIM, planos de 2026) estão em `docs/arquivo/` e `scripts/arquivo/`.
Auditoria de segurança do painel: `docs/AUDITORIA_PAINEL_PLANO_CORRECAO.md`.

## 27/10/2026 — auditoria de fecho (resumo do que mudou)
- Rotas protegidas: `get-all-contacts`, `migrate-contacts` e `check-smtp-config` só com administrador (a primeira também com `CRON_SECRET`); rotas do fornecedor antigo (`mozserver-proxy`, `whmcs-proxy`) apagadas, com a chave que tinham no código.
- Limite de pedidos (`src/lib/limite-pedidos.ts`) em `auth/reset-password`, `submit-ticket` e `domain-check`; `submit-ticket` escapa o HTML dos e-mails.
- Regras num único ficheiro (`regras.md`; `AGENTS.md` só como porta de entrada). Nunca nomear o fornecedor do servidor.
- Verificação em cada PR (`.github/workflows/verificar-pr.yml`): tipos e traduções do site e do painel. Painel e site com 0 textos sem inglês.
- Lockfile regenerado com o Node 24 (`npm ci` volta a funcionar).

## 27/10/2026, 20:34 — leitura do servidor
Resolvidos: certificados de e-mail do mltmark.com e do basededadosagro.com, nginx da porta 2026. **Por fazer:** troca do endereço do Supabase (continua `supabase-contabo…`), cron das cópias no R2 (não existe), Stripe em modo real (as chaves são `sk_test_`/`pk_test_`), SSH só com chave. Detalhe em `docs/AUDITORIA_FECHO_PROJECTO.md`, secção 9.

## 28/10/2026, 10:12 — segunda leitura do servidor (só leitura; workflows `ops-php-seguranca` fase `backups` e `ops-auditoria-leitura`)
- **Envio das cópias para fora do servidor: confirmado.** O cron `/etc/cron.d/vd-backup-externo` existe e correu às 07:00:11 de hoje, acabando às 07:01:25 (19 objectos, 7,773 GiB no R2). As seis cópias mais recentes (vdadmin, provisualcorporate, aamihe, oshercollective, mltmark e concordia, feitas a 27/10 entre as 22:29 e as 22:52) estão lá. Não havia cópias novas desde ontem à noite, por isso o envio de hoje não acrescentou contas.
- **Troca do endereço do Supabase: continua por fazer.** `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL` e `NEXT_PUBLIC_SUPABASE_URL` ainda apontam para `supabase-contabo…`; os dois nomes respondem (401 no `/auth/v1/health` sem chave, o esperado).
- **Certificados de e-mail: resolvidos.** `mail.mltmark.com` e `mail.basededadosagro.com` têm certificado Let's Encrypt de 26/10/2026, válido até 24/01/2027.
- Sem actualizações de segurança por instalar nem reinício pendente; `unattended-upgrades` activo; pm2 só com o `visualdesignmoz` (online) e o `basededadosagro-site` activo; disco a 24%.
- Ainda por decidir: Stripe em modo de teste (`sk_test_`/`pk_test_`), M-Pesa em `sandbox`, variáveis `DIRECTADMIN_*` ainda no `.env.local` (o aviso «nenhuma» do workflow engana: só procura nomes que começam por `DA_`, `WHMCS`, etc.) e o SSH com `permitrootlogin yes` e `passwordauthentication yes` na configuração (a porta 22 está fechada no firewall).
