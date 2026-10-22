# 🌐 Template de Configuração para Próximos Sites

Este documento explica como **reutilizar o Postgres do Contabo para novos sites** (aamihe, Base Agrodata, etc.) sem precisar de múltiplas instâncias Docker.

---

## 📐 Arquitetura: 1 Postgres → N Sites

```
Contabo (VPS)
├── Docker Compose
│   └── Postgres (1 instância)
│       ├── EntreCampos (tabelas)
│       ├── mltmark (tabelas)
│       └── aamihe (tabelas)
│
├── Nginx Reverse Proxy
│   ├── http://supabase.seu-dominio.com → Studio
│   ├── http://api.seu-dominio.com → Kong/PostgREST
│   └── ...
│
└── Apps (Next.js, React, HTML)
    ├── EntreCampos (app1.vercel.com)
    ├── mltmark (app2.vercel.com)
    └── aamihe (app3.vercel.com)
```

---

## 🔧 SETUP PARA NOVO SITE

#### **Cenário: Adicionar "mltmark" e "aamihe" ao Postgres existente**

#### **MÉTODO 1: Manual (5 minutos)**

1. Abra Studio: `http://seu-ip-contabo:3000`
2. SQL Editor → New Query
3. Cole isto (adaptado):

```sql
-- Tabelas para aamihe
CREATE TABLE sites_aamihe (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE site_members_aamihe (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT REFERENCES sites_aamihe(id),
  user_id UUID,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE emails_aamihe (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  site_id BIGINT REFERENCES sites_aamihe(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dados
INSERT INTO sites_aamihe (name, domain) 
VALUES ('aamihe', 'aamihe.pt');

INSERT INTO emails_aamihe (domain, email, password, site_id)
SELECT 'aamihe.pt', 'admin@aamihe.pt', 'senha-aqui', id
FROM sites_aamihe WHERE domain = 'aamihe.pt';
```

4. Run → ✅

---

#### **MÉTODO 2: Automático (via script)**

No Contabo:

```bash
cd /root  # ou sua pasta de trabalho

# Copie o script (ou crie-o)
curl -o setup-novo-site.sh https://seu-repo/scripts/setup-novo-site.sh
chmod +x setup-novo-site.sh

# Execute para aamihe
./setup-novo-site.sh aamihe aamihe.pt admin@aamihe.pt senha123
```

Isto gera um ficheiro SQL em `/tmp/setup-aamihe.sql` que você copia/cola no Studio.

---

## 🌍 Apontar App para Novo Site

### **Exemplo: App aamihe em Next.js**

No `.env.local` da app aamihe:

```env
NEXT_PUBLIC_SUPABASE_URL=http://api.seu-dominio.com  # Postgres self-hosted
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...  # A MESMA key do Studio
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # A MESMA key

# Identificador do site (para queries)
SITE_NAME=aamihe
SITE_DOMAIN=aamihe.pt
```

Na app (exemplo em `/app/api/get-emails/route.ts`):

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  // Query a tabela específica de aamihe
  const { data, error } = await supabase
    .from('emails_aamihe')  // ← Usar tabela do site específico
    .select('*')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
```

---

## 📊 Padrão de Nomenclatura (Importante!)

Para evitar conflitos, use este padrão em todas as tabelas:

| Tabela | EntreCampos | mltmark | aamihe |
|---|---|---|---|
| Sites | `sites` | `sites_mltmark` | `sites_aamihe` |
| Membros | `site_members` | `site_members_mltmark` | `site_members_aamihe` |
| Emails | `emails` | `emails_mltmark` | `emails_aamihe` |

---

## 🔐 Segurança: RLS (Row-Level Security)

Para cada tabela, configure RLS para que um utilizador só veja dados do seu site:

```sql
-- Para aamihe
ALTER TABLE emails_aamihe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_read_own_emails_aamihe" ON emails_aamihe
  FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM site_members_aamihe 
    WHERE site_id = emails_aamihe.site_id
  ));

CREATE POLICY "only_admins_can_edit_emails_aamihe" ON emails_aamihe
  FOR UPDATE
  USING (auth.uid() IN (
    SELECT user_id FROM site_members_aamihe 
    WHERE site_id = emails_aamihe.site_id 
    AND role = 'admin'
  ));
```

---

## ✅ Checklist para Novo Site

- [ ] Tabelas SQL criadas no Studio (com sufixo `_sitenam`)
- [ ] Dados iniciais inseridos
- [ ] App apontada para `NEXT_PUBLIC_SUPABASE_URL` do Contabo
- [ ] `.env` da app preenchido com credenciais
- [ ] Teste: `curl http://seu-dominio-api/rest/v1/emails_aamihe`
- [ ] RLS configurado (se necessário)

---

## 🚀 Próximos Passos

1. **Backups automáticos**: Configurar `pg_dump` via cron
2. **Monitoring**: Dashboard para ver saúde do Postgres
3. **Escalar**: Quando tiver 10+ sites, considere replicação DB
