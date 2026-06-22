'use client'

import { createClient, type Session } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  'placeholder-key'

const OAUTH_STORAGE_KEY = 'vd-oauth-pkce'

let oauthClient: ReturnType<typeof createClient> | null = null

/** Cliente só para OAuth — PKCE em localStorage (fiável em localhost e após redirect Google). */
export function getOAuthBrowserClient() {
  if (typeof window === 'undefined') {
    throw new Error('OAuth client só está disponível no browser')
  }
  if (!oauthClient) {
    oauthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        storageKey: OAUTH_STORAGE_KEY,
        storage: window.localStorage,
      },
    })
  }
  return oauthClient
}

export async function startGoogleOAuth(redirectTo: string) {
  const client = getOAuthBrowserClient()
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
  if (error) throw error
}

export async function exchangeOAuthCode(code: string): Promise<Session> {
  const client = getOAuthBrowserClient()
  const { data, error } = await client.auth.exchangeCodeForSession(code)
  if (error || !data.session) {
    throw error ?? new Error('Sessão inválida após OAuth')
  }
  return data.session
}
