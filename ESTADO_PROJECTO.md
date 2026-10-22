# Estado do projecto — VisualDesign (auditoria de 22/10/2026)

## Em produção
- Site e painel no **Contabo** (Hestia), publicados por cada merge em `main`. Hetzner (servidor) desligado.
- Supabase próprio no Contabo. CI: últimos deploys todos verdes. Traduções: 0 textos sem inglês.
- Segurança do servidor: SSH na 2234, FTP e painel do Hestia fechados, bloqueio no nginx, guarda de sites, 2 passos opcional.

## Falta para fechar (por ordem)
1. **M-Pesa em sandbox** — pendente da Vodacom; mensagem pronta em `docs/mpesa-pedido-vodacom.md`.
2. **Troca do endereço do Supabase** (`supabase-contabo…` → `supabase…`): ver "TAREFA AGENDADA" em `regras.md`.
3. **Fechar a porta 22 do SSH** (código e workflows já usam a 2234; falta fechar no servidor e confirmar de fora).
4. **Segredo `CONTABO_ROOT_PASSWORD`** do GitHub: já nenhum workflow o usa (passaram à chave SSH, 22/10/2026). Falta só apagá-lo nos
   secrets do GitHub (Settings › Secrets) depois de o PR ser publicado e um dos workflows de manutenção correr bem.
5. **Hetzner Object Storage (S3)**: `deploy/wordpress/*hetzner*`, `deploy/wp-s3-only.sh` e `deploy/da-backup-to-s3.sh` falam do armazenamento de
   ficheiros do Hetzner (não do servidor). Confirmar se as imagens dos sites WordPress e as cópias ainda estão lá antes de o fechar.
6. **PRs antigos**: #95, #113, #106, #105 (juntar ou fechar); #28 e #3 são do Hetzner (fechar).
7. **Quota do pacote `VD-Email-Basico` no Hestia** (o PR #105 só corrige o ficheiro do site).
8. **Gestores (`manager`)** nas rotas `/api/da` e `/api/server-exec`: bloqueados (seguro) mas incompletos; testar com conta real.
9. **Telemóvel (390 px)**: aprovação do Silva e varredura a 320 px.
10. **Referências ao Hetzner**: restam comentários em `src/lib` e `src/app/api` a explicar os ramos DirectAdmin ainda no código. Só desaparecem
    removendo esses ramos (trabalho à parte).

## Credenciais que estiveram no código
Saíram do código (agora vêm do ambiente). Eram todas do tempo do Hetzner (chave `service_role` do Supabase antigo, MySQL e DirectAdmin do
Hetzner). O repositório é privado; decidido a 22/10/2026 não as mudar, para não afectar clientes.

## Arquivo
Notas e scripts antigos (Gmail/SMTP, DKIM, planos de 2026) estão em `docs/arquivo/` e `scripts/arquivo/`.
Auditoria de segurança do painel: `AUDITORIA_PAINEL_PLANO_CORRECAO.md`.
