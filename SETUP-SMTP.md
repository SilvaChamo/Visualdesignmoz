# 🚀 Configuração SMTP CyberPanel - Guia Completo

## 📋 O que vai fazer
Configurar o CyberPanel no Contabo para aceitar ligações SMTP externas, permitindo que o site Next.js (hospedado no Vercel) envie emails.

---

## 🔐 Dados de Acesso
- **Servidor**: 109.199.104.22
- **Usuário**: ADMIN
- **Senha**: Meckito#77?*

---

## ⚡ Passos (executar no terminal)

### 1. Ligar ao servidor via SSH
```bash
ssh ADMIN@109.199.104.22
# Password: Meckito#77?*
```

### 2. Transferir o script para o servidor
No seu computador local (novo terminal):
```bash
cd /Users/macbook/Desktop/APP/visualdesign
scp scripts/setup-cyberpanel-smtp.sh ADMIN@109.199.104.22:/tmp/
# Password: Meckito#77?*
```

### 3. Executar o script no servidor
De volta ao SSH (já ligado ao servidor):
```bash
chmod +x /tmp/setup-cyberpanel-smtp.sh
sudo /tmp/setup-cyberpanel-smtp.sh
```

### 4. Verificar se funcionou
```bash
# Testar se postfix está a correr
sudo systemctl status postfix

# Ver portas abertas
sudo netstat -tlnp | grep -E ':(25|587|465)'

# Ou
sudo ss -tlnp | grep -E ':(25|587|465)'
```

Deverá ver algo como:
```
tcp   0   0 0.0.0.0:587    0.0.0.0:*   LISTEN   1234/master
tcp   0   0 0.0.0.0:465    0.0.0.0:*   LISTEN   1234/master
tcp   0   0 0.0.0.0:25     0.0.0.0:*   LISTEN   1234/master
```

---

## 🛡️ Passo Extra: Firewall do Contabo

Além do firewall no servidor, o **Contabo tem firewall próprio no painel web**:

1. Aceda ao painel Contabo: https://contabo.com
2. Vá a **VPS Control** → **Firewall**
3. Adicione regras TCP para:
   - Porta 587 (SMTP Submission)
   - Porta 465 (SMTPS)
   - Porta 25 (SMTP)

---

## 🧪 Testar envio de email

### Teste local no servidor:
```bash
# Instalar mailutils se não tiver
sudo apt-get install mailutils -y

# Enviar teste
echo "Teste de configuracao SMTP" | mail -s "Teste CyberPanel SMTP" seuemail@gmail.com
```

### Teste remoto (do seu computador):
```bash
telnet 109.199.104.22 587

# Deverá aparecer algo como:
# 220 oshercollective.com ESMTP Postfix
```

---

## 📧 Configuração do Site (já feito no código)

Depois de configurar o servidor, o site já está pronto:

```javascript
// Configuração no .env.local
SMTP_HOST=109.199.104.22
SMTP_PORT=587
SMTP_MASTER_EMAIL=admin@visualdesignmoz.com
SMTP_MASTER_PASSWORD=Ad.Vd#2425?*
```

---

## ❌ Se falhar

### Erro: "Permission denied"
```bash
# Tornar script executável
chmod +x /tmp/setup-cyberpanel-smtp.sh

# Executar com sudo
sudo bash /tmp/setup-cyberpanel-smtp.sh
```

### Erro: "postfix: command not found"
```bash
# Instalar postfix
sudo apt-get update
sudo apt-get install postfix -y
# Escolher "Internet Site" na configuração
```

### Erro: "Port already in use"
```bash
# Ver o que está a usar a porta
sudo lsof -i :587
sudo lsof -i :465

# Matar processo se necessário
sudo kill -9 <PID>
```

---

## ✅ Verificação Final

Depois de tudo configurado, teste no site:
1. Vá ao painel cliente → Email Marketing
2. Escolha domínio e email de envio
3. Envie email de teste

Se funcionar: **Sucesso!** 🎉

---

## 📞 Suporte
Se tiver problemas:
1. Ver logs: `sudo tail -f /var/log/mail.log`
2. Verificar postfix: `sudo postfix check`
3. Restart serviços: `sudo systemctl restart postfix dovecot`
