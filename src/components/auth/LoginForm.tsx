'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useI18n } from '@/lib/i18n'
import { googleOAuthUserMessage } from '@/lib/auth-messages'
import { PUBLIC_PANEL_ENTRY, resolvePostLoginUrl } from '@/lib/panel-origin'
import { AuthPageShell, AuthLoadingShell } from '@/components/auth/AuthPageShell'
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

function LoginFormInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [internalField, setInternalField] = useState('')
  const [oauthError, setOauthError] = useState<{ title: string; desc: string } | null>(null)
  const { signIn, signInWithGoogle } = useAuth()
  const searchParams = useSearchParams()
  const { t } = useI18n()

  useEffect(() => {
    const urlError = searchParams.get('error')
    const urlErrorDesc = searchParams.get('error_description')
    if (urlError) {
      const { title, desc } = googleOAuthUserMessage(urlError, urlErrorDesc)
      setOauthError({ title, desc })
    }
  }, [searchParams])

  const goToPanel = (role: Parameters<typeof resolvePostLoginUrl>[0]['role']) => {
    const redirectTo = searchParams.get('redirect') || searchParams.get('next')
    if (redirectTo && typeof redirectTo === 'string' && redirectTo.startsWith('/')) {
      window.location.assign(redirectTo)
      return
    }
    window.location.assign(
      resolvePostLoginUrl({
        origin: window.location.origin,
        role,
        from: PUBLIC_PANEL_ENTRY,
      }),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (internalField) {
      console.warn('Honeypot triggered - might be a bot or aggressive autofill.')
    }
    setLoading(true)
    setError('')
    try {
      const role = await signIn(email, password)
      goToPanel(role)
    } catch (err: unknown) {
      const msg = String((err as Error)?.message || '')
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setError(
          'Email ou password incorrectos. Se ainda não tem conta, use «Criar conta». ' +
            'Se esqueceu a password, use «Esqueci a password».',
        )
      } else {
        setError((err as Error).message || t('login.errorGeneric'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true)
    setError('')
    try {
      await signInWithGoogle(PUBLIC_PANEL_ENTRY)
    } catch (err: unknown) {
      setLoadingGoogle(false)
      setOauthError({
        title: t('login.errorGoogleStart'),
        desc: (err as Error).message || t('login.errorGoogleDesc'),
      })
    }
  }

  return (
    <AuthPageShell>
      <div className={authCardClass}>
        <div>
        </div>

        {error && <div className={authErrorBoxClass}>{error}</div>}

        {oauthError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className={`w-full max-w-sm ${authCardClass}`}>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{oauthError.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{oauthError.desc}</p>
              <button
                type="button"
                onClick={() => setOauthError(null)}
                className={`mt-5 w-full ${authPrimaryBtnClass}`}
              >
                {t('login.close')}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="absolute -z-10 opacity-0 pointer-events-none" aria-hidden="true">
            <input
              type="text"
              name="_internal_hp_field"
              value={internalField}
              onChange={(e) => setInternalField(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div>
            <label className={authLabelClass}>{t('login.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
              placeholder="email@your-domain.com"
              required
            />
          </div>

          <div>
            <label className={authLabelClass}>{t('login.password')}</label>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
              >
                {showPassword ? (
                  <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                ) : (
                  <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                )}
              </button>
            </div>
            <a href="/auth/forgot-password" className={`mt-2 inline-block text-xs ${authLinkClass}`}>
              {t('login.forgotPassword')}
            </a>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className={`flex-1 ${authPrimaryBtnClass}`}>
              {loading ? t('login.submitting') : t('login.submit')}
            </button>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loadingGoogle}
              title="Entrar com Google"
              className={authGoogleBtnClass}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </button>
          </div>
        </form>

        <p className={`mt-4 text-center ${authMutedTextClass}`}>
          {t('login.noAccount')}{' '}
          <a href="/auth/register" className={authLinkClass}>
            {t('login.register')}
          </a>
        </p>
      </div>
    </AuthPageShell>
  )
}

export function LoginForm() {
  return (
    <Suspense fallback={<AuthLoadingShell />}>
      <LoginFormInner />
    </Suspense>
  )
}
