import type { CookieOptions } from '@supabase/ssr'
import { getRedirectPathForRole, type UserRole } from '@/lib/user-roles'

const PANEL_PATHS = ['/admin', '/client', '/revendedor', '/guest', '/dashboard'] as const

/** Entrada pública única do painel — todas as contas usam o mesmo URL. */
export const PUBLIC_PANEL_ENTRY = '/painel'

export function getPanelOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_PANEL_URL?.trim() ||
    'https://painel.visualdesignmoz.com'
  return raw.replace(/\/$/, '')
}

export function getPublicSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://visualdesignmoz.com'
  return raw.replace(/\/$/, '')
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
export function isSplitPanelDeployment(): boolean {
  try {
    const panelHost = new URL(getPanelOrigin()).host
    const siteHost = new URL(getPublicSiteOrigin()).host
    return panelHost !== siteHost
  } catch {
    return true
  }
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

/** /painel/admin → /admin; /painel → null (usar papel). */
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
  const host = hostname.toLowerCase().split(':')[0]
  try {
    return new URL(getPanelOrigin()).hostname.toLowerCase() === host
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
    if (shouldUsePanelOriginForHost(host)) {
      return `${getPublicSiteOrigin()}${entryPath}`
    }
    if (isPanelHost(host) && isSplitPanelDeployment()) {
      return getPanelAbsoluteUrl(innerPath)
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
  if (host.endsWith('visualdesignmoz.com')) {
    return '.visualdesignmoz.com'
  }
  return undefined
}

export function applySharedAuthCookieOptions(
  options: CookieOptions = {},
  hostname?: string,
): CookieOptions {
  const domain = getSharedAuthCookieDomain(hostname)
  if (!domain) return options
  return {
    ...options,
    domain,
    path: options.path ?? '/',
    secure: options.secure ?? process.env.NODE_ENV === 'production',
    sameSite: options.sameSite ?? 'lax',
  }
}
