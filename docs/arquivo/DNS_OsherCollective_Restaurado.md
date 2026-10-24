# 🌐 Configuração DNS Restaurada - oshercollective.com
**Site e Emails na Mozserver (Configuração Padrão)**

## 📍 Configuração Atual:

| Serviço | Onde fica | IP |
|---------|-----------|-----|
| **Website** | Mozserver | 160.119.249.43 |
| **Emails** | Mozserver | 160.119.249.43 |
| **Webmail** | Mozserver | mail.oshercollective.com |

---

## 🔧 Registros DNS na Mozserver (cPanel):

A partir das imagens do cPanel, estes são os registros configurados:

### 1. **A Record** (Site)
```
Tipo: A
Nome: @ (oshercollective.com)
Valor: 160.119.249.43
TTL: 14400
```

### 2. **A Record** (WWW)
```
Tipo: A
Nome: www
Valor: 160.119.249.43
TTL: 14400
```

### 3. **MX Record** (Email server)
```
Tipo: MX
Nome: @
Prioridade: 10
Destino: mail.oshercollective.com
TTL: 14400
```

### 4. **A Record** (Mail server)
```
Tipo: A
Nome: mail
Valor: 160.119.249.43
TTL: 14400
```

---

## 📧 Registros de Email (SPF/DKIM/DMARC):

### 5. **SPF Record** (TXT)
```
Tipo: TXT
Nome: @
Valor: v=spf1 a mx ip4:160.119.249.43 include:_spf.google.com include:_spf.turbo-smtp.com include:relay.mailchannels.net ~all
TTL: 14400
```

### 6. **DKIM Records** (TXT)
```
Tipo: TXT
Nome: default._domainkey.oshercollective.com
Valor: [chave DKIM da Mozserver]
TTL: 14400
```

**Nota:** A Mozserver tem múltiplos registros DKIM configurados (vistos nas imagens).

### 7. **DMARC Record** (TXT)
```
Tipo: TXT
Nome: _dmarc.oshercollective.com
Valor: v=DMARC1; p=none; rua=mailto:dmarc@oshercollective.com
TTL: 14400
```

---

## ✅ Verificação do DNS:

Teste no terminal ou em https://mxtoolbox.com:

```bash
# Verificar MX
dig oshercollective.com MX

# Verificar A record
dig oshercollective.com A

# Verificar SPF
dig oshercollective.com TXT | grep spf

# Verificar DKIM
dig default._domainkey.oshercollective.com TXT
```

---

## 📋 Próximos Passos:

1. ✅ **Verificar no cPanel** se as contas de email estão criadas
2. ✅ **Testar envio** de email via webmail da Mozserver
3. ✅ **Testar recebimento** de email
4. ✅ **Verificar** em https://mxtoolbox.com/SuperTool.aspx

---

## 🔄 Diferença da Configuração Split:

| | Configuração Split (Antiga) | Configuração Padrão (Atual) |
|---|---|---|
| **Site** | Mozserver | Mozserver |
| **Email** | Contabo (37.27.17.25) | Mozserver (160.119.249.43) |
| **Vantagem** | Servidores separados | Mais simples, tudo no mesmo lugar |

---

**Configuração restaurada com sucesso! ✅**
