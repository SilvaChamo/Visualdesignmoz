/**
 * Cloudflare Worker — visualdesignmoz.com
 * Encaminha rotas do painel para o Hetzner; resto segue para a Vercel.
 *
 * Manter isPanelProxyPath alinhado com src/lib/panel-proxy-paths.ts
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
]

const VERCEL_API_PREFIXES = [
  '/api/public/',
  '/api/domain-check',
  '/api/domain-register',
]

const PANEL_ORIGIN = 'https://painel.visualdesignmoz.com'
const PUBLIC_HOST = 'visualdesignmoz.com'

function isPanelUiPath(pathname) {
  return PANEL_UI_PREFIXES.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  )
}

function isVercelApiPath(pathname) {
  return VERCEL_API_PREFIXES.some(
    (base) => pathname === base || pathname.startsWith(base),
  )
}

function isPanelProxyPath(pathname) {
  if (isPanelUiPath(pathname)) return true
  if (!pathname.startsWith('/api/')) return false
  if (isVercelApiPath(pathname)) return false
  return true
}

async function proxyToPanel(request, url) {
  const originUrl = new URL(url.pathname + url.search, PANEL_ORIGIN)

  const headers = new Headers(request.headers)
  headers.set('Host', new URL(PANEL_ORIGIN).host)
  headers.set('X-Forwarded-Host', PUBLIC_HOST)
  headers.set('X-Forwarded-Proto', 'https')
  headers.set('X-Panel-Proxy', 'cloudflare')

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
  }

  const upstream = await fetch(originUrl.toString(), init)

  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.delete('content-security-policy')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (url.hostname !== PUBLIC_HOST && url.hostname !== `www.${PUBLIC_HOST}`) {
      return fetch(request)
    }

    if (!isPanelProxyPath(url.pathname)) {
      return fetch(request)
    }

    return proxyToPanel(request, url)
  },
}
