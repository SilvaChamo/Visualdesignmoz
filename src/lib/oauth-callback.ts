/** Rota única de retorno do Google — o utilizador nunca escolhe URL. */
export const OAUTH_CALLBACK_PATH = '/auth/callback'

function normalizeAuthOrigin(raw: string): string {
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    const host = url.hostname.toLowerCase()
    if (host === '127.0.0.1') url.hostname = 'localhost'
    if (host === 'www.visualdesignmoz.com') url.hostname = 'visualdesignmoz.com'
    return url.origin
  } catch {
    return 'http://localhost:3002'
  }
}

function readConfiguredSiteOrigin(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim()
  return raw ? normalizeAuthOrigin(raw) : null
}

/** Origem canónica para auth no browser (dev → sempre localhost:3002 do .env). */
export function getCanonicalBrowserAuthOrigin(): string {
  if (typeof window === 'undefined') {
    return readConfiguredSiteOrigin() || 'http://localhost:3002'
  }

  const host = window.location.hostname.toLowerCase()

  if (host === 'localhost' || host === '127.0.0.1') {
    return readConfiguredSiteOrigin() || normalizeAuthOrigin(window.location.origin)
  }

  if (host.endsWith('.vercel.app')) {
    return normalizeAuthOrigin(window.location.origin)
  }

  return readConfiguredSiteOrigin() || normalizeAuthOrigin(window.location.origin)
}

/** URL completa do callback OAuth — uma rota para local e produção. */
export function getOAuthCallbackUrl(baseOrigin?: string): string {
  const origin = baseOrigin
    ? normalizeAuthOrigin(baseOrigin)
    : typeof window !== 'undefined'
      ? getCanonicalBrowserAuthOrigin()
      : readConfiguredSiteOrigin() || 'http://localhost:3002'

  return new URL(OAUTH_CALLBACK_PATH, origin).toString()
}

/** Em dev, 127.0.0.1 → localhost antes de iniciar OAuth (mesmos cookies/PKCE). */
export function redirectToCanonicalAuthHostIfNeeded(): boolean {
  if (typeof window === 'undefined') return false
  if (window.location.hostname.toLowerCase() !== '127.0.0.1') return false

  const target = new URL(window.location.href)
  target.hostname = 'localhost'
  window.location.replace(target.toString())
  return true
}
