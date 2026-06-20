# VisualDesign Admin Panel — Notas do Projeto

## Stack
- **Framework**: Next.js 15 (App Router, TypeScript)
- **UI**: TailwindCSS, Lucide icons, shadcn/ui
- **Base de dados**: Supabase self-hosted (PostgreSQL)
- **Hosting**: DirectAdmin + PM2 no Hetzner
- **Servidor**: `37.27.17.25` (porta SSH `2234`)
- **Domínio**: `visualdesignmoz.com`

---

## Acesso ao Servidor
```
SSH: ssh -i ~/.ssh/visualdesign_hetzner -p 2234 root@37.27.17.25
DirectAdmin: https://host.visualdesignmoz.com:2222
App: https://visualdesignmoz.com
Supabase: https://supabase.visualdesignmoz.com
Admin: https://visualdesignmoz.com/admin
```

---

## Arquitectura

### Autenticação e papéis
- Supabase Auth + tabela `profiles`
- Papéis: `admin`, `reseller`, `client`, `guest` (`src/lib/user-roles.ts`)

### Painel de hospedagem
- DirectAdmin nativo para gestão de sites, DNS e email
- Dados espelhados no Supabase: `panel_sites`, `panel_users`, `panel_packages`
- APIs internas: `/api/email-contas`, `/api/panel-dns`, `/api/directadmin-access`, etc.

### Email transaccional
- Brevo API/SMTP para envios externos (newsletter, confirmações)
- DirectAdmin/Exim para contas hospedadas no servidor

---

## Deploy / Atualização
```bash
bash deploy/deploy-ssh.sh
```

Atualização rápida (só código):
```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git --exclude "*.env*" \
  -e "ssh -i ~/.ssh/visualdesign_hetzner -p 2234" \
  ./ root@37.27.17.25:/home/visualdesignmoz.com/public_html/ && \
ssh -i ~/.ssh/visualdesign_hetzner -p 2234 root@37.27.17.25 \
  "cd /home/visualdesignmoz.com/public_html && npm run build && pm2 restart visualdesign"
```

---

## Tabelas Supabase
- `supabase-setup-completo.sql` — setup completo
- `scripts/migrate-legacy-panel-tables.sql` — migração de tabelas legadas para `panel_*`
