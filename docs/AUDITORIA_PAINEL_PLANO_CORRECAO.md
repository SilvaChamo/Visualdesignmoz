# Auditoria do painel (admin/revendedor/cliente) — achados e plano de correção

Documento de handoff. Gerado depois de uma auditoria completa ao menu lateral do painel,
motivada por um bug real: a página de DNS Central mostrava registos da conta VisualDesign
dentro do painel de um cliente.

**Estado actual: todos os pontos do plano original (P0, P1, P2) estão corrigidos, verificados
(`tsc --noEmit` limpo) e commitados.** P1-5 tem uma limitação conhecida e documentada (ver
secção 2). P3 (dívida técnica de baixo risco) não foi tocado. O `git push` para `origin/main`
fica pendente de confirmação do utilizador antes de cada publicação — ver secção 4 para o
estado exacto do que já foi/não foi publicado.

**Aviso permanente:** este repositório é editado por mais do que uma sessão/agente em
paralelo, mesmo quando não parece estar a acontecer. Confirmado repetidamente nesta sessão
(commits "encomendas" e alterações de hover em `AdminSidebar.tsx`/`panel-ui.ts` que esta sessão
não fez, aparecendo em `git log`/`git status` sem aviso). **Nunca usar `git add -A` ou `git
add .`** — adicionar sempre só os ficheiros explicitamente tocados pela tarefa em mãos, e correr
`git status`/`git diff --stat` imediatamente antes de cada commit.

---

## 1. JÁ CORRIGIDO — histórico de commits

### Sessões anteriores (commitado + push para `main`)
1. Unificação de preços de hospedagem — `src/lib/hosting-plans.ts`. Commit `4747ef6`.
2. Lentidão ao abrir "Pacotes" — `PackagesSection` deixou de forçar `fullSync`. Commit `e370b19`.
3. Campos "ilimitado" a zerar depois de sincronizar. Commit `d8d9a7d`.
4. Lentidão nas contas de revendedores — chamadas ao vivo só quando o espelho está stale. Commit `8e7f20f`.
5. Fuga de cache entre contas no logout (causa raiz do bug do DNS). Commit `3bc1d23`.

### Esta sessão — segurança (P0/P1)
6. **P0-1** — RCE não autenticado em `/api/git-deploy`. `POST()` passou a exigir admin;
   `isSafeDomain()` valida `domain` em `deploySite`/`getDeployStatus`/`getGitLog` antes de
   interpolar em comandos SSH. Menu "Git Integration" removido do painel de revendedor.
   Commit `96d1753`.
7. **P0-2..P0-5** — fugas de dados entre contas: `db-manager` deixou de confiar no `owner` do
   pedido; `listMirrorPackages` deixou de devolver pacotes de outros revendedores;
   `email-dns-brevo` passou a verificar posse do domínio; `panel-session-cache-clear.ts` passou
   a varrer também `localStorage` e os prefixos `vd-`/`webmail_`. Commit `b5c337c`.
8. **P1-1..P1-4** — IDOR em `/api/renewals`, `/api/admin/cotacoes`, e fallbacks de newsletter
   que devolviam/enviavam para contactos de outras contas (`MailMarketingSection.tsx` E réplica
   em `src/app/cliente/page.tsx`, mais grave por ser client-facing). `adminRemoverCampanha`/
   `adminRemoverSubscritor` passaram a verificar posse antes de apagar. Commit `c922b49`.
9. **P1-6** — `/api/registrar/account/domains` restringido a admin (stopgap; sem coluna de
   posse por domínio ainda). Commit `427878a`.
10. **P0-6** — impersonação de revendedor não limpava caches do browser ao entrar/sair
    (`ClientesDaSection.tsx`, `HostingSections.tsx`, `revendedor/page.tsx`), mesma causa-raiz do
    bug original de DNS mas nunca aplicada à impersonação — um admin via dados da própria conta
    ou de um revendedor impersonado antes, misturados com os da conta actual. Commit `21ac2dc`.
11. **P0-7, P0-8** — `/api/da-emails` geria email de qualquer domínio sem verificar posse;
    `server-exec` (resolveSitePath/listDirectory/siteDiskUsage/FILE_OPS) e `upload-native`
    davam acesso a ficheiros de QUALQUER cliente via SSH root, só validando formato do caminho,
    nunca posse — `siteDiskUsage` e `upload-native` também tinham injecção de comandos (mesma
    classe do P0-1). Novo módulo `src/lib/panel-fs-ownership.ts`. Commit `add10aa`.
12. **P0-9, P0-10** — `requireAdmin()` (`src/lib/admin-api-auth.ts`) tratava 'manager' como
    admin real, dando acesso a `/api/admin/impersonate` (impersonar qualquer revendedor),
    `/api/admin/panel-users` (criar contas e atribuir roles — incluindo tornar-se admin),
    `/api/admin/reseller-provision`, `/api/admin/wp-install` — o escalonamento mais grave
    encontrado. `/api/email-contas`, `/api/email-senha`, `imap-panel-shared.ts` davam a
    QUALQUER revendedor/manager a password de servidor de email de QUALQUER conta, sem
    verificar domínio. Commit `c945953`.
13. **P1-5** — ver secção 2 abaixo (resolvido com limitação documentada). Commit `a8d8b01`.

### Esta sessão — performance/UX (P2)
14. **P2-1..P2-4** — `moveToReseller` passou a confirmar posse antes de mover conta;
    `listPackages`/`LIVE_LIST_FALLBACK` em `server-exec` deixaram de ir sempre ao DirectAdmin
    ao vivo (gate por `isMirrorStale`); "Transferir domínio" deixou de afirmar sucesso falso;
    dropdown de "proprietário" em Contas de email passou a filtrar por posse para revendedor
    (`ownerScopeToSites`), sem restringir a vista do admin. Commit `bd699fc`.

---

## 2. P1-5 — resolvido, com uma lacuna documentada (não bloqueante)

**O que era:** `requireAdminOrReseller()` (`panel-api-auth.ts`) coercia `'manager'` para
`role:'admin'`, dando a qualquer conta "manager" credenciais DirectAdmin admin reais em ~30
rotas — confirmado por leitura de `resolvePanelDaContext()`.

**Fix aplicado:**
1. `requireAdminOrReseller()` agora rejeita `'manager'` explicitamente (403) — seguro por
   omissão em TODAS as rotas, sem precisar de as tocar uma a uma. Nova função
   `requireAdminResellerOrManager()` para rotas onde um manager, escopado à sua própria conta
   DA, pode legitimamente actuar.
2. `resolvePanelDaContext()` ganhou um ramo `'manager'` que usa exactamente o mesmo mecanismo
   de credenciais escopadas de um revendedor (nunca admin real).
3. Aplicado a 12 rotas: `admin/wp-update`, `admin/wp-users`, `backup-manager`,
   `backup-schedule`, `db-manager`, `directadmin-access`, `panel-dns`, `da-emails`,
   `email-dns-brevo`, `reseller/da-profile`, `reseller/ensure-provision`, `revendedor/context`.

**Achado adicional (corrigido no mesmo commit):** `directadmin-access/route.ts` tinha uma
falha PRÉ-EXISTENTE mais grave que já afectava qualquer revendedor, não só manager — sem
`?as=reseller` no pedido, `target` assumia `'admin'` por omissão e devolvia SSO real de admin
do DirectAdmin a QUALQUER chamador autenticado. `parseAccessTarget()` agora deriva sempre o
target da role real do chamador, nunca do valor pedido pelo cliente.

**Lacuna que fica por resolver (bloqueada para manager, 403 seguro, sem regressão):**
`/api/da` e `/api/server-exec` — dispatchers grandes com dezenas de acções, algumas claramente
escopáveis a um manager (PHP/SSL/DNS/email/BD do seu próprio site — `da/route.ts` tem a lista
completa comentada no código) e outras claramente não (`createPackage`/`deletePackage`,
`createUser`/`deleteUser` de sub-contas, firewall, `execCommand`). Dividir acção a acção requer
tocar em cada branch do dispatcher e não foi feito por ser trabalho maior sem ganho de
segurança adicional (o comportamento actual — manager bloqueado nestas duas rotas — já é
seguro, só incompleto). Se o utilizador quiser managers a gerir PHP/SSL/DNS via estas duas
rotas especificamente, é o próximo passo natural.

**Nota sobre teste:** não foi possível fazer login real como conta "manager" para validar
end-to-end — a correcção foi feita por leitura cuidada do código de resolução de credenciais
(`resolveDirectAdminCredentials`, que já tratava qualquer role não-admin de forma idêntica via
`loadResellerCredentialsByUserId`), não por teste ao vivo. Recomenda-se um teste manual de
login como manager numa próxima sessão com acesso a uma conta de teste.

---

## 3. P3 — dívida técnica de baixo risco, não tocada

- `GitDeploySection` guarda `git-deploy-cache` em localStorage, fora da limpeza de logout —
  inofensivo (histórico de commits partilhado).
- Painel do cliente mostra placeholders "Secção não disponível" — código morto inofensivo.
- **`src/app/dashboard/mensagens/*` + `src/lib/clientes-api.ts`** — implementação antiga/
  duplicada de newsletter, com a sua própria versão (client-side, chave anon, sem verificação
  de posse) de `removerSubscritor`/`removerCampanha`, protegida só por RLS. Mesma classe de bug
  do P1-4, mas nunca avaliada em detalhe nesta ronda — candidato natural a próximo P1 se for
  reavaliada.

---

## 4. Estado de publicação (push)

Confirmar sempre com o utilizador antes de publicar. Estado à data deste documento:
- Commits `96d1753` até `36b06f9` (P0-1..P1-6 + doc): **publicados em `main`** (push feito
  a pedido explícito do utilizador).
- Commits seguintes (`21ac2dc` P0-6, `de8564c` doc, `add10aa` P0-7/8, `c945953` P0-9/10,
  `a8d8b01` P1-5, `bd699fc` P2): estado de publicação depende de quando este documento for
  lido — verificar `git log origin/main..HEAD` para confirmar o que ainda não foi publicado
  antes de assumir.
- **Importante:** este branch local partilha working tree com outra sessão activa, que também
  cria commits (ex.: vários commits "encomendas" vistos nesta sessão). Um `git push` publica
  TODOS os commits locais à frente de `origin/main`, incluindo os dessa outra sessão — avisar
  o utilizador disso antes de cada push, não assumir que só os commits de segurança serão
  publicados.

---

## 5. Notas gerais para a próxima sessão

- Depois de qualquer alteração: `npx tsc --noEmit -p tsconfig.json` (ignorar erros em
  `.next/dev/types/**` — são artefactos de cache stale, não relacionados com o código-fonte).
- Antes de qualquer commit: `git status` e `git diff --stat`; nunca `git add -A`.
- Padrão de verificação de posse de domínio (`canAccessDomain` via
  `loadResellerCredentialsByUserId` + `getMirrorSiteOwner`) foi replicado em 5+ rotas nesta
  sessão — reutilizar em vez de reinventar sempre que aparecer um novo endpoint sem esta
  verificação.
