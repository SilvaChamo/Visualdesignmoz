# Briefing do Projeto: VisualDesign App

**Última Atualização:** 18 de Março de 2026

Este documento serve como um guia completo para qualquer programador ou agente de IA que trabalhe neste projeto. O objetivo é fornecer todo o contexto necessário sobre a arquitetura, funcionalidades e estado atual da aplicação.

---

## 1. Visão Geral do Projeto

-   **Nome:** Aplicação de Gestão VisualDesign.
-   **Propósito:** Uma plataforma dupla que serve como (1) um **Painel de Administração** para a VisualDesign gerir clientes e serviços de alojamento e (2) um **Painel de Cliente** para os utilizadores finais gerirem os seus próprios serviços. A aplicação automatiza a gestão de um servidor de alojamento que corre **CyberPanel**.
-   **Público-Alvo:**
    -   **Administradores:** Equipa da VisualDesign que precisa de uma interface centralizada para gerir o servidor.
    -   **Clientes:** Clientes da VisualDesign que contrataram serviços de alojamento.
-   **Stack Tecnológica:**
    -   **Framework Frontend:** Next.js 14+ (com App Router)
    -   **Linguagem:** TypeScript
    -   **Base de Dados & Autenticação:** Supabase (PostgreSQL + Auth)
    -   **UI/Componentes:** React, Tailwind CSS, `lucide-react` para ícones.
    -   **Serviços Externos (Infraestrutura):**
        -   **Servidor:** VPS da Contabo
        -   **Painel de Controlo do Servidor:** CyberPanel
        -   **Servidor Web:** OpenLiteSpeed
        -   **Gestor de Processos:** PM2 (para correr a aplicação Next.js)
-   **URLs:**
    -   **Produção:** `https://visualdesignmoz.com`
    -   **Painel de Administração:** `https://visualdesignmoz.com/admin`
    -   **Painel de Cliente:** `https://visualdesignmoz.com/dashboard`
    -   **Acesso Direto ao CyberPanel:** `https://109.199.104.22:8090`

---

## 2. Arquitetura

A aplicação segue um padrão **Backend-for-Frontend (BFF)**, onde o frontend (Next.js) não comunica diretamente com serviços críticos como o CyberPanel.

### Estrutura de Pastas

-   `src/app/`: Contém as rotas principais da aplicação (App Router).
    -   `admin/`: Ecrãs e lógica exclusivos do painel de administração.
    -   `dashboard/`: Ecrãs e lógica do painel do cliente.
    -   `api/`: Rotas de API que funcionam como o "backend". A rota mais importante é `api/server-exec/`, que atua como um proxy seguro para o CyberPanel.
    -   `auth/`: Lógica de autenticação, incluindo a página de login e a rota de callback do Supabase.
-   `src/components/`: Componentes React reutilizáveis, partilhados entre os painéis.
-   `src/lib/`: Lógica de negócio e clientes de API.
    -   `cyberpanel-api.ts`: **Ficheiro Crítico.** Cliente de API para interagir com o CyberPanel. Abstrai todas as chamadas, quer sejam para a API oficial do CyberPanel ou comandos de shell diretos.
    -   `supabase.ts`: Cliente Supabase para o lado do cliente.
    -   `cache-service.ts`: Um serviço de cache em memória simples para otimizar chamadas repetidas à API do CyberPanel.
-   `src/utils/`: Utilitários, incluindo os helpers do Supabase para o lado do servidor.
-   `deploy/`: Scripts relacionados com o deploy, como `trigger-deploy.sh` que dispara um workflow no GitHub Actions.

### Comunicação e Serviços Externos

1.  **Frontend -> BFF (API Routes):**
    -   O frontend (ex: `src/app/admin/page.tsx`) nunca chama o CyberPanel diretamente. Em vez disso, importa e usa funções do `cyberpanel-api.ts`.
    -   Estas funções fazem um `fetch` para a rota interna `/api/server-exec`.

2.  **BFF -> CyberPanel:**
    -   A rota `/api/server-exec` (código no lado do servidor) recebe os pedidos do frontend.
    -   É aqui que a lógica de comunicação com o CyberPanel é executada. **Decisão Técnica Importante:** Esta comunicação é híbrida:
        -   Usa endpoints da API oficial do CyberPanel para algumas ações (`listWebsites`, `createWebsite`).
        -   Executa **comandos de shell diretos** no servidor para a maioria das outras ações (ex: `cmd('cyberpanel changePHP ...')`). Isto torna a aplicação muito dependente da estrutura de ficheiros e dos comandos disponíveis no servidor Contabo.
    -   As credenciais do CyberPanel estão armazenadas de forma segura no servidor como variáveis de ambiente e são usadas apenas por esta rota de API.

3.  **Supabase:**
    -   **Autenticação:** Usa o provider de OAuth do Supabase. O fluxo é gerido pelos helpers do Supabase (`@supabase/ssr`).
    -   **Base de Dados:** As operações de leitura e escrita na base de dados (ex: gestão de clientes) são feitas através do cliente Supabase, utilizando o URL do projeto e a `anon key`. A segurança é garantida pelas Row Level Security (RLS) policies na base de dados.

---

## 3. Funcionalidades Implementadas

-   **Painel de Administração (`/admin`)**
    -   **O que faz:** Interface completa para gestão de websites, pacotes, utilizadores, backups, DNS, SSL, e clientes.
    -   **Ficheiros:** `src/app/admin/page.tsx`, `src/app/admin/CyberPanelSections.tsx`.
    -   **Estado:** **Parcialmente Funcional.** A UI está muito bem desenvolvida e a maioria das chamadas à API está implementada. No entanto, precisa de validação end-to-end para confirmar que todos os dados são carregados e as ações funcionam como esperado em produção.

-   **Gestão de Websites (Admin)**
    -   **O que faz:** Listar, criar, apagar, suspender/reativar, emitir SSL e fazer backup de websites no CyberPanel.
    -   **Ficheiros:** `ListWebsitesSection` e `CreateWebsiteSection` em `src/app/admin/page.tsx`, `cyberpanel-api.ts`.
    -   **Estado:** **Funcional.** A lógica principal está implementada.

-   **Webmail (Cliente)**
    -   **O que faz:** Interface de webmail para ler, enviar, apagar, arquivar e marcar emails como spam.
    -   **Ficheiros:** `src/components/dashboard/EmailWebmailSection.tsx`, `src/app/api/send-email/route.ts`, `src/app/api/delete-email/route.ts`.
    -   **Estado:** **Funcional.** As operações de apagar, arquivar e spam usam atualizações otimistas da UI (filtram a lista localmente sem recarregar tudo). O envio de email tem proteção contra duplicados (idempotency key) e a operação de apagar move os emails para a lixeira de forma segura.

-   **Gestão de Clientes (Admin)**
    -   **O que faz:** Listar e criar novos clientes na tabela `clientes` do Supabase.
    -   **Ficheiros:** `ClientesSection` em `src/app/admin/page.tsx`.
    -   **Estado:** **Funcional.** Usa a API REST do Supabase diretamente.

-   **Autenticação de Utilizadores**
    -   **O que faz:** Permite o login de administradores e clientes via Supabase Auth.
    -   **Ficheiros:** `src/app/auth/**`, `src/lib/supabase.ts`, `src/utils/supabase/server.ts`.
    -   **Estado:** **Parcialmente Funcional.** A estrutura está montada, mas de acordo com `ESTADO_PROJECTO.md`, o fluxo completo precisa de ser validado, incluindo as regras de acesso (RLS) para cada tipo de utilizador.

---

## 4. Bugs Conhecidos e Pendentes

-   **Bug 1 (Validação de Auth)**
    -   **Descrição:** O fluxo de autenticação e as regras de segurança (RLS) do Supabase para distinguir `admin` de `cliente` não foram testadas de ponta a ponta.
    -   **Ficheiros:** `src/app/client/page.tsx`, `src/app/dashboard/**`, tabelas do Supabase.
    -   **Severidade:** **Crítico.**

-   **Bug 2 (Dados Mock no Painel Cliente)**
    -   **Descrição:** O painel principal do cliente (`/client`) está a usar um objeto de dados estático (`cliente`) para popular toda a UI. Nenhuma chamada à API do Supabase para obter dados reais do cliente autenticado está a ser feita.
    -   **Ficheiros:** `src/app/client/page.tsx`.
    -   **Severidade:** **Alto.**

-   **Bug 3 (Credenciais Hardcoded)**
    -   **Descrição:** Existem múltiplas credenciais (passwords de email/SMTP) hardcoded diretamente no código-fonte, representando um risco de segurança crítico.
    -   **Ficheiros:** `src/components/dashboard/EmailWebmailSection.tsx`, `src/app/api/send-email/route.ts`.
    -   **Severidade:** **Crítico.**

-   **Bug 4 (Delete em Massa Ineficiente)**
    -   **Descrição:** A funcionalidade de apagar emails em massa no webmail executa um pedido à API para cada email selecionado de forma sequencial, em vez de um único pedido em batch. Isto é ineficiente e lento para grandes seleções.
    -   **Ficheiros:** `src/components/dashboard/EmailWebmailSection.tsx` (aproximadamente L891).
    -   **Severidade:** Médio.

-   **Bug 5 (UX do Arquivo de Email)**
    -   **Descrição:** Ao arquivar um email, a UI remove-o da lista atual, mas não atualiza a vista para a pasta "Arquivo". O utilizador tem de navegar manualmente para ver o email arquivado.
    -   **Ficheiros:** `src/components/dashboard/EmailWebmailSection.tsx`.
    -   **Severidade:** Baixo.

-   **Code Smell 1 (Lógica Duplicada)**
    -   **Descrição:** A lógica para criar um website está duplicada. Existe no componente `CreateWebsiteSection` e novamente no modal dentro de `ListWebsitesSection`. Ambas fazem chamadas `fetch` diretas em vez de usarem a função `cyberPanelAPI.createWebsite()` já definida.
    -   **Ficheiros:** `src/app/admin/page.tsx`.
    -   **Severidade:** **Médio.** A lógica deve ser centralizada no `cyberpanel-api.ts`.

-   **Code Smell 2 (Logs com Informação Sensível)**
    -   **Descrição:** Várias rotas de API (`send-email`, `delete-email`) contêm `console.log` que expõem dados sensíveis (como passwords parciais) nos logs do servidor em produção.
    -   **Ficheiros:** `src/app/api/send-email/route.ts`, `src/app/api/delete-email/route.ts`.
    -   **Severidade:** Médio.

-   **Code Smell 2 (Refatorização da API)**
    -   **Descrição:** O ficheiro `cyberpanel-api.ts` tem duas funções muito semelhantes (`run` e `runSites`) que poderiam ser unificadas para reduzir a duplicação de código.
    -   **Ficheiros:** `src/lib/cyberpanel-api.ts`.
    -   **Severidade:** **Baixo.**

---

## 5. Decisões Técnicas Importantes

1.  **Proxy de Comandos Shell:** A decisão mais crítica foi usar a API de backend não apenas como proxy para a API do CyberPanel, mas também para executar comandos de shell (`cmd(...)`) diretamente no servidor. Isto dá uma enorme flexibilidade, mas cria uma forte dependência da configuração do servidor. **Qualquer alteração nos paths ou scripts do CyberPanel no servidor pode quebrar a aplicação.**
2.  **Cache de API:** O `cyberpanel-api.ts` usa um `cacheService` para guardar em memória os resultados de chamadas à API (especialmente listagens). Isto melhora a performance, mas significa que os dados podem não estar 100% em tempo real. O TTL (Time-to-Live) da cache está definido para 5 minutos para listagens.
3.  **Deploy Standalone:** A configuração `output: 'standalone'` no `next.config.ts` é intencional e necessária para o deploy no VPS da Contabo com PM2, pois agrupa todas as dependências necessárias.

---

## 6. Variáveis de Ambiente

Estas variáveis devem existir no ficheiro `.env.local` no servidor de produção.

-   `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase.
-   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chave pública (anónima) do Supabase.
-   `GITHUB_TOKEN`: [Apenas para desenvolvimento local] Token de acesso pessoal do GitHub para disparar o workflow de deploy através do script `deploy/trigger-deploy.sh`.

**Variáveis Assumidas (apenas no lado do servidor):**

-   `CYBERPANEL_SERVER_IP`: IP do servidor CyberPanel.
-   `CYBERPANEL_ADMIN_USER`: Nome de utilizador do admin do CyberPanel.
-   `CYBERPANEL_ADMIN_PASSWORD`: Password do admin do CyberPanel.

**[A CONFIRMAR]** A forma como as credenciais do CyberPanel são passadas para a rota `/api/server-exec` precisa de ser confirmada, mas é assumido que são variáveis de ambiente do servidor.

---

## 7. Fluxos Críticos

### Autenticação (Supabase)
1.  Utilizador acede a `/auth/login`.
2.  Clica num botão de login (ex: Google).
3.  A app chama `supabase.auth.signInWithOAuth()`.
4.  O Supabase redireciona para o provedor de OAuth.
5.  Após sucesso, o provedor redireciona para `/auth/callback`.
6.  A `route.ts` em `/auth/callback` troca o código de autorização por uma sessão de utilizador.
7.  O Supabase define os cookies de sessão no browser.
8.  O utilizador é redirecionado para o seu painel (`/admin` ou `/dashboard`).

### Ação no CyberPanel (Ex: Criar Website)
1.  Admin preenche um formulário no frontend.
2.  O componente React chama uma função do `cyberpanel-api.ts`, por exemplo `cyberPanelAPI.createWebsite({...})`.
3.  Esta função faz um `fetch` para a rota interna `/api/server-exec` com `{ action: 'createWebsite', params: {...} }`.
4.  A rota de API no servidor recebe o pedido.
5.  Usa as credenciais do CyberPanel (guardadas no servidor) para se autenticar.
6.  Executa a ação correspondente (seja uma chamada à API do CyberPanel ou um comando shell).
7.  Retorna o resultado em JSON para o frontend.

### Leitura/Envio de Emails
-   **[A CONFIRMAR]** O projeto tem UI para gestão de email, e o `cyberpanel-api.ts` tem funções para gerir contas de email via CyberPanel. No entanto, a lógica para ler e enviar emails (conexão IMAP/SMTP) não está presente nos ficheiros analisados e precisa de ser confirmada.

---

## 8. O Que Não Alterar

-   **`next.config.ts`:** A configuração de `output: 'standalone'` e os `headers` de segurança são essenciais para o deploy e segurança atuais.
-   **`deploy/trigger-deploy.sh`:** É o gatilho para o pipeline de CI/CD. Alterá-lo pode quebrar o processo de deploy.
-   **Estrutura da rota `/api/server-exec`:** O frontend depende fortemente desta rota para interagir com o servidor. Uma refatorização exigiria uma revisão em toda a aplicação.
-   **Comandos `cmd(...)` em `src/lib/cyberpanel-api.ts`:** Estas funções são frágeis e dependem da shell do servidor. Não devem ser alteradas sem testar exaustivamente no servidor de produção.

---

## 9. Próximos Passos (Prioridades)

Baseado no ficheiro `ESTADO_PROJECTO.md`:

1.  **Validar Autenticação (Prioridade Crítica):**
    -   Testar o fluxo de login/logout de ponta a ponta para utilizadores `admin` e `cliente`.
    -   Confirmar que as regras de acesso (RLS) no Supabase estão a funcionar e a filtrar os dados corretamente para cada tipo de utilizador.

2.  **Conectar Dados Reais nos Painéis:**
    -   **Substituir os dados mock em `src/app/client/page.tsx`** por uma chamada real ao Supabase para obter os dados do cliente autenticado.
    -   Validar que todos os módulos do painel de admin (`/admin`) estão a sincronizar e a exibir dados corretos do CyberPanel (Websites, DNS, Email, etc.).

3.  **Correção de Bugs Críticos:**
    -   **Remover Credenciais Hardcoded:** Mover todas as passwords de `EmailWebmailSection.tsx` e `send-email/route.ts` para variáveis de ambiente do servidor.
    -   **Remover Logs Sensíveis:** Auditar e remover todas as chamadas `console.log` que possam expor dados sensíveis em produção.

4.  **Limpeza e Consistência:**
    -   Remover todas as referências ao domínio antigo `visualdesign.ao`.
    -   Fazer uma limpeza de vhosts de teste no servidor CyberPanel, se já não forem necessários.
    -   Tomar uma decisão final sobre a gestão de email (registos MX) e implementar a configuração escolhida.

5.  **Melhorias e Refatorização (Prioridade Média/Baixa):**
    -   **Otimizar Delete em Massa:** Criar uma nova rota de API que aceite um array de IDs de email para apagar de uma só vez e atualizar o frontend para a usar.
    -   Centralizar a lógica de criação de websites, usando sempre a função `cyberPanelAPI.createWebsite()`.
    -   Unificar as funções `run` e `runSites` em `src/lib/cyberpanel-api.ts`.
    -   **Melhorar UX do Arquivo:** Após arquivar um email, atualizar a UI para mostrar a pasta "Arquivo".
    -   **Completar Funcionalidades:** Implementar a lógica marcada com `// TODO:` na secção `CPUsersSection` (`CyberPanelSections.tsx`) para editar, suspender e fazer reset à password de utilizadores.

---

*Este documento foi gerado automaticamente com base na análise do código-fonte.*