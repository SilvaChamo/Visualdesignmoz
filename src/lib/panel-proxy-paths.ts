/**
 * Rotas servidas no Hetzner e expostas em visualdesignmoz.com via Cloudflare Worker.
 * Manter alinhado com cloudflare/visualdesignmoz-panel-proxy/worker.js
 */

const PANEL_UI_PREFIXES = [
  '/dashboard',
  '/client',
  '/revendedor',
  '/guest',
  '/painel',
  '/login',
  '/auth',
  '/offline',
] as const

/** APIs que ficam na Vercel (site público). */
const VERCEL_API_PREFIXES = [
  '/api/public/',
  '/api/domain-check',
  '/api/domain-register',
] as const

export function isPanelUiProxyPath(pathname: string): boolean {
  return PANEL_UI_PREFIXES.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  )
}

export function isVercelApiPath(pathname: string): boolean {
  return VERCEL_API_PREFIXES.some(
    (base) => pathname === base || pathname.startsWith(base),
  )
}

/** Pedido que o Worker deve enviar ao Hetzner. */
export function isPanelProxyPath(pathname: string): boolean {
  if (isPanelUiProxyPath(pathname)) return true
  if (!pathname.startsWith('/api/')) return false
  if (isVercelApiPath(pathname)) return false
  return true
}

export const PANEL_LEGACY_HOST = 'painel.visualdesignmoz.com'
