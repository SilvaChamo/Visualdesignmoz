import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveUserRole, getRedirectPathForRole } from '@/lib/user-roles'
import {
  buildPanelLoginUrl,
  getPublicSiteOrigin,
  isPanelHost,
  isPanelRoute,
  panelRouteFromPublicEntry,
  PUBLIC_LOGIN_ENTRY,
  PUBLIC_PANEL_ENTRY,
  resolveInnerPanelPath,
  resolvePanelInnerRedirect,
  shouldUsePanelOriginForHost,
} from '@/lib/panel-origin'
import { OAUTH_CALLBACK_PATH } from '@/lib/oauth-callback'
import { getRequestHostname } from '@/lib/request-host'
import { createAppServerClient } from '@/lib/supabase-cookies'

// Simulação de Rate Limiting
const RATE_LIMIT_MS = 2000
const loginAttempts = new Map<string, number>()

const PUBLIC_MARKETING_PREFIXES = [
  '/servicos',
  '/portfolio',
  '/sobre-nos',
  '/contacto',
  '/precos',
  '/cursos',
  '/faq',
] as const

function isPublicMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_MARKETING_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = getRequestHostname(request.headers, request.url)
  const publicOrigin = getPublicSiteOrigin()
  const hostOnly = hostname.toLowerCase().split(':')[0]

  // 127.0.0.1 → localhost (mesmo sítio, cookies/PKCE iguais — automático)
  if (hostOnly === '127.0.0.1') {
    const canonical = request.nextUrl.clone()
    canonical.hostname = 'localhost'
    return NextResponse.redirect(canonical, 308)
  }

  // www → apex em login/OAuth (PKCE exige o mesmo host no início e no callback)
  if (
    hostOnly === 'www.visualdesignmoz.com' &&
    (pathname === PUBLIC_LOGIN_ENTRY || pathname.startsWith('/auth/'))
  ) {
    const canonical = new URL(`${pathname}${request.nextUrl.search}`, publicOrigin)
    return NextResponse.redirect(canonical, 308)
  }

  // FIRST: OAuth ?code= fora de /auth/callback → corrigir rota
  const oauthCode = request.nextUrl.searchParams.get('code')
  if (
    oauthCode &&
    pathname !== '/auth/callback' &&
    pathname !== '/auth/confirm'
  ) {
    const callback = request.nextUrl.clone()
    callback.pathname = OAUTH_CALLBACK_PATH
    return NextResponse.redirect(callback)
  }

  // let auth callback pass immediately
  if (pathname === OAUTH_CALLBACK_PATH || pathname === '/auth/confirm') {
    return NextResponse.next()
  }

  const onPanelHost = isPanelHost(hostname)

  // Subdomínio painel.* — marketing no site principal; raiz = entrada do painel.
  // Isto tem de correr ANTES dos passthroughs genéricos de /login e /auth/
  // abaixo — senão esses engolem pedidos como /auth/login no domínio do
  // painel antes de serem redirecionados para o site principal, e a página
  // /auth/login tenta renderizar-se sozinha no host errado (rebenta).
  if (onPanelHost) {
    if (pathname !== '/' && isPublicMarketingPath(pathname)) {
      return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, publicOrigin))
    }
    if (pathname === '/auth/login' || pathname === PUBLIC_LOGIN_ENTRY) {
      const login = buildPanelLoginUrl(publicOrigin, request.nextUrl.searchParams)
      return NextResponse.redirect(login)
    }
    if (pathname.startsWith('/auth/')) {
      const dest = new URL(`${pathname}${request.nextUrl.search}`, publicOrigin)
      return NextResponse.redirect(dest)
    }
  }

  // Login — página estática; limpar ?from= legado (evita loops)
  if (pathname === PUBLIC_LOGIN_ENTRY) {
    if (request.nextUrl.searchParams.has('from')) {
      return NextResponse.redirect(
        buildPanelLoginUrl(request.url, request.nextUrl.searchParams),
      )
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  // Legado: /admin → /dashboard
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const legacy = request.nextUrl.clone()
    legacy.pathname = pathname.replace(/^\/admin/, '/dashboard')
    return NextResponse.redirect(legacy, 308)
  }

  // Páginas públicas de marketing (home, serviços, portfolio, preços, etc.)
  // — não correr auth no proxy. Isto evita uma chamada de rede à Supabase
  // em CADA visita anónima a estas páginas, que são as mais visitadas do
  // site. Antes disto só cobria a home ('/'), o que gastava Fluid Compute
  // desnecessário em todas as outras páginas públicas.
  if (isPublicMarketingPath(pathname) && !oauthCode && !onPanelHost) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createAppServerClient(request, response)

  const { data: { user } } = await supabase.auth.getUser()
  const ip = (request as any).ip || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  // supabase.auth.getUser() pode renovar a sessão (token expirado) e escrever
  // os novos cookies em `response`. Se a seguir devolvermos um
  // NextResponse.redirect(...) diferente, esses cookies novos perdem-se e a
  // sessão "desaparece" a meio da navegação — por isso todo redirect a
  // partir daqui usa este helper para os levar consigo.
  const redirectWithSession = (url: string | URL, status?: number) => {
    const redirect = status ? NextResponse.redirect(url, status) : NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie)
    })
    return redirect
  }

  const isPanelEntryPath =
    pathname === PUBLIC_PANEL_ENTRY ||
    pathname.startsWith(`${PUBLIC_PANEL_ENTRY}/`) ||
    (onPanelHost && pathname === '/')

  // Entrada: visualdesignmoz.com/painel (site) ou painel.* / (subdomínio)
  if (isPanelEntryPath) {
    if (!user) {
      return redirectWithSession(buildPanelLoginUrl(request.url))
    }
    const role = resolveUserRole({
      email: user.email,
      userMetadata: user.user_metadata,
      appMetadata: user.app_metadata,
    })
    const inner = panelRouteFromPublicEntry(pathname) ?? resolveInnerPanelPath(null, role)
    const target = resolvePanelInnerRedirect(
      request.url,
      inner,
      request.nextUrl.search,
    )
    return redirectWithSession(target)
  }

  // Site público (Vercel): rotas do painel → Hetzner (ou login)
  if (shouldUsePanelOriginForHost(hostname) && isPanelRoute(pathname)) {
    if (!user) {
      return redirectWithSession(buildPanelLoginUrl(request.url))
    }
    return redirectWithSession(
      resolvePanelInnerRedirect(request.url, pathname, request.nextUrl.search),
    )
  }

  // Local / mesmo host: /dashboard, /client… — API e UI no mesmo `npm run dev`
  if (!shouldUsePanelOriginForHost(hostname) && isPanelRoute(pathname) && !pathname.startsWith(PUBLIC_PANEL_ENTRY)) {
    if (!user) {
      return redirectWithSession(buildPanelLoginUrl(request.url))
    }
    return response
  }

  // Honeypot/Rate Limit logic
  if ((pathname === '/auth/login' || pathname === PUBLIC_LOGIN_ENTRY) && request.method === 'POST') {
    const lastAttempt = loginAttempts.get(ip) || 0
    const now = Date.now()
    if (now - lastAttempt < RATE_LIMIT_MS) {
      return new NextResponse('Muitas solicitações.', { status: 429 })
    }
    loginAttempts.set(ip, now)
    if (loginAttempts.size > 1000) loginAttempts.clear()
  }

  // Hidden paths
  const pathsToHide = ['/autenticacao']
  if (pathsToHide.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.rewrite(new URL('/404-obfuscated', request.url))
  }

  // APIs do painel — refrescar sessão; não bloquear sem user
  if (pathname.startsWith('/api/')) {
    return response
  }

  // Public routes
  const publicRoutes = ['/', '/servicos', '/portfolio', '/sobre-nos', '/contacto', '/precos', '/auth', '/cursos']
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return response
  }
  if (!user) {
    return redirectWithSession(buildPanelLoginUrl(request.url))
  }

  const role = resolveUserRole({
    email: user.email,
    userMetadata: user.user_metadata,
    appMetadata: user.app_metadata,
  })

  if (pathname.startsWith('/client') && role !== 'client') {
    return redirectWithSession(new URL(getRedirectPathForRole(role), request.url))
  }

  if (pathname.startsWith('/guest') && role !== 'guest') {
    return redirectWithSession(new URL(getRedirectPathForRole(role), request.url))
  }

  if (pathname.startsWith('/revendedor') && role !== 'reseller' && role !== 'admin') {
    return redirectWithSession(new URL(getRedirectPathForRole(role), request.url))
  }

  if (pathname.startsWith('/dashboard') && role === 'client') {
    return redirectWithSession(new URL('/client', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/painel',
    '/painel/:path*',
    '/servicos',
    '/servicos/:path*',
    '/portfolio',
    '/portfolio/:path*',
    '/sobre-nos',
    '/contacto',
    '/precos',
    '/precos/:path*',
    '/cursos',
    '/cursos/:path*',
    '/faq',
    '/faq/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/admin',
    '/admin/:path*',
    '/api/:path*',
    '/client/:path*',
    '/guest/:path*',
    '/revendedor/:path*',
    '/login',
    '/auth/:path*',
    '/autenticacao',
  ],
}
