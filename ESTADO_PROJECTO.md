# Estado do projecto — VisualDesign (auditoria de 04/11/2026)

> Feita contra a realidade: código de `main` (`cf816015`), site em produção, DNS, GitHub e sondas ao servidor. Substitui os relatórios
> anteriores, que ficam em `docs/arquivo/` só como história. O servidor antigo já está fechado e nada depende dele.

## Verificado hoje — está fechado
- `tsc` limpo, `npm test` 10/10, `eslint` 0 erros, `npm audit` (produção) 0 vulnerabilidades, deploys todos verdes, vigilância externa a cada 15 min.
- `visualdesignmoz.com`, `basededadosagro.com`, `entrecamposblog.com`, `mltmark.com`, webmail e Supabase respondem; certificados até dezembro de 2026 ou mais; cabeçalhos de segurança no ar.
- Rotas de API protegidas (`get-all-contacts`, `migrate-contacts` já com autenticação); Supabase no endereço próprio; verificação em PR e Dependabot activos.
- Traduções: site e painel com 0 textos sem inglês; português de Portugal nos textos visíveis; IVA nas compras do carrinho.
- DMARC em `quarantine; pct=100` nos domínios do servidor; o padrão de domínios novos ou reprocessados passou a ser o mesmo.
- **SSH fechado a 04/11/2026**: a porta 2234 só aceita chave (`passwordauthentication no`, `permitrootlogin without-password`), com a prova de uma ligação nova por chave; os workflows e a aplicação usam chave. `entrecamposblog.com` já está com o DMARC a 100 %.
- Código: 0 erros de `tsc` e de `eslint`; 118 imports sem uso retirados (935 → 817 avisos); nenhum ficheiro sem referência em `src`.

## Em aberto — só depende do Silva (nada a programar)
1. **M-Pesa em `sandbox`** (a operadora ainda não deu as chaves reais). O webhook M-Pesa só aceita pedidos com `MPESA_WEBHOOK_SECRET`; sem segredo fica desligado.
2. **Stripe**: confirmar no painel da Stripe se as chaves são de teste ou reais.
3. **Texto legal** (Privacidade e Termos): falta a identificação do responsável (NUIT, morada) e a menção a cookies.
4. **Facturação**: certificação AT/SAF-T e factura-recibo, decisão com o contabilista.
5. **Cópias fora do servidor**: o envio diário para o R2 está instalado; falta guardar a palavra-passe de cifra num gestor de palavras-passe.
6. **Pull request #3** (repõe o `basededadosagro.com` em `domain_renewals`): fica aberto até o Silva dar o OK. **Nunca fechar.**

## Nomes «DA» no código — fechado, não é alerta (Silva, 04/11/2026)
Os nomes `da-*` do painel VisualHost (classes de estilo como `da-card`, as tabelas de equivalência «DA» do menu, o módulo `da-sync`) são nomes
herdados do modelo do DirectAdmin: **são só nomes**. Há também código antigo que sabe falar com um DirectAdmin de verdade, mas está **desligado**:
`DEFAULT_HOSTING_PROVIDER=hestia` faz tudo ler e escrever no servidor actual (ex.: o login por nome de utilizador só chega ao ramo do DirectAdmin
quando `isHestiaOnlyDeploy()` é falso). Fica como está. Único ponto a não apagar: `DIRECTADMIN_HOST` ainda dá o nome do servidor de correio.

## Lixo — ver `docs/ramos-para-apagar-*.md` e o relatório de 04/11/2026
Ramos já fundidos em `main` por apagar; `public/cloned`, os SVG de demonstração do Next.js e scripts SQL de depuração foram apagados a 04/11/2026
(tudo recuperável pelo histórico do Git).
