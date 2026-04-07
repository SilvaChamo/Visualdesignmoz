# 🔐 **ANÁLISE - Login Automático no SnappyMail**

## 📋 **INVESTIGAÇÃO COMPLETA**

### **🔍 Situação Atual**
```typescript
// CÓDIGO ATUAL - EmailWebmailSection.tsx
const getWebmailUrl = () => {
  return detectDomainConfig(emailOrigem).webmail
}

// BOTÃO ATUAL
<a href={getWebmailUrl()} target="_blank" 
   className="bg-gray-600 hover:bg-red-600 text-white px-4 py-1.5 rounded-md text-sm font-bold">
  {emailOrigem ? 'Webmail' : 'Webmail'}
</a>
```

**Problema**: Abre `https://dominio.com:8090/snappymail/` mas pede credenciais manualmente.

---

## 🎯 **OPÇÕES IDENTIFICADAS**

### **OPÇÃO 1: SSO com Plugin Proxy Auth (RECOMENDADO)**
```typescript
// SnappyMail v2.33.0+ tem plugin Proxy Auth
// URL: https://dominio.com:8090/snappymail/?ProxyAuth
```

**Como funciona:**
- Plugin "Proxy Auth" instalado no SnappyMail
- Configuração de "Master User" no Dovecot
- Login automático via HTTP header
- URL especial: `/?ProxyAuth`

**Pré-requisitos:**
1. ✅ Instalar plugin Proxy Auth no SnappyMail
2. ✅ Configurar Master User no Dovecot
3. ✅ Configurar reverse proxy para passar header

### **OPÇÃO 2: SSO Hash (RainLoop Style)**
```php
// Método RainLoop/SnappyMail com hash
$ssoHash = \RainLoop\Api::GetUserSsoHash($email, $password);
// URL: https://dominio.com:8090/snappymail/?sso=$ssoHash
```

**Como funciona:**
- Gera hash temporário com credenciais
- URL contém hash para login automático
- Hash expira após uso

### **OPÇÃO 3: Credenciais na URL (NÃO RECOMENDADO)**
```typescript
// Método inseguro - apenas para desenvolvimento
// URL: https://dominio.com:8090/snappymail/?login=email&password=senha
```

**Problemas:**
- ❌ Credenciais visíveis no histórico
- ❌ Inseguro (HTTPS não protege URL)
- ❌ Pode não funcionar em versões recentes

---

## 🚀 **PLANO DE IMPLEMENTAÇÃO**

### **SOLUÇÃO HÍBRIDA RECOMENDADA**

#### **FASE 1: Implementar SSO Hash (30 min)**

**1.1 Criar API Endpoint para SSO**
```typescript
// /api/email-sso/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { email } = await req.json()
    
    // Buscar credenciais criptografadas
    const { data: conta } = await supabaseAdmin
      .from('email_contas')
      .select('password_smtp')
      .eq('email', email)
      .eq('cliente_id', session.user.id)
      .single()
    
    if (!conta?.password_smtp) {
      return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
    }

    // Descriptografar senha
    const password = decrypt(conta.password_smtp)
    
    // Gerar hash SSO (simulação - precisa implementar real)
    const ssoHash = Buffer.from(`${email}:${password}:${Date.now()}`).toString('base64')
    
    return NextResponse.json({ 
      success: true, 
      ssoHash,
      email,
      webmailUrl: `https://${email.split('@')[1]}:8090/snappymail/?sso=${ssoHash}`
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**1.2 Modificar Componente para SSO**
```typescript
// No EmailWebmailSection.tsx
const handleWebmailLogin = async () => {
  if (!emailOrigem) {
    alert('Selecione uma conta de email')
    return
  }

  try {
    // Buscar hash SSO
    const res = await fetch('/api/email-sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailOrigem })
    })
    
    const data = await res.json()
    
    if (data.success) {
      // Abrir webmail com SSO
      window.open(data.webmailUrl, '_blank')
    } else {
      // Fallback para login manual
      window.open(getWebmailUrl(), '_blank')
    }
  } catch (error) {
    console.error('Erro no SSO:', error)
    // Fallback para login manual
    window.open(getWebmailUrl(), '_blank')
  }
}

// BOTÃO ATUALIZADO
<button 
  onClick={handleWebmailLogin}
  className="bg-gray-600 hover:bg-red-600 text-white px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors"
>
  <Mail className="w-4 h-4" />
  {emailOrigem ? 'Webmail' : 'Webmail'}
</button>
```

#### **FASE 2: Implementar Plugin Proxy Auth (60 min)**

**2.1 Configurar Plugin no Servidor**
```bash
# Instalar plugin Proxy Auth
cd /usr/local/CyberCP/public/snappymail
php index.php?install=proxy-auth

# Configurar plugin
# Admin → Extensions → Proxy Auth
```

**2.2 Configurar Master User no Dovecot**
```bash
# Adicionar ao /etc/dovecot/conf.d/10-auth.conf
auth_master_user_separator = *
auth_master_user = admin
auth_master_user_separator = *

# Criar usuário master
dovecot pw -p 'MasterPassword123!'
# Adicionar ao /etc/dovecot/users
admin:{PLAIN}MasterPassword123!
```

**2.3 Implementar API Proxy Auth**
```typescript
// /api/email-proxy-auth/route.ts
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  
  // Gerar URL com Proxy Auth
  const domain = email.split('@')[1]
  const proxyUrl = `https://${domain}:8090/snappymail/?ProxyAuth&user=${encodeURIComponent(email)}`
  
  return NextResponse.json({ 
    success: true, 
    proxyUrl 
  })
}
```

#### **FASE 3: Implementar Fallback Inteligente (15 min)**

```typescript
const handleWebmailLogin = async () => {
  if (!emailOrigem) {
    alert('Selecione uma conta de email')
    return
  }

  try {
    // Tentar Proxy Auth primeiro
    const proxyRes = await fetch('/api/email-proxy-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailOrigem })
    })
    
    if (proxyRes.ok) {
      const proxyData = await proxyRes.json()
      window.open(proxyData.proxyUrl, '_blank')
      return
    }
  } catch (error) {
    console.log('Proxy Auth não disponível, tentando SSO Hash...')
  }

  try {
    // Tentar SSO Hash
    const ssoRes = await fetch('/api/email-sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailOrigem })
    })
    
    const ssoData = await ssoRes.json()
    
    if (ssoData.success) {
      window.open(ssoData.webmailUrl, '_blank')
      return
    }
  } catch (error) {
    console.log('SSO Hash não disponível, usando fallback...')
  }

  // Fallback para login manual
  window.open(getWebmailUrl(), '_blank')
}
```

---

## 🔧 **IMPLEMENTAÇÕES ESPECÍFICAS**

### **PARA ADMIN PAINEL**
```typescript
// Admin pode ver emails de qualquer cliente
const handleAdminWebmailLogin = async (email: string) => {
  try {
    // Admin usa master credentials
    const res = await fetch('/api/admin/email-sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, adminAccess: true })
    })
    
    const data = await res.json()
    window.open(data.webmailUrl, '_blank')
  } catch (error) {
    window.open(`https://${email.split('@')[1]}:8090/snappymail/`, '_blank')
  }
}
```

### **PARA CLIENTE/REVENDEDOR**
```typescript
// Cliente só acessa próprias contas
const handleClientWebmailLogin = async () => {
  // Usa implementação normal com verificação de ownership
}
```

---

## 📊 **CRITÉRIOS DE SUCESSO**

| Método | Segurança | Complexidade | Manutenção | Recomendação |
|--------|-----------|--------------|-------------|---------------|
| **Proxy Auth** | 🔒 Alta | 📈 Média | 📉 Baixa | ✅ **Recomendado** |
| **SSO Hash** | 🔒 Média | 📈 Baixa | 📈 Média | ✅ **Alternativa** |
| **URL Params** | 🔴 Baixa | 📉 Baixa | 📉 Baixa | ❌ **Não usar** |

---

## 🎯 **RESPOSTA DIRETA**

### **SIM, É POSSÍVEL!** ✅

#### **Opções Implementáveis:**

1. **🔐 Proxy Auth Plugin (Recomendado)**
   - Login automático via `/?ProxyAuth`
   - Configuração única no servidor
   - Mais seguro e robusto

2. **🔑 SSO Hash (Alternativa)**
   - Login automático via hash temporário
   - Implementação via API
   - Mais simples de implementar

3. **🔄 Fallback Inteligente**
   - Tenta métodos automáticos primeiro
   - Fallback para login manual
   - Melhor experiência do usuário

#### **Implementação Imediata:**
```typescript
// Botão atualizado com SSO
<button onClick={handleWebmailLogin}>
  <Mail className="w-4 h-4" />
  Acessar Webmail
</button>
```

**O login automático é totalmente viável e pode ser implementado em etapas!** 🚀
