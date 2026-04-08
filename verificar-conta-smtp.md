# VERIFICAÇÃO DE CONTA SMTP

## Problema: Autenticação Falhando

```
Invalid login: 535 5.7.8 Error: authentication failed: (reason unavailable)
```

## Ações Imediatas Necessárias

### 1. Verificar Conta no Webmail
Acesse: https://109.199.104.22:8090/snappymail/

**Teste com:**
- Email: `admin@visualdesigne.com`
- Senha: `VisualDesign#2026`

### 2. Se o Login Falhar

#### Opção A: Verificar Senha Correta
- A senha pode ser diferente no servidor
- Verifique no CyberPanel a senha exata

#### Opção B: Criar Conta Admin
1. Acesse CyberPanel: https://visualdesigne.com:8090/
2. Email -> Create Email
3. Dominio: `visualdesigne.com`
4. Usuario: `admin`
5. Senha: `VisualDesign#2026`
6. Marque "Send Welcome Email"

#### Opção C: Usar Outra Conta Existente
Se você tem outra conta que funciona:
- `suporte@visualdesigne.com`
- `geral@visualdesigne.com`
- Sua conta pessoal

### 3. Teste Manual SMTP

Use um cliente SMTP para testar:

```bash
# Teste com telnet
telnet 109.199.104.22 465
```

Se conectar, servidor está online.

### 4. Verificar Logs do Servidor

No CyberPanel, verifique:
1. Email -> View Email Logs
2. Procurar erros de autenticação
3. Verificar se conta está ativa

### 5. Possíveis Causas

#### Conta Não Existe
- `admin@visualdesigne.com` não foi criada
- Senha está incorreta

#### Conta Bloqueada
- Muitas tentativas falhadas
- Limite de envio atingido

#### Configuração SMTP
- Servidor SMTP requer configuração especial
- Porta bloqueada por firewall

## Solução Rapida

### Teste com Sua Conta Pessoal

Se você tem uma conta que funciona no webmail:

1. **Atualize temporariamente** as credenciais:
```bash
SMTP_MASTER_EMAIL=sua-conta@visualdesigne.com
SMTP_MASTER_PASSWORD=sua-senha-real
```

2. **Teste o mailmarketing**
3. **Se funcionar**, sabemos que o problema é apenas a conta `admin@visualdesigne.com`

### Verificação no CyberPanel

1. **Email -> Email Accounts**
2. **Procurar**: `admin@visualdesigne.com`
3. **Se não existir**: Criar
4. **Se existir**: Verificar status e resetar senha

## Próximos Passos

1. **Verifique webmail** com as credenciais
2. **Se falhar**, crie a conta ou use outra existente
3. **Atualize .env.local** com credenciais funcionais
4. **Teste novamente**

O erro é 100% de autenticação - precisamos encontrar as credenciais corretas que funcionam no servidor.
