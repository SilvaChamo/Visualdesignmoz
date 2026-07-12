# Painel: DirectAdmin (acesso + Vercel) e domínios (Porkbun)

Documento de referência para próximas sessões. Projeto: `visualdesign` (Next.js).

---

## 1. DirectAdmin — URL principal e fallback automático

### URL canónica (recomendada)

- **Painel:** `https://host.visualdesignmoz.com:2026`
- **Não usar:** `host.visualdesignmoz.2026.com` (formato incorreto).

### Comportamento no código

- Existe o endpoint **`/api/directadmin-access`**: tenta primeiro o host/porta públicos; se a ligação TCP falhar, redireciona (307) para o **fallback** (por defeito IP + porta legada em HTTP).
- Os botões do admin que abrem o DirectAdmin devem usar **`getDirectAdminAccessUrl()`** (em `src/lib/server-config.ts`), não o URL cru, para beneficiar deste fallback.

### Variáveis na Vercel (Production e Preview)

**Obrigatórias para o painel e APIs server-side:**

| Variável | Valor típico |
|----------|----------------|
| `NEXT_PUBLIC_DIRECTADMIN_HOST` | `host.visualdesignmoz.com` |
| `NEXT_PUBLIC_DIRECTADMIN_PORT` | `2026` |
| `DIRECTADMIN_HOST` | `host.visualdesignmoz.com` |
| `DIRECTADMIN_PORT` | `2026` |
| `DIRECTADMIN_PROTOCOL` | `https` |
| `DIRECTADMIN_USER` | `admin` |
| `DIRECTADMIN_PASSWORD` ou `DIRECTADMIN_PASS` | credencial válida |

**Opcional — URL explícita (se usar, deve apontar para o host novo):**

- `DIRECTADMIN_URL` → `https://host.visualdesignmoz.com:2026`

**Fallback quando o domínio HTTPS:2026 não responde:**

| Variável | Valor típico |
|----------|----------------|
| `DIRECTADMIN_FALLBACK_HOST` ou `NEXT_PUBLIC_DIRECTADMIN_FALLBACK_HOST` | IP do servidor (ex.: `37.27.17.25`) |
| `DIRECTADMIN_FALLBACK_PORT` ou `NEXT_PUBLIC_DIRECTADMIN_FALLBACK_PORT` | `2222` (ou a porta onde o DA responde no IP) |
| `DIRECTADMIN_FALLBACK_PROTOCOL` ou `NEXT_PUBLIC_DIRECTADMIN_FALLBACK_PROTOCOL` | `http` se no IP não houver SSL válido; `https` se já existir certificado |

Após alterar variáveis: **redeploy** na Vercel.

### SSL no hostname (objetivo: desligar dependência do IP)

1. DNS: registo **A** de `host.visualdesignmoz.com` → IP do servidor.
2. No DirectAdmin (nível admin): emitir certificado **Let’s Encrypt** para o hostname do painel (conforme a tua build do DA).
3. Se necessário no servidor (exemplo genérico; caminhos podem variar):

   ```bash
   sudo /usr/local/directadmin/scripts/letsencrypt.sh request_single host.visualdesignmoz.com 4096
   sudo systemctl restart directadmin
   ```

4. Quando HTTPS no domínio estiver estável, podes manter o fallback só como rede de segurança ou remover variáveis de fallback.

### Quem ainda usa links antigos (`painel.visualdesigne.com`, etc.)

Redirecionamento de bookmarks antigos é **DNS / proxy / servidor** (fora do Next.js), a não ser que cries uma rota específica no teu domínio antigo. O código normaliza vários hosts legados quando constrói URLs a partir de env.

---

## 2. Compra de domínios — Porkbun (o que já existe no código)

### Ficheiros principais

| Ficheiro | Função |
|----------|--------|
| `src/lib/porkbun-adapter.ts` | Cliente API v3: `checkAvailability`, `registerDomain`, `updateNameservers`, `getDomainDetails` |
| `src/app/api/domain-check/route.ts` | POST: verifica disponibilidade (corpo JSON: `domain`, opcional `tld`) |
| `src/app/api/domain-register/route.ts` | POST: registo (corpo JSON: `domain`; aceita `years` mas **não** é passado ao adapter) |
| `src/components/DomainSearch.tsx` | UI: chama `/api/domain-check` e, se `isAdmin`, `/api/domain-register` |
| `src/app/admin/PorkbunResellerSection.tsx` | Wrapper admin em volta de `DomainSearch` |

### Variáveis de ambiente (Porkbun)

- `PORKBUN_API_KEY`
- `PORKBUN_SECRET_KEY`

Sem estas chaves na Vercel, check e register devolvem erro genérico.

### Problemas / melhorias para a ligação ser efetiva

1. **`registerDomain` incompleto face à API Porkbun**  
   O adapter envia apenas `apikey` e `secretapikey`. A API de registo da Porkbun normalmente exige também (conforme documentação atual): período (`years`), servidores DNS (`ns`), e **dados de contacto do registrador** (nome, morada, email, telefone, país, etc.). Sem isso, o registo falha ou fica inconsistente.

2. **Preço hardcoded**  
   Em `domain-check`, o preço devolvido pode ser estimativa (`10.37` USD); não vem da API de pricing da Porkbun.

3. **`PorkbunResellerSection` não está ligado ao menu admin**  
   O componente existe mas **não** está importado/renderizado em `src/app/admin/page.tsx` (ou equivalente). Para o painel admin “comprar domínios”, é preciso acrescentar uma secção/menu que renderize `PorkbunResellerSection`.

4. **Segurança nas rotas API (estado actual)**  
   `src/app/api/domain-check/route.ts` e `src/app/api/domain-register/route.ts` **não** aplicam hoje `requireAdminOrReseller` (ou equivalente): qualquer cliente que saiba o URL pode chamar estas rotas se as chaves Porkbun estiverem no servidor. Para produção, **é obrigatório** proteger pelo menos `domain-register` (e idealmente também `domain-check` com rate limit).

5. **Resposta `register` sem tratamento de texto não-JSON**  
   `checkAvailability` já faz `response.text()` + parse seguro; `registerDomain` usa `response.json()` direto — em caso de HTML/erro de rede, pode rebentar.

6. **Pós-registo**  
   Falta fluxo opcional: atualizar NS para o teu servidor, criar zona no DirectAdmin, ou gravar o domínio no Supabase para o cliente.

### Referência oficial

- Documentação API v3: `https://porkbun.com/api/json/v3/documentation`
- OpenAPI: `https://porkbun.com/api/json/v3/spec`

---

## 3. Checklist rápido antes de ir a produção

- [ ] Vercel: todas as variáveis DirectAdmin + fallback conforme secção 1  
- [ ] Vercel: `PORKBUN_*` sem espaços e com permissões corretas na conta Porkbun  
- [ ] Redeploy  
- [ ] Testar no browser: `https://host.visualdesignmoz.com:2026`  
- [ ] Testar: `GET /api/directadmin-access` (deve redirecionar para DA ou fallback)  
- [ ] Porkbun: testar POST `/api/domain-check` com domínio inventado + TLD  
- [ ] Porkbun: só activar registo em massa após `registerDomain` enviar payload completo e auth no servidor

---

*Última actualização: referência interna do repositório `visualdesign`.*
