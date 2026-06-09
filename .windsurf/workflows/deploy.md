---
description: Deploy ou atualizar o site VisualDesign no servidor de produção
---

## Estado Atual
- Servidor: `37.27.17.25` (Hetzner, DirectAdmin + PM2)
- App: `https://visualdesignmoz.com`
- Supabase self-hosted: `https://supabase.visualdesignmoz.com`
- PM2 processo: `visualdesign`
- SSH: porta `2234`, chave `~/.ssh/aamihe_hetzner`

## Pré-requisitos
- Chave SSH em `~/.ssh/aamihe_hetzner`
- `.env.local` no servidor conforme `deploy/env.production.template`

## Deploy completo (primeira vez)

```bash
bash deploy/instalar-no-servidor.sh
```

## Atualização rápida (após alterações no código)

```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git --exclude "*.env*" \
  -e "ssh -i ~/.ssh/aamihe_hetzner -p 2234" \
  ./ root@37.27.17.25:/home/visualdesignmoz.com/public_html/ && \
ssh -i ~/.ssh/aamihe_hetzner -p 2234 root@37.27.17.25 \
  "cd /home/visualdesignmoz.com/public_html && npm run build && pm2 restart visualdesign && echo DONE"
```

## Verificar estado

```bash
ssh -i ~/.ssh/aamihe_hetzner -p 2234 root@37.27.17.25 \
  "pm2 list && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001"
```
