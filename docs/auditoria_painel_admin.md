# 🛡️ Relatório de Auditoria do Painel Admin

Este documento apresenta a análise técnica detalhada do painel de administração (`/admin`), identificando as funcionalidades que estão prontas e os pontos que necessitam de ajustes ou configurações adicionais.

---

## 1. 📧 Gestão de E-mails & Webmail
*Status: **Infraestrutura OK — experiência no painel em correcção***

### O que está pronto:
- **Sincronização de Contas**: Identificamos e corrigimos desalinhamentos críticos entre o banco de dados Supabase e a aplicação Next.js:
  - **Esquema do Banco**: A coluna da tabela `email_contas` estava com o nome legado `senha_cyberpanel`. Executamos a migração via console PostgreSQL do container no servidor remoto para renomeá-la para `senha_servidor` (alinhando com o código Next.js).
  - **PostgREST Cache**: O sinal `SIGUSR1` foi enviado ao container `supabase-rest` no servidor para atualizar o cache do esquema.
  - **Check Constraint**: A restrição no banco de dados que permitia apenas os tipos `'mailbox'`, `'forwarder'` e `'alias'` impedia que a aplicação gravasse o tipo `'webmail'`. A restrição foi removida com sucesso.
  - **População de Dados**: Executamos o script de população que extraiu todas as **10 contas de e-mail reais** do DirectAdmin e as inseriu com sucesso no Supabase.
- **Visualização de E-mails**: A leitura (`/api/read-emails`), detalhe (`/api/read-email-detail`) e envio (`/api/send-email`) estão totalmente operacionais usando o protocolo IMAP/SMTP com conexão direta ao IP do servidor Hetzner (resolvendo instabilidades de DNS/SSL).
- **Interface Webmail**: A UI do seletor em `/admin` (menu Email -> Webmail) agora exibe todas as 10 contas sincronizadas corretamente e permite o acesso às caixas de correio.

### O que falta configurar:
- [ ] **Timeout de Sincronização**: O endpoint de sincronização em lote (`/api/admin/sync-directadmin-users`) está demorando mais de 60 segundos porque tenta fazer SSH para checar SSL de cada domínio um por um. É necessário otimizar esse fluxo de forma assíncrona ou desativar o teste SSH bloqueante.
- [ ] **Sincronismo de Senhas**: Se o usuário trocar a senha da caixa postal direto no DirectAdmin, o painel do Supabase ficará dessincronizado. O painel deve forçar a sincronização de senhas.
- [ ] **Envio e recepção a funcionar de ponta a ponta** *(prioridade — comentário do utilizador)*:
  - **Envio (webmail)**: `WebmailSection` depende de `password_smtp` / `/api/email-senha` — sem senha correcta, IMAP e SMTP falham.
  - **Envio transaccional**: Brevo API/SMTP relay configurado em produção (`/api/check-smtp-config` → `brevoTransactional: true`).
  - **Recepção externa**: MX Brevo + webhook `POST /api/webhook/brevo-inbound` → inject na caixa no servidor. Exige MX por domínio (secção «Envio e Recepção») e webhook activo no painel Brevo.
  - **Verificar**: DNS MX/SPF, webhook Brevo, senhas em `email_contas.senha_servidor`, portas 587/993.

---

## 2. 🌐 Hospedagem & DirectAdmin API
*Status: **Parcialmente Pronto***

### O que está pronto:
- **Autenticação com a API**: A autenticação do DirectAdmin via `Basic Auth` está configurada no `.env.local`. O código resolve automaticamente o username `silva.chamo@gmail.com` para o usuário de API `admin` e autentica com sucesso utilizando a `DIRECTADMIN_LOGIN_KEY`.
- **Listagem de Sites**: O painel consegue listar os domínios do usuário principal através do comando `CMD_API_SHOW_USER_DOMAINS?user=admin` com sucesso.
- **SSH Fallback**: Caso a API HTTP do DirectAdmin falhe, o sistema possui uma ponte SSH (`da-ssh-proxy`) para executar comandos nativos no servidor remoto.

### O que falta configurar:
- [ ] **Tabela Clientes Legada**: A tabela `clientes` do banco de dados está vazia (os usuários reais do sistema ficam em `profiles`). A tabela `email_contas` tem uma chave estrangeira apontando para `clientes(id)`. Como bypass, populamos os e-mails com `cliente_id = null`. Recomenda-se remover ou alterar a chave estrangeira de `email_contas` para apontar para `profiles(id)` se a tabela `clientes` não for mais utilizada.

---

## 3. 💳 Registo de domínios (Spaceship)
*Status: **Parcialmente pronto** (não usar Porkbun — fornecedor actual: Spaceship)*

### O que está pronto:
- **Pesquisa de disponibilidade**: `/api/domain-check` usa o adaptador `spaceship-adapter.ts`.
- **UI no painel**: secção «Registar domínio» em `RegistrarDomainsSection` → `DomainSearch`, integrada no hub `DomainsHubSection` (tab «Registar»).
- **Listagem de domínios registados**: APIs em `/api/registrar/*` com listagem via Spaceship (`listAllDomains`, detalhes, lock, autorenew).
- **Credenciais**: `SPACESHIP_API_KEY` e `SPACESHIP_SECRET_KEY` no ambiente.

### O que falta configurar:
- [ ] **Registo na compra**: `/api/domain-register` ainda chama código legado Porkbun — migrar para Spaceship ou desactivar o botão «Registar» até o endpoint estar alinhado.
- [ ] **Disponibilidade real**: `checkAvailability` no adaptador está em modo simulado (delay + regra «indisponivel» no nome); ligar à API real `spaceship.dev` quando as chaves estiverem validadas.
- [ ] **Protecção de rotas**: confirmar que `domain-check` e `domain-register` exigem sessão admin/revendedor em produção.
- [ ] **Linguagem UI**: manter «Registar domínio» / «Domínios registados» — sem mencionar Porkbun nem Spaceship na interface.

### Nota (comentário do utilizador):
> Não há intenção de usar Porkbun. Toda a compra e gestão de domínios deve reflectir **Spaceship** apenas no backend; o painel mostra linguagem neutra («registador», «serviço de registo»).

---

## 4. 📝 Notificações, Renovação e Cobranças
*Status: **Pronto***

### O que está pronto:
- **Telas**: O módulo de notificações (`RenewalsSection.tsx` e `TemplatesSection.tsx`) está integrado à barra lateral e permite a criação de regras e templates de cobrança.
- **Envio**: Conector de e-mails via SMTP para avisos automáticos aos clientes sobre renovações.

---

## 5. 🛠️ Painel WordPress
*Status: **Pronto***

### O que está pronto:
- **Painel Central**: O `WordPressHubSection.tsx` gerencia os sites ativos e permite instalar novos, gerir plugins e criar backups.
- **Ações Rápidas**: Possibilidade de emitir certificados SSL, acessar gerenciador de arquivos e bases de dados diretamente da listagem de sites WordPress.

---

## 🚀 Recomendações Prioritárias

1. **Ajuste da Foreign Key**: Alterar a restrição de chave estrangeira de `email_contas.cliente_id` para apontar para `profiles(id)` e remover a tabela vazia `clientes` para evitar confusão de dados.
2. **Registo Spaceship**: Migrar `/api/domain-register` de Porkbun para Spaceship; activar `checkAvailability` real na API.
3. **Otimização da Sync**: Remover o loop de requisições SSH por domínio no endpoint `/api/admin/sync-directadmin-users` para evitar travamento da requisição Next.js por timeout.
4. **Email ponta a ponta**: Garantir senhas no webmail, MX Brevo por domínio, webhook inbound e testes de envio/recepção no painel.
