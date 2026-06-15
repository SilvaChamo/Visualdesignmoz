import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveUserRole, getRedirectPathForRole } from '@/lib/user-roles'

// Simulação de Rate Limiting
const RATE_LIMIT_MS = 2000
const loginAttempts = new Map<string, number>()

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // FIRST: let auth callback pass immediately — no session exists yet at this point
  if (pathname === '/auth/callback') {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const ip = (request as any).ip || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

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

  // Protected routes
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
