import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: false,
    flowType: 'pkce',
  }
})

// Tipos para o nosso sistema
export interface Cliente {
  id: string
  nome: string
  email: string
  telefone?: string
  empresa?: string
  morada?: string
  cidade?: string
  pais: string
  status: 'active' | 'suspended' | 'inactive'
  data_cadastro: string
  ultimo_acesso?: string
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface SiteCliente {
  id: string
  cliente_id: string
  dominio: string
  titulo_site?: string
  descricao?: string
  plano: 'basic' | 'premium' | 'enterprise' | 'custom'
  preco_mensal: number
  moeda: string
  data_criacao: string
  data_renovacao?: string
  status: 'active' | 'suspended' | 'expired' | 'pending'
  cyberpanel_id?: number
  ssl: boolean
  created_at: string
  updated_at: string
}

export interface Pagamento {
  id: string
  cliente_id: string
  site_id: string
  valor: number
  moeda: string
  data_pagamento?: string
  data_vencimento: string
  metodo_pagamento: 'mpesa' | 'transferencia' | 'paypal' | 'multicaixa' | 'referencia' | 'cash'
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded'
  referencia?: string
  descricao?: string
  created_at: string
  updated_at: string
}

export interface Notificacao {
  id: string
  cliente_id?: string
  site_id?: string
  pagamento_id?: string
  tipo: string
  titulo: string
  mensagem: string
  data_envio?: string
  data_leitura?: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  canal: 'email' | 'sms' | 'dashboard' | 'whatsapp'
  prioridade: 'low' | 'normal' | 'high' | 'urgent'
  automatica: boolean
  template_usado?: string
  created_at: string
}

export interface EmailConta {
  id: string
  cliente_id: string
  site_id: string
  email: string
  senha_cyberpanel?: string
  quota_mb: number
  quota_usada_mb: number
  status: 'active' | 'suspended' | 'deleted'
  tipo_conta: 'mailbox' | 'forwarder' | 'alias'
  email_encaminhamento?: string
  auto_resposta: boolean
  auto_resposta_texto?: string
  spam_protection: boolean
  created_at: string
  updated_at: string
}

export interface TicketSuporte {
  id: string
  cliente_id?: string
  site_id?: string
  assunto: string
  descricao: string
  categoria: 'general' | 'technical' | 'billing' | 'domain' | 'email' | 'ssl' | 'backup'
  prioridade: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed'
  atribuido_a?: string
  created_at: string
  updated_at: string
  resolvido_em?: string
}

// Funções de autenticação
export const auth = {
  // Login
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    return data
  },

  // Registrar novo usuário
  async signUp(email: string, password: string, metadata: { nome: string; telefone?: string }) {
    console.log('supabase-client auth.signUp: Initing signup for:', email)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) {
      console.error('supabase-client auth.signUp: Error:', error)
      throw error
    }
    console.log('supabase-client auth.signUp: Success:', data.user?.email)
    return data
  },

  // Logout
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  // Recuperar senha
  async resetPassword(email: string) {
    console.log('supabase-client auth.resetPassword: Sending email to:', email)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/reset-password`
    })

    if (error) {
      console.error('supabase-client auth.resetPassword: Error:', error)
      throw error
    }
    console.log('supabase-client auth.resetPassword: Email sent successfully')
  },

  // Obter usuário atual
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Verificar role do utilizador
  async getUserRole(): Promise<'admin' | 'reseller' | 'client'> {
    const user = await this.getCurrentUser()
    if (!user) return 'client'

    const adminEmails = ['admin@your-domain.com', 'geral@your-domain.com', 'silva.chamo@gmail.com', 'silva.chamo@your-domain.com']
    if (adminEmails.includes((user.email || '').toLowerCase())) return 'admin'

    const metaRole = user.user_metadata?.role
    if (metaRole === 'admin') return 'admin'
    if (metaRole === 'reseller') return 'reseller'
    if (metaRole === 'client') return 'client'

    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (data?.role === 'admin') return 'admin'
    if (data?.role === 'reseller') return 'reseller'

    return 'client'
  },


  // Manter isAdmin para compatibilidade
  async isAdmin(): Promise<boolean> {
    const role = await this.getUserRole()
    return role === 'admin'
  },

  // Função de redirecionamento baseado no role
  async getRedirectPath(): Promise<string> {
    const role = await this.getUserRole()
    console.log('getRedirectPath: Role detected:', role)

    switch (role) {
      case 'admin':
        console.log('getRedirectPath: Redirecting to /admin')
        return '/admin'
      case 'reseller':
        console.log('getRedirectPath: Redirecting to /dashboard')
        return '/dashboard'
      default:
        console.log('getRedirectPath: Redirecting to /client')
        return '/client'
    }
  },

  // Obter sessão atual
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }
}

// Listener para mudanças de autenticação
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session?.user?.email)

  if (event === 'SIGNED_IN') {
    // Usuário logou
    console.log('User signed in:', session?.user?.email)
  } else if (event === 'SIGNED_OUT') {
    // Usuário deslogou
    console.log('User signed out')
  }
})

export default supabase
