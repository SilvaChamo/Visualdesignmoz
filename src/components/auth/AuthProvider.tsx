'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, auth } from '@/lib/supabase-client'
import { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  userRole: 'admin' | 'reseller' | 'client' | null
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUp: (email: string, password: string, nome: string, telefone?: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  getRedirectPath: () => Promise<string>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'reseller' | 'client' | null>(null)

  useEffect(() => {
    // Verificar sessão inicial
    const initializeAuth = async () => {
      // Safety timeout - never let loading hang more than 3 seconds
      const timeout = setTimeout(() => {
        console.log('AuthProvider: Init timeout reached, forcing loading=false')
        setLoading(false)
      }, 3000)

      try {
        const session = await auth.getSession()
        const currentUser = session?.user || null
        setUser(currentUser)

        if (currentUser) {
          try {
            const role = await auth.getUserRole()
            setUserRole(role)
            setIsAdmin(role === 'admin')
          } catch (roleError) {
            console.error('AuthProvider: Error getting role:', roleError)
            // Default to client if role check fails
            setUserRole('client')
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

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthProvider onAuthStateChange:', event, session?.user?.email)
        const currentUser = session?.user || null
        setUser(currentUser)

        if (currentUser) {
          const role = await auth.getUserRole()
          console.log('AuthProvider onAuthStateChange: Role:', role)
          setUserRole(role)
          setIsAdmin(role === 'admin')
        } else {
          console.log('AuthProvider onAuthStateChange: User logged out')
          setIsAdmin(false)
          setUserRole(null)
        }

        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      // Do NOT set loading=true here — it hides the login form
      const data = await auth.signIn(email, password)

      if (data.user) {
        try {
          const role = await auth.getUserRole()
          setUserRole(role)
          setIsAdmin(role === 'admin')
        } catch {
          setUserRole('client')
          setIsAdmin(false)
        }
        setUser(data.user)
      }
    } catch (error) {
      console.error('AuthProvider signIn: Error:', error)
      throw error
    }
  }

  const signUp = async (email: string, password: string, nome: string, telefone?: string) => {
    try {
      setLoading(true)
      await auth.signUp(email, password, { nome, telefone })
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
      console.log('AuthProvider resetPassword: Requesting enriched email for:', email)

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar email de recuperação.')

      console.log('AuthProvider resetPassword: Success:', data)
    } catch (error) {
      console.error('AuthProvider resetPassword: Error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('AuthProvider signInWithGoogle: Error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const getRedirectPath = async () => {
    return await auth.getRedirectPath()
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
