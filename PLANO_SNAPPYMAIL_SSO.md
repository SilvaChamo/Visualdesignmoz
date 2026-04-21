# Plano de Ação — SnappyMail SSO

**Projeto:** VisualDesign Admin Panel  
**Servidor:** 109.199.104.22 (SSH como root)  
**Objetivo:** Confirmar login, confirmar admin, implementar SSO

---

## ✅ PROGRESSO

| Fase | Passo | Estado |
|------|-------|--------|
| Fase 1 | 1.1 - Testar login IMAP | ✅ OK (Logged in) |
| Fase 1 | 1.1-FIX - Verificar passdb | ✅ COMPLETO |
| Fase 1 | 1.2 - Verificar logs | ✅ SEM ERROS |
| Fase 1 | 1.3 - Confirmar domínio | ✅ OK |
| Fase 2 | 2.1 - Verificar application.ini | ✅ OK |
| Fase 2 | 2.2 - Repor senha admin | ✅ OK (hash existe) |
| Fase 2 | 2.3 - Verificar domínio | ✅ OK (default.json) |
| Fase 2 | 2.4 - Testar painel admin | ✅ OK (Restauração completa) |
| Fase 2 | 2.5 - Testar login normal | 🔄 EM CURSO |
| Fase 3 | 3.1 - Instalar plugin | ⏳ PENDENTE |
| Fase 3 | 3.2 - Verificar plugin | ⏳ PENDENTE |
| Fase 3 | 3.3 - Ativar plugin | ⏳ PENDENTE |
| Fase 3 | 3.4 - Criar API route | ⏳ PENDENTE |
| Fase 3 | 3.5 - Atualizar botão | ⏳ PENDENTE |
| Fase 3 | 3.6 - Testar SSO | ⏳ PENDENTE |

---

## FASE 1 — VERIFICAR AUTENTICAÇÃO DOVECOT

### Passo 1.1 — Testar login IMAP com conta real

**Comando:**
```bash
(echo "a LOGIN silva.chamo@visualdesigne.com SENHA_REAL_AQUI"; sleep 2; echo "a LOGOUT") | telnet 127.0.0.1 143
```

**Resultado:** ❌ FALHOU
```
* OK [CAPABILITY IMAP4rev1 SASL-IR LOGIN-REFERRALS ID ENABLE IDLE LITERAL+ STARTTLS AUTH=PLAIN] Dovecot (Ubuntu) ready.
a NO [AUTHENTICATIONFAILED] Authentication failed.
Connection closed by foreign host.
```

---

### Passo 1.1-FIX — Verificar onde estão as senhas dos emails

**Comandos executados:**
```bash
cat /etc/dovecot/dovecot.conf | grep -i passdb
# Resultado: passdb {

cat /etc/dovecot/conf.d/10-auth.conf | grep -v "^#" | grep -v "^$"
# Resultado: !include auth-system.conf.ext
```

**Próximo comando para executar:**
```bash
cat /etc/dovecot/dovecot.conf | grep -A 10 "passdb"
```

---

### Passo 1.2 — Verificar logs do Dovecot

**Comando:**
```bash
journalctl -u dovecot --since "5 minutes ago" --no-pager | tail -30
```

---

### Passo 1.3 — Confirmar domínio configurado

**Comandos:**
```bash
ls /etc/dovecot/conf.d/ | grep domain
grep -r "visualdesigne.com" /etc/dovecot/ 2>/dev/null | head -20
```

---

## FASE 2 — CONFIRMAR PAINEL ADMIN SNAPPYMAIL

### Passo 2.1 — Verificar application.ini

**Comando:**
```bash
cat /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/configs/application.ini | grep -E "admin_password|imap|smtp"
```

---

### Passo 2.2 — Repor senha admin

```bash
php -r "echo password_hash('7vO8X0K8rDMTTU', PASSWORD_BCRYPT) . PHP_EOL;"
```

---

### Passo 2.3 — Verificar domínio no SnappyMail

**Comando:**
```bash
ls /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/domains/
```

---

### Passo 2.4 — Testar painel admin

URL: `https://109.199.104.22:8090/snappymail/?admin`  
User: `admin`  
Password: `7vO8X0K8rDMTTU`  
TOTP: deixar vazio

---

### Passo 2.5 — Testar login normal

URL: `https://109.199.104.22:8090/snappymail/`  
Email: `silva.chamo@visualdesigne.com`  
Password: senha real do email

---

## FASE 3 — IMPLEMENTAR SSO

### Passo 3.1 — Instalar plugin login-remote

**Verificar se existe:**
```bash
ls /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/plugins/ | grep -i login
```

**Criar plugin:**
```bash
mkdir -p /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/plugins/login-remote
cat > /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/plugins/login-remote/index.php << 'PHPEOF'
<?php

class LoginRemotePlugin extends \RainLoop\Plugins\AbstractPlugin
{
    const NAME = 'login-remote';
    const VERSION = '2.0';
    const DESCRIPTION = 'Auto-login via POST credentials';

    public function Init(): void
    {
        $this->addHook('login.credentials.step-1', 'ServiceRemoteAutoLogin');
    }

    public function ServiceRemoteAutoLogin()
    {
        $sEmail    = \trim(\MailSo\Base\Utils::GetParam('RemoteEmail', ''));
        $sPassword = \trim(\MailSo\Base\Utils::GetParam('RemotePassword', ''));

        if (!empty($sEmail) && !empty($sPassword)) {
            $oActions = \RainLoop\Api::Actions();
            $oActions->LoginProcess(
                $sEmail,
                new \SnappyMail\SensitiveString($sPassword)
            );
        }
    }
}
PHPEOF
```

---

### Passo 3.2 — Verificar plugin

```bash
cat /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/plugins/login-remote/index.php
```

---

### Passo 3.3 — Ativar plugin

1. Abrir `https://109.199.104.22:8090/snappymail/?admin`
2. Clicar em **Plugins**
3. Encontrar **login-remote** na lista
4. Ativar o toggle
5. Clicar **Save**

---

### Passo 3.4 — Criar API route

Ficheiro: `/src/app/api/webmail-sso/route.ts`

---

### Passo 3.5 — Atualizar botão

Ficheiro: `/src/components/dashboard/WebmailSection.tsx`

Substituir:
- `href="https://109.199.104.22:8090/snappymail/"`
- Por: `href="/api/webmail-sso"`

---

### Passo 3.6 — Testar SSO

1. Fazer login no painel Next.js
2. Clicar em "Abrir Webmail"
3. Verificar se entra direto sem pedir senha

---

## NOTAS

- Se a tabela `email_accounts` não existir no Supabase, perguntar onde estão guardadas as senhas
- O plugin expõe credenciais em POST — garantir HTTPS sempre
- Verificar versão SnappyMail: `grep version /usr/local/lscp/cyberpanel/snappymail/snappymail/v/*/index.php 2>/dev/null | head -5`
