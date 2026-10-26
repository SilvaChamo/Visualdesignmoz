# Estado do projecto — VisualDesign (auditoria de 22/10/2026, actualizado a 26/10/2026)

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
5. **Hetzner Object Storage (S3) — ainda em uso** (verificado a 22/10/2026): os sites **mltmark.com**, **oshercollective.com**, **lirandzojewelry.com** e
   **msdn-moz.org** têm no servidor os plugins `vd-hetzner-media-urls.php` e `s3-endpoint-fix.php`, que apontam as imagens para o balde
   `visualdesign-storage`. **aamihe.com e entrecamposblog.com não usam o balde** (ficheiros locais: 214 MB e 145 MB). Por isso a conta do Hetzner
   (só o armazenamento) tem de continuar activa e os scripts `deploy/wordpress/*hetzner*`, `deploy/wp-s3-only.sh` e `deploy/da-backup-to-s3.sh`
   ficam. Para cancelar de vez: copiar as imagens dos 4 sites para o Contabo e tirar esses plugins.
6. **PRs abertos** (26/10/2026): #180 (Next 16.1 → 16.4.3, corrige o alerta crítico do GitHub) e #181 (nodemailer 8 → 10, o transporte do Brevo) pedem
   teste antes de juntar; **#3 repõe o basededadosagro.com em `domain_renewals` (escrita na base de dados, só com o OK do Silva) — nunca fechar**.
7. **Quota do pacote `VD-Email-Basico` no Hestia** (o PR #105 só corrige o ficheiro do site).
8. **Gestores (`manager`)** nas rotas `/api/da` e `/api/server-exec`: bloqueados (seguro) mas incompletos; testar com conta real.
9. **Telemóvel**: ecrãs varridos a 320, 390, 980 e 1280 px (#191, 26/10/2026); falta a aprovação do Silva.
10. **Referências ao Hetzner**: restam comentários em `src/lib` e `src/app/api` a explicar os ramos DirectAdmin ainda no código. Só desaparecem
    removendo esses ramos (trabalho à parte).
11. **Bloqueio de login (26/10/2026)**: ligado no código (5 falhadas → 15 min, aviso numa linha). A tabela e as funções foram criadas na base de dados a
    26/10 (`scripts/migrate-login-rate-limit.sql`; testado: a 6.ª tentativa bloqueia 15 min e a chave pública não tem acesso). Falta publicar e confirmar
    em produção que o 6.º erro seguido devolve 429.
12. **Período de recuperação das renovações (26/10/2026)**: 30 dias depois do fim do prazo, com o serviço suspenso; o cliente é avisado no dia da
    suspensão, a meio e nos últimos dias (`src/lib/recuperacao-renovacao.ts`, chamado pelo cron `renewal-check`).
13. **DMARC do visualdesignmoz.com**: o registo duplicado de 24/07 foi apagado no Cloudflare a 26/10/2026 (fica um só, `p=none; fo=1`). Falta subir para
    `p=quarantine` depois de um e-mail de teste mostrar "DMARC: PASS" no Gmail (enviado a 26/10 pelo Brevo, entregue; falta o Silva ver o cabeçalho).
14. **`servidor@visualdesignmoz.com` não existe no servidor de e-mail** do Contabo ("550 Unrouteable address", também para qualquer endereço inexistente do
    domínio; `geral@` recebe bem). Os avisos de erro do site (`error-log.ts`) iam para essa caixa e perdiam-se (24 numa semana, bloqueados pelo Brevo): passaram para
    `SITE_NOTIFY_EMAIL` (geral@). Para voltar à caixa própria: criá-la no Hestia (`v-add-mail-account`), tirá-la da lista de bloqueados do Brevo e repor o destino.
15. **Quem só tem encomendas** (sem hospedagem nem domínio) fica no painel das encomendas, `/encomendas` (o painel antigo: adicionar, gerir, cancelar, eliminar), com
    uma faixa de publicidade de domínio, hospedagem e e-mail (`PromoProdutos`). `/guest` e o login levam para lá. Ao comprar só domínio passa para a vista compacta
    do vhost; hospedagem, para o painel do pacote.
16. **Menu "⋯" das páginas WordPress › "Mudar nome"** (26/10/2026): acrescentado (só muda o título; `wp-pagina-nome` em `api/vhost/avancado`). Ainda por testar num site
    WordPress real. Por ver no painel, com sessão: Elementor num site real, tabelas largas, indicação do domínio na Gestão e "Acção"/"Colunas" na lista de e-mail.
17. **Endereço antigo `host` (26/10/2026)**: a pasta interna do painel é agora `src/app/vhost`; `/host:2026` e afins só redireccionam (casos omissos). Falta correr o
    workflow `ops-nginx-porta-2026` (primeiro sem "aplicar", depois com) para o nginx da porta 2026 apontar a `/vhost:2026`.
18. **`servidor@visualdesignmoz.com`**: o Silva cria a caixa no Hestia; depois tirá-la da lista de bloqueados do Brevo (voltou lá por causa do bounce de 26/10) e enviar um
    e-mail de teste. Os avisos de erro do site continuam a ir para ela (`error-log.ts`).

## Credenciais que estiveram no código
Saíram do código (agora vêm do ambiente). Eram todas do tempo do Hetzner (chave `service_role` do Supabase antigo, MySQL e DirectAdmin do
Hetzner). O repositório é privado; decidido a 22/10/2026 não as mudar, para não afectar clientes.

## Arquivo
Notas e scripts antigos (Gmail/SMTP, DKIM, planos de 2026) estão em `docs/arquivo/` e `scripts/arquivo/`.
Auditoria de segurança do painel: `docs/AUDITORIA_PAINEL_PLANO_CORRECAO.md`.
