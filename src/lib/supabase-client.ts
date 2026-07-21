'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import {
  resolveUserRole,
  getRedirectPathForRole,
  type UserRole,
} from '@/lib/user-roles'
import { getOAuthCallbackUrl } from '@/lib/oauth-callback'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  'placeholder-key'

function resolveBrowserCookieOptions() {
  if (typeof window === 'undefined') {
    return { path: '/', sameSite: 'lax' as const }
  }
  const host = window.location.hostname.toLowerCase()
  const secure = window.location.protocol === 'https:'
  if (host.endsWith('visualdesignmoz.com')) {
    return {
      domain: '.visualdesignmoz.com',
      path: '/',
      sameSite: 'lax' as const,
      secure,
    }
  }
  return { path: '/', sameSite: 'lax' as const, secure }
}

let browserClient: ReturnType<typeof createBrowserClient> | null = null

function getBrowserClient() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase browser client só está disponível no browser')
  }
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: false },
      cookieOptions: resolveBrowserCookieOptions(),
    })
  }
  return browserClient
}

/** Copia sessão OAuth para cookies do browser (UI) e do servidor (proxy). */
export async function syncCookieSessionFromOAuth(session: {
  access_token: string
  refresh_token: string
}) {
  const syncRes = await fetch('/api/auth/sync-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  })
  if (!syncRes.ok) {
    const payload = (await syncRes.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || 'Não foi possível guardar a sessão')
  }

  const { error } = await getBrowserClient().auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) throw error
}

/** Cliente Supabase só no browser — evita PKCE perdido em pré-render do servidor. */
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    const client = getBrowserClient() as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
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
  panel_id?: number
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
  senha_servidor?: string
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
  // Login — Auth primeiro; fallback com password guardada (ProvisualCorporate)
  async signIn(loginId: string, password: string) {
    let normalizedEmail = loginId.trim().toLowerCase();

    // Tradução de Nome de Utilizador para Email
    if (!normalizedEmail.includes('@')) {
      if (normalizedEmail === 'osher' || normalizedEmail === 'oshercollective') {
        normalizedEmail = 'osher@oshercollective.com';
      } else if (normalizedEmail === 'admin' || normalizedEmail === 'silvachamo') {
        normalizedEmail = 'silva.chamo@gmail.com';
      } else {
        normalizedEmail = `${normalizedEmail}@visualdesignmoz.com`;
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (!error) return data;

    const invalid =
      error.message?.toLowerCase().includes('invalid login credentials') ||
      error.message?.toLowerCase().includes('invalid credentials');

    if (invalid) {
      try {
        const syncRes = await fetch('/api/auth/panel-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password }),
        });
        if (syncRes.ok) {
          const retry = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (!retry.error) return retry.data;
        }
      } catch {
        /* manter erro original */
      }
    }

    throw error;
  },

  // Registrar novo usuário
  async signUp(email: string, password: string, metadata: { nome: string; telefone?: string }) {
    console.log('supabase-client auth.signUp: Initing signup for:', email)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { ...metadata, role: 'guest' },
        emailRedirectTo: getOAuthCallbackUrl()
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
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://visualdesignmoz.com'
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/auth/reset-password`
    })

    if (error) {
      console.error('supabase-client auth.resetPassword: Error:', error)
      throw error
    }
    console.log('supabase-client auth.resetPassword: Email sent successfully')
  },

  // Obter usuário actual
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Verificar role do utilizador (usa sessão local; evita getUser() extra após login)
  async getUserRole(userHint?: User | null): Promise<UserRole> {
    let user = userHint ?? null
    if (!user) {
      const { data: { session } } = await supabase.auth.getSession()
      user = session?.user ?? null
    }
    if (!user) return 'guest'

    const { profileAuthOrFilter } = await import('@/lib/profile-db')
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, da_username')
      .or(profileAuthOrFilter(user.id))
      .maybeSingle()

    return resolveUserRole({
      email: user.email,
      userMetadata: user.user_metadata,
      appMetadata: user.app_metadata,
      profileRole: profile?.role,
      daUsername: profile?.da_username ?? null,
    })
  },


  // Manter isAdmin para compatibilidade
  async isAdmin(): Promise<boolean> {
    const role = await this.getUserRole()
    return role === 'admin'
  },

  // Redirecionamento por role — sem API pesada de produtos no momento do login
  async getRedirectPath(userHint?: User | null, cachedRole?: UserRole | null): Promise<string> {
    const role = cachedRole ?? (await this.getUserRole(userHint))
    return getRedirectPathForRole(role)
  },

  // Obter sessão actual
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }
}

// Listener para mudanças de autenticação (evitar init com ?code= no callback OAuth)
if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/callback')) {
  getBrowserClient().auth.onAuthStateChange((event: any, session: any) => {
    console.log('Auth state changed:', event, session?.user?.email)

    if (event === 'SIGNED_IN') {
      console.log('User signed in:', session?.user?.email)
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out')
    }
  })
}

// Função createClientInstance para compatibilidade
export function createClientInstance() {
  return getBrowserClient()
}

export default supabase
