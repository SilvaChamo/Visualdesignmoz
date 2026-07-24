import type { CookieOptions } from '@supabase/ssr'
import { getRedirectPathForRole, type UserRole } from '@/lib/user-roles'

const PANEL_PATHS = ['/dashboard', '/client', '/revendedor', '/guest'] as const

const DEFAULT_PUBLIC_SITE_ORIGIN = 'https://visualdesignmoz.com'

/** Entrada pública única do painel — todas as contas usam o mesmo URL. */
export const PUBLIC_PANEL_ENTRY = '/painel'

/** Login visível no domínio principal. */
export const PUBLIC_LOGIN_ENTRY = '/login'

/** Único link de login (botões do site). */
export const PANEL_LOGIN_HREF = PUBLIC_LOGIN_ENTRY

/** URL de login; preserva só erros OAuth/mensagens do sistema. */
export function buildPanelLoginUrl(
  base: string | URL,
  preserve?: URLSearchParams,
): URL {
  const baseUrl = typeof base === 'string' ? new URL(base) : base;
  const url = new URL(PUBLIC_LOGIN_ENTRY, baseUrl)
  if (preserve) {
    for (const key of ['error', 'error_description', 'reason', 'reset', 'redirect', 'next'] as const) {
      const value = preserve.get(key)
      if (value) url.searchParams.set(key, value)
    }
  }
  return url
}

function sanitizeOrigin(raw: string | undefined, fallback: string): string {
  const trimmed = (raw ?? '').trim().replace(/\/$/, '')
  if (!trimmed) return fallback
  try {
    const { hostname, protocol } = new URL(trimmed)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
        return fallback
      }
    }
    if (protocol !== 'http:' && protocol !== 'https:') return fallback
    return trimmed
  } catch {
    return fallback
  }
}

export function getPublicSiteOrigin(): string {
  return sanitizeOrigin(process.env.NEXT_PUBLIC_SITE_URL?.trim(), DEFAULT_PUBLIC_SITE_ORIGIN)
}

/** Dev no Mac (`npm run dev`). */
export function isLocalDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(':')[0]
  return host === 'localhost' || host === '127.0.0.1'
}

export function isPanelRoute(pathname: string): boolean {
  if (pathname === PUBLIC_PANEL_ENTRY || pathname.startsWith(`${PUBLIC_PANEL_ENTRY}/`)) {
    return true
  }
  return PANEL_PATHS.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  )
}

/** /painel/dashboard → /admin; /painel → null (usar papel). */
export function panelRouteFromPublicEntry(pathname: string): string | null {
  if (pathname === PUBLIC_PANEL_ENTRY) return null
  if (!pathname.startsWith(`${PUBLIC_PANEL_ENTRY}/`)) return null
  const inner = pathname.slice(PUBLIC_PANEL_ENTRY.length)
  return inner.startsWith('/') ? inner : `/${inner}`
}

export function resolveInnerPanelPath(
  from: string | null | undefined,
  role: UserRole,
): string {
  const fromPainel = from ? panelRouteFromPublicEntry(from) : null
  if (fromPainel && PANEL_PATHS.some((b) => fromPainel === b || fromPainel.startsWith(`${b}/`))) {
    return fromPainel
  }
  if (from && from.startsWith('/') && PANEL_PATHS.some((b) => from === b || from.startsWith(`${b}/`))) {
    return from
  }
  return getRedirectPathForRole(role)
}

/** Painel e site público vivem sempre no mesmo host — redirecionamento simples. */
export function resolvePanelInnerRedirect(
  requestUrl: string,
  innerPath: string,
  search = '',
): string {
  return new URL(`${innerPath}${search}`, requestUrl).toString()
}

/**
 * Redirecções de rotas API do painel.
 */
export function resolvePanelApiRedirect(pathAndQuery: string, requestUrl?: string): string {
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
  if (requestUrl) {
    try {
      return new URL(path, requestUrl).toString()
    } catch {
      /* usar origem pública */
    }
  }
  return `${getPublicSiteOrigin()}${path}`
}

export function resolvePostLoginUrl(options: {
  origin: string
  role: UserRole
  from?: string | null
}): string {
  const { role, from } = options
  return resolveInnerPanelPath(from, role)
}

export function getSharedAuthCookieDomain(_hostname?: string): string | undefined {
  return undefined
}

export function applySharedAuthCookieOptions(
  options: CookieOptions = {},
  hostname?: string,
  role: UserRole = 'client',
): CookieOptions {
  const domain = getSharedAuthCookieDomain(hostname)

  const maxAge =
    role === 'admin'
      ? 60 * 60 * 6 // 6 hours for admin
      : 60 * 60 * 1 // 1 hour for others

  const combinedOptions: CookieOptions = {
    ...options,
    domain,
    path: options.path ?? '/',
    secure: options.secure ?? process.env.NODE_ENV === 'production',
    sameSite: options.sameSite ?? 'lax',
    maxAge,
  }

  if (!domain) delete combinedOptions.domain

  return combinedOptions
}
