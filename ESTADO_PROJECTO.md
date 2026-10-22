# Estado do projecto — VisualDesign (auditoria de 22/10/2026)

## Em produção
- Site e painel no **Contabo** (Hestia), publicados por cada merge em `main`. Hetzner desligado.
- Supabase próprio no Contabo. CI: últimos deploys todos verdes. Traduções: 0 textos sem inglês.
- Segurança do servidor: SSH na 2234, FTP e painel do Hestia fechados, bloqueio no nginx, guarda de sites, 2 passos opcional.

## Falta para fechar (por ordem)
1. **M-Pesa em sandbox** (`MPESA_ENV` no workflow de deploy). Passar a produção só com confirmação do Silva (dinheiro real).
2. **Rodar as credenciais que estiveram no código**: chave `service_role` do Supabase, palavra-passe MySQL do entrecampos,
   token do warm-up, palavra-passe de chave do DirectAdmin. Já saíram do código mas continuam no histórico do Git.
3. **Troca do endereço do Supabase** (`supabase-contabo…` → `supabase…`): ver "TAREFA AGENDADA" em `regras.md`.
4. **Fechar a porta 22 do SSH** (os workflows já usam a 2234).
5. **PRs antigos** por decidir: #95, #113, #106, #105 (juntar ou fechar); #28 e #3 são do Hetzner (fechar).
6. **Quota do pacote `VD-Email-Basico` no Hestia** (o PR #105 só corrige o ficheiro do site).
7. **Gestores (`manager`)** nas rotas `/api/da` e `/api/server-exec`: bloqueados (seguro) mas incompletos; testar com conta real.
8. **Telemóvel (390 px)**: aprovação do Silva e varredura a 320 px.

## Arquivo
Notas e scripts antigos (Gmail/SMTP, DKIM, planos de 2026) estão em `docs/arquivo/` e `scripts/arquivo/`.
Auditoria de segurança do painel: `AUDITORIA_PAINEL_PLANO_CORRECAO.md`.
