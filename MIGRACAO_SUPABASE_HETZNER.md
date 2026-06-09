# Migração para Supabase Hetzner (self-hosted)

**Data:** Junho 2026  
**URL Supabase:** `https://supabase.visualdesignmoz.com`  
**URL App:** `https://visualdesignmoz.com` (Vercel → alias `visualdesignmoz.com`)

## Estado (7 Jun 2026) — CONCLUÍDO

- [x] App Vercel aponta para `https://supabase.visualdesignmoz.com`
- [x] Tabelas VisualDesign criadas no Postgres Hetzner (`clientes`, `panel_*`, `profiles`, etc.)
- [x] Redirect URLs `visualdesignmoz.com` adicionadas no Supabase Docker
- [x] Google OAuth — activado no Supabase Hetzner Docker (`GOTRUE_EXTERNAL_GOOGLE_*`)
- [x] Vercel `NEXT_PUBLIC_SUPABASE_URL` → `supabase.visualdesignmoz.com` (não mais cloud)
- [x] Recuperação de senha — **corrigida** (SMTP `noreply@visualdesignmoz.com` via Exim)
- [x] Deploy produção: `npx vercel --prod`

---

## Dois logins diferentes (importante)

| URL | Para quem | Aparência |
|-----|-----------|-----------|
| `https://visualdesignmoz.com/auth/login` | **Clientes e equipa** | Página VisualDesign (logo, vermelho/preto, Google) |
| `https://supabase.visualdesignmoz.com` | **Só administradores TI** | Login genérico do Supabase Studio (Kong) |

O ecrã cinzento que viste é o **painel de base de dados** (Studio), não o login da aplicação.  
**Não é possível** personalizar facilmente esse popup — é autenticação HTTP do gateway Kong.

**Recomendação:** clientes usam sempre `visualdesignmoz.com/auth/login`. O subdomínio `supabase.*` fica só para gestão interna da BD.

---

## Passo 1 — Confirmar Supabase Docker no Hetzner

No servidor Hetzner (`37.27.17.25`):

```bash
cd /caminho/para/supabase/docker
docker compose ps
curl -s https://supabase.visualdesignmoz.com/auth/v1/health
```

Todos os containers devem estar `Up`.

---

## Passo 2 — Configurar OAuth Google no Supabase Docker

Editar o `.env` do Supabase (ver `deploy/supabase-oauth.env.template`):

```env
SITE_URL=https://visualdesignmoz.com
ADDITIONAL_REDIRECT_URLS=https://visualdesignmoz.com/auth/callback,https://visualdesignmoz.com/auth/confirm
GOOGLE_ENABLED=true
GOOGLE_CLIENT_ID=...
GOOGLE_SECRET=...
```

No **Google Cloud Console** (console.cloud.google.com → APIs & Services → Credentials):

1. Criar OAuth 2.0 Client ID (tipo: Web application)
2. **Authorized redirect URIs:** `https://supabase.visualdesignmoz.com/auth/v1/callback`
3. **Authorized JavaScript origins:** `https://visualdesignmoz.com`, `https://supabase.visualdesignmoz.com`

Reiniciar Supabase:

```bash
docker compose down && docker compose up -d
```

### O login com Google é seguro?

**Sim**, quando configurado assim:

- O Google autentica o utilizador; a app **nunca vê a password** do Google
- O Supabase troca o código OAuth por um **JWT assinado** (fluxo PKCE — já activo no código)
- Só funcionam redirect URLs na lista `ADDITIONAL_REDIRECT_URLS`
- O `GOOGLE_SECRET` fica **só no servidor** (nunca no frontend)

Riscos a evitar:

- Não expor `SERVICE_ROLE_KEY` no browser
- Limitar redirect URLs (não usar wildcards demasiado amplos em produção)
- Manter HTTPS em todos os domínios

---

## Passo 3 — Actualizar `.env.local` da app Next.js

No servidor: `/home/visualdesignmoz.com/public_html/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.visualdesignmoz.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

As keys `ANON_KEY` e `SERVICE_ROLE_KEY` estão no `.env` do Supabase Docker (geradas com `utils/generate-keys.sh`).

---

## Passo 4 — Importar tabelas no Supabase Studio

1. Abrir `https://supabase.visualdesignmoz.com` (credenciais `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`)
2. SQL Editor → executar por ordem:

| Ficheiro | Conteúdo |
|----------|----------|
| `supabase-setup-completo.sql` | Tabelas base |
| `supabase-gestao-clientes.sql` | Clientes, sites, pagamentos |
| `supabase-gestao-clientes-parte2.sql` | Views e triggers |
| `supabase-create-admin-users-direct.sql` | Tabela `profiles` + admin |
| `supabase-renewals-payments.sql` | Renovações |
| `supabase-notifications.sql` | Notificações |
| `supabase-setup-email-contas.sql` | Contas email |

3. Verificar com:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

---

## Passo 5 — Criar utilizador admin

No Studio → Authentication → Users → Add user:

- Email: `silva.chamo@gmail.com` (ou o teu admin)
- Password: (definir)
- User Metadata: `{ "role": "admin" }`

Depois no SQL Editor:

```sql
INSERT INTO public.profiles (id, user_id, role, email)
SELECT id, id, 'admin', email FROM auth.users WHERE email = 'silva.chamo@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

---

## Passo 6 — Deploy da app com novas variáveis

Na Mac:

```bash
bash deploy/deploy-ssh.sh
```

Ou manualmente: rsync + `npm run build` + `pm2 restart visualdesign`.

---

## Passo 7 — Testar

```bash
# Health auth
curl -s "https://supabase.visualdesignmoz.com/auth/v1/health" \
  -H "apikey: <ANON_KEY>"

# Login email na app
# → https://visualdesignmoz.com/auth/login

# Login Google
# → botão Google → deve voltar a /auth/callback → /admin ou /client
```

Checklist:

- [ ] Login email/password funciona
- [ ] Login Google redirecciona sem erro `callback_error`
- [ ] Admin vai para `/admin`
- [ ] Cliente vai para `/client`
- [ ] Dados de clientes aparecem no painel (não vazio)

---

## Migrar dados do Supabase cloud (opcional)

Se tinhas dados em `gwankhxcbkrtgxopbxwd.supabase.co`:

```bash
# Exportar do cloud
pg_dump "postgresql://postgres:[PASSWORD]@db.gwankhxcbkrtgxopbxwd.supabase.co:5432/postgres" \
  --schema=public --data-only -f cloud_data.sql

# Importar no Hetzner (dentro do container postgres)
docker compose exec db psql -U postgres -d postgres -f /tmp/cloud_data.sql
```

Utilizadores Auth: exportar via Supabase Dashboard cloud → importar manualmente no self-hosted, ou pedir reset de password.

---

## Problemas comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `504 request_timeout` no Google OAuth | Container Docker sem internet (iptables FORWARD DROP) | `bash scripts/fix-docker-iptables-hetzner.sh` no servidor ou `systemctl start fix-docker-nat` |
| `callback_error` / PKCE | Redirect URL não autorizada | Adicionar URL em `ADDITIONAL_REDIRECT_URLS` |
| Google `redirect_uri_mismatch` | URI não registada no Google Console | Ver `GOOGLE-OAUTH-SETUP.md` — adicionar `https://supabase.visualdesignmoz.com/auth/v1/callback` |
| CSP bloqueia fetch | Content-Security-Policy | Já corrigido em `next.config.ts` |
| `Invalid API key` | ANON_KEY errada no `.env.local` | Copiar do `.env` Docker |
| Tabelas vazias | SQL não importado | Correr scripts do Passo 4 |

### Erro 504 no login Google (resolvido 8 Jun 2026)

O `supabase-auth` não conseguia aceder a `accounts.google.com` porque as regras **iptables NAT/FORWARD** do Docker tinham sido apagadas (comum com DirectAdmin).

No servidor Hetzner foi instalado:
- Script: `/usr/local/bin/fix-docker-nat.sh`
- Serviço: `fix-docker-nat.service` (aplica regras no boot)

Se voltar a falhar após reboot do servidor:
```bash
ssh -p 2234 root@37.27.17.25 systemctl start fix-docker-nat
```
