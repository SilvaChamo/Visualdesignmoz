# 📧 Configuração de Email - VisualDesign

## ✅ Status Atual

- ✅ **Porta 587 (SMTP submission)** configurada e funcionando
- ✅ **TLS/SSL** ativo com certificado Let's Encrypt
- ✅ **Autenticação SASL** funcionando com Dovecot
- ✅ **admin@visualdesignmoz.com** testado e funcionando com Gmail
- ⚠️ **DKIM** parcialmente configurado (visualdesignmoz.com OK, oshercollective.com precisa verificar)

## 🔧 Configuração Necessária

### 1. Variáveis de Ambiente (.env)

```bash
# Email Master (usado para envios automáticos)
SMTP_MASTER_EMAIL=admin@visualdesignmoz.com
SMTP_MASTER_PASSWORD=Ad.Vd#2425?*

# Configuração SMTP
SMTP_HOST=109.199.104.22
SMTP_PORT=587
SMTP_SECURE=false  # STARTTLS

# Outros emails do sistema
SMTP_FROM_EMAIL=admin@visualdesignmoz.com
SMTP_REPLY_TO=suporte@visualdesignmoz.com
```

### 2. Contas de Email Válidas

| Email | Senha | Funciona com Gmail |
|-------|-------|-------------------|
| admin@visualdesignmoz.com | Ad.Vd#2425?* | ✅ Sim |
| osher@oshercollective.com | gce7G)S-1FfUX)-b | ❌ Não (sem DKIM) |

### 3. Atualizar Código

**Arquivos que precisam usar admin@visualdesignmoz.com:**
- `/src/app/api/submit-ticket/route.ts`
- `/src/app/api/mailmarketing-send/route.ts`
- `/src/app/api/send-email/route.ts`

**Alteração:** Garantir que `fromEmail` use `admin@visualdesignmoz.com` quando não for especificado.

## 🧪 Testar Configuração

```bash
# Testar via SSH
swaks \
    --to silva.chamo@gmail.com \
    --from admin@visualdesignmoz.com \
    --server 127.0.0.1:587 \
    --auth-user admin@visualdesignmoz.com \
    --auth-password 'Ad.Vd#2425?*' \
    --auth-plain \
    --tls \
    --body "Teste $(date)" \
    --h-Subject "Teste SMTP $(date +%H:%M)"
```

## 📋 Próximos Passos

1. ✅ Atualizar variáveis de ambiente no servidor
2. ✅ Testar envio pelo site (ticket, marketing)
3. ⚠️ Configurar DKIM para oshercollective.com (opcional)
4. ✅ Configurar watchdog para OpenDKIM (se necessário)

## 🚨 Solução de Problemas

**Email não chega ao Gmail:**
- Verificar se está usando conta @visualdesignmoz.com
- Verificar se senha está correta
- Verificar logs: `tail -20 /var/log/mail.log`

**Erro de autenticação:**
- Verificar se porta 587 está aberta: `ss -tlnp | grep 587`
- Verificar credenciais no Dovecot

## 💡 Recomendação

Para evitar problemas futuros, configure um **watchdog** para manter o OpenDKIM ativo:

```bash
# Adicionar ao crontab
*/5 * * * * /usr/local/bin/opendkim-watchdog.sh
```
