# Checklist — Google OAuth no Supabase (Hetzner)

**Objectivo:** Login com Google em `https://visualdesignmoz.com/auth/login`  
**Google Console:** já configurado (origens + redirect URIs)  
**Próximo passo:** validar o **servidor Supabase** no Hetzner

---

## Antes de começar

| Item | Valor correcto |
|------|----------------|
| App (clientes) | `https://visualdesignmoz.com/auth/login` |
| Supabase Auth | `https://supabase.visualdesignmoz.com` |
| Callback Google → Supabase | `https://supabase.visualdesignmoz.com/auth/v1/callback` |
| Callback Supabase → App | `https://visualdesignmoz.com/auth/callback` |
| Client ID Google | `423302530307-3hh69uum0mpn0rgsovhuhdrdhg049ld2.apps.googleusercontent.com` |

---

## Parte A — Servidor Hetzner (SSH)

### A1. Ligar ao servidor

```bash
ssh -p 2234 root@37.27.17.25
# (ou o IP/utilizador que usar habitualmente)
```

- [ ] Consegui entrar por SSH

---

### A2. Containers Supabase activos

```bash
cd /opt/supabase-aamihe/docker
# ou o caminho real do docker-compose do Supabase
docker compose ps
```

- [ ] `auth`, `kong`, `db` (e restantes) estão **Up**
- [ ] Nenhum container em **Restarting** ou **Exit**

---

### A3. Auth API responde (não HTML 404)

No servidor **ou** no seu Mac:

```bash
curl -s https://supabase.visualdesignmoz.com/auth/v1/health \
  -H "apikey: <ANON_KEY>"
```

Resposta esperada (JSON):

```json
{"version":"v2.x.x","name":"GoTrue",...}
```

- [ ] Devolve JSON (não página HTML Apache)
- [ ] Se falhar: correr `scripts/fix-supabase-apache-proxy.sh` no servidor

---

### A4. Editar `.env` do Supabase Docker

Ficheiro típico: `/opt/supabase-aamihe/docker/.env`  
Referência: `deploy/supabase-oauth.env.template`

Confirmar **exactamente** estas linhas:

```env
SUPABASE_PUBLIC_URL=https://supabase.visualdesignmoz.com
API_EXTERNAL_URL=https://supabase.visualdesignmoz.com
SITE_URL=https://visualdesignmoz.com

ADDITIONAL_REDIRECT_URLS=https://visualdesignmoz.com/auth/callback,https://visualdesignmoz.com/auth/confirm,https://visualdesignmoz.com/auth/reset-password,https://www.visualdesignmoz.com/auth/callback

GOOGLE_ENABLED=true
GOOGLE_CLIENT_ID=423302530307-3hh69uum0mpn0rgsovhuhdrdhg049ld2.apps.googleusercontent.com
GOOGLE_SECRET=<copiar do Google Console → Credenciais → Client Secret>
```

**Atenção:**

- `GOOGLE_CLIENT_ID` = **igual** ao OAuth Client no Google Console (termina em `049ld2`)
- `GOOGLE_SECRET` = **sem espaços** no início/fim; copiar de novo se tiver dúvida
- Não confundir com `GOTRUE_EXTERNAL_GOOGLE_*` — no Docker Supabase recente usa `GOOGLE_*`

- [ ] `SITE_URL` = `https://visualdesignmoz.com`
- [ ] `ADDITIONAL_REDIRECT_URLS` inclui `/auth/callback`
- [ ] `GOOGLE_ENABLED=true`
- [ ] `GOOGLE_CLIENT_ID` correcto
- [ ] `GOOGLE_SECRET` actualizado (se regenerou no Google, actualizar aqui)

---

### A5. Reiniciar Supabase

```bash
cd /opt/supabase-aamihe/docker
docker compose down
docker compose up -d
```

Aguardar ~30 segundos.

- [ ] Reinício concluído sem erros
- [ ] `docker compose logs auth --tail 30` sem erros de Google/OAuth

---

### A6. Rede Docker (OAuth timeout 504)

Se o Google demorar e der **504** ou timeout:

```bash
bash /caminho/para/scripts/fix-docker-iptables-hetzner.sh
# ou no servidor:
systemctl start fix-docker-nat
```

- [ ] Regras iptables Docker OK (se já teve 504 antes)

---

## Parte B — Google Cloud Console (confirmar)

Já tem na imagem — só validar:

**Origens JavaScript:**

- [ ] `https://visualdesignmoz.com`
- [ ] `https://www.visualdesignmoz.com`
- [ ] `https://supabase.visualdesignmoz.com`

**Redirect URIs:**

- [ ] `https://supabase.visualdesignmoz.com/auth/v1/callback` ← **obrigatório**
- [ ] `https://visualdesignmoz.com/auth/callback` (opcional no Google, útil no Supabase)
- [ ] Clicou **Guardar** e esperou 1–2 minutos

**Credenciais:**

- [ ] Client ID termina em `...049ld2`
- [ ] Client Secret copiado para o `.env` do Supabase (passo A4)

---

## Parte C — Teste do fluxo OAuth

### C1. Teste técnico (opcional)

```bash
curl -sI "https://supabase.visualdesignmoz.com/auth/v1/authorize?provider=google" \
  -H "apikey: <ANON_KEY>" | grep -i location
```

- [ ] `Location:` aponta para `accounts.google.com` com `client_id=423302530307-...`

---

### C2. Teste real (utilizador)

1. Abrir **janela anónima** (Chrome)
2. Ir a `https://visualdesignmoz.com/auth/login`
3. Clicar no botão **Google**
4. Escolher conta Google
5. **Concluir** password/2FA — **não cancelar**
6. Deve voltar ao site e ir para `/guest` (visitante) ou `/client` / `/admin` conforme o papel

- [ ] Redireccionamento volta a `visualdesignmoz.com` (não fica em erro 401 Google)
- [ ] Utilizador fica logado (painel guest/cliente)

---

### C3. Se falhar — interpretar o erro

| Erro | Causa provável | Acção |
|------|----------------|-------|
| `redirect_uri_mismatch` | URI em falta no Google | Adicionar `.../auth/v1/callback` |
| `401 invalid_client` / malformed | Secret errado ou Client ID diferente | Repetir A4 com Secret novo |
| `Request canceled` | Utilizador cancelou no Google | Tentar de novo até ao fim |
| `504` / timeout | Docker sem internet | A6 — iptables |
| `callback_error` na app | Redirect URL não permitida no Supabase | Verificar `ADDITIONAL_REDIRECT_URLS` |
| HTML 404 no supabase.* | Apache não faz proxy ao Kong | `fix-supabase-apache-proxy.sh` |

---

## Parte D — App Vercel (confirmar)

No painel Vercel → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.visualdesignmoz.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<igual ao ANON_KEY do Docker>
```

- [ ] URL **não** aponta para `*.supabase.co` (cloud antigo)
- [ ] Redeploy feito após alterar variáveis (se mudou algo)

---

## Parte E — Enquanto o Google não funciona

Utilizadores **já registados** (ex.: Dulce):

| Campo | Valor |
|-------|--------|
| URL | `https://visualdesignmoz.com/auth/login` |
| Método | **Email + password** (não Google) |
| Papel inicial | `guest` → `/guest` |

Registo novo por email: `https://visualdesignmoz.com/auth/register` (sem confirmação de email).

---

## Ordem rápida (5 minutos)

1. SSH → `docker compose ps` (tudo Up)
2. `.env` → `GOOGLE_SECRET` + `SITE_URL` + `ADDITIONAL_REDIRECT_URLS`
3. `docker compose down && docker compose up -d`
4. Janela anónima → testar Google no login
5. Se OK → informar equipa; se não → ver tabela C3

---

## Quem faz o quê

| Tarefa | Quem |
|--------|------|
| Google Console (URIs) | Já feito por si |
| `.env` Supabase + reinício Docker | Admin servidor Hetzner |
| Vercel env vars | Admin deploy |
| Teste login Google | Qualquer pessoa com conta Google |
| Login email (Dulce, etc.) | Funciona independentemente do Google |

---

*Última actualização: 8 Jun 2026*
