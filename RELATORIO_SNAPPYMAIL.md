# 📋 Relatório de Status - SnappyMail & Webmail

## 🎯 **Contexto do Projeto**

**Projeto:** VisualDesign - Painel Administrativo Integrado com CyberPanel
**Local:** `/Users/macbook/Desktop/APP/visualdesign`
**Servidor CyberPanel:** `109.199.104.22:8090`

### Arquitetura:
- **Frontend:** Next.js + React + TypeScript + TailwindCSS
- **Backend:** API Next.js + Supabase
- **Integração Servidor:** CyberPanel via API + SSH
- **Webmail:** SnappyMail (deveria estar instalado em `/snappymail/`)

---

## ✅ **O que Já Foi Feito**

### 1. **Auditoria Completa do Painel Admin** (Concluído)
- 12/12 funcionalidades do CyberPanel corrigidas
- Comandos CLI validados para: websites, emails, SSL, usuários, etc.
- Ver memória: `897ec95c-857d-4bb7-936b-b3a49709da66`

### 2. **Correções de Contagem de Emails** (Parcialmente Resolvido)
**Problema:** Contagens de emails não lidos estavam trocadas entre pastas (Inbox, Lixo, Enviados)

**Arquivos Modificados:**
- `/src/app/api/read-emails/route.ts` - API de leitura IMAP
- `/src/components/dashboard/WebmailSection.tsx` - Frontend

**Solução Implementada:**
- Mapeamento case-insensitive de nomes de pastas IMAP
- Busca de emails não lidos com filtro 'not seen'
- Correção de inconsistência entre IDs 'Spam' e 'Junk'
- Cache local desativado para evitar mistura de dados

**Status:** ✅ Funcionando no painel admin, mas precisa de validação final

### 3. **Tentativas de Instalação do SnappyMail** (Em Progresso)

**Local de Instalação:** `/usr/local/CyberCP/public/snappymail/`

**O que foi tentado:**
1. ✅ Download do SnappyMail v2.38.2 do GitHub
2. ✅ Extração de arquivos para pasta correta
3. ✅ Criação de `index.php` com constantes necessárias
4. ✅ Configuração de permissões (lscpd:lscpd)
5. ✅ Criação de pasta `data/` com permissões 777
6. ✅ Reinício do lscpd (`/usr/local/lscp/bin/lscpdctrl restart`)

**Comando usado para instalação:**
```bash
rm -rf /usr/local/CyberCP/public/snappymail
mkdir -p /usr/local/CyberCP/public/snappymail
cd /usr/local/CyberCP/public/snappymail
tar -xzf /tmp/latest.tar.gz --strip-components=1
mkdir -p data && chmod -R 777 data
chown -R lscpd:lscpd /usr/local/CyberCP/public/snappymail/
chmod -R 755 /usr/local/CyberCP/public/snappymail/

# Criar index.php
echo '<?php
define("APP_VERSION", "2.38.2");
define("APP_VERSION_ROOT_PATH", __DIR__ . "/");
define("APP_INDEX_ROOT_PATH", __DIR__ . "/");
define("APP_DATA_FOLDER_PATH", __DIR__ . "/data/");
define("APP_PRIVATE_DATA", __DIR__ . "/data/");
define("APP_PRIVATE_STATIC", __DIR__ . "/data/");
define("SNAPPYMAIL_DEV", false);
require __DIR__ . "/include.php";
' > index.php

/usr/local/lscp/bin/lscpdctrl restart
```

---

## ❌ **Problema Atual - SnappyMail Não Funciona**

### Sintomas:
- ✅ Arquivos estão presentes em `/usr/local/CyberCP/public/snappymail/`
- ✅ Permissões configuradas (lscpd:lscpd)
- ✅ `index.php` criado com constantes corretas
- ❌ Acesso via browser retorna **página branca/HTTP 200 com conteúdo vazio**
- ❌ `curl -k https://109.199.104.22:8090/snappymail/index.php` retorna vazio

### Estrutura Atual:
```
/usr/local/CyberCP/public/snappymail/
├── app/                 (bibliotecas PHP)
├── data/                (permissão 777)
├── static/              (JS/CSS)
├── themes/              (templates)
├── index.php            (351 bytes - criado manualmente)
├── include.php          (arquivo original)
├── setup.php            (arquivo original)
└── .htaccess.bak        (renomeado - original bloqueava acesso)
```

### Descoberta Importante:
O **lscpd** (servidor CyberPanel na porta 8090) tem **DUAS** pastas snappymail:
1. `/usr/local/CyberCP/public/snappymail/` (onde instalamos)
2. `/usr/local/lscp/cyberpanel/snappymail/` (usada pelo lscpd internamente)

---

## 🔍 **O que Falta Resolver**

### 1. **SnappyMail Não Responde**
**Possíveis causas:**
- O lscpd pode estar usando a pasta errada (`/usr/local/lscp/cyberpanel/snappymail/` em vez de `/usr/local/CyberCP/public/snappymail/`)
- Configuração de handler PHP no lscpd pode estar incorreta
- Falta arquivo `.htaccess` correto
- Constantes PHP podem estar incompletas

**Próximos passos sugeridos:**
1. Verificar qual pasta o lscpd realmente usa
2. Comparar `/usr/local/lscp/cyberpanel/snappymail/` com a instalação atual
3. Verificar logs do lscpd em `/usr/local/lscp/logs/`
4. Testar se o PHP está sendo executado (criar test.php com `phpinfo()`)

### 2. **Confirmação da Correção de Contagens de Email**
- Validar se as contagens de emails não lidos estão corretas em todas as pastas
- Testar com múltiplas contas de email
- Verificar se o cache não está causando problemas

### 3. **Integração com Painel Admin**
- Botão "Abrir Webmail Completo" deve abrir em nova aba (não iframe - causa erro de segurança)
- URL: `https://109.199.104.22:8090/snappymail/index.php`

---

## 📂 **Arquivos Importantes**

### Backend:
- `/src/app/api/read-emails/route.ts` - API de leitura IMAP
- `/src/app/api/server-exec/route.ts` - Execução de comandos SSH

### Frontend:
- `/src/components/dashboard/WebmailSection.tsx` - Componente de webmail
- `/src/app/admin/page.tsx` - Página principal do admin

### Documentação:
- `/INSTALAR_SNAPPYMAIL.md` - Guia de instalação manual
- `/RELATORIO_SNAPPYMAIL.md` - Este relatório

---

## 🔗 **Memórias do Sistema (Contexto Adicional)**

- `897ec95c-857d-4bb7-936b-b3a49709da66` - Auditoria completa do painel admin
- `96853c0a-05f9-4d49-b680-e6ca4e6dc051` - Arquitetura do painel admin
- `a30bd395-22e9-4484-a45e-abfe22743194` - Layout Email Marketing

---

## 🆘 **Comandos Úteis para Debug**

```bash
# Verificar se SnappyMail responde
curl -k https://109.199.104.22:8090/snappymail/index.php

# Verificar estrutura
ls -la /usr/local/CyberCP/public/snappymail/

# Verificar permissões
tail -20 /usr/local/lscp/logs/error.log

# Reiniciar lscpd
/usr/local/lscp/bin/lscpdctrl restart

# Testar PHP
echo '<?php phpinfo(); ?>' > /usr/local/CyberCP/public/snappymail/test.php
curl -k https://109.199.104.22:8090/snappymail/test.php

# Verificar ambas as pastas snappymail
ls -la /usr/local/lscp/cyberpanel/snappymail/
ls -la /usr/local/CyberCP/public/snappymail/
```

---

## ✅ **Critérios de Sucesso**

1. ✅ Acessar `https://109.199.104.22:8090/snappymail/index.php` no browser
2. ✅ Ver interface de login do SnappyMail
3. ✅ Fazer login com credenciais de email
4. ✅ Ler/enviar emails normalmente
5. ✅ No painel admin: botão "Abrir Webmail Completo" funciona

---

**Data do Relatório:** 21 de Abril de 2026
**Status:** Bloqueado - SnappyMail não responde após instalação
**Próximo Passo:** Identificar por que o lscpd não serve o SnappyMail corretamente
