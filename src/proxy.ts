import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveUserRole, getRedirectPathForRole } from '@/lib/user-roles'
import {
  isPanelRoute,
  panelRouteFromPublicEntry,
  PUBLIC_PANEL_ENTRY,
  resolveInnerPanelPath,
  resolvePanelInnerRedirect,
  shouldUsePanelOriginForHost,
} from '@/lib/panel-origin'
import { createAppServerClient } from '@/lib/supabase-cookies'

// Simulação de Rate Limiting
const RATE_LIMIT_MS = 2000
const loginAttempts = new Map<string, number>()

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''

  // FIRST: OAuth ?code= fora de /auth/callback → corrigir rota
  const oauthCode = request.nextUrl.searchParams.get('code')
  if (
    oauthCode &&
    pathname !== '/auth/callback' &&
    pathname !== '/auth/confirm'
  ) {
    const callback = request.nextUrl.clone()
    callback.pathname = '/auth/callback'
    return NextResponse.redirect(callback)
  }

  // let auth callback pass immediately
  if (pathname === '/auth/callback') {
    return NextResponse.next()
  }

  // Home sem ?code= — não correr auth no proxy (performance)
  if (pathname === '/' && !oauthCode) {
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

  // Entrada universal /painel (todas as contas, sem config por domínio)
  if (pathname === PUBLIC_PANEL_ENTRY || pathname.startsWith(`${PUBLIC_PANEL_ENTRY}/`)) {
    if (!user) {
      const login = new URL('/auth/login', request.url)
      const fromPath = pathname.startsWith(PUBLIC_PANEL_ENTRY)
        ? `${pathname}${request.nextUrl.search}`
        : `${PUBLIC_PANEL_ENTRY}${pathname}${request.nextUrl.search}`
      login.searchParams.set('from', fromPath)
      return NextResponse.redirect(login)
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
    return NextResponse.redirect(target)
  }

  // Site público (Vercel): rotas legadas /admin → login com /painel
  if (shouldUsePanelOriginForHost(host) && isPanelRoute(pathname)) {
    if (!user) {
      const login = new URL('/auth/login', request.url)
      const fromPath = pathname.startsWith(PUBLIC_PANEL_ENTRY)
        ? `${pathname}${request.nextUrl.search}`
        : `${PUBLIC_PANEL_ENTRY}${pathname}${request.nextUrl.search}`
      login.searchParams.set('from', fromPath)
      return NextResponse.redirect(login)
    }
    return NextResponse.redirect(
      resolvePanelInnerRedirect(request.url, pathname, request.nextUrl.search),
    )
  }

  // Local / mesmo host: /admin, /client… — API e UI no mesmo `npm run dev`
  if (!shouldUsePanelOriginForHost(host) && isPanelRoute(pathname) && !pathname.startsWith(PUBLIC_PANEL_ENTRY)) {
    if (!user) {
      const login = new URL('/auth/login', request.url)
      login.searchParams.set('from', `${PUBLIC_PANEL_ENTRY}${pathname}${request.nextUrl.search}`)
      return NextResponse.redirect(login)
    }
    return response
  }

  // Honeypot/Rate Limit logic
  if (pathname === '/auth/login' && request.method === 'POST') {
    const lastAttempt = loginAttempts.get(ip) || 0
    const now = Date.now()
    if (now - lastAttempt < RATE_LIMIT_MS) {
      return new NextResponse('Muitas solicitações.', { status: 429 })
    }
    loginAttempts.set(ip, now)
    if (loginAttempts.size > 1000) loginAttempts.clear()
  }

  // Hidden paths
  const pathsToHide = ['/login', '/autenticacao']
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
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const role = resolveUserRole({
    email: user.email,
    userMetadata: user.user_metadata,
    appMetadata: user.app_metadata,
  })

  if (pathname.startsWith('/client') && role !== 'client') {
    return NextResponse.redirect(new URL(getRedirectPathForRole(role), request.url))
  }

  if (pathname.startsWith('/guest') && role !== 'guest') {
    return NextResponse.redirect(new URL(getRedirectPathForRole(role), request.url))
  }

  if (pathname.startsWith('/revendedor') && role !== 'reseller' && role !== 'admin') {
    return NextResponse.redirect(new URL(getRedirectPathForRole(role), request.url))
  }

  if (pathname.startsWith('/dashboard') && role === 'client') {
    return NextResponse.redirect(new URL('/client', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/painel',
    '/painel/:path*',
    '/admin/:path*',
    '/api/:path*',
    '/dashboard/:path*',
    '/client/:path*',
    '/guest/:path*',
    '/revendedor/:path*',
    '/auth/:path*',
    '/login',
    '/autenticacao',
  ],
}
