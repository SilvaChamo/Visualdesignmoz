# 📧 Guia Passo a Passo - Desativar Limite de Email

## ⚠️ O Problema
O limite de email está ativo no **CyberPanel** (servidor), não no Next.js.

## 🎯 Solução Rápida (3 passos)

---

### ✅ PASSO 1: Abrir Terminal

```bash
# No VS Code, pressione:
Ctrl + `      (Windows/Linux)
Cmd + `       (Mac)

# OU use o Terminal do Mac diretamente
```

---

### ✅ PASSO 2: Ir para a pasta do projeto

```bash
cd /Users/macbook/Desktop/APP/visualdesign
```

---

### ✅ PASSO 3: Executar o script automático

**Opção A - Script Completo (Recomendado):**
```bash
./scripts/fix-cyberpanel-limits-auto.sh
```

**Opção B - Script Simples (mais rápido):**
```bash
./scripts/fix-cyberpanel-limits-sed.sh
```

---

## 🔍 O que vai acontecer

Quando executar o script, ele vai:

1. **Conectar** ao servidor CyberPanel (109.199.104.22)
2. **Fazer backup** do arquivo original
3. **Modificar** o arquivo PHP para desativar limites
4. **Reiniciar** o serviço LSCPD
5. **Confirmar** as alterações

---

## 📋 Exemplo de saída esperada

```
🚫 DESATIVANDO LIMITES DE EMAIL NO CYBERPANEL - AUTO
===================================================

🔍 Etapa 1: Verificando arquivo...
✅ Arquivo encontrado: /usr/local/CyberCP/public/send-email-api.php

📋 Etapa 2: Criando backup...
✅ Backup criado: send-email-api.php.backup.20250411_235500

🔍 Etapa 3: Analisando verificações de limite...
... (mostra linhas encontradas)

📝 Etapa 4: Desativando limites...
✅ Modificações aplicadas!

🔄 Etapa 5: Reiniciando serviços...
✅ Serviços reiniciados

===================================================
✅ LIMITES DESATIVADOS!
```

---

## 🧪 PASSO 4: Testar o envio

1. Abra o navegador
2. Aceda ao painel cliente: `http://localhost:3000/client`
3. Faça login
4. Vá para "Email Marketing"
5. Tente enviar uma campanha para vários contactos

---

## 🔧 PASSO 5: Verificar se funcionou

Se ainda der erro, verifique manualmente:

```bash
# Ver se as alterações foram aplicadas
ssh root@109.199.104.22 'grep -n "LIMITE DESATIVADO" /usr/local/CyberCP/public/send-email-api.php'
```

---

## 🆘 Solução de Problemas

### "Permission denied"
```bash
chmod +x scripts/fix-cyberpanel-limits-auto.sh
./scripts/fix-cyberpanel-limits-auto.sh
```

### "Arquivo não encontrado"
O arquivo pode estar em outro local. Verifique:
```bash
ssh root@109.199.104.22 'find /usr/local/CyberCP -name "send-email*" -o -name "*email*api*"'
```

### "SSH connection refused"
Verifique se tem acesso SSH ao servidor:
```bash
ssh root@109.199.104.22 'echo "Conexão OK"'
```

---

## 🔄 Como reverter (se algo der errado)

```bash
# Listar backups
ssh root@109.199.104.22 'ls -la /usr/local/CyberCP/public/send-email-api.php.backup.*'

# Restaurar último backup
ssh root@109.199.104.22 'cp /usr/local/CyberCP/public/send-email-api.php.backup.XXXXXXX /usr/local/CyberCP/public/send-email-api.php'

# Reiniciar serviço
ssh root@109.199.104.22 'systemctl restart lscpd'
```

---

## 📞 Precisa de ajuda?

Se o script não funcionar, pode editar manualmente:

```bash
# Aceder ao servidor
ssh root@109.199.104.22

# Editar o arquivo
nano /usr/local/CyberCP/public/send-email-api.php

# Procurar por "dailyLimit" ou "limite" e comentar as verificações
# Exemplo: change: if ($sentToday >= $dailyLimit)
#      to:   if (false /* LIMITE DESATIVADO */)

# Salvar: Ctrl+O, Enter, Ctrl+X
# Reiniciar: systemctl restart lscpd
```

---

## ✅ Checklist Final

- [ ] Script executado sem erros
- [ ] Backup criado
- [ ] Serviço reiniciado
- [ ] Teste de envio realizado
- [ ] Emails enviados com sucesso

**🎉 Pronto! Os limites estão desativados.**
