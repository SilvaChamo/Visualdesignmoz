# PROBLEMA DE AUTENTICAÇÃO GMAIL

## O que está acontecendo:

### Logs mostram:
```
Email enviado para geral@visualdesignmoz.com como osher@oshercollective.com
Email enviado para silva.chamo@gail.com como osher@oshercollective.com
POST /api/mailmarketing-send 200 in 6.9s
```

### Mas frontend mostra erro:
```
Falha na conexão SMTP: Invalid login: 535 5.7.8
```

## Possíveis Causas:

### 1. App Password Inválida
- Senha pode estar errada
- App Password expirou
- Precisa gerar nova

### 2. Gmail Bloqueando Acesso
- Gmail pode estar bloqueando acesso "menos seguro"
- Precisa permitir acesso de apps

### 3. Problema de Formato
- Senha com espaços pode estar incorreta
- Formato da senha pode estar errado

## Soluções:

### Opção 1: Gerar Nova App Password

1. **Vá para:** https://myaccount.google.com/apppasswords
2. **Apague a senha atual** (se houver)
3. **Crie nova senha:**
   - App: Email
   - Device: Outro (nome personalizado)
   - Name: VisualDesign MailMarketing v2
4. **Copie a nova senha**
5. **Me envie a nova senha**

### Opção 2: Permitir Acesso de Apps

1. **Vá para:** https://myaccount.google.com/lesssecureapps
2. **Ative "Permitir aplicativos menos seguros"**
3. **Espere 5-10 minutos**
4. **Teste novamente**

### Opção 3: Verificar Senha Atual

A senha `qymm temd wwxr zqoi` está correta?
- Confirme se copiou exatamente
- Verifique se não tem espaços extras
- Confirme se App Password foi gerada corretamente

## Teste Rápido:

### Para saber se é problema de senha:
1. **Tente fazer login no Gmail** com seu email e senha normal
2. **Se funcionar**, problema é na App Password
3. **Se não funcionar**, problema é na conta Gmail

## O que fazer agora:

### 1. Confirme a App Password
- A senha `qymm temd wwxr zqoi` está 100% correta?
- Foi gerada para "Email" app?

### 2. Se estiver errada:
- Gere nova App Password
- Me envie a nova senha

### 3. Se estiver correta:
- Ative acesso de apps menos seguros
- Espere alguns minutos
- Teste novamente

## Importante:

- **App passwords são diferentes** da senha normal do Gmail
- **Só funcionam para apps específicos**
- **Precisam ser geradas novamente** se suspeitar de problema

---

**Me diga: a App Password `qymm temd wwxr zqoi` foi gerada corretamente para o app "Email"?**
