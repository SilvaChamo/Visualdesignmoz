# Plano de implementação — Compra, produtos e painel do cliente

**Versão:** 2.0  
**Data:** 8 de junho de 2026  
**Projeto:** visualdesignmoz.com  

---

## Resumo em poucas palavras

O cliente **compra no site**, **paga de verdade**, e **logo depois** entra no painel com o mesmo login para ver os produtos (domínio, hospedagem, faturas).  
**Não acede ao DirectAdmin.**  
**Não configura servidor** (DNS, PHP, ficheiros, etc.).  
Só **vê informação**, **renova** e **compra** — como um cliente final, não como programador.

O **revendedor** mantém acesso técnico mais amplo + links directos (DirectAdmin, Roundcube).  
O **admin** mantém controlo total.

---

## Quem pode fazer o quê

| Acção | Cliente | Revendedor | Admin |
|-------|---------|------------|-------|
| Comprar domínio / hospedagem | Sim | Sim | Sim |
| Ver produtos e validades | Sim | Sim | Sim |
| Renovar domínio / hospedagem | Sim | Sim | Sim |
| Ver faturas e histórico | Sim | Sim | Sim |
| Abrir webmail (dentro do painel) | Sim | Sim | Sim |
| Criar/apagar emails | Limitado* | Sim | Sim |
| DNS, PHP, ficheiros, SSL técnico | **Não** | Sim | Sim |
| DirectAdmin directo | **Não** | Sim (link na conta) | Sim |
| Criar sites para terceiros | **Não** | Sim | Sim |

\* Cliente: apenas o essencial ligado ao que comprou (ex.: abrir webmail da conta incluída no pacote). Sem gestão avançada de servidor.

---

## Fluxo completo (actualizado)

### 1. Visitante
- Navega no site, pesquisa domínio, escolhe pacote de hospedagem (+ SSL/email opcional).
- Adiciona ao carrinho.

### 2. Conta (guest)
- Regista-se ou faz login (email ou Google).
- Conta criada com `role: guest` — área `/guest` com opções de compra (domínio, hospedagem, email).

### 3. Compra
- Carrinho: domínio + pacote (+ extras opcionais).
- Paga de verdade (M-Pesa, e-Mola, cartão).
- Sistema confirma pagamento.
- **Imediatamente após confirmação:**
  - Cliente é redirecionado (ou recebe email com link) para o **painel do cliente**.
  - Em **"Os meus produtos"** já vê o que comprou, por exemplo:
    - Domínio: nome, data de registo, **data de validade**, dias até expirar, **botão Renovar**.
    - Hospedagem: plano, domínio associado, estado (activo / a provisionar), data de renovação.
    - Fatura da compra actual.
  - Se a automação ainda estiver a correr: estado **"A provisionar"** com mensagem clara — não fica à espera sem feedback.

### 4. Automação (bastidores — cliente não vê)
- Registo do domínio no registrador.
- Criação do site no DirectAdmin.
- Configuração DNS.
- Ligação de tudo à conta do cliente na base de dados.
- Actualização do estado de **"A provisionar"** para **"Activo"** no painel.

### 5. Painel do cliente (experiência limitada)

**Princípio:** o cliente gere a **sua relação comercial** com a Visual Design, não o servidor.

#### O que o cliente VÊ e PODE fazer
| Secção | Conteúdo | Acções permitidas |
|--------|----------|-------------------|
| **Os meus produtos** | Lista unificada de tudo o que comprou | Ver detalhes |
| **Domínios** | Nome, registo, expiração, nameservers (só leitura) | **Renovar**, comprar extensão |
| **Hospedagem** | Plano, domínio, espaço usado, estado | **Renovar**, fazer upgrade de plano |
| **Emails** | Contas incluídas no pacote | Abrir **webmail**; pedir conta extra (compra) |
| **Faturas** | Histórico de pagamentos | Ver, descarregar recibo |
| **Suporte** | Tickets | Abrir pedido de ajuda |
| **Conta** | Perfil, password | Editar dados pessoais |

#### O que o cliente NÃO vê (remover ou ocultar do menu)
- DirectAdmin (qualquer link ou URL técnica).
- Gestor de ficheiros.
- Editor DNS / nameservers.
- Configuração PHP, SSL técnico, bases de dados, FTP.
- Instalação WordPress, construtores de páginas, mail marketing avançado.
- Criar/apagar websites, suspender sites, pacotes de revenda.

> Estas funções ficam no painel do **revendedor** e **admin**, não no do cliente.

### 6. Revendedor (espelho DirectAdmin)
- Login único no site.
- **Centro DirectAdmin** no dashboard: grelha com as mesmas ferramentas do DirectAdmin nativo.
- Menu lateral alinhado com secções DA: E-mails, Ficheiros, Domínios, WordPress, DNS, SSL, PHP, Pacotes, etc.
- Secção **"Acesso directo"**: DirectAdmin nativo, Roundcube, webmail no painel + credenciais.
- Gestão técnica completa — igual ao que faria no cPanel/DirectAdmin.

### 7. Admin
- Acesso total, DirectAdmin nativo, correcção manual se a automação falhar.

---

## Painel do cliente — modelo mental

```
CLIENTE = DONO DO PRODUTO, NÃO DO SERVIDOR

Pode:  VER → RENOVAR → COMPRAR → PEDIR SUPORTE
Não pode: CONFIGURAR → INSTALAR → APAGAR → ACEDER AO DIRECTADMIN
```

Analogia: como a conta da operadora de telemóvel — vês o teu pacote, a validade e renovas; não entras na central telefónica.

---

## Fases de implementação (actualizadas)

### Fase 1 — Segurança e perfis de acesso (1–2 semanas)

| Tarefa | Detalhe |
|--------|---------|
| Bloquear DirectAdmin para clientes | Nenhum link, URL ou API expõe o painel nativo ao role `client` |
| Menu do cliente simplificado | Remover do menu: DNS, ficheiros, PHP, WP install, construtores, mail marketing |
| Permissões por role | Regras claras: `client` = leitura + renovação + compra; `reseller` = técnico; `admin` = tudo |
| Revendedor: acesso directo | Secção na conta com links DirectAdmin + Roundcube + credenciais |
| APIs protegidas | Acções técnicas (criar site, DNS, etc.) recusam role `client` |

**Entregável:** cliente entra no painel e só vê o que lhe compete.

---

### Fase 2 — Pagamento real (2–3 semanas)

| Tarefa | Detalhe |
|--------|---------|
| M-Pesa / e-Mola / cartão | Integração real com confirmação |
| Tabela de encomendas | Estado: pendente → pago → a provisionar → activo / falhou |
| Após pagamento confirmado | Redireccionar para `/client` → secção **Os meus produtos** |
| Email de confirmação | Resumo da compra + link para o painel |

**Entregável:** pagar = ver produto no painel (mesmo que ainda "a provisionar").

---

### Fase 3 — Automação pós-pagamento (2–3 semanas)

| Passo | Acção |
|-------|-------|
| 1 | Ler encomenda paga |
| 2 | Registar domínio |
| 3 | Criar hospedagem no DirectAdmin |
| 4 | Configurar DNS |
| 5 | Gravar produtos ligados ao `user_id` |
| 6 | Actualizar estado no painel: **Activo** |
| 7 | Email: "O seu site está pronto" |

| Se falhar | Comportamento |
|-----------|---------------|
| Erro parcial | Produto fica "A provisionar"; admin recebe alerta |
| Erro total | Cliente vê "Em processamento"; suporte contacta |

**Entregável:** compra ligada à conta com datas de validade correctas.

---

### Fase 4 — "Os meus produtos" (1–2 semanas)

Secção central do painel do cliente (e espelho simplificado no revendedor).

#### Domínios (cartão por domínio)
- Nome do domínio
- Data de registo
- **Data de expiração / validade**
- Dias restantes (alerta se < 30 dias)
- Estado: Activo | A expirar | Expirado | A provisionar
- Botão **Renovar**
- Link para ver site (abrir `https://dominio` em nova aba)

#### Hospedagem (cartão por pacote)
- Nome do plano (ex.: Básico, Profissional)
- Domínio associado
- Espaço usado / limite (só leitura)
- Estado: Activo | Suspenso | A provisionar
- Data de renovação
- Botão **Renovar** ou **Fazer upgrade**

#### Emails
- Lista de contas incluídas
- Botão **Abrir webmail** (sem password DirectAdmin — SSO interno)
- Botão **Comprar conta extra** (se pacote permitir add-on)

#### Faturas
- Data, valor, método, produto, recibo
- Filtro por tipo (domínio / hospedagem / email)

**Entregável:** uma página onde o cliente percebe tudo o que tem e quando expira.

---

### Fase 5 — Renovações e compras no painel (1–2 semanas)

| Acção | Fluxo |
|-------|-------|
| Renovar domínio | Clicar Renovar → checkout → pagamento → validade actualizada |
| Renovar hospedagem | Idem |
| Upgrade de plano | Escolher plano superior → pagamento → migração automática |
| Comprar add-on (email, SSL) | Carrinho com item único → pagamento → produto activo |

**Regra:** toda a "gestão" do cliente passa por **compra ou renovação**, nunca por configuração técnica.

**Entregável:** cliente renova sem falar com suporte (quando possível).

---

### Fase 6 — Painel do revendedor (estilo cPanel) (1–2 semanas)

- Links directos: DirectAdmin, Roundcube.
- Gestão técnica completa (DNS, sites, emails, etc.).
- "Os meus produtos" com visão de revenda (domínios e pacotes que gere).

---

### Fase 7 — Testes e produção (1 semana)

| Cenário | Resultado esperado |
|---------|-------------------|
| Cliente novo compra domínio + hospedagem | Após pagamento, vê produtos no painel com validade |
| Cliente tenta aceder DNS / ficheiros | Menu não existe ou acção bloqueada |
| Cliente renova domínio a expirar | Validade actualizada; nova fatura |
| Revendedor | Vê links DirectAdmin na conta |
| Pagamento falha | Sem produto activo; mensagem clara |

---

## Ordem de execução

```
Fase 1 (perfis + menu cliente)
    ↓
Fase 2 (pagamento real + redirect pós-compra)
    ↓
Fase 3 (automação domínio + hospedagem)
    ↓
Fase 4 (Os meus produtos)
    ↓
Fase 5 (renovações no painel)
    ↓
Fase 6 (revendedor)
    ↓
Fase 7 (testes)
```

**Estimativa total:** 9–13 semanas.

---

## O que muda no código actual (referência interna)

| Área actual | Mudança necessária |
|-------------|-------------------|
| Menu cliente (`panel-menu-privileges`) | Remover itens técnicos; adicionar **Os meus produtos** |
| Página `/client` | Substituir dashboard técnico por vista de produtos |
| `CpanelDashboard` no cliente | Não mostrar ao role `client` |
| Carrinho (`CartDrawer`) | Pagamento real + redirect para produtos |
| Tabelas `domain_renewals`, `hosting_renewals`, `pagamentos` | Unificar leitura em "Os meus produtos" |
| APIs DirectAdmin | Bloquear para `client`; permitir `reseller`/`admin` |

---

## Decisões confirmadas (v2)

1. Cliente **sem** DirectAdmin — nunca.
2. Cliente **só vê e renova** — sem configuração de servidor.
3. Após pagamento → **acesso imediato** ao painel com produtos (mesmo em provisionamento).
4. Domínio mostra **validade, renovação e estado** — todos os detalhes necessários para o cliente, não para o técnico.
5. Revendedor mantém acesso directo (DirectAdmin, Roundcube) na sua conta.
6. Toda gestão do cliente alinhada com **compra e renovação**, não com configurações.

---

*Documento para orientar implementação. Sem exemplos de código — detalhe técnico fica nas tarefas de cada fase.*
