# Configuração SMTP para Envio de Emails

## Problema Atual
```
Invalid login: 535 5.7.8 Error: authentication failed: (reason unavailable)
```

## Solução 1: Gmail (Recomendado para Testes)

### 1. Criar App Password no Gmail
1. Vá para: https://myaccount.google.com/
2. Ative "Verificação em duas etapas"
3. Vá para: Senhas > App Passwords
4. Crie nova App Password para "Mail"
5. Copie a senha gerada (ex: `abcd efgh ijkl mnop`)

### 2. Atualizar .env.local
```bash
# Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_MASTER_EMAIL=seu-email@gmail.com
SMTP_MASTER_PASSWORD=abcd efgh ijkl mnop
```

## Solução 2: SendGrid (Recomendado para Produção)

### 1. Criar Conta SendGrid
1. Cadastre-se em: https://sendgrid.com/
2. Verifique seu email
3. Crie uma API Key

### 2. Atualizar .env.local
```bash
# SendGrid SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_MASTER_EMAIL=apikey
SMTP_MASTER_PASSWORD=SG.xxxxxx.yyyyyy.zzzzzz
```

## Solução 3: Mailgun

### 1. Criar Conta Mailgun
1. Cadastre-se em: https://www.mailgun.com/
2. Verifique seu domínio
3. Obtenha credenciais SMTP

### 2. Atualizar .env.local
```bash
# Mailgun SMTP
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_MASTER_EMAIL=postmaster@seu-dominio.com
SMTP_MASTER_PASSWORD=senha-mailgun
```

## Como Aplicar

1. Abra o arquivo `.env.local` na raiz do projeto
2. Substitua as linhas SMTP existentes
3. Reinicie o servidor: `npm run dev`
4. Teste o envio novamente

## Teste Rápido

Após configurar, teste com:
1. Preencha assunto e conteúdo
2. Selecione lista de destinatários
3. Clique "Enviar"
4. Verifique console e email

## Verificação

Funcionou quando:
- Console mostra "STATUS RESPONSE: 200"
- Email chega na caixa de entrada
- Sem erros de autenticação
