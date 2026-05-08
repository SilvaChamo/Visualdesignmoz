# Estado do Projecto — VisualDesign (Gestão + CyberPanel)

## O que já está feito

### Infra / Produção
- Domínio oficial em uso: `visualdesignmoz.com`.
- DNS funcional a apontar para o VPS Contabo: `109.199.104.22` (via nameservers MozServer + Zone Editor MozServer).
- Aplicação Next.js já faz build em produção sem falhar (`next build` OK).
- PM2 a executar a app:
  - Nome do processo: `visualdesign`
  - CWD (no servidor): `/home/visualdesignmoz.com/public_html`
  - Porta interna da app (proxy): `127.0.0.1:3001`
- OpenLiteSpeed/CyberPanel configurado para servir a app:
  - VirtualHost `visualdesignmoz.com` configurado com reverse proxy para `127.0.0.1:3001`.
- SSL instalado e funcional para o domínio:
  - Certificado Let’s Encrypt válido para `visualdesignmoz.com`.

### Next.js (frontend)
- Painéis existentes:
  - Admin: `src/app/admin/page.tsx`
  - Dashboard (user): `src/app/dashboard/*`
  - Cliente: `src/app/client/page.tsx`
  - Auth: `src/app/auth/login/page.tsx` + callback `src/app/auth/callback/route.ts`
  - Placeholder: `src/app/simple-login/page.tsx`
- `next.config.ts` configurado para `output: 'standalone'`.

### Integração CyberPanel
- API client completo: `src/lib/cyberpanel-api.ts`.
- Proxy genérico para endpoints CyberPanel:
  - `src/app/api/cyberpanel-proxy/route.ts`
- Rotas API para operações CyberPanel (exemplos):
  - `src/app/api/cyberpanel-db/route.ts`
  - `src/app/api/cyberpanel-dns/route.ts`
  - `src/app/api/cyberpanel-email/route.ts`
  - `src/app/api/cyberpanel-packages/route.ts`

### Supabase
- SQL do sistema de gestão de clientes pronto:
  - `supabase-gestao-clientes.sql`
  - `supabase-gestao-clientes-parte2.sql`
- Supabase URL/keys já recolhidas e usadas em produção.
- Ajuste feito para evitar erro `supabaseKey is required`:
  - `src/lib/supabase.ts` passou a usar `NEXT_PUBLIC_SUPABASE_ANON_KEY` (com fallback).


## O que falta fazer

### Funcionalidade (prioridade alta)
- Validar autenticação real (Supabase Auth) end-to-end:
  - URLs de redirect no Supabase (`Site URL` e `Redirect URLs`).
  - Criar/validar utilizadores reais (admin/cliente) e regras de acesso.
- Confirmar que o painel do cliente (`/client`) lê dados reais das tabelas/views (RLS) e não apenas “mock/placeholder”.
- Confirmar que o painel admin (`/admin`) sincroniza e apresenta corretamente:
  - Sites
  - Utilizadores CyberPanel
  - Subdomínios/DNS/Email/SSL

### Limpeza / Consistência
- Remover/depreciar referências antigas a `visualdesign.ao` e vhosts/subdomínios de teste no servidor (se já não forem necessários).
- Rever MX/Email:
  - No DNS MozServer, MX atualmente aponta para o próprio domínio; decidir se email fica MozServer temporariamente ou migra para CyberPanel.

### Automatização / Qualidade
- (Opcional) CI/CD (GitHub Actions) para deploy automático.
- (Opcional) testes e logs operacionais.


## Credenciais e configurações importantes

### Domínio / DNS
- Domínio: `visualdesignmoz.com`
- Nameservers (atual):
  - `ns1.mozserver.com`
  - `ns2.mozserver.com`
  - `ns3.mozserver.com`
  - `ns4.mozserver.com`
- Registos críticos no Zone Editor MozServer:
  - `visualdesignmoz.com` A -> `109.199.104.22` (TTL 300)
  - `www` CNAME -> `visualdesignmoz.com`

### Servidor Contabo
- IP: `109.199.104.22`
- CyberPanel: `https://109.199.104.22:8090`
- Deploy path: `/home/visualdesignmoz.com/public_html`
- PM2:
  - Processo: `visualdesign`

### Supabase
- Project URL:
  - `https://gwankhxcbkrtgxopbxwd.supabase.co`
- Anon public key (usar como `NEXT_PUBLIC_SUPABASE_ANON_KEY`):
  - `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY`

### Variáveis de ambiente (produção)
- Ficheiro no servidor:
  - `/home/visualdesignmoz.com/public_html/.env.local`
- Mínimo necessário:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`


## Páginas principais
- Site: `https://visualdesignmoz.com/`
- Admin: `https://visualdesignmoz.com/admin`
- Dashboard: `https://visualdesignmoz.com/dashboard`
- Login: `https://visualdesignmoz.com/auth/login`
- Cliente: `https://visualdesignmoz.com/client`
