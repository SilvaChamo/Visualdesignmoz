/** Rota única de retorno do Google — o utilizador nunca escolhe URL. */
export const OAUTH_CALLBACK_PATH = '/auth/callback'

const DEFAULT_AUTH_ORIGIN = 'https://visualdesignmoz.com'

function normalizeAuthOrigin(raw: string): string {
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    const host = url.hostname.toLowerCase()
    if (host === '127.0.0.1') url.hostname = 'localhost'
    if (host === 'www.visualdesignmoz.com') url.hostname = 'visualdesignmoz.com'
    return url.origin
  } catch {
    return defaultAuthOrigin()
  }
}

function defaultAuthOrigin(): string {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return DEFAULT_AUTH_ORIGIN
  }
  return 'http://localhost:3002'
}

function readConfiguredSiteOrigin(): string | null {
  const rawSite = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (rawSite) return normalizeAuthOrigin(rawSite)

  const rawApp = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!rawApp) return null

  const normalizedApp = normalizeAuthOrigin(rawApp)
  const appHost = normalizedApp.toLowerCase()
  if (
    (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') &&
    (appHost.startsWith('http://localhost') || appHost.startsWith('http://127.0.0.1'))
  ) {
    return null
  }

  return normalizedApp
}

/**
 * Origem canónica para auth no browser.
 *
 * Se `NEXT_PUBLIC_SITE_URL` ou `NEXT_PUBLIC_APP_URL` estiver configurado, usa
 * esse valor em vez da porta actual do localhost. Isso evita que um cache/aba
 * antiga em localhost:3003 force o callback OAuth para o porto errado.
 */
export function getCanonicalBrowserAuthOrigin(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()

    if (host === 'localhost' || host === '127.0.0.1') {
      return normalizeAuthOrigin(window.location.origin)
    }

    if (host.endsWith('.vercel.app')) {
      return normalizeAuthOrigin(window.location.origin)
    }
  }

  const configuredOrigin = readConfiguredSiteOrigin()
  if (configuredOrigin) {
    return configuredOrigin
  }

  return typeof window !== 'undefined'
    ? normalizeAuthOrigin(window.location.origin)
    : defaultAuthOrigin()
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
