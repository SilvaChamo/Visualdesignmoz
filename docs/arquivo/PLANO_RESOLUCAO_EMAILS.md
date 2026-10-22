# 📋 PLANO DE RESOLUÇÃO - Lista de Emails Não Aparece

## 🔍 **PROBLEMA IDENTIFICADO**

### **Sintomas**
- ❌ Lista de emails existentes não aparece no painel cliente
- ❌ Seção de emails vazia mesmo com contas configuradas
- ❌ Funcionalidade de mailmarketing implementada mas emails não carregam

### **Causas Prováveis**

#### **1. Falha no Carregamento Inicial**
```typescript
// PROBLEMA: Não há useEffect para carregar emails ao montar componente
const [emailsOrigem, setEmailsOrigem] = useState<{ email: string, tipo: string, nome: string, password?: string }[]>([])
// SOLUÇÃO: Adicionar useEffect para buscar contas do usuário logado
```

#### **2. API Não Chamada no Momento Certo**
```typescript
// PROBLEMA: API /api/email-contas só é chamada em momentos específicos
// SOLUÇÃO: Chamar API sempre que o componente montar ou usuário mudar
```

#### **3. Filtro de Cliente Incorreto**
```typescript
// PROBLEMA: Query pode estar filtrando errado no Supabase
const { data } = await supabaseAdmin
  .from('email_contas')
  .select('*')
  .eq('cliente_id', clienteId) // Pode estar null ou incorreto
```

#### **4. Estado Não Atualizado Após Criação**
```typescript
// PROBLEMA: Após criar email, lista não atualiza automaticamente
// SOLUÇÃO: Recarregar lista após operações CRUD
```

#### **5. Problema de Sessão/Permissão**
```typescript
// PROBLEMA: Usuário pode não ter permissão para ver próprias contas
const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
if (clienteId !== session.user.id && session.user?.user_metadata?.role !== 'admin' && !isExplicitAdmin) {
  return NextResponse.json({ error: 'Acesso proibido' }, { status: 403 });
}
```

---

## 🎯 **PLANO DE IMPLEMENTAÇÃO**

### **FASE 1: DIAGNÓSTICO IMEDIATA (5 min)**

#### **1.1 Verificar API Response**
```bash
# Testar endpoint diretamente
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3002/api/email-contas?cliente_id=USER_ID"
```

#### **1.2 Verificar Estado no Componente**
```typescript
// Adicionar log para debug
useEffect(() => {
  console.log('🔍 [DEBUG] Emails atuais:', emailsOrigem)
  console.log('🔍 [DEBUG] Sessão:', sessionUser)
}, [emailsOrigem])
```

#### **1.3 Verificar Carregamento Inicial**
```typescript
// Adicionar useEffect para carregar emails ao montar
useEffect(() => {
  if (sessionUser) {
    carregarEmailsDoUsuario()
  }
}, [sessionUser])
```

### **FASE 2: CORREÇÕES ESTRUTURAIS (15 min)**

#### **2.1 Adicionar Carregamento Automático**
```typescript
// No EmailWebmailSection.tsx
useEffect(() => {
  if (emailOrigem && emailOrigem.includes('@')) {
    carregarEmailsDoUsuario()
  }
}, [emailOrigem])

const carregarEmailsDoUsuario = async () => {
  setCarregandoEmails(true)
  try {
    const res = await fetch('/api/email-contas')
    const data = await res.json()
    
    if (data.success && data.contas?.length > 0) {
      setEmailsOrigem(data.contas.map((c: any) => ({
        email: c.email,
        tipo: c.tipo_conta,
        nome: c.nome_conta,
        password: ''
      })))
      
      // Auto-selecionar primeira conta se não houver seleção
      if (!emailOrigem && data.contas.length > 0) {
        setEmailOrigem(data.contas[0].email)
      }
    }
  } catch (error) {
    console.error('Erro ao carregar emails:', error)
    setErroEmail('Falha ao carregar contas de email')
  } finally {
    setCarregandoEmails(false)
  }
}
```

#### **2.2 Corrigir Filtro de Cliente**
```typescript
// No /api/email-contas/route.ts
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // CORREÇÃO: Usar ID da sessão ou permitir admin ver todos
  const clienteId = searchParams.get('cliente_id') || session.user.id
  const isExplicitAdmin = adminEmails.includes(session.user?.email || '')
  
  // Permitir admin ver todos ou usuário ver próprios
  if (clienteId !== session.user.id && session.user?.user_metadata?.role !== 'admin' && !isExplicitAdmin) {
    return NextResponse.json({ error: 'Acesso proibido a dados de terceiros' }, { status: 403 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('email_contas')
      .select('*')
      .eq('cliente_id', clienteId) // Garantir que sempre há um ID válido
      .order('created_at', { ascending: false })

    if (error) throw error

    const contas = (data || []).map(c => ({
      ...c,
      password_smtp: '' // nunca devolver password
    }))

    return NextResponse.json({ success: true, contas })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

#### **2.3 Adicionar Recarregamento Após Operações**
```typescript
// Após criar/editar/deletar email
const handleCriarEmail = async () => {
  // ... lógica de criação ...
  
  // RECARGAR LISTA
  await carregarEmailsDoUsuario()
  
  setMostrarAdicionarConta(false)
  setNovaContaForm({ nome: '', email: '', password: '', servidor: '', porta: '993', smtp: '', smtpPorta: '465', assinatura: '' })
}
```

### **FASE 3: MELHORIAS DE EXPERIÊNCIA (20 min)**

#### **3.1 Estados de Loading**
```typescript
// Adicionar skeletons enquanto carrega
{carregandoEmails ? (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
) : (
  // Lista real de emails
)}
```

#### **3.2 Tratamento de Erros**
```typescript
// Adicionar mensagens claras de erro
{erroEmail && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
    <div className="flex items-center space-x-2">
      <AlertCircle className="w-5 h-5 text-red-500" />
      <span className="text-red-700 font-medium">{erroEmail}</span>
    </div>
    <button 
      onClick={() => setErroEmail('')}
      className="mt-2 text-red-600 hover:text-red-700 text-sm underline"
    >
      Fechar
    </button>
  </div>
)}
```

#### **3.3 Indicador de Vazio**
```typescript
// Mostrar mensagem quando não há emails
{!carregandoEmails && emailsOrigem.length === 0 && (
  <div className="text-center py-12">
    <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhuma conta de email</h3>
    <p className="text-gray-500 mb-6">Configure sua primeira conta de email profissional</p>
    <button
      onClick={() => setMostrarAdicionarConta(true)}
      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
    >
      <Plus className="w-4 h-4 mr-2" />
      Adicionar Primeira Conta
    </button>
  </div>
)}
```

---

## 🚀 **AGENTE DE RESOLUÇÃO (EXECUÇÃO)**

### **PASSO 1: Implementar Diagnóstico**
- [ ] Adicionar logs de debug no componente
- [ ] Testar API endpoint diretamente
- [ ] Verificar estado da sessão

### **PASSO 2: Corrigir Carregamento**
- [ ] Adicionar useEffect para carregar emails
- [ ] Corrigir filtro de cliente na API
- [ ] Implementar recarregamento automático

### **PASSO 3: Melhorar UX**
- [ ] Adicionar estados de loading
- [ ] Implementar tratamento de erros
- [ ] Adicionar indicador de vazio

### **PASSO 4: Testes**
- [ ] Testar criação de email
- [ ] Testar listagem após refresh
- [ ] Testar com diferentes usuários

---

## 📊 **CRITÉRIOS DE SUCESSO**

| Critério | Status Esperado | Como Verificar |
|----------|----------------|---------------|
| **Lista carrega** | ✅ Emails aparecem ao montar | Verificar no console |
| **API responde** | ✅ 200 com contas | Testar com curl |
| **Criação atualiza** | ✅ Lista recarrega após criar | Testar fluxo completo |
| **Persistência** | ✅ Emails permanecem após refresh | Testar F5 |
| **Multi-contas** | ✅ Várias contas aparecem | Adicionar 2+ contas |

---

## ⚡ **PRIORIDADES**

1. **URGENTE**: Carregamento inicial (bloqueador principal)
2. **ALTA**: Correção do filtro de cliente
3. **MÉDIA**: Recarregamento após CRUD
4. **BAIXA**: Melhorias de UX/Loading

---

## 🔧 **FERRAMENTAS NECESSÁRIAS**

- **Logs do navegador** para debug
- **Postman/Insomnia** para testar API
- **Supabase Dashboard** para verificar dados
- **Console React** para inspecionar estado

---

**ESTE PLANO DEVE RESOLVER O PROBLEMA DA LISTA DE EMAILS NÃO APARECER DE FORMA ESTRUTURADA E DEFINITIVA.**
