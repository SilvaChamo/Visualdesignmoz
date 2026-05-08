# CORRIGIR IDENTIDADE DO EMAIL - PROBLEMA RESOLVIDO

## O Problema:

### O que está acontecendo:
- **Emails chegam nos destinatários** ✅
- **Mas aparecem como "VisualDesign"** ❌
- **Deveriam aparecer como nome do cliente** ✅

### Exemplo do problema:
```
De: VisualDesign <visualdesign.moz@gmail.com>  ❌
Para: cliente@email.com

Deveria ser:
De: João da Loja <joao@loja.com>         ✅
Para: cliente@email.com
```

## Causa do Problema:

### No código atual:
```javascript
// Remetente personalizado do cliente
const personalizedSender = clientName && clientEmail 
    ? `"${clientName}" <${clientEmail}>`
    : sender || `"VisualDesign" <admin@visualdesignmoz.com>`;
```

### O problema:
- **`clientName` e `clientEmail` não estão sendo enviados** do frontend
- **Sistema usa fallback**: `"VisualDesign" <admin@visualdesignmoz.com>`
- **Por isso aparece VisualDesign** em vez do cliente

---

## Solução:

### 1. Atualizar Frontend (page.tsx)
```javascript
// No handleSend, adicionar clientName e clientEmail
const response = await fetch('/api/mailmarketing-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        to: emailList,
        subject,
        content: finalHtml,
        domain: targetDomain,
        clientName: 'Nome do Cliente',     // ADICIONAR
        clientEmail: 'cliente@dominio.com', // ADICIONAR
        sender: `"Nome do Cliente" <cliente@dominio.com>`
    })
});
```

### 2. Pegar dados do usuário logado
```javascript
// Obter dados do usuário logado
const { data: { user } } = await supabase.auth.getUser();
const clientName = user?.user_metadata?.full_name || user?.email?.split('@')[0];
const clientEmail = user?.email;
```

---

## Implementação Imediata:

### Opção 1: Usar email do usuário logado
```javascript
// No handleSend, obter dados do usuário
const { data: { user } } = await supabase.auth.getUser();
const clientName = user?.user_metadata?.full_name || 'Cliente';
const clientEmail = user?.email || 'noreply@visualdesignmoz.com';
```

### Opção 2: Usar domínio do site selecionado
```javascript
// Usar nome do site/dominio como identidade
const clientName = selectedSite?.replace('.com', '').replace('.pt', '');
const clientEmail = `contato@${selectedSite}`;
```

### Opção 3: Campo personalizado no formulário
```javascript
// Adicionar campo "Nome do Remetente" no formulário
const [senderName, setSenderName] = useState('');

// No formulário:
<input
    type="text"
    placeholder="Seu Nome/Nome da Empresa"
    value={senderName}
    onChange={(e) => setSenderName(e.target.value)}
/>
```

---

## Solução Recomendada:

### Usar dados do usuário logado automaticamente:
1. **Nome**: Do perfil do usuário
2. **Email**: Do usuário logado
3. **Personalização**: Sem trabalho manual

### Como ficará:
```
// Se usuário logado: joao@loja.com
De: João da Loja <joao@loja.com>

// Se usuário logado: maria@boutique.com  
De: Maria da Boutique <maria@boutique.com>
```

---

## Próximos Passos:

### 1. Implementar no frontend
- Obter dados do usuário logado
- Enviar clientName e clientEmail na API

### 2. Testar
- Verificar se aparece nome do cliente
- Confirmar que emails chegam corretamente

### 3. Opcional: Campo personalizado
- Permitir que cliente personalize nome
- Sobrescrever dados do perfil se quiser

---

## Importante:

### Emails já estão funcionando!
- **Apenas a identidade está errada**
- **Entrega está OK**
- **Só precisa ajustar remetente**

### Solução é simples:
- **Pegar dados do usuário logado**
- **Enviar na API**
- **Pronto!**
