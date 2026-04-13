---
description: Deploy ou atualizar o site VisualDesign no servidor de produção
---

## Estado Atual ✅
- [x] Servidor configurado: `109.199.104.22` (Ubuntu 24.04, CyberPanel + OpenLiteSpeed + PM2)
- [x] Site acessível em `http://visualdesign.ao` (via /etc/hosts no Mac)
- [x] LiteSpeed proxy configurado: porta 80 → porta 3002
- [x] PM2 a gerir o processo com nome `visualdesign`
- [x] DNS registado: A record `visualdesign.ao` → `109.199.104.22` (a propagar)
- [x] Sincronização CyberPanel via MySQL direto (`/api/cyberpanel-db`)
- [x] i18n PT/EN completo (site público + dashboard admin)
- [x] Login: logo dentro do formulário, tamanho aumentado
- [ ] SSL Let's Encrypt — aguardar propagação DNS para emitir

## Pré-requisitos
- Chave SSH em `/Users/macbook/.ssh/visualdesign_cyberpanel_key`
- Servidor: `109.199.104.22` (Ubuntu 24.04, CyberPanel + LiteSpeed + PM2)
- Site em `/home/visualdesign.ao/public_html`
- Next.js app na porta `3002`, gerido pelo PM2 com nome `visualdesign`
- `.env.local` no servidor com `CYBERPANEL_USE_LOCAL_EXEC=true`

## Deploy completo (primeira vez ou reset)

// turbo
1. Corre o script automático:
```bash
bash /Users/macbook/Desktop/APP/visualdesign/deploy/instalar-no-servidor.sh
```

## Atualização Robusta (RECOMMENDADO) ← USA ESTE

// turbo
2. Corre o script de deploy robusto (limpa cache, build local, sincroniza, build servidor, reinicia PM2):
```bash
bash /Users/macbook/Desktop/APP/visualdesign/deploy/deploy-robusto.sh
```

**Ou manualmente se o script falhar:**

```bash
# 1. Limpar cache local
rm -rf .next

# 2. Build local para verificar erros
npm run build

# 3. Criar diretório no servidor se não existir
ssh -i /Users/macbook/.ssh/visualdesign_cyberpanel_key root@109.199.104.22 \
  "mkdir -p /home/visualdesign.ao/public_html"

# 4. Sincronizar arquivos (com --delete para remover arquivos antigos)
rsync -avz --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude "*.env*" \
  -e "ssh -i /Users/macbook/.ssh/visualdesign_cyberpanel_key" \
  /Users/macbook/Desktop/APP/visualdesign/ \
  root@109.199.104.22:/home/visualdesign.ao/public_html/

# 5. Build e reiniciar no servidor
ssh -i /Users/macbook/.ssh/visualdesign_cyberpanel_key root@109.199.104.22 \
  "cd /home/visualdesign.ao/public_html && npm run build && pm2 delete visualdesign 2>/dev/null; pm2 start npm --name visualdesign -- start"
```

## Verificar estado do site no servidor

// turbo
3. Verifica PM2 e acesso:
```bash
ssh -i /Users/macbook/.ssh/visualdesign_cyberpanel_key root@109.199.104.22 \
  "pm2 list && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002"
```

## GitHub Actions — Deploy Automático (Webhook)
O ficheiro `.github/workflows/deploy-webhook.yml` permite deploy automático via webhook (não precisa de scope `workflow`).

### Configurar Secrets no GitHub (só uma vez)
Vai a: `https://github.com/SilvaChamo/Visualdesigne/settings/secrets/actions` → **New repository secret**

| Secret | Valor |
|--------|-------|
| `SERVER_HOST` | `109.199.104.22` |
| `SERVER_USER` | `root` |
| `SERVER_SSH_KEY` | conteúdo de `/Users/macbook/.ssh/visualdesign_cyberpanel_key` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gwankhxcbkrtgxopbxwd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | `sb_publishable_NkNwKuVE-AyGgyxKB6zpmQ_b-HdjWOA` |

### Configurar token GitHub (só uma vez)
1. Cria token em `https://github.com/settings/tokens/new` com scope `repo`
2. Adiciona ao `.env.local` local:
```
GITHUB_TOKEN=ghp_XXXXXXXXXXXXXXXXXXXX
```

### Usar deploy automático
Após fazer `git push origin main`, corre:
```bash
bash /Users/macbook/Desktop/APP/visualdesign/deploy/trigger-deploy.sh
```

Este script dispara o GitHub Actions que faz deploy automático ao servidor.

---

---

## Emitir SSL (após DNS propagar)
4. No CyberPanel `https://109.199.104.22:8090`:
```
Websites → List Websites → Manage (visualdesign.ao) → SSL → Issue SSL
```
Depois atualizar vhost.conf para redirecionar HTTP → HTTPS.

## 🔧 Troubleshooting - Alterações não aparecem no site

### Problema: Deploy feito mas site não atualiza

**Causas comuns e soluções:**

1. **Cache do Next.js (.next)**
   ```bash
   # Limpar cache local antes do build
   rm -rf .next
   npm run build
   ```

2. **Cache do navegador**
   - Pressione `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (Mac) para hard refresh
   - Ou abra em aba anônima (Private/Incognito)

3. **PM2 usando processo antigo**
   ```bash
   # Solução: deletar e recriar o processo
   ssh -i ~/.ssh/visualdesign_cyberpanel_key root@109.199.104.22 \
     "pm2 delete visualdesign; cd /home/visualdesign.ao/public_html && pm2 start npm --name visualdesign -- start"
   ```

4. **Arquivos antigos não removidos**
   - Usar `rsync --delete` no deploy para garantir sincronização completa
   - Ou usar o script `deploy-robusto.sh` que já inclui `--delete`

5. **Build falhou silenciosamente**
   ```bash
   # Verificar logs do build no servidor
   ssh -i ~/.ssh/visualdesign_cyberpanel_key root@109.199.104.22 \
     "cd /home/visualdesign.ao/public_html && cat .next/build.log 2>/dev/null || echo 'Build log não encontrado'"
   ```

### Verificar estado completo do servidor
```bash
ssh -i ~/.ssh/visualdesign_cyberpanel_key root@109.199.104.22 "
echo '=== PM2 Status ===' && pm2 list && 
echo '=== Porta 3002 ===' && netstat -tlnp | grep 3002 || ss -tlnp | grep 3002 &&
echo '=== Últimas linhas do log ===' && pm2 logs visualdesign --lines 20
"
```

## Acesso
- Site público: `http://visualdesign.ao`
- Painel admin: `http://visualdesign.ao/admin` (login: `silva.chamo@gmail.com` / `0001`)
- CyberPanel: `https://109.199.104.22:8090`
- GitHub: `https://github.com/SilvaChamo/Visualdesigne`
