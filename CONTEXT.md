# Briefing do Projeto: VisualDesign App

**Última Atualização:** Junho de 2026

Guia de contexto para programadores e agentes de IA que trabalhem neste repositório.

---

## 1. Visão Geral

- **Propósito:** Painel de administração e painel de cliente para gestão de alojamento, email e domínios da VisualDesign.
- **Stack:** Next.js 15 (App Router), TypeScript, Tailwind, Supabase Auth + PostgreSQL.
- **Infraestrutura:** VPS Hetzner (`37.27.17.25`), DirectAdmin, PM2, Supabase self-hosted.
- **URLs:**
  - App: `https://visualdesignmoz.com`
  - Admin: `https://visualdesignmoz.com/admin`
  - Supabase: `https://supabase.visualdesignmoz.com`
  - DirectAdmin: `https://host.visualdesignmoz.com:2222`

---

## 2. Arquitectura

### Autenticação e papéis
- Supabase Auth + tabela `profiles`
- Papéis em `src/lib/user-roles.ts`: `admin`, `reseller`, `client`, `guest`

### Painel de hospedagem
- DirectAdmin é o painel nativo (sites, DNS, email)
- Dados espelhados no Supabase: `panel_sites`, `panel_users`, `panel_packages`
- APIs relevantes: `/api/directadmin-access`, `/api/email-contas`, `/api/panel-dns`, `/api/panel-bridge`

### Email
- Contas hospedadas: DirectAdmin/Exim + IMAP (Roundcube SSO)
- Email transaccional externo: Brevo API/SMTP (`src/lib/brevo-mail.ts`, `src/lib/smtp-mail.ts`)

### Estrutura de pastas
- `src/app/admin/` — painel administrador
- `src/app/client/`, `src/app/revendedor/` — painéis por papel
- `src/app/api/` — rotas BFF (nunca expor credenciais DirectAdmin ao browser)
- `src/lib/` — lógica partilhada (`server-config.ts`, `directadmin.ts`, `supabase-sync.ts`)
- `deploy/` — scripts de deploy e templates de env

---

## 3. Deploy

```bash
bash deploy/deploy-ssh.sh
```

SSH: `ssh -i ~/.ssh/visualdesign_hetzner -p 2234 root@37.27.17.25`

Variáveis de produção: ver `deploy/env.production.template`

---

## 4. Base de dados

Scripts SQL na raiz:
- `supabase-setup-completo.sql` — setup inicial
- `scripts/migrate-legacy-panel-tables.sql` — migração de tabelas legadas (executar uma vez se necessário)

---

## 5. Notas importantes

- Integração de painel: apenas DirectAdmin + Supabase (sem painéis legados).
- `/api/server-exec` está desactivado (stub); operações de painel fazem-se via DirectAdmin nativo ou APIs dedicadas.
- Credenciais SMTP Brevo são obrigatórias na Vercel/servidor para entrega externa (Gmail, etc.).
