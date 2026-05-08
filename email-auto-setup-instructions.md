# SISTEMA DE CONFIGURAÇÃO AUTOMÁTICA DE EMAILS

## Funcionalidade Criada

### 1. API de Configuração Automática
**Endpoint:** `/api/auto-email-config`

**Função:** Envia automaticamente email com dados de configuração SMTP/IMAP para novos clientes

### 2. Mailmarketing Atualizado
- **Credenciais corrigidas:** `admin@visualdesignmoz.com` / `VisualDesign#2026`
- **Servidor:** `109.199.104.22:465` (SSL)
- **Webmail:** `https://109.199.104.22:8090/snappymail/`

## Como Usar

### Para Novos Clientes
Ao criar um novo email, chame a API:

```javascript
fetch('/api/auto-email-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userEmail: 'cliente@dominio.com',
        clientName: 'Nome do Cliente',
        domain: 'dominio.com'
    })
})
```

### Email Enviado Automaticamente Contém:
- **Dados SMTP completos** para envio
- **Dados IMAP completos** para recebimento
- **Link direto para webmail**
- **Instruções passo a passo**
- **Configuração para Outlook/Thunderbird**

## Configuração SMTP/IMAP

### SMTP (Envio)
- **Servidor:** `109.199.104.22`
- **Porta:** `465`
- **SSL:** Ativo
- **Usuário:** Email completo do cliente
- **Senha:** Senha do email do cliente

### IMAP (Recebimento)
- **Servidor:** `109.199.104.22`
- **Porta:** `993`
- **SSL:** Ativo
- **Usuário:** Email completo do cliente
- **Senha:** Senha do email do cliente

### Webmail
- **URL:** `https://109.199.104.22:8090/snappymail/`
- **Login:** Email completo + senha

## Integração com CyberPanel

### Ao Criar Email no CyberPanel:
1. Chamar API `/api/auto-email-config`
2. Email de configuração enviado automaticamente
3. Cliente recebe todos os dados necessários
4. Pode configurar Outlook/Thunderbird imediatamente

## Benefícios

- **Zero trabalho manual** para configuração
- **Profissional** email personalizado
- **Dados completos** para qualquer cliente
- **Redução de suporte** sobre configuração
- **Experiência profissional** para clientes

## Próximos Passos

1. **Integrar** com criação de emails no painel admin
2. **Integrar** com criação de emails no painel cliente
3. **Adicionar** botão "Reenviar Configuração"
4. **Criar** template para diferentes idiomas

## Teste

Para testar:
```javascript
// Teste rápido
fetch('/api/auto-email-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userEmail: 'seu-email@teste.com',
        clientName: 'Teste VisualDesign',
        domain: 'teste.com'
    })
})
```

O sistema enviará email completo com todas as configurações!
