'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { exchangeOAuthCode } from '@/lib/supabase-oauth-browser'
import { auth, supabase, syncCookieSessionFromOAuth } from '@/lib/supabase-client'
import { buildPanelLoginUrl, PUBLIC_PANEL_ENTRY, resolvePostLoginUrl } from '@/lib/panel-origin'
import { clearPanelFromCookieHeader } from '@/lib/panel-oauth-from'

function AuthCallbackInner() {
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('A concluir login…')
  const hasRun = useRef(false)

  useEffect(() => {
    const finish = async () => {
      if (hasRun.current) return
      hasRun.current = true

      const oauthError = searchParams.get('error')
      const oauthDesc = searchParams.get('error_description')
      const code = searchParams.get('code')

      if (oauthError) {
        const loginUrl = buildPanelLoginUrl(window.location.origin)
        loginUrl.searchParams.set('error', oauthError)
        loginUrl.searchParams.set(
          'error_description',
          oauthDesc || 'Erro ao autenticar com Google',
        )
        window.location.replace(loginUrl.toString())
        return
      }

      if (!code) {
        window.location.replace(buildPanelLoginUrl(window.location.origin).toString())
        return
      }

      setMessage('A validar sessão Google…')

      try {
        const session = await exchangeOAuthCode(code)
        window.history.replaceState({}, '', '/auth/callback')
        await syncCookieSessionFromOAuth(session)

        const user = session.user
        if (!user.user_metadata?.role) {
          await supabase.auth.updateUser({
            data: {
              ...user.user_metadata,
              role: 'guest',
              nome:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                user.email?.split('@')[0],
            },
          })
        }

        const role = await auth.getUserRole(user)

        const cleared = clearPanelFromCookieHeader()
        document.cookie = `${cleared.name}=; path=${cleared.options.path}; max-age=0`

        const target = resolvePostLoginUrl({
          origin: window.location.origin,
          role,
          from: PUBLIC_PANEL_ENTRY,
        })

        setMessage('A entrar no painel…')
        window.location.assign(
          target.startsWith('http') ? target : new URL(target, window.location.origin).toString(),
        )
      } catch (err) {
        const loginUrl = buildPanelLoginUrl(window.location.origin)
        loginUrl.searchParams.set('error', 'callback_error')
        loginUrl.searchParams.set(
          'error_description',
          err instanceof Error ? err.message : 'Erro desconhecido',
        )
        window.location.replace(loginUrl.toString())
      }
    }

    void finish()
  }, [searchParams])

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">A concluir login…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  )
}
