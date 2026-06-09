'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import {
  authCardClass,
  authErrorBoxClass,
  authInputClass,
  authLabelClass,
  authMutedTextClass,
  authPrimaryBtnClass,
} from '@/components/auth/auth-styles'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Sessão expirada ou inválida. Solicite um novo link de recuperação.')
      }
    }
    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmar) {
      setError('As passwords não coincidem.')
      return
    }
    if (password.length < 6) {
      setError('A password deve ter no mínimo 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Sessão inválida. Utilize o link enviado por email novamente.')
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setSucesso(true)
      await supabase.auth.signOut()
      setTimeout(() => router.push('/auth/login?reset=success'), 3000)
    } catch (err: unknown) {
      setError((err as Error).message || 'Erro ao atualizar a password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell>
      <div className={authCardClass}>
        {sucesso ? (
          <div className="py-6 text-center">
            <p className="text-4xl mb-4">🎉</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Password atualizada</p>
            <p className={`text-sm ${authMutedTextClass}`}>A redirecionar para o login...</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Nova password
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Defina a sua nova palavra-passe de acesso
              </p>
            </div>

            {error && <div className={authErrorBoxClass}>{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={authLabelClass}>Nova password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${authInputClass} pr-10`}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
              <div>
                <label className={authLabelClass}>Confirmar password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    className={`${authInputClass} pr-10`}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
                  >
                    {showConfirmPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className={`w-full ${authPrimaryBtnClass}`}>
                {loading ? 'A atualizar...' : 'Atualizar password'}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthPageShell>
  )
}
