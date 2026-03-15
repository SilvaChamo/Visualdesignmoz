# AUDITORIA PROFUNDA - SISTEMA DE EMAIL

## FASE 1: ANÁLISE DE CÓDIGO

### APIs
- **Delete Email**: `/api/delete-email/route.ts` ✅ EXISTE
- **Archive Email**: `/api/archive-email/route.ts` ✅ EXISTE
- **Forward Email**: `/api/forward-email/route.ts` ✅ EXISTE

### UI (EmailWebmailSection.tsx)
- **Botão Deletar**: 🗑️ ✅ IMPLEMENTADO
- **Botão Arquivar**: 📁 ✅ IMPLEMENTADO
- **Botão Forward**: ↪️ ✅ IMPLEMENTADO

---

## FASE 2: TESTES NO BROWSER (DIAGNÓSTICO)

| Botão | API Existe? | Botão no UI? | Funciona? | Erro Encontrado |
| :--- | :---: | :---: | :---: | :--- |
| **Deletar** | ✅ | ✅ | ❓ | *Aguardando teste* |
| **Arquivar** | ✅ | ✅ | ❓ | *Aguardando teste* |
| **Forward** | ✅ | ✅ | ❓ | *Aguardando teste* |

---

## FASE 3: SERVIDOR IMAP (PASTAS REAIS)

Auditado via SSH em `/home/vmail/visualdesigne.com/admin/Maildir/`

| Pasta (UI) | Nome no Servidor (Real) | Mapeamento UI | API (Default) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Caixa de Entrada** | `INBOX` | `INBOX` | - | ✅ OK |
| **Enviados** | `Sent` | `Sent` | - | ✅ OK |
| **Rascunhos** | `Drafts` | `Drafts` | - | ✅ OK |
| **Arquivo** | `Archive` | `Archive` | `Archived` | ⚠️ MISMATCH API |
| **Lixo** | `Deleted Items` | `Trash` | `Trash` | ❌ MISMATCH TOTAL |
| **Spam** | `Junk E-mail` | `Junk` | `Junk` | ❌ MISMATCH TOTAL |

---

## FASE 4: RELATÓRIO DE ERROS E CONCLUSÕES

### BOTÕES
- **Deletar**: Provavelmente falha silenciosamente ou dá erro "Mailbox does not exist" porque tenta usar `Trash` enquanto o servidor usa `Deleted Items`.
- **Arquivar**: Provavelmente falha porque a API busca `Archived` (com 'd') e o servidor tem `Archive`.
- **Forward**: API existe e parece correta, mas depende da leitura bem-sucedida do email original.

### PASTAS
- **Lixo/Deletados**: Não carrega porque o UI pede `INBOX.Trash` (ou `Trash`) e o servidor usa `INBOX.Deleted Items`.
- **Arquivo**: Pode carregar se o UI usar `Archive`, mas a ação de arquivar usa a API com `Archived`.

### RECOMENDAÇÃO (AUDITORIA APENAS):
Corrigir os mapeamentos em `src/components/dashboard/EmailWebmailSection.tsx` e nas APIs para corresponderem aos nomes reais do servidor Dovecot/CyberPanel.
