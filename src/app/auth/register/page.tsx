'use client'
import React, { useState } from 'react'
import { useAuth } from '../../../components/auth/AuthProvider'
import { googleOAuthUserMessage } from '@/lib/auth-messages'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import {
  authCardClass,
  authErrorBoxClass,
  authGoogleBtnClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authMutedTextClass,
  authPrimaryBtnClass,
} from '@/components/auth/auth-styles'

export default function RegisterPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const { signInWithGoogle } = useAuth()

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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nome }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar conta.')
      }
      setSucesso(true)
    } catch (err: unknown) {
      setError((err as Error).message || 'Erro ao criar conta.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      setLoadingGoogle(false)
      const { desc } = googleOAuthUserMessage('callback_error', (err as Error).message)
      setError(desc)
    }
  }

  return (
    <AuthPageShell wide>
      <div className={authCardClass}>
        {sucesso ? (
          <div className="py-6 text-center">
            <p className="text-4xl mb-4">📧</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Conta criada</p>
            <p className={`text-sm ${authMutedTextClass} mb-2`}>Pode entrar agora com:</p>
            <p className={`font-semibold break-all ${authLinkClass}`}>{email}</p>
            <p className={`mt-4 text-xs ${authMutedTextClass}`}>
              A conta começa como visitante — após a primeira compra passa a cliente.
            </p>
            <a href="/auth/login" className={`mt-6 inline-block ${authPrimaryBtnClass} px-6`}>
              Ir para entrar →
            </a>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Criar conta
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Aceda à plataforma VisualDesign
              </p>
            </div>

            {error && <div className={authErrorBoxClass}>{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={authLabelClass}>Nome completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className={authInputClass}
                  placeholder="O seu nome"
                  required
                />
              </div>
              <div>
                <label className={authLabelClass}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={authInputClass}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={authLabelClass}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${authInputClass} pr-10`}
                      placeholder="Mín. 6"
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
                  <label className={authLabelClass}>Confirmar</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmar}
                      onChange={(e) => setConfirmar(e.target.value)}
                      className={`${authInputClass} pr-10`}
                      placeholder="Repetir"
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
              </div>

              <button type="submit" disabled={loading} className={`w-full ${authPrimaryBtnClass}`}>
                {loading ? 'A criar...' : 'Registar'}
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loadingGoogle}
                title="Registar com Google"
                className={`flex w-full justify-center gap-2 ${authGoogleBtnClass}`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {loadingGoogle ? 'A ligar...' : 'Continuar com Google'}
              </button>
            </form>

            <p className={`mt-6 text-center ${authMutedTextClass}`}>
              Já tem conta?{' '}
              <a href="/auth/login" className={authLinkClass}>Entrar</a>
            </p>
          </>
        )}
      </div>
    </AuthPageShell>
  )
}
