import { supabase } from '@/lib/supabase'
import { User as SupabaseUser } from '@supabase/auth-js'

export interface User {
  id: string
  email: string
  name?: string
}

export const authService = {
  async signUp(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })

    // If signUp succeeded, trigger server-side on-register to create profile
    try {
      if (data?.user?.email) {
        await fetch('/api/on-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: data.user.id, email: data.user.email, name })
        })
      }
    } catch (e) {
      console.warn('on-register hook failed:', e)
    }

    return { data, error }
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  onAuthStateChange(callback: (user: SupabaseUser | null) => void) {
    return supabase.auth.onAuthStateChange((event: any, session: any) => {
      callback(session?.user ?? null)
    })
  }
}
