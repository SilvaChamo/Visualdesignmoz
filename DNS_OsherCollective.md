# 🌐 Configuração DNS Split - oshercollective.com
**Site na Mozserver | Emails na Contabo**

## � Como funciona esta configuração:

| Serviço | Onde fica | IP/Destino |
|---------|-----------|------------|
| **Website** | Mozserver | IP da Mozserver |
| **Emails** | Contabo | 109.199.104.22 |
| **Webmail** | Contabo | mail.oshercollective.com |

**Vantagens:**
- Site continua na Mozserver (onde está hospedado)
- Emails usam infraestrutura da Contabo (CyberPanel)
- Cada serviço no servidor mais adequado

---

## � Onde configurar:
Acesse seu **MozServer DNS** ou painel do registrador de domínio

---

## 🔧 Registros DNS Necessários:

### 1. **A Record** (Site → Mozserver)
```
Tipo: A
Nome: @ (ou oshercollective.com)
Valor: [IP_DA_MOZSERVER]
TTL: 3600
```

### 2. **A Record** (WWW → Mozserver)
```
Tipo: A
Nome: www
Valor: [IP_DA_MOZSERVER]
TTL: 3600
```

### 3. **MX Record** (Emails → Contabo)
```
Tipo: MX
Nome: @
Valor: 10 mail.oshercollective.com
TTL: 3600
```

### 4. **A Record** (Mail server → Contabo)
```
Tipo: A
Nome: mail
Valor: 109.199.104.22
TTL: 3600
```

---

## 📧 Registros de Email (SPF/DKIM):

### 5. **SPF Record** (TXT) - Email na Contabo
```
Tipo: TXT
Nome: @
Valor: v=spf1 ip4:109.199.104.22 ~all
TTL: 3600
```

**Nota:** O SPF referencia o IP da Contabo (109.199.104.22) porque é onde os emails são enviados.

### 6. **DKIM Record** (TXT) - APÓS gerar chaves
```
Tipo: TXT
Nome: default._domainkey
Valor: v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA... (chave pública)
TTL: 3600
```

**⚠️ IMPORTANTE:** A chave DKIM precisa ser gerada no servidor primeiro!

### 7. **DMARC Record** (TXT)
```
Tipo: TXT
Nome: _dmarc
Valor: v=DMARC1; p=none; rua=mailto:admin@oshercollective.com
TTL: 3600
```

---

## 🚀 Passos no MozServer:

1. Acesse: **mozserver.com** ou painel do registrador
2. Vá em: **Gestão de DNS** ou **Zona DNS**
3. Adicione cada registro acima
4. Aguarde propagação: **15 minutos a 2 horas**

---

## ✅ Verificação:

Após configurar, teste no SSH:
```bash
# Verificar se domínio aponta corretamente
dig oshercollective.com A

# Verificar MX
dig oshercollective.com MX

# Verificar SPF
dig oshercollective.com TXT | grep spf
```

---

## 📋 Próximos Passos (após DNS configurado):

### No CyberPanel da Contabo:
1. Criar website para `oshercollective.com` (apenas para gestão de emails)
2. Criar contas de email no CyberPanel
3. Gerar chaves DKIM no servidor Contabo
4. Adicionar registro TXT do DKIM no DNS da Mozserver
5. Configurar SSL para `mail.oshercollective.com` no CyberPanel

### Verificações finais:
6. Testar envio de email
7. Testar recebimento de email
8. Verificar em: https://mxtoolbox.com/SuperTool.aspx

---

## ⚠️ Notas importantes:

**SSL/Webmail:** Como o site está na Mozserver e o email na Contabo, o SSL do webmail (`mail.oshercollective.com`) precisa ser configurado no CyberPanel da Contabo, não na Mozserver.

**Certificado SSL do site:** Continua sendo gerenciado na Mozserver (onde o site está hospedado).

---

**Precisa de ajuda para gerar as chaves DKIM ou configurar o SSL?** 🗝️
