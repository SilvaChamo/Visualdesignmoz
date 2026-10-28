# VisualDesign

Site e painel de gestão (VisualHost) da VisualDesign: domínios, hospedagem, e-mail, encomendas e contabilidade.
Next.js 16 (App Router) + TypeScript + Supabase (próprio, no servidor do projecto) + Hestia (painel de alojamento).

> **O Hetzner já está fechado** (servidor desligado a 19/10/2026; só falta cancelar a conta do balde de ficheiros). Nada neste projecto depende dele:
> não usar, não trazer nada de lá e não propor nem fazer alterações para ele. O único servidor é o do projecto; fala-se sempre "o servidor", sem nomear o fornecedor.

- Site: https://visualdesignmoz.com
- Painel: https://visualdesignmoz.com/vhost:2026

## Regras de trabalho

Ler `regras.md` (valem para qualquer pessoa ou IA). Resumo: trabalha-se num ramo, nunca em `main`; só se publica
quando o Silva disser "publica"; tudo em português; texto novo no site entra já traduzido (`npm run i18n` = 0 em falta).

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:3003 (pré-visualização: /dev-preview-telemovel)
npm run i18n     # tem de dar 0 textos sem inglês
npm run i18n:painel  # idem, para o painel
npm run lint     # só os erros travam (npm run lint -- --quiet)
npm test         # testes unitários
npm run build
```

Variáveis de ambiente: nunca no código. Modelo em `deploy/env.production.template`; em produção são escritas pelo
workflow de deploy a partir dos secrets do GitHub.

## Publicação

Cada merge em `main` publica no servidor (`.github/workflows/deploy-visualdesign.yml`, SSH pela porta 2234). Não há outro deploy.

## Onde está o quê

| Pasta / ficheiro | Para quê |
|---|---|
| `src/app`, `src/components`, `src/lib` | Aplicação |
| `src/components/vhost` | Painel VisualHost |
| `deploy/`, `deploy/seguranca/` | Scripts instalados no servidor |
| `scripts/` | Cron, migrações SQL e utilitários (`scripts/arquivo/` = diagnósticos antigos de e-mail) |
| `supabase-*.sql` (raiz) | Esquema da base de dados (o deploy usa `supabase-vhost-activity-history.sql`) |
| `docs/` | Documentação (`docs/arquivo/` = notas antigas) |
| `ESTADO_PROJECTO.md` | O que está feito e o que falta |
