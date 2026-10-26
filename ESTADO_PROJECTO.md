# Estado do projecto — VisualDesign (auditoria de 22/10/2026)

## Em produção
- Site e painel no **Contabo** (Hestia), publicados por cada merge em `main`. Hetzner (servidor) desligado.
- Supabase próprio no Contabo. CI: últimos deploys todos verdes. Traduções: 0 textos sem inglês.
- Segurança do servidor: SSH na 2234, FTP e painel do Hestia fechados, bloqueio no nginx, guarda de sites, 2 passos opcional.

## Falta para fechar (por ordem)
1. **M-Pesa em sandbox** — pendente da Vodacom; mensagem pronta em `docs/mpesa-pedido-vodacom.md`.
2. **Troca do endereço do Supabase** (`supabase-contabo…` → `supabase…`): ver "TAREFA AGENDADA" em `regras.md`.
3. ~~Fechar a porta 22 do SSH~~ — **já está fechada** (verificado a 22/10/2026 por leitura autorizada: o servidor só escuta na 2234 e o firewall
   só tem regras para a 2234).
4. **Segredo `CONTABO_ROOT_PASSWORD`** do GitHub: já nenhum workflow o usa (passaram à chave SSH, 22/10/2026). Falta só apagá-lo nos
   secrets do GitHub (Settings › Secrets) depois de o PR ser publicado e um dos workflows de manutenção correr bem.
5. **Hetzner Object Storage (S3) — os sites já não o usam** (verificado e migrado a 26/10/2026 pelo workflow `ops-balde-hetzner.yml`): nenhum dos
   `wp-config` tem a configuração do balde, a base de dados não tem nenhum URL do balde e o servidor já não tem chaves dele (`rclone.conf` não existe).
   O único site que ainda chamava o balde era **oshercollective.com** (3 imagens do Offload Media e as miniaturas): os 14 ficheiros foram trazidos
   para `wp-content/uploads`, o Offload Media foi desactivado e os plugins `s3-endpoint-fix.php` e `vd-hetzner-media-urls.php` foram postos de lado em
   `/root/balde-hetzner-troca/<domínio>-<data>/` nos 4 sites (mltmark, oshercollective, lirandzojewelry, msdn-moz), com os comandos para desfazer no registo
   da corrida. **Falta antes de cancelar a conta do Hetzner:** o servidor não tem chaves do balde, por isso não se consegue listar o que mais lá está
   (ficheiros que nenhum site referencia, o balde de backups do DirectAdmin de `da-backup-to-s3.sh`). Ver no painel do Hetzner o tamanho de cada balde e,
   se houver mais do que estes sites, criar chaves só de leitura, guardá-las como segredos do GitHub e correr a fase `copiar`. Os scripts
   `deploy/wordpress/*hetzner*`, `deploy/wp-s3-only.sh` e `deploy/da-backup-to-s3.sh` podem sair do repositório depois disso.
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
