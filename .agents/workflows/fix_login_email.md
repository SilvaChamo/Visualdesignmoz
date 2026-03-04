---
description: Guia de resolução para o Login e Personalização de Emails
---

# Estado Atual do Sistema de Login

## ✅ Concluído
1. **Botão Login** — Funcionava mas o honeypot bloqueava. Corrigido em `src/app/auth/login/page.tsx` (campo renomeado para `_internal_hp_field`, lógica de bloqueio removida).
2. **Google OAuth** — Erro "Unable to exchange code" corrigido restaurando `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local`.
3. **Email Recuperação** — Design revertido para versão larga (600px) em `src/app/api/auth/reset-password/route.ts`.
4. **Middleware → Proxy** — Next.js 16 usa `proxy.ts` em vez de `middleware.ts`. Ficheiro renomeado e export corrigido para `export async function proxy()`.
5. **Emails Admin Sincronizados** — Lista unificada em 4 ficheiros: `proxy.ts`, `AdminLayout`, `callback/route.ts`, `supabase-client.ts`.

## ⚠️ Pontos de Atenção
- **Bypass Temporário** — `silva.chamo` tem bypass de debug no `AdminLayout` e `proxy.ts`. Remover quando roles estabilizarem.
- **Tabela `profiles`** — `getUserRole()` consulta `profiles` no Supabase. Verificar se existe e tem dados corretos.
- **Deploy** — Alterações são locais. Necessário `git push` para Vercel.

## Ficheiros Chave
| Ficheiro | Função |
|----------|--------|
| `src/proxy.ts` | Segurança/routing (Next.js 16) |
| `src/app/admin/layout.tsx` | Verificação de acesso admin |
| `src/lib/supabase-client.ts` | Deteção de role (admin/client/reseller) |
| `src/app/auth/callback/route.ts` | Callback OAuth Google |
| `src/app/auth/login/page.tsx` | Página de login |
| `src/app/api/auth/reset-password/route.ts` | Envio de email de recuperação |

## Lista de Emails Admin (Sincronizada)
```
admin@visualdesigne.com
geral@visualdesigne.com
silva.chamo@gmail.com
silva.chamo@visualdesigne.com
```

## Fluxo de Login
1. `/auth/login` → `signIn()` → `getRedirectPath()` → `/admin` ou `/client`
2. Google → `/auth/callback` → `exchangeCodeForSession()` → redireciona por role
3. `proxy.ts` valida acesso na camada de rede
4. `AdminLayout` válida acesso no servidor
