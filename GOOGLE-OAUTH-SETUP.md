# Corrigir Google Login — Erro redirect_uri_mismatch

## O que significa

O Google rejeita o login porque o **Redirect URI** que o Supabase Hetzner envia **não está registado** no Google Cloud Console.

O Supabase Hetzner envia **sempre** este URI (copiar exactamente):

```
https://supabase.visualdesignmoz.com/auth/v1/callback
```

**Client ID actual (VisualDesign):**
```
423302530307-3hh69uum0mpn0rgsovhuhdrdhg049ld2.apps.googleusercontent.com
```
(atenção: `dr**d**hg` — um `d` a mais que a versão antiga errada `drhg`)

---

## Passos no Google Cloud Console (5 minutos)

1. Abrir: https://console.cloud.google.com/apis/credentials
2. Seleccionar o projecto da **VisualDesign** (ou onde criou o OAuth)
3. Clicar no OAuth 2.0 Client ID que termina em `...049ld2` (client `423302530307`)
4. Em **Authorized redirect URIs**, clicar **+ ADD URI** e adicionar:

   ```
   https://supabase.visualdesignmoz.com/auth/v1/callback
   ```

5. Em **Authorized JavaScript origins**, confirmar que existem (adicionar se faltar):

   ```
   https://visualdesignmoz.com
   https://www.visualdesignmoz.com
   https://supabase.visualdesignmoz.com
   ```

6. Clicar **SAVE**
7. Aguardar **1–2 minutos** (propagação Google)
8. Testar login em janela anónima: https://visualdesignmoz.com/auth/login

---

## URIs antigos (pode manter ou remover)

Se migrou do Supabase Cloud, pode existir:

```
https://gwankhxcbkrtgxopbxwd.supabase.co/auth/v1/callback
```

Pode **manter** (não interfere) ou remover se já não usa cloud.

---

## Verificar no ecrã de erro do Google

No link **"Saiba mais sobre este erro"** → **"detalhes do erro"**, o Google mostra:

- `redirect_uri=` → deve ser `https://supabase.visualdesignmoz.com/auth/v1/callback`
- Se for diferente, copie esse valor e adicione-o no Console

---

## Depois de guardar no Google

Não é preciso redeploy. Só testar de novo o botão Google no login.

---

## Erro `401: invalid_client` ou API Supabase em 404/503

**Causa:** `supabase.visualdesignmoz.com` estava a servir ficheiros estáticos (Apache) em vez do Kong Docker (`:8000`).

**Correcção no servidor Hetzner:**
```bash
ssh -i ~/.ssh/visualdesign_hetzner -p 2234 root@37.27.17.25
bash /caminho/para/scripts/fix-supabase-apache-proxy.sh
systemctl restart docker && bash /usr/local/bin/fix-docker-nat.sh
cd /opt/supabase-aamihe/docker && docker compose up -d
```

**Verificar:** `curl https://supabase.visualdesignmoz.com/auth/v1/health` deve devolver JSON (não HTML 404).

No `.env` Supabase Docker: `SITE_URL=https://visualdesignmoz.com` e `GOOGLE_CLIENT_ID` igual ao Google Console.
