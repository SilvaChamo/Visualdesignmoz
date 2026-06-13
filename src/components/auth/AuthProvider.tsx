'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase, auth } from '@/lib/supabase-client'
import { User } from '@supabase/supabase-js'
import { getRedirectPathForRole, type UserRole } from '@/lib/user-roles'
import { getInactivityConfig } from '@/lib/session-inactivity'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  userRole: 'admin' | 'reseller' | 'client' | 'guest' | null
  signIn: (email: string, password: string) => Promise<UserRole>
  signInWithGoogle: () => Promise<void>
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
  const [userRole, setUserRole] = useState<'admin' | 'reseller' | 'client' | 'guest' | null>(null)

  useEffect(() => {
    const initializeAuth = async () => {
      const timeout = setTimeout(() => setLoading(false), 800)

      try {
        const session = await auth.getSession()
        const currentUser = session?.user || null
        setUser(currentUser)

        if (currentUser) {
          try {
            const role = await auth.getUserRole(currentUser)
            setUserRole(role)
            setIsAdmin(role === 'admin')
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
  }, [])

  // Inatividade: 10 min no painel DirectAdmin; 20 min no resto da aplicação
  useEffect(() => {
    if (!user) return

    let timeoutId: NodeJS.Timeout
    const { limitMs, minutes, reason } = getInactivityConfig(pathname)

    const handleAutomaticSignOut = async () => {
      try {
        console.log(`Inatividade detectada por ${minutes} minutos. Deslogando utilizador...`)
        await auth.signOut()
        setUser(null)
        setIsAdmin(false)
        setUserRole(null)
        window.location.href = `/auth/login?reason=${reason}`
      } catch (err) {
        console.error('Erro ao efetuar logout por inatividade:', err)
        window.location.href = `/auth/login?reason=${reason}`
      }
    }

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(handleAutomaticSignOut, limitMs)
    }

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ]

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer)
    })

    resetTimer()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer)
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

  const signInWithGoogle = async () => {
    try {
      // Remover setLoading(true) para evitar que a página bloqueie no loading
      const redirectUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`
      console.log('Google OAuth: Iniciando login...')
      console.log('Redirect URL:', redirectUrl)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })

      if (error) {
        console.error('Google OAuth Error:', error)
        throw error
      }

      console.log('Google OAuth: Redirecionando para Google...')
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
