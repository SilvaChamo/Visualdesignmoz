'use client'
import React, { useState } from 'react'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import {
  authCardClass,
  authErrorBoxClass,
  authHintBoxClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authMutedTextClass,
  authPrimaryBtnClass,
} from '@/components/auth/auth-styles'

function formatResetError(err: unknown): string {
  if (err instanceof Error && err.message && err.message !== '{}') return err.message
  return 'Não foi possível enviar o email de recuperação. Tente mais tarde.'
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const ct = res.headers.get('content-type') || ''
      const data = ct.includes('application/json')
        ? await res.json().catch(() => ({}))
        : {
            error:
              res.status === 404
                ? 'Serviço indisponível. Aguarde o redeploy do site.'
                : `Erro ${res.status} ao enviar email.`,
          }
      if (!res.ok) {
        throw new Error(String(data?.error || 'Erro ao enviar email.'))
      }
      setEnviado(true)
    } catch (err: unknown) {
      setError(formatResetError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell>
      <div className={authCardClass}>
        {enviado ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
              <svg className="h-8 w-8 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-green-600 dark:text-green-400">Email enviado com sucesso</h2>
            <p className={`text-sm ${authMutedTextClass}`}>
              Enviámos um link para <span className="font-semibold text-zinc-900 dark:text-zinc-100">{email}</span>
            </p>
            <div className={`mt-5 ${authHintBoxClass}`}>
              <p className="text-left">Verifica a caixa de entrada e a pasta de spam. O link expira em 60 minutos.</p>
            </div>
            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setEnviado(false)}
                className={`text-xs font-medium uppercase tracking-wider ${authLinkClass}`}
              >
                Reenviar email
              </button>
              <a href="/auth/login" className={authMutedTextClass}>← Voltar ao login</a>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Recuperar password
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Enviaremos um link seguro para o seu email
              </p>
            </div>

            {error && <div className={authErrorBoxClass}>{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={authLabelClass}>E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={authInputClass}
                  placeholder="email@your-domain.com"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className={`w-full ${authPrimaryBtnClass}`}>
                {loading ? 'A enviar...' : 'Enviar link de recuperação'}
              </button>
            </form>

            <div className={`mt-5 ${authHintBoxClass}`}>
              Por segurança, não indicamos se o email existe no sistema.
            </div>

            <p className="mt-6 text-center">
              <a href="/auth/login" className={authMutedTextClass}>← Voltar ao login</a>
            </p>
          </>
        )}
      </div>
    </AuthPageShell>
  )
}
