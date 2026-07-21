'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { startGoogleOAuth } from '@/lib/supabase-oauth-browser'
import { supabase, auth } from '@/lib/supabase-client'
import { User } from '@supabase/supabase-js'
import { getRedirectPathForRole, type UserRole } from '@/lib/user-roles'
import { PUBLIC_PANEL_ENTRY } from '@/lib/panel-origin'
import { setPanelFromCookie } from '@/lib/panel-oauth-from'
import { getInactivityConfig, touchPanelActivity, isIdleBeyond, clearPanelActivity } from '@/lib/session-inactivity'
import { prefetchPanelContentOnLogin } from '@/lib/panel-prefetch'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  userRole: UserRole | null
  signIn: (email: string, password: string) => Promise<UserRole>
  signInWithGoogle: (fromPath?: string | null) => Promise<void>
  signUp: (email: string, password: string, nome: string, telefone?: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  getRedirectPath: () => Promise<string>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)

  useEffect(() => {
    const initializeAuth = async () => {
      const timeout = setTimeout(() => setLoading(false), 800)

      try {
        const session = await auth.getSession()
        const currentUser = session?.user || null
        setUser(currentUser)

        if (currentUser) {
          touchPanelActivity()
          try {
            const role = await auth.getUserRole(currentUser)
            setUserRole(role)
            setIsAdmin(role === 'admin')
            void prefetchPanelContentOnLogin(role)
          } catch (roleError) {
            console.error('AuthProvider: Error getting role:', roleError)
            setUserRole('guest')
            setIsAdmin(false)
          }
        }
      } catch (error) {
        console.error('AuthProvider initializeAuth: Error:', error)
      } finally {
        clearTimeout(timeout)
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === 'SIGNED_OUT') {
        clearPanelActivity()
        setUser(null)
        setIsAdmin(false)
        setUserRole(null)
        return
      }
      if (session?.user) {
        setUser(session.user)
        if (event === 'SIGNED_IN') {
          touchPanelActivity()
          void auth.getUserRole(session.user).then((role) => {
            setUserRole(role)
            setIsAdmin(role === 'admin')
            void prefetchPanelContentOnLogin(role)
          }).catch(() => undefined)
        }
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Inatividade: 25 min no painel; refresh de sessão Supabase para não expirar token à toa
  useEffect(() => {
    if (!user) return

    const { limitMs, minutes, reason } = getInactivityConfig(pathname)
    let signingOut = false

    const handleAutomaticSignOut = async () => {
      if (signingOut || !isIdleBeyond(limitMs)) return
      signingOut = true
      try {
        console.log(`Inatividade detectada por ${minutes} minutos. Deslogando utilizador...`)
        clearPanelActivity()
        await auth.signOut()
        setUser(null)
        setIsAdmin(false)
        setUserRole(null)
        window.location.href = `/login?reason=${reason}`
      } catch (err) {
        console.error('Erro ao efectuar logout por inatividade:', err)
        window.location.href = `/login?reason=${reason}`
      }
    }

    const onActivity = () => {
      touchPanelActivity()
    }

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const

    activityEvents.forEach((event) => {
      window.addEventListener(event, onActivity, { passive: true })
    })

    const checkInterval = window.setInterval(() => {
      if (isIdleBeyond(limitMs)) {
        void handleAutomaticSignOut()
      }
    }, 30_000)

    const refreshInterval = window.setInterval(() => {
      if (!isIdleBeyond(limitMs)) {
        void supabase.auth.getSession()
      }
    }, 10 * 60 * 1000)

    return () => {
      window.clearInterval(checkInterval)
      window.clearInterval(refreshInterval)
      activityEvents.forEach((event) => {
        window.removeEventListener(event, onActivity)
      })
    }
  }, [user, pathname])

  const signIn = async (email: string, password: string): Promise<UserRole> => {
    try {
      const data = await auth.signIn(email, password)
      let role: UserRole = 'guest'

      if (data.user) {
        try {
          role = await auth.getUserRole(data.user)
          setUserRole(role)
          setIsAdmin(role === 'admin')
        } catch {
          role = 'guest'
          setUserRole(role)
          setIsAdmin(false)
        }
        setUser(data.user)
        touchPanelActivity()
        void prefetchPanelContentOnLogin(role)
      }

      return role
    } catch (error) {
      console.error('AuthProvider signIn: Error:', error)
      throw error
    }
  }

  const signUp = async (email: string, password: string, nome: string, telefone?: string) => {
    try {
      setLoading(true)
      const result = await auth.signUp(email, password, { nome, telefone })

      // Após o registo, tentar criar a conta de email no servidor e sincronizar com Supabase
      try {
        const parts = email.split('@')
        const user = parts[0]
        const domain = parts[1]
        if (user && domain) {
          fetch('/api/email-contas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domainName: domain, userName: user, password })
          }).then(async res => {
            try {
              const data = await res.json()
              console.log('Email create attempt result:', data)
            } catch {
              console.log('Email create responded (no-json)')
            }
          }).catch(err => console.error('Erro ao chamar /api/email-contas:', err))
        }
      } catch (emailErr) {
        console.error('Erro ao tentar criar conta de email após registo:', emailErr)
      }
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      await auth.signOut()
      clearPanelActivity()
      setUser(null)
      setIsAdmin(false)
      setUserRole(null)
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      setLoading(true)
      await auth.resetPassword(email)
    } catch (error) {
      console.error('AuthProvider resetPassword: Error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async (fromPath?: string | null) => {
    try {
      setPanelFromCookie()

      await startGoogleOAuth()
    } catch (error) {
      console.error('Google OAuth Exception:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const getRedirectPath = async () => {
    if (userRole) return getRedirectPathForRole(userRole)
    return await auth.getRedirectPath(user)
  }

  const value = {
    user,
    loading,
    isAdmin,
    userRole,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    getRedirectPath
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthProvider
