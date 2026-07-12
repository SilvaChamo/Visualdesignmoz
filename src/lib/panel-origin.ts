import type { CookieOptions } from '@supabase/ssr'
import { getRedirectPathForRole, type UserRole } from '@/lib/user-roles'
import { PANEL_LEGACY_HOST } from '@/lib/panel-proxy-paths'

const PANEL_PATHS = ['/dashboard', '/client', '/revendedor', '/guest'] as const

const DEFAULT_PANEL_ORIGIN = 'https://painel.visualdesignmoz.com'
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
  // Força que o login aconteça sempre no domínio principal (elimina a segunda página de login no painel)
  let baseUrl = typeof base === 'string' ? new URL(base) : base;
  if (isPanelHost(baseUrl.hostname)) {
    baseUrl = new URL(getPublicSiteOrigin());
  }

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

export function getPanelOrigin(): string {
  return sanitizeOrigin(
    process.env.NEXT_PUBLIC_PANEL_URL,
    DEFAULT_PANEL_ORIGIN,
  )
}

export function getPublicSiteOrigin(): string {
  return sanitizeOrigin(
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    DEFAULT_PUBLIC_SITE_ORIGIN,
  )
}

/** Dev no Mac (`npm run dev`) — painel no mesmo host que o site. */
export function isLocalDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(':')[0]
  return host === 'localhost' || host === '127.0.0.1'
}

/**
 * Produção: site na Vercel + painel no Hetzner (hosts diferentes).
 * Dev: um só host (localhost) — mesmo código, mesmo fluxo /painel.
 */
export function isCanonicalPanelOnMainDomain(): boolean {
  try {
    return new URL(getPanelOrigin()).host === new URL(getPublicSiteOrigin()).host
  } catch {
    return false
  }
}

export function isLegacyPanelSubdomain(hostname: string): boolean {
  const host = hostname.toLowerCase().split(':')[0]
  return host === PANEL_LEGACY_HOST || host === `www.${PANEL_LEGACY_HOST}`
}

export function isSplitPanelDeployment(): boolean {
  return !isCanonicalPanelOnMainDomain()
}

export function buildPanelEntryPath(
  innerPath: string,
  from?: string | null,
  role?: UserRole,
): string {
  if (from?.startsWith(PUBLIC_PANEL_ENTRY)) return from
  if (role && innerPath === getRedirectPathForRole(role) && !from) {
    return PUBLIC_PANEL_ENTRY
  }
  return `${PUBLIC_PANEL_ENTRY}${innerPath}`
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

export function isPanelHost(hostname: string): boolean {
  if (isLocalDevHost(hostname)) return false
  const host = hostname.toLowerCase().split(':')[0]
  try {
    const panelHostname = new URL(getPanelOrigin()).hostname.toLowerCase()
    const siteHostname = new URL(getPublicSiteOrigin()).hostname.toLowerCase()
    // Dev: painel e site no mesmo host — não tratar como subdomínio painel.*
    if (panelHostname === siteHostname) return false
    return panelHostname === host
  } catch {
    return host === 'painel.visualdesignmoz.com'
  }
}

export function isPublicSiteHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(':')[0]
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) {
    return false
  }
  try {
    const publicHost = new URL(getPublicSiteOrigin()).hostname.toLowerCase()
    return host === publicHost || host === `www.${publicHost}`
  } catch {
    return host === 'visualdesignmoz.com' || host === 'www.visualdesignmoz.com'
  }
}

/** Site público (ex. Vercel) com painel noutro host (Hetzner). */
export function shouldUsePanelOriginForHost(hostname: string): boolean {
  if (isLocalDevHost(hostname)) return false
  if (!isSplitPanelDeployment()) return false
  return isPublicSiteHost(hostname) && !isPanelHost(hostname)
}

/** Para onde enviar após /painel com sessão (mesmo host vs Hetzner). */
export function resolvePanelInnerRedirect(
  requestUrl: string,
  innerPath: string,
  search = '',
): string {
  const host = new URL(requestUrl).hostname
  const path = `${innerPath}${search}`
  if (shouldUsePanelOriginForHost(host)) {
    return getPanelAbsoluteUrl(path)
  }
  return new URL(path, requestUrl).toString()
}

export function getPanelAbsoluteUrl(pathAndQuery: string): string {
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
  return `${getPanelOrigin()}${path}`
}

/**
 * Redirecções de rotas API do painel — evita localhost quando o proxy interno
 * (Apache → 127.0.0.1:3002) não repõe o host público em req.url.
 */
export function resolvePanelApiRedirect(pathAndQuery: string, requestUrl?: string): string {
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
  try {
    if (requestUrl) {
      const host = new URL(requestUrl).hostname
      if (isLocalDevHost(host)) {
        if (process.env.NODE_ENV === 'production') {
          return getPanelAbsoluteUrl(path)
        }
        return new URL(path, requestUrl).toString()
      }
      if (shouldUsePanelOriginForHost(host)) {
        return getPanelAbsoluteUrl(path)
      }
      return new URL(path, requestUrl).toString()
    }
  } catch {
    /* usar origem configurada */
  }
  return getPanelAbsoluteUrl(path)
}

export function resolvePostLoginUrl(options: {
  origin: string
  role: UserRole
  from?: string | null
}): string {
  const { origin, role, from } = options
  const innerPath = resolveInnerPanelPath(from, role)
  const entryPath = buildPanelEntryPath(innerPath, from, role)

  try {
    const host = new URL(origin).hostname
    if (isLocalDevHost(host)) {
      return innerPath
    }
    if (isCanonicalPanelOnMainDomain()) {
      return innerPath
    }
    if (shouldUsePanelOriginForHost(host)) {
      return `${getPanelOrigin()}${entryPath}`
    }
    if (isPanelHost(host) && isSplitPanelDeployment()) {
      return innerPath
    }
  } catch {
    /* path relativo */
  }

  return entryPath
}

export function getSharedAuthCookieDomain(hostname?: string): string | undefined {
  const host = (hostname ?? '').toLowerCase().split(':')[0]
  if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) {
    return undefined
  }
  // Partilhar sessão entre visualdesignmoz.com e painel.* — o proxy do DirectAdmin
  // remove cookies sb-* antes de chegar ao host.visualdesignmoz.com.
  if (host.endsWith('visualdesignmoz.com')) {
    return '.visualdesignmoz.com'
  }
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
