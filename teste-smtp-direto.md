# TESTE SMTP DIRETO - DEBUG AVANÇADO

## Problema: Autenticação SMTP Falhando

Apesar das credenciais funcionarem no webmail, o SMTP está falhando.

## Possíveis Causas

### 1. Webmail vs SMTP São Serviços Diferentes
- **Webmail**: Acesso via interface web (IMAP)
- **SMTP**: Servidor de envio (requer autenticação específica)

### 2. Conta Pode Não Ter Permissão SMTP
- Conta existe para webmail
- Mas não está autorizada para enviar via SMTP

### 3. Configuração Especial do Servidor
- CyberPanel pode exigir configuração específica
- Autenticação pode ser diferente para SMTP

## Ações de Debug

### 1. Verificar Logs do CyberPanel
1. Acesse: https://visualdesigne.com:8090/
2. Verifique: Email -> Email Logs
3. Procure erros de autenticação SMTP

### 2. Testar com Outra Conta
Se você tem outra conta que funciona:
- Sua conta pessoal
- `suporte@visualdesigne.com`
- `geral@visualdesigne.com`

### 3. Verificar Configuração SMTP no CyberPanel
1. CyberPanel -> Mail -> Manage Mail Servers
2. Verificar configuração do servidor SMTP
3. Verificar se `admin@visualdesigne.com` tem permissão SMTP

### 4. Teste Manual com Cliente SMTP
Use Thunderbird/Outlook para testar:
- Configurar conta `admin@visualdesigne.com`
- Tentar enviar email
- Verificar erro específico

## Soluções Possíveis

### Opção A: Usar Conta Diferente
Se outra conta funcionar:
1. Atualizar credenciais no sistema
2. Usar essa conta para envios

### Opção B: Configurar Permissão SMTP
No CyberPanel:
1. Email -> Email Accounts
2. Editar conta `admin@visualdesigne.com`
3. Verificar permissões de envio

### Opção C: Usar Servidor SMTP Externo
Configurar Gmail/SendGrid:
1. Criar conta externa
2. Usar para envios do sistema
3. Manter emails internos para recebimento

## Teste Imediato

### Verificar se Conta Tem SMTP
1. Configure `admin@visualdesigne.com` no Outlook
2. Tente enviar um email
3. Se falhar, o problema é a conta, não o código

### Teste com Sua Conta Pessoal
Se você tem email que funciona:
1. Me diga as credenciais
2. Testamos no sistema
3. Se funcionar, sabemos que é só a conta admin

## Conclusão

O fato de funcionar no webmail não garante que funcione para SMTP.
Precisamos encontrar uma conta que tenha permissão SMTP completa.
