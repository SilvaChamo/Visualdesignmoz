'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { auth } from '@/lib/supabase-client'
import { useI18n } from '@/lib/i18n'
import { googleOAuthUserMessage } from '@/lib/auth-messages'
import { PUBLIC_PANEL_ENTRY } from '@/lib/panel-origin'
import { preCarregarDadosVhost } from '@/lib/vhost-cache'
import type { UserRole } from '@/lib/user-roles'
import { AuthLoadingShell } from '@/components/auth/AuthPageShell'
import { LoginDividido } from '@/components/auth/LoginDividido'
import {
  authCardClass,
  authErrorBoxClass,
  authLinkClass,
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
  const router = useRouter()
  const { t } = useI18n()

  useEffect(() => {
    const urlError = searchParams.get('error')
    const urlErrorDesc = searchParams.get('error_description')
    if (urlError) {
      const { title, desc } = googleOAuthUserMessage(urlError, urlErrorDesc)
      setOauthError({ title, desc })
    }
  }, [searchParams])

  /** Lê os dados do painel ainda no ecrã de login (o botão fica em "A entrar…") e guarda-os no navegador: o painel
   * abre logo com o conteúdo, sem o ecrã branco com o círculo depois das credenciais (pedido do Silva, 13/10/2026 —
   * só na entrada pelo site; a entrada pelo próprio painel fica como está). Se falhar, o painel lê ao abrir. */
  const prefetchPanelData = async (role: UserRole) => {
    if (role === 'guest') return
    await preCarregarDadosVhost()
  }

  const goToPanel = async (role: Awaited<ReturnType<typeof auth.getUserRole>>) => {
    const redirectTo = searchParams.get('redirect') || searchParams.get('next')
    const pedido = redirectTo && typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : null
    const target = pedido || (await auth.getRedirectPath(undefined, role))
    // O painel abre sem recarregar a página (pedido do Silva, 13/10/2026): este ecrã fica à vista, com "A entrar…",
    // até o painel aparecer já com os dados lidos acima — sem a página branca com a roda pelo meio
    if (/^\/host(:|%3a)2026(\/|$)/i.test(target)) {
      router.push(target)
      return
    }
    window.location.assign(pedido || new URL(target, window.location.origin).toString())
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
      await prefetchPanelData(role)
      // o botão fica em "A entrar…" até a página seguinte aparecer
      await goToPanel(role)
    } catch (err: unknown) {
      setLoading(false)
      const msg = String((err as Error)?.message || '')
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setError(
          'Email ou password incorrectos. Se ainda não tem conta, use «Criar conta». ' +
            'Se esqueceu a password, use «Esqueci a password».',
        )
      } else {
        setError((err as Error).message || t('login.errorGeneric'))
      }
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
    <LoginDividido>
      {/* no telemóvel e no tablet a imagem (com o logótipo) não aparece: o logótipo fica por cima do formulário */}
      <a href="/" className="mb-5 flex justify-center lg:hidden" title="VisualDesign">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logotype.png" alt="VisualDesign" className="h-[80px] w-auto object-contain dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logotipoII.png" alt="VisualDesign" className="hidden h-[80px] w-auto object-contain dark:block" />
      </a>

      {/* no telemóvel e no tablet tudo ao centro (pedido do Silva, 13/10/2026) */}
      <h1 className="text-center text-[28px] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50 lg:text-left">{t('login.title')}</h1>
      <p className="mt-2 text-center text-[15px] text-zinc-500 dark:text-zinc-400 lg:text-left">{t('login.subtitle')}</p>

      {error && <div className={`mt-6 ${authErrorBoxClass}`}>{error}</div>}

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

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 lg:mt-8 lg:space-y-5">
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

        <CampoFlutuante
          id="login-user"
          rotulo={t('login.user')}
          dica={t('login.userPlaceholder')}
          autoComplete="username"
          value={email}
          onChange={setEmail}
        />

        <div>
          <CampoFlutuante
            id="login-senha"
            rotulo={t('login.password')}
            dica="••••••••"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            minLength={6}
            value={password}
            onChange={setPassword}
          >
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
          </CampoFlutuante>
        </div>

        <button type="submit" disabled={loading} className={`h-11 w-full ${authPrimaryBtnClass} text-[15px] font-semibold`}>
          {loading ? t('login.signingIn') : t('login.signIn')}
        </button>


        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-[#393e4d]" />
          {t('login.or')}
          <span className="h-px flex-1 bg-zinc-200 dark:bg-[#393e4d]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loadingGoogle}
          className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-zinc-300 bg-white text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-[#393e4d] dark:bg-[#272a34] dark:text-zinc-200 dark:hover:bg-[#303440]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {t('login.google')}
        </button>

        {/* por baixo do Google: recuperar a senha à esquerda, registar à direita (pedido do Silva, 13/10/2026) */}
        <div className="flex items-center justify-between gap-4 text-sm">
          <a href="/auth/forgot-password" className={authLinkClass}>
            {t('login.forgot')}
          </a>
          <a href="/auth/register" className={authLinkClass}>
            {t('login.register')}
          </a>
        </div>
      </form>

    </LoginDividido>
  )
}

/** Campo com a etiqueta a meio; ao clicar (ou já preenchido) a etiqueta sobe para a linha de cima do campo
 *  (pedido do Silva, 13/10/2026). A dica (ex.: o formato do e-mail) só aparece com o campo escolhido. No telemóvel e no
 *  tablet a etiqueta e o texto ficam ao centro. */
function CampoFlutuante({
  id,
  rotulo,
  dica,
  type = 'text',
  autoComplete,
  minLength,
  value,
  onChange,
  children,
}: {
  id: string
  rotulo: string
  dica?: string
  type?: string
  autoComplete?: string
  minLength?: number
  value: string
  onChange: (v: string) => void
  children?: React.ReactNode
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        minLength={minLength}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={dica || ' '}
        className={
          'peer h-12 w-full rounded-md border border-zinc-300 bg-transparent px-3.5 text-center text-[15px] text-zinc-900 outline-none transition-colors lg:text-left ' +
          'placeholder:text-transparent focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:placeholder:text-zinc-400 ' +
          'dark:border-[#393e4d] dark:text-zinc-100 dark:focus:border-red-500 dark:focus:placeholder:text-zinc-500 ' +
          (children ? 'px-10 lg:pl-3.5' : '')
        }
      />
      <label
        htmlFor={id}
        className={
          'pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-white px-1 text-xs font-medium text-zinc-500 transition-all duration-150 lg:left-2.5 lg:translate-x-0 ' +
          'peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:font-normal ' +
          'peer-focus:top-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-red-600 ' +
          'dark:bg-[#15161e] dark:text-zinc-400 dark:peer-focus:text-red-400'
        }
      >
        {rotulo}
      </label>
      {children}
    </div>
  )
}

export function LoginForm() {
  return (
    <Suspense fallback={<AuthLoadingShell />}>
      <LoginFormInner />
    </Suspense>
  )
}
