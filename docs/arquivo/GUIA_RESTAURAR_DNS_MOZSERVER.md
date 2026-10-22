# 🔄 Guia: Restaurar Email oshercollective.com na Mozserver

## 📍 O que precisa fazer no cPanel da Mozserver

As imagens mostram que o DNS já está configurado na Mozserver, mas precisa garantir que os emails funcionem corretamente.

---

## 📊 Resumo do Diagnóstico

| Registro | Status | Observação |
|----------|--------|------------|
| **A** @ → 160.119.249.43 | ✅ OK | Site aponta corretamente |
| **MX** → oshercollective.com | ❌ **ERRADO** | Prioridade 0, deveria ser 10 e apontar para mail.oshercollective.com |
| **A** mail → 160.119.249.43 | ✅ OK | Servidor de email existe |
| **SPF** | ✅ OK | Configurado corretamente |
| **DKIM** (3 registros) | ✅ OK | Múltiplas chaves configuradas |
| **DMARC** | ✅ OK | _dmarc configurado |
| **MailChannels** | ✅ OK | Autenticação presente |
| **Webmail** A | ✅ OK | Aponta para IP correto |

**Nota sobre MX:** A configuração com prioridade `0` apontando para `oshercollective.com` **pode funcionar** se o cPanel estiver configurado para isso (é o padrão de alguns servidores cPanel). 

No entanto, a configuração recomendada é `mail.oshercollective.com` com prioridade `10` para ser mais explícita e evitar problemas.

---

## ✅ Passo 1: Verificar Registros MX no cPanel

Acesse o **cPanel** → **Zone Editor** (Editor de Zona)

Verifique se existem estes registros:

| Tipo | Nome | Valor | Prioridade |
|------|------|-------|------------|
| **MX** | @ | mail.oshercollective.com | 10 |
| **A** | mail | 160.119.249.43 | - |

**Se não existir:** Adicione o registro MX apontando para `mail.oshercollective.com`

---

## ⚠️ PROBLEMAS ENCONTRADOS

### 1. ❌ MX Record INCORRETO

**Atual (errado):**
```
oshercollective.com. 14400 MX
Prioridade: 0
Destino: oshercollective.com
```

**Problemas:**
1. Prioridade está **0** (deveria ser **10**)
2. Destino está `oshercollective.com` (deveria ser `mail.oshercollective.com`)

**Correção necessária:**
```
Tipo: MX
Nome: @
Prioridade: 10
Destino: mail.oshercollective.com
TTL: 14400
```

**Como corrigir no cPanel:**
1. Zone Editor → Localize o registro MX atual
2. Clique em **Editar** ou **Remover** e recrie
3. Configure:
   - Prioridade: **10**
   - Destino: **mail.oshercollective.com**

---

## � Se o DNS já está correto (padrão Mozserver)

Se todos os domínios na Mozserver usam MX prioridade `0` apontando para o domínio e funcionam, então o problema pode ser outro:

### Verificar no cPanel:

| Verificação | Onde no cPanel | O que procurar |
|-------------|----------------|----------------|
| **Contas de Email** | Email → Email Accounts | As contas existem? (geral@, admin@, etc.) |
| **Roteamento de Email** | Email → Routing | Deve estar em "Local Mail Exchanger" |
| **Firewall Mail** | Security → Mail | Verificar se não está bloqueando |
| **Estado do Serviço** | Status → Services | Exim, Dovecot, IMAP, POP3 devem estar ONLINE |

### Teste rápido:

1. Crie uma conta de email no cPanel (ex: `teste@oshercollective.com`)
2. Acesse o webmail: `https://oshercollective.com:2096` ou `https://webmail.oshercollective.com`
3. Envie um email para si mesmo
4. Verifique se chega

Se não funcionar, verifique os logs de email no cPanel → **Track Delivery** ou contacte o suporte da Mozserver.

---

## �📋 Registros Especiais da Mozserver

### `_mailchannels.oshercollective.com` (TXT)

```
Tipo: TXT
Nome: _mailchannels
Valor: v=mc1 auth=mozserver4qacfgqt
```

**Função:** Este registro é para a **MailChannels** - serviço de envio de email da Mozserver.

- **MailChannels** é o serviço que a Mozserver usa para enviar emails
- O valor `auth=mozserver4qacfgqt` é uma chave de autenticação única da sua conta na Mozserver
- Permite que os emails enviados pelo cPanel sejam autenticados e não caiam no spam
- É criado automaticamente pelo cPanel quando ativa o serviço de email

**Importância:** Sem este registro, os emails enviados podem ser rejeitados ou marcados como spam.

---

## ✅ Passo 2: Verificar SPF Record

No Zone Editor, verifique o registro TXT do SPF:

```
Tipo: TXT
Nome: @
Valor: v=spf1 a mx ip4:160.119.249.43 include:_spf.google.com include:_spf.turbo-smtp.com include:relay.mailchannels.net ~all
```

**Importante:** O SPF deve incluir o IP da Mozserver (160.119.249.43)

---

## ✅ Passo 3: Verificar DKIM

No cPanel:
1. Vá em **Email** → **Authentication** (ou "Autenticação")
2. Verifique se o **DKIM** está **Ativado**
3. Se estiver desativado, ative-o

O DKIM gera automaticamente os registros TXT necessários.

---

## ✅ Passo 4: Criar Contas de Email no cPanel

1. No cPanel, vá em **Email Accounts** (Contas de Email)
2. Crie as contas necessárias:
   - geral@oshercollective.com
   - admin@oshercollective.com
   - info@oshercollective.com
   - (outras que precisar)

3. Defina senhas seguras para cada conta

---

## ✅ Passo 5: Configurar Webmail

O webmail da Mozserver geralmente está em:
```
https://oshercollective.com:2096 (webmail seguro)
```

Ou acesse pelo cPanel → **Webmail**

---

## ✅ Passo 6: Testar Envio e Recebimento

Depois de configurar:

1. Acesse o webmail da Mozserver
2. Envie um email para um endereço externo (ex: gmail)
3. Verifique se chegou
4. Responda do Gmail
5. Verifique se voltou para a caixa de entrada na Mozserver

---

## 📧 Configurações para Clientes de Email

Se alguém configurar no Outlook/Thunderbird:

| Configuração | Valor |
|-------------|-------|
| **Servidor IMAP** | mail.oshercollective.com |
| **Porta IMAP** | 993 |
| **SSL/TLS** | Sim |
| **Servidor SMTP** | mail.oshercollective.com |
| **Porta SMTP** | 465 (SSL) ou 587 (TLS) |

---

## 🔍 Verificação de DNS Online

Teste após as alterações:

1. https://mxtoolbox.com/SuperTool.aspx
   - Escolha "MX Lookup"
   - Digite: oshercollective.com
   - Deve mostrar: mail.oshercollective.com

2. https://mxtoolbox.com/SuperTool.aspx
   - Escolha "SPF Record"
   - Digite: oshercollective.com

---

## ⚠️ Importante: Propagação DNS

Após alterações no cPanel:
- **Aguarde 15 minutos a 2 horas** para propagação
- Alguns casos podem levar até 24 horas

---

## 📝 Resumo das Alterações Necessárias

| Ação | Onde no cPanel | Status |
|------|---------------|--------|
| MX Record → mail.oshercollective.com | Zone Editor | ⬜ Verificar |
| A Record mail → 160.119.249.43 | Zone Editor | ⬜ Verificar |
| SPF com IP da Mozserver | Zone Editor | ⬜ Verificar |
| DKIM Ativado | Email → Authentication | ⬜ Ativar |
| Contas de Email Criadas | Email Accounts | ⬜ Criar |
| Testar Envio/Recebimento | Webmail | ⬜ Testar |

---

**Dúvidas?** Verifique se os registros nas imagens já estão corretos e apenas confirme se o DKIM está ativado e as contas de email estão criadas.
