'use client'

import { useEffect } from 'react'
import { getCanonicalBrowserAuthOrigin, OAUTH_CALLBACK_PATH } from '@/lib/oauth-callback'

/**
 * O Google por vezes devolve ?code= fora de /auth/callback.
 * Reencaminha automaticamente para a rota única de callback.
 */
export function OAuthCodeRedirect() {
  useEffect(() => {
    const { pathname, search } = window.location
    if (!search.includes('code=')) return
    if (pathname === OAUTH_CALLBACK_PATH || pathname === '/auth/confirm') return

    const dest = new URL(OAUTH_CALLBACK_PATH, getCanonicalBrowserAuthOrigin())
    const params = new URLSearchParams(search)
    params.forEach((value, key) => dest.searchParams.set(key, value))
    window.location.replace(dest.toString())
  }, [])

  return null
}
