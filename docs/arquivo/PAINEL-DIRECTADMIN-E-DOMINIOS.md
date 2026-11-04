# Painel: DirectAdmin (acesso + Vercel) e domínios (Spaceship)

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
| `DIRECTADMIN_FALLBACK_HOST` ou `NEXT_PUBLIC_DIRECTADMIN_FALLBACK_HOST` | IP do servidor (`169.58.148.144`, o Contabo) |
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

## 2. Compra de domínios — Spaceship

A integração de domínios usa exclusivamente a API da **Spaceship** (`src/lib/spaceship-adapter.ts`), chamada por `src/app/api/domain-check/route.ts` e `src/app/api/domain-register/route.ts`. Não há nenhuma integração com a Porkbun no código — foi completamente removida (2026-08-04), incluindo referências no menu admin e na documentação, na sequência de uma chave de API da Porkbun encontrada exposta em scripts de debug antigos.

---

## 3. Checklist rápido antes de ir a produção

- [ ] Vercel: todas as variáveis DirectAdmin + fallback conforme secção 1  
- [ ] Vercel: variáveis `SPACESHIP_*` correctas  
- [ ] Redeploy  
- [ ] Testar no browser: `https://host.visualdesignmoz.com:2026`  
- [ ] Testar: `GET /api/directadmin-access` (deve redirecionar para DA ou fallback)  
- [ ] Spaceship: testar POST `/api/domain-check` com domínio inventado + TLD

---

*Última actualização: referência interna do repositório `visualdesign`.*
