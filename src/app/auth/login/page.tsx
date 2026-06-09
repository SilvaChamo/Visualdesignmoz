'use client'
import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '../../../components/auth/AuthProvider'
import { useI18n } from '@/lib/i18n'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { googleOAuthUserMessage, LOGIN_NO_ACCOUNT_HINT } from '@/lib/auth-messages'

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [internalField, setInternalField] = useState('') // Honeypot field for bot protection
  const [oauthError, setOauthError] = useState<{ title: string, desc: string } | null>(null)
  const { signIn, signInWithGoogle, getRedirectPath, user, loading: sessionLoading } = useAuth()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const hasChecked = React.useRef(false)
  const [loadingTimeout, setLoadingTimeout] = React.useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoadingTimeout(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  // Ler erros de OAuth do URL (vindos do callback)
  useEffect(() => {
    const urlError = searchParams.get('error')
    const urlErrorDesc = searchParams.get('error_description')
    if (urlError) {
      const { title, desc } = googleOAuthUserMessage(urlError, urlErrorDesc)
      setOauthError({ title, desc })
    }
  }, [searchParams])

  useEffect(() => {
    // Só redireciona se a sessão foi verificada E o utilizador está autenticado
    // NÃO redireciona se vem do OAuth (callback já tratou disso)
    if (!sessionLoading) {
      if (!hasChecked.current) {
        hasChecked.current = true
      }
      // Se vem do OAuth callback, não interferir — o callback já redirecionou
      const isFromOAuth = window.location.search.includes('code=') ||
        document.referrer.includes('/auth/callback')
      if (user && !isFromOAuth) {
        getRedirectPath().then((path) => {
          window.location.assign(path)
        })
      }
    }
  }, [user, sessionLoading])

  if (sessionLoading && !loadingTimeout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Honeypot check: if 'internalField' is filled, it's likely a bot or autofill
    if (internalField) {
      console.warn('Honeypot triggered - might be a bot or aggressive autofill.')
      // Proceed anyway but log it, to avoid blocking legitimate users
    }

    setLoading(true)
    setError('')
    console.log('Tentando login com:', { email, passwordLength: password.length })
    try {
      await signIn(email, password)
      const redirectPath = await getRedirectPath()
      console.log('Login bem-sucedido, redirecionando para:', redirectPath)

      // FORÇAR redirecionamento real para que os cookies SSR cheguem ao servidor Next.js
      window.location.assign(redirectPath)
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
      await signInWithGoogle()
      // O browser será redirecionado automaticamente
    } catch (err: unknown) {
      setLoadingGoogle(false)
      setOauthError({
        title: t('login.errorGoogleStart'),
        desc: (err as Error).message || t('login.errorGoogleDesc'),
      })
    }
  }

  return (
    <div className="font-panel relative flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-red-500/10 blur-3xl dark:bg-red-500/20" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-zinc-300/30 blur-3xl dark:bg-zinc-700/20" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        <a href="/" className="mb-8 block">
          <img
            src="/assets/logotipoII.png"
            alt="VisualDesign"
            className="h-16 object-contain dark:brightness-110"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </a>

        <div className="w-full max-w-[420px] rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Iniciar sessão
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Aceda ao painel VisualDesign
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {oauthError && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{oauthError.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{oauthError.desc}</p>
                <button
                  onClick={() => setOauthError(null)}
                  className="mt-5 w-full rounded-md bg-red-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
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
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('login.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="email@your-domain.com"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('login.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 pr-10 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
              <a
                href="/auth/forgot-password"
                className="mt-2 inline-block text-xs font-medium text-red-600 hover:text-red-500 dark:text-red-400"
              >
                {t('login.forgotPassword')}
              </a>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-md bg-red-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t('login.submitting') : t('login.submit')}
              </button>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loadingGoogle}
                title="Entrar com Google"
                className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2.5 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-800"
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

          <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {LOGIN_NO_ACCOUNT_HINT}
          </p>

          <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
            {t('login.noAccount')}{' '}
            <a href="/auth/register" className="font-medium text-red-600 hover:text-red-500 dark:text-red-400">
              {t('login.register')}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
