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

    // Rerunning onAuthStateChange is not recommended with SSR cookies, 
    // as it can conflict with the server requests. We only rely on initializeAuth.
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
