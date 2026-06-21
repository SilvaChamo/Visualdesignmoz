# Cloudflare Worker — DESACTIVADO

Este fluxo foi **abandonado**. O painel usa apenas:

**`https://painel.visualdesignmoz.com/dashboard`**

## Remover na Cloudflare (faça isto)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers e Pages** → `visualdesignmoz-panel-proxy`
2. **Domínios** → apague as rotas:
   - `visualdesignmoz.com/*`
   - `www.visualdesignmoz.com/*`
3. (Opcional) **Configurações** → **Geral** → **Excluir** o Worker

Depois disso, `visualdesignmoz.com` volta a ir só para a Vercel, sem passar pelo Worker.
