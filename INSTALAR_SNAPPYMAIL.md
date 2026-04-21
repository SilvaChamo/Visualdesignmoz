# 🚀 Guia de Instalação Manual - SnappyMail

## Onde executar?
**No Terminal SSH** conectado ao servidor CyberPanel (109.199.104.22)

---

## ⚡ Instalação Rápida (1 comando)

**Copie e cole TUDO de uma vez no SSH:**

```bash
rm -rf /usr/local/CyberCP/public/snappymail && mkdir -p /usr/local/CyberCP/public/snappymail && cd /usr/local/CyberCP/public/snappymail && curl -L -o snappymail.tar.gz "https://github.com/the-djmaze/snappymail/releases/download/v2.38.2/snappymail-2.38.2.tar.gz" && tar -xzf snappymail.tar.gz && rm snappymail.tar.gz && mkdir -p data && chmod -R 777 data && chown -R lscpd:lscpd /usr/local/CyberCP/public/snappymail/ && chmod -R 755 /usr/local/CyberCP/public/snappymail/ && echo "✅ SnappyMail instalado!" && ls -la
```

---

## Passo 1: Conectar ao Servidor

```bash
ssh root@109.199.104.22
```

---

## Passo 2: Instalação Detalhada (se o rápido falhar)

```bash
# Limpar instalação antiga
rm -rf /usr/local/CyberCP/public/snappymail

# Criar e entrar na pasta
mkdir -p /usr/local/CyberCP/public/snappymail
cd /usr/local/CyberCP/public/snappymail

# Baixar do GitHub (mirror mais rápido)
curl -L -o snappymail.tar.gz "https://github.com/the-djmaze/snappymail/releases/download/v2.38.2/snappymail-2.38.2.tar.gz"

# Se curl falhar, tente wget:
# wget -O snappymail.tar.gz "https://github.com/the-djmaze/snappymail/releases/download/v2.38.2/snappymail-2.38.2.tar.gz"

# Extrair
tar -xzf snappymail.tar.gz
rm snappymail.tar.gz

# Permissões
mkdir -p data
chmod -R 777 data
chown -R lscpd:lscpd /usr/local/CyberCP/public/snappymail/
chmod -R 755 /usr/local/CyberCP/public/snappymail/

# Verificar
ls -la
```

---

## Passo 3: Testar Acesso

Após instalação, acesse:

```
https://109.199.104.22:8090/snappymail/index.php
```

---

## 🔧 Se der erro de permissão:

```bash
chown -R lscpd:lscpd /usr/local/CyberCP/public/snappymail/
chmod -R 777 /usr/local/CyberCP/public/snappymail/data/
chmod -R 755 /usr/local/CyberCP/public/snappymail/
/usr/local/lsws/bin/lswsctrl restart
```

---

## 🆘 Se download falhar (servidor sem internet)

Baixe no seu Mac primeiro:
```bash
# No terminal do Mac
wget "https://github.com/the-djmaze/snappymail/releases/download/v2.38.2/snappymail-2.38.2.tar.gz"
scp snappymail-2.38.2.tar.gz root@109.199.104.22:/tmp/
```

Depois no servidor:
```bash
cd /usr/local/CyberCP/public
rm -rf snappymail
mkdir snappymail && cd snappymail
tar -xzf /tmp/snappymail-2.38.2.tar.gz
mkdir -p data && chmod -R 777 data
chown -R lscpd:lscpd . && chmod -R 755 .
```

---

## 📝 Resumo de Comandos

| Ação | Comando |
|------|---------|
| Conectar SSH | `ssh root@109.199.104.22` |
| Instalar rápido | Ver "Instalação Rápida" acima |
| Ver logs erro | `cat /usr/local/lsws/logs/error.log \| tail -20` |
| Reiniciar web | `/usr/local/lsws/bin/lswsctrl restart` |
| Testar URL | `curl -I https://109.199.104.22:8090/snappymail/index.php` |

---

**SnappyMail não abre?** Verifique no navegador: F12 → Console → me envie o erro.
