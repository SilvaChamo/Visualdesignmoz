# VERIFICAÇÃO DE CREDENCIAIS SMTP

## Problema Identificado
```
Invalid login: 535 5.7.8 Error: authentication failed: (reason unavailable)
```

## Configuração Atual
- **Host**: `mail.visualdesigne.com`
- **Porta**: `465` (SSL)
- **Usuário**: `admin@visualdesigne.com`
- **Senha**: `Ad.Vd#2425?*`

## Ações Necessárias

### 1. Verificar Conta de Email
Acesse o webmail para verificar se a conta existe:
https://visualdesigne.com:8090/snappymail/

**Login:**
- Email: `admin@visualdesigne.com`
	- Senha: `Ad.Vd#2425?*`

### 2. Se o Login Falhar no Webmail
A conta não existe ou a senha está incorreta.

**Soluções:**
- Criar conta `admin@visualdesigne.com` no CyberPanel
- OU usar uma conta existente

### 3. Opções de Contas Válidas

#### Opção A: Usar conta existente
Se você tem outra conta como `suporte@visualdesigne.com` ou `geral@visualdesigne.com`:

1. Verifique o login no webmail
2. Atualize as credenciais no `.env.local`:
```bash
SMTP_MASTER_EMAIL=suporte@visualdesigne.com
SMTP_MASTER_PASSWORD=senha-correta
```

#### Opção B: Criar conta admin
1. Acesse CyberPanel: https://visualdesigne.com:8090/
2. Email -> Create Email
3. Dominio: `visualdesigne.com`
4. Usuario: `admin`
5. Senha: `Ad.Vd#2425?*`
4. Marque "Send Welcome Email"

#### Opção C: Descobrir credenciais corretas
1. Verifique emails que já funcionam (recuperação de senha)
2. Use as mesmas credenciais
3. Verifique no painel Supabase as configurações de email

### 4. Teste Após Correção
1. Reinicie o servidor: `npm run dev`
2. Teste envio no mailmarketing
3. Verifique console para "SMTP Connection verified successfully"

## Verificação Rápida

**Execute este comando para testar a conexão:**
```bash
telnet mail.visualdesigne.com 465
```

Se conectar, o servidor está online. Se não, há problema de conexão.

## Próximos Passos

1. **Verifique webmail** primeiro
2. **Se falhar**, crie a conta ou use outra existente
3. **Atualize .env.local** com credenciais corretas
4. **Teste novamente**

O erro é 100% de autenticação - servidor responde, mas não aceita as credenciais.
