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
      try {
        const session = await auth.getSession()
        const currentUser = session?.user || null
        console.log('AuthProvider initializeAuth: User:', currentUser?.email)
        setUser(currentUser)

        if (currentUser) {
          const role = await auth.getUserRole()
          console.log('AuthProvider initializeAuth: Role:', role)
          setUserRole(role)
          setIsAdmin(role === 'admin')
        }
      } catch (error) {
        console.error('AuthProvider initializeAuth: Error:', error)
      } finally {
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
      setLoading(true)
      console.log('AuthProvider signIn: Attempting login for:', email)
      const data = await auth.signIn(email, password)
      console.log('AuthProvider signIn: Sign-in successful, data:', data.user?.email)

      if (data.user) {
        const role = await auth.getUserRole()
        console.log('AuthProvider signIn: Role determined:', role)
        setUserRole(role)
        setIsAdmin(role === 'admin')
      }
    } catch (error) {
      console.error('AuthProvider signIn: Error:', error)
      throw error
    } finally {
      setLoading(false)
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
    } catch (error) {
      console.error('AuthProvider resetPassword: Error:', error)
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
