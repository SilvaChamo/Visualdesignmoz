'use client'

import { useEffect } from 'react'

/**
 * O Supabase/Google por vezes devolve ?code= na home em vez de /auth/callback.
 * Reencaminha antes de o utilizador ver URL estranha na página inicial.
 */
export function OAuthCodeRedirect() {
  useEffect(() => {
    const { pathname, search, origin } = window.location
    if (!search.includes('code=')) return
    if (pathname === '/auth/callback' || pathname === '/auth/confirm') return

    const dest = new URL('/auth/callback', origin)
    const params = new URLSearchParams(search)
    params.forEach((value, key) => dest.searchParams.set(key, value))
    window.location.replace(dest.toString())
  }, [])

  return null
}
