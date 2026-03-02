'use client'
import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../components/auth/AuthProvider'

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [oauthError, setOauthError] = useState<{ title: string, desc: string } | null>(null)
  const { signIn, getRedirectPath, user, loading: sessionLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
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
      let title = 'Erro de Autenticação'
      let desc = urlErrorDesc || 'Ocorreu um erro inesperado.'
      if (urlError === 'access_denied') {
        title = 'Acesso Negado'
        desc = 'Cancelaste o login com Google ou a conta não tem permissões suficientes.'
      } else if (urlError === 'callback_error') {
        title = 'Erro no Callback'
        desc = desc
      }
      setOauthError({ title, desc })
    }
  }, [searchParams])

  useEffect(() => {
    // Só redireciona se a sessão foi verificada E o utilizador está autenticado
    // Ignora o estado inicial antes da verificação terminar
    if (!sessionLoading) {
      if (!hasChecked.current) {
        hasChecked.current = true
      }
      if (user) {
        getRedirectPath().then((path) => router.push(path))
      }
    }
  }, [user, sessionLoading])

  if (sessionLoading && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    console.log('Tentando login com:', { email, passwordLength: password.length })
    try {
      await signIn(email, password)
      const redirectPath = await getRedirectPath()
      console.log('Login bem-sucedido, redirecionando para:', redirectPath)
      router.push(redirectPath)
    } catch (err: unknown) {
      const msg = String((err as Error)?.message || '')
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setError('Credenciais inválidas. Verifique o email e a password.')
      } else {
        setError((err as Error).message || 'Erro ao fazer login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true)
    setError('')
    try {
      const { supabase } = await import('../../../lib/supabase-client')
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (oauthErr) throw oauthErr
      // O browser será redirecionado automaticamente
    } catch (err: unknown) {
      setLoadingGoogle(false)
      setOauthError({
        title: 'Erro ao iniciar login com Google',
        desc: (err as Error).message || 'Não foi possível iniciar a autenticação com Google.',
      })
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Gradiente apenas no canto superior esquerdo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          style={{
            position: 'absolute',
            top: '-15%',
            left: '-15%',
            width: '65%',
            height: '65%',
            background: 'radial-gradient(ellipse at top left, rgba(180,0,0,0.65) 0%, rgba(120,0,0,0.4) 45%, transparent 75%)',
            filter: 'blur(45px)',
          }}
        />
      </div>

      {/* Logo no topo */}
      <div className="flex flex-col items-center mb-6 z-10 transition-all duration-300">
        <img
          src="/assets/logotipoII.png"
          alt="VisualDesigne"
          className="h-32 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>

      {/* Formulário com glassmorphism */}
      <div
        className="w-full max-w-md rounded-2xl p-10 z-10"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {error && (
          <div className="mb-5 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Modal de Erro OAuth */}
        {oauthError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-red-900/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-white text-lg font-bold mb-2 uppercase tracking-tight">{oauthError.title}</h3>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  {oauthError.desc}
                </p>
                <button
                  onClick={() => setOauthError(null)}
                  className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg transition-colors uppercase text-xs tracking-widest"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Campo Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-all duration-200"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(127, 0, 0, 0.4)',
                color: 'white',
              }}
              placeholder="email@visualdesigne.com"
              required
            />
          </div>

          {/* Campo Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Palavra-passe
            </label>
            <div className="relative mb-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-all duration-200 pr-12"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(127, 0, 0, 0.4)',
                  color: 'white',
                }}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition text-sm"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div className="flex justify-start mt-2">
              <a href="/auth/forgot-password" className="text-xs text-red-500 hover:text-red-400 uppercase tracking-widest font-semibold transition">
                ESQUECEU A SENHA?
              </a>
            </div>
          </div>

          {/* Botões lado a lado */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-200 shadow-lg shadow-red-900/20 uppercase tracking-widest"
            >
              {loading ? 'A ENTRAR...' : 'ENTRAR'}
            </button>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loadingGoogle}
              title="Entrar com Google"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold transition-all duration-200 hover:bg-white/10"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'white',
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {loadingGoogle ? '...' : ''}
            </button>
          </div>
        </form>

        {/* Link registo */}
        <p className="text-center text-white/50 text-sm mt-6">
          Ainda não tens conta?{' '}
          <a href="/auth/register" className="text-white hover:text-red-400 transition font-semibold uppercase tracking-wider">
            Registe-se
          </a>
        </p>
      </div>

      {/* Linha vermelha no rodapé */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ height: '3px', background: 'linear-gradient(90deg, #7f0000, #cc0000, #7f0000)' }}
      />

    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
