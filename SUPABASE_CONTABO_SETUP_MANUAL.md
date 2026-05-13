# 🚀 Setup Manual - Supabase Self-Hosted no Contabo

## ✅ Pré-requisitos Confirmados
- Docker CE + Docker Compose instalados e respondendo ✅
- `docker compose up -d` já executado na pasta do Supabase ✅

---

## 📋 O QUE VOCÊ DEVE FAZER MANUALMENTE

### **PASSO 1: Verificar se Supabase está Online**

No terminal do Contabo, execute:

```bash
docker compose ps
```

**Deve ver algo assim:**
```
NAME                    STATUS
supabase_kong_1         Up 2 minutes
supabase_postgres_1     Up 2 minutes
supabase_studio_1       Up 2 minutes
```

Se algum container está `Exited` ou não aparece, execute:
```bash
docker compose logs -f postgres
```
(Ctrl+C para sair)

---

### **PASSO 2: Aceder ao Studio (Interface Supabase)**

1. **No seu navegador**, vá para:
   ```
   http://seu-ip-contabo:3000
   ```
   (Substitua `seu-ip-contabo` pelo IP real do Contabo)

2. **Login**: 
   - Email: o que definiu no `.env` (ex: `admin@supabase.io`)
   - Senha: a que definiu no `.env`

3. Se não conseguir aceder, verifique:
   ```bash
   # Ver IP do Contabo
   hostname -I
   
   # Ver portas em uso
   netstat -tlnp | grep 3000
   
   # Ver logs do Studio
   docker compose logs studio
   ```

---

### **PASSO 3: Criar Migrations para EntreCampos**

Depois de aceder ao Studio:

1. **Clique em "SQL Editor"** (lado esquerdo)
2. **Crie uma nova Query** (botão azul `+`)
3. **Cole o conteúdo de cada migration** (por ordem):

#### **Migration 001 - Tabelas Base (CORRER ISTO PRIMEIRO)**

```sql
-- Tabelas base do EntreCampos
CREATE TABLE IF NOT EXISTS sites (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_members (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT DEFAULT 'member', -- 'admin', 'manager', 'member'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emails (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  site_id BIGINT REFERENCES sites(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_site_members_site_id ON site_members(site_id);
CREATE INDEX idx_site_members_user_id ON site_members(user_id);
CREATE INDEX idx_emails_site_id ON emails(site_id);
```

**Clique em "Run"** ✅

---

#### **Migration 002 - Tabelas de Manutenção (OPCIONAL - correr depois)**

```sql
-- Tabela para logs de manutenção Docker
CREATE TABLE IF NOT EXISTS infra_maintenance_runs (
  id BIGSERIAL PRIMARY KEY,
  run_date TIMESTAMP DEFAULT NOW(),
  container_name TEXT,
  status TEXT, -- 'running', 'restarted', 'error'
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_maintenance_runs_date ON infra_maintenance_runs(run_date);
```

**Clique em "Run"** ✅

---

#### **Seed - Dados de Teste (OPCIONAL - correr depois)**

```sql
-- Inserir site de teste
INSERT INTO sites (name, domain, description) 
VALUES ('EntreCampos', 'entrecampos.pt', 'Portal de agricultura');

-- Inserir emails de teste
INSERT INTO emails (domain, email, password, site_id)
SELECT 
  'entrecampos.pt',
  'admin@entrecampos.pt',
  'sua-senha-aqui', -- MUDE ISTO!
  id
FROM sites WHERE domain = 'entrecampos.pt';
```

**Clique em "Run"** ✅

---

### **PASSO 4: Copiar Credenciais do Supabase**

No Studio, vá a **Settings → API** (lado esquerdo):

1. **Copie:**
   - `Project URL` → será seu `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → será seu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → será seu `SUPABASE_SERVICE_ROLE_KEY`

2. **Guarde num ficheiro seguro** (vai precisar para apps)

---

### **PASSO 5: Configurar Firewall / Proxy (IMPORTANTE)**

O Supabase está a rodar em portas internas (3000, 5432, etc.).  
Precisa de as expor ou colocar atrás de um reverse proxy.

#### **Opção A - Expor direto (Menos seguro, apenas testes):**
```bash
# Edite o .env do docker-compose
nano .env

# Mude as portas de listen, ex:
# STUDIO_DEFAULT_PORT=3000
# Deixe assim e aceda via http://seu-ip:3000
```

#### **Opção B - Atrás de Nginx Reverse Proxy (Recomendado):**

```bash
# Instale Nginx
sudo apt install nginx -y

# Crie um virtual host em /etc/nginx/sites-available/supabase
sudo nano /etc/nginx/sites-available/supabase
```

Cole isto:
```nginx
server {
    listen 80;
    server_name seu-dominio-ou-ip.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Depois:
```bash
sudo ln -s /etc/nginx/sites-available/supabase /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### **PASSO 6: Testar Conexão (API Test)**

No Contabo, execute:

```bash
curl -X POST "http://localhost:3000/rest/v1/sites" \
  -H "apikey: sua-anon-key-aqui" \
  -H "Content-Type: application/json" \
  -d '{"name":"teste"}'
```

Se retornar dados JSON → ✅ Tudo OK!

---

## 🔄 TEMPLATE REUTILIZÁVEL PARA PRÓXIMOS SITES

### Para cada novo site (ex: aamihe, Base Agrodata):

1. **Passo 3 - Crie migrations específicas do site** (mesma estrutura, dados diferentes)
2. **Passo 4 - Copie as credenciais** (já terá as mesmas, mas guarde por site)
3. **Passo 5 - Configure domínios** (se usar reverse proxy, adicione novo virtual host)
4. **Passo 6 - Teste a API** com os dados do novo site

---

## ⚠️ CHECKLIST FINAL

- [ ] `docker compose ps` mostra todos os containers `Up`
- [ ] Consegue aceder ao Studio em `http://seu-ip:3000`
- [ ] Migrations SQL foram corridas sem erros
- [ ] Credenciais foram copiadas e guardadas
- [ ] Firewall/proxy está configurado
- [ ] Curl test retorna dados JSON

Quando tudo isto estiver ✅, avise-me e eu:
1. Configuro as apps para apontarem a este Postgres
2. Crio um script de manutenção automática
3. Preparo o setup para os próximos sites
