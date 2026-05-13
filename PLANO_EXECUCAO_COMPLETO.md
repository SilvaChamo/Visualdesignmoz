# 📋 PLANO COMPLETO DE EXECUÇÃO - mltmark + aamihe + Supabase Contabo

**Versão**: 1.0  
**Data**: 13 de maio de 2026  
**Status**: Pronto para implementação por outro agente  
**Tempo estimado**: 3-4 horas (incluindo testes)

---

## 📍 OBJETIVO FINAL

Ter operacional:
- ✅ Supabase self-hosted no Contabo (Docker)
- ✅ Duas sites (mltmark e aamihe) com tabelas PostgreSQL separadas
- ✅ Painel Next.js para administrar cada site
- ✅ HTML estático (mltmark) consumindo dados do seu painel
- ✅ Hospedado: GitHub + Vercel (ambos os painéis e HTML)

---

## 🎯 ESTRUTURA DO PROJETO

```
/root/supabase-project/          (Contabo - Docker)
├── docker-compose.yml
├── .env
└── (containers a correr)

/root/apps/
├── mltmark-panel/               (Painel Next.js)
│   ├── src/app/api/
│   ├── .env.local
│   └── package.json
│
├── aamihe-panel/                (Painel Next.js)
│   ├── src/app/api/
│   ├── .env.local
│   └── package.json
│
└── mltmark-html/                (Site estático HTML)
    ├── index.html
    ├── assets/
    └── script.js (consome API do painel mltmark)
```

---

## 📝 PASSO 1: VERIFICAÇÃO PRÉ-REQUISITOS (10 min)

### ✅ No Contabo, execute:

```bash
# 1.1 Verificar Docker
docker --version
docker compose version

# Deve retornar algo como:
# Docker version 20.10.x
# Docker Compose version 2.x.x

# 1.2 Verificar espaço em disco
df -h
# Mínimo 20GB disponível

# 1.3 Verificar IP do servidor
hostname -I
# Anotar o IP (ex: 123.45.67.89)

# 1.4 Verificar portas livres
netstat -tlnp | grep -E ':(3000|3001|5432|8000)'
# Não deve retornar nada (portas livres)
```

**Checklist:**
- [ ] Docker instalado
- [ ] 20GB+ disponível
- [ ] IP anotado
- [ ] Portas livres

---

## 📝 PASSO 2: SETUP POSTGRES SUPABASE (Contabo) (45 min)

### ✅ 2.1 Preparar diretório

```bash
cd /root

# Clone ou prepare o Supabase self-hosted
mkdir -p supabase-project
cd supabase-project

# Copie o docker-compose.yml da pasta supabase oficial
# Ou execute isto para baixar:
git clone --depth 1 https://github.com/supabase/supabase.git
cp -r supabase/docker/* .
```

### ✅ 2.2 Configurar .env

```bash
cp .env.example .env
nano .env
```

**Preencha os seguintes valores no .env:**

```env
# Core
POSTGRES_PASSWORD=super-senhaSegura12345!  # MUDE ISTO!
JWT_SECRET=$(openssl rand -hex 32)         # MUDE ISTO!
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Valor base64
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Valor base64

# Networking
STUDIO_DEFAULT_PORT=3000
API_EXTERNAL_URL=http://seu-ip-contabo:8000

# Email (opcional, para future use)
SMTP_HOST=seu-smtp
SMTP_PORT=587
```

**Para gerar JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY:**
```bash
# Abra em Python (rápido):
python3 << 'EOF'
import json
import base64
import secrets

def generate_jwt(secret, purpose="anon"):
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"iss": "supabase", "aud": purpose, "iat": 1234567890}
    
    import hmac
    h = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b'=').decode()
    p = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=').decode()
    
    sig = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), f"{h}.{p}".encode(), 'sha256').digest()
    ).rstrip(b'=').decode()
    
    return f"{h}.{p}.{sig}"

secret = secrets.token_hex(32)
print(f"JWT_SECRET={secret}")
print(f"ANON_KEY={generate_jwt(secret, 'anon')}")
print(f"SERVICE_ROLE_KEY={generate_jwt(secret, 'authenticated')}")
EOF
```

### ✅ 2.3 Iniciar Docker Compose

```bash
cd /root/supabase-project

# Pull das imagens
docker compose pull

# Iniciar
docker compose up -d

# Aguarde 1-2 minutos
sleep 60

# Verificar status
docker compose ps
```

**Output esperado:**
```
NAME                    STATUS
supabase_kong_1         Up 1 minute
supabase_postgres_1     Up 2 minutes
supabase_studio_1       Up 1 minute
supabase_auth_1         Up 1 minute
supabase_rest_1         Up 1 minute
```

### ✅ 2.4 Verificar acesso ao Studio

```bash
curl -s http://localhost:3000/auth/session | head -c 100
# Deve retornar JSON

# Abra no navegador:
# http://seu-ip-contabo:3000
```

**Checklist:**
- [ ] `docker compose ps` mostra todos containers `Up`
- [ ] Studio acessível em `http://seu-ip:3000`
- [ ] Conseguiu fazer login

---

## 📝 PASSO 3: CRIAR TABELAS POSTGRES (30 min)

### ✅ 3.1 Aceder ao Studio

1. Abra: `http://seu-ip-contabo:3000`
2. Login (email/senha definida no .env)
3. Clique em **SQL Editor** (esquerda)
4. Clique em **+ New Query**



### ✅ 3.3 Executar Migration 002 - Tabelas mltmark

```sql
-- Migration 002: Tabelas mltmark
CREATE TABLE IF NOT EXISTS sites_mltmark (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_members_mltmark (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT REFERENCES sites_mltmark(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emails_mltmark (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  site_id BIGINT REFERENCES sites_mltmark(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_projects_mltmark (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT REFERENCES sites_mltmark(id),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  create2 Executar Migration 001OW()
);

CREATE INDEX id1_site_members_mltmark_site_id ON site_members_mltmark(site_id);
CREATE INDEX idx_emails_mltmark_site_id ON emails_mltmark(site_id);
CREATE INDEX idx_portfolio_projects_mltmark_site_id ON portfolio_projects_mltmark(site_id);
```

Clique **Run** ✅

### ✅ 3.4 Executar Migration 003 - Tabelas aamihe

```sql
-- Migration 002: Tabelas aamihe
CREATE TABLE IF NOT EXISTS sites_aamihe (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_members_aamihe (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT REFERENCES sites_aamihe(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emails_aamihe (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  site_id BIGINT REFERENCES sites_aamihe(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_aamihe (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT REFERENCES sites_aamihe(id),
  page_name TEXT,
  section_name TEXT,
  content_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);3 Executar Migration 002

CREATE INDEX idx_site_members_aamihe_site_id ON site_members_aamihe(site_id);
CREATE INDEX idx_emails_aamihe_site_id ON emails_aamihe(site_id);
CREATE INDEX idx_content_aamihe_site_id ON content_aamihe(site_id);
```

Clique **Run** ✅

### ✅ 3.4 Seed - Dados Iniciais

```sql
-- Seed: Dados iniciais

-- mltmark
INSERT INTO sites_mltmark (name, domain, description) 
VALUES ('mltmark', 'mltmark.com', 'Design Studio');

INSERT INTO emails_mltmark (domain, email, password, site_id)
SELECT 'mltmark.com', 'admin@mltmark.com', 'password123', id
FROM sites_mltmark WHERE domain = 'mltmark.com';

-- aamihe
INSERT INTO sites_aamihe (name, domain, description) 
VALUES ('aamihe', 'aamihe.pt', 'Consultoria e Educação');

INSERT INTO emails_aamihe (domain, email, password, site_id)
SELECT 'aamihe.pt', 'admin@aamihe.pt', 'password123', id
FROM sites_aamihe WHERE domain = 'aamihe.pt';
```

Clique **Run** ✅

### ✅ 3.6 Copiar Credenciais

No Studio, vá a **Settings → API**:

Copie e guarde num ficheiro seguro:
```
NEXT_PUBLIC_SUPABASE_URL = (Project URL)
NEXT_PUBLIC_SUPABASE_ANON_KEY = (anon public key)
SUPABASE5SERVICE_ROLE_KEY = (service_role key)
```

**Checklist:**
- [ ] Todas as migrations corridas sem erros
- [ ] Dados iniciais inseridos
- [ ] Credenciais copiadas e guardadas

---

## 📝 PASSO 4: CRIAR PAINEL NEXT.JS MLTMARK (45 min)

### ✅ 4.1 Criar projeto Next.js

```bash
cd /root/apps
npx create-next-app@latest mltmark-panel --typescript --tailwind --eslint

# Ou clone uma template existente:30
# git clone seu-repo mltmark-panel
# cd mltmark-panel && npm install
```

### ✅ 4.2 Instalar dependências

```bash
cd /root/apps/mltmark-panel

npm install @supabase/supabase-js dotenv
```

### ✅ 4.3 Criar .env.local

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://seu-ip-contabo:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Identificação do site
SITE_NAME=mltmark
SITE_DOMAIN=mltmark.com
EOF
```

### ✅ 4.4 Criar API para listar projetos

**Ficheiro: `src/app/api/projects/route.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('portfolio_projects_mltmark')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return Response.json(data)
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Obter site_id
    const { data: siteData } = await supabase
      .from('sites_mltmark')
      .select('id')
      .eq('domain', process.env.SITE_DOMAIN!)
      .single()

    if (!siteData) throw new Error('Site não encontrado')

    const { data, error } = await supabase
      .from('portfolio_projects_mltmark')
      .insert({
        site_id: siteData.id,
        title: body.title,
        description: body.description,
        image_url: body.image_url,
        link_url: body.link_url
      })
      .select()

    if (error) throw error
    return Response.json(data)
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

### ✅ 4.5 Criar página admin

**Ficheiro: `src/app/admin/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Painel mltmark</h1>
      <div className="grid grid-cols-3 gap-4">
        {projects.map((p: any) => (
          <div key={p.id} className="border rounded p-4">
            <h3 className="font-bold">{p.title}</h3>
            <p className="text-sm text-gray-600">{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### ✅ 4.6 Testar painel

```bash
cd /root/apps/mltmark-panel
npm run dev

# Deve estar em http://localhost:3001
```

**Checklist:**
- [ ] Projeto criado sem erros
- [ ] `.env.local` preenchido
- [ ] APIs criadas
- [ ] Painel rodando em porta 3001
- [ ] API `/api/projects` retorna dados

---

## 📝 PASSO 5: CRIAR PAINEL NEXT.JS AAMIHE (40 min)

Repita o **PASSO 4** mas com:

```bash
cd /root/apps
npx create-next-app@latest aamihe-panel

# .env.local:30 min)

Repita o **PASSO 4** com a mesma estrutura_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

SITE_NAME=aamihe
SITE_DOMAIN=aamihe.pt
```

**APIs: `src/app/api/content/route.ts`** (listar/criar conteúdo)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('content_aamihe')
    .select('*')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  
  const { data: siteData } = await supabase
    .from('sites_aamihe')
    .select('id')
    .eq('domain', process.env.SITE_DOMAIN!)
    .single()

  const { data, error } = await supabase
    .from('content_aamihe')
    .insert({
      site_id: siteData?.id,
      page_name: body.page_name,
      section_name: body.section_name,
      content_text: body.content_text
    })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
```

---

## 📝 PASSO 6: SETUP MLTMARK HTML (30 min)

### ✅ 6.1 Preparar ficheiros

```bash
mkdir -p /root/apps/mltmark-html
cd /root/apps/mltmark-html

# Se tem HTML existente, copie para aqui
# scp seu-servidor:mltmark.html .
# Ou crie um index.html básico:

cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>mltmark - Design Studio</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 20px; }
    .project { border: 1px solid #ccc; padding: 10px; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>mltmark Portfolio</h1>
  <div id="projects"></div>
  
  <script>
    const API_URL = 'http://seu-ip-contabo:3001/api/projects'
    
    fetch(API_URL)
      .then(r => r.json())
      .then(projects => {
        const html = projects.map(p => `
          <div class="project">
            <h3>${p.title}</h3>
            <p>${p.description}</p>
            <img src="${p.image_url}" style="max-width: 100%">
            <a href="${p.link_url}">Ver projeto</a>
          </div>
        `).join('')
        document.getElementById('projects').innerHTML = html
      })
      .catch(e => console.error('Erro ao carregar projetos:', e))
  </script>
</body>
</html>
EOF
```

### ✅ 6.2 Deploy no Vercel

```bash
cd /root/apps/mltmark-html

# Opção A: Via CLI Vercel
npm install -g vercel
vercel

# Opção B: Git + Vercel (recomendado)
git init
git add .
git commit -m "Initial mltmark HTML"
git remote add origin seu-github-repo
git push -u origin main

# Depois, no Vercel:
# 1. Vá a vercel.com/new
# 2. Selecione GitHub repository
# 3. Deploy

# Variáveis de ambiente no Vercel:
# NEXT_PUBLIC_SUPABASE_URL=http://seu-ip-contabo:8000
# API_URL=http://seu-ip-contabo:3001
```

**Checklist:**
- [ ] HTML criado/copiado
- [ ] Consume API do painel mltmark
- [ ] Hospedado no Vercel
- [ ] Acessível em vercel.com URL

---

## 📝 PASSO 7: TESTES DE VALIDAÇÃO (30 min)

### ✅ 7.1 Teste 1: Postgres acessível

```bash
curl -X GET "http://seu-ip-contabo:8000/rest/v1/sites_mltmark" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json"

# Deve retornar JSON com sites
```

### ✅ 7.2 Teste 2: Painel mltmark funciona

```bash
curl http://localhost:3001/api/projects

# Deve retornar array JSON de projetos
```

### ✅ 7.3 Teste 3: Painel aamihe funciona

```bash
curl http://localhost:3002/api/content

# Deve retornar array JSON de conteúdo
```

### ✅ 7.4 Teste 4: HTML consome dados

Abra no navegador:
```
http://localhost/mltmark-html/index.html
```

Deve mostrar projetos do painel.

### ✅ 7.5 Teste 5: Deploy Vercel

Acesse:
```
https://seu-projeto.vercel.app
```

Deve mostrar HTML com projetos.

**Checklist:**
- [ ] API Postgres retorna dados
- [ ] Painel mltmark acessa Postgres
- [ ] Painel aamihe acessa Postgres
- [ ] HTML consome API painel
- [ ] Site HTML no Vercel funciona

---

## 🐛 TROUBLESHOOTING

### Erro: "Cannot connect to Postgres"
```bash
# Verifique se containers estão rodando
docker compose ps

# Ver logs
docker compose logs postgres

# Reinicie
docker compose restart postgres
```

### Erro: "CORS error" no HTML
```bash
# No painel Next.js, adicione headers:
# src/app/api/projects/route.ts

const headers = new Headers({
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
})

return new Response(JSON.stringify(data), { headers })
```

### Erro: "Invalid JWT"
```bash
# Regenere as keys no .env do docker-compose
# Depois reinicie containers

docker compose down
docker compose up -d
```

### Erro: Porta já em uso
```bash
# Mude a porta no docker-compose.yml
# Ou mate o processo:

fuser -k 3001/tcp
fuser -k 3002/tcp
```

---

## ✅ CHECKLIST FINAL - IMPLEMENTAÇÃO COMPLETA

- [ ] **Contabo Setup**
  - [ ] Docker Compose rodando
  - [ ] Supabase Studio acessível
  
- [ ] **Postgres & Migrations**
  - [ ] Tabelas EntreCampos criadas
  - [ ] Tabelas mltmark criadas
  - [ ] Tabelas aamihe criadas
  - [ ] Dados iniciais inseridos
  - [ ] Credenciais guardadas

- [ ] **Painel mltmark**
  - [ ] Projeto criado
  - [ ] APIs impem http://localhost:3001
  - [ ] Conecta a Postgres
  
- [ ] **Painel aamihe**
  - [ ] Projeto criado
  - [ ] APIs implementadas
  - [ ] Rodando em http://localhost:3002
  - [ ] Conecta a Postgres

- [ ] **HTML mltmark**
  - [ ] Ficheiros preparados
  - [ ] Consome API painel
  - [ ] Hospedado no Vercel
  - [ ] Funciona com domínio

- [ ] **Testes**
  - [ ] Postgres acessível via API
  - [ ] Painel mltmark retorna dados
  - [ ] Painel aamihe retorna dados
  - [ ] HTML mostra dados
  - [ ] Vercel funciona

---

## 📞 DOCUMENTAÇÃO DE REFERÊNCIA

- [SUPABASE_CONTABO_SETUP_MANUAL.md](./SUPABASE_CONTABO_SETUP_MANUAL.md) - Detalhes setup manual
- [TEMPLATE_PROXIMOS_SITES.md](./TEMPLATE_PROXIMOS_SITES.md) - Template para escalar
- [Supabase Docs](https://supabase.com/docs) - Documentação oficial
- [Next.js Docs](https://nextjs.org/docs) - Documentação Next.js

---

**FIM DO PLANO**

Se surgir dúvida ou erro, este plano é suficiente para outro agente implementar 100% da solução.
