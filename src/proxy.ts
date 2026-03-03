import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simulação de Rate Limiting (em produção usar Redis para Vercel Edge)
const RATE_LIMIT_MS = 2000; // Mínimo de 2 segundos entre tentativas
const loginAttempts = new Map<string, number>();

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  // 1. Supabase Session Handling via SSR
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => req.cookies.set(name, value))
          res = NextResponse.next({
            request: req,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = req.nextUrl
  const ip = (req as any).ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  // 0. Rate Limiting para Login
  if (pathname === '/auth/login' && req.method === 'POST') {
    const lastAttempt = loginAttempts.get(ip) || 0;
    const now = Date.now();
    if (now - lastAttempt < RATE_LIMIT_MS) {
      return new NextResponse('Muitas solicitações. Aguarde um momento.', { status: 429 });
    }
    loginAttempts.set(ip, now);

    if (loginAttempts.size > 1000) loginAttempts.clear();
  }

  // 1. Bloquear caminhos que o utilizador quer esconder (404 forçado)
  const pathsToHide = ['/login', '/autenticacao']
  if (pathsToHide.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.rewrite(new URL('/404-obfuscated', req.url))
  }

  // 2. Rotas públicas — sem autenticação necessária
  const publicRoutes = ['/', '/servicos', '/portfolio', '/sobre-nos', '/contacto', '/precos', '/auth', '/cursos']
  const isPublic = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
  if (isPublic) return res

  // 3. Sem sessão em rotas protegidas
  if (!user) {
    return NextResponse.rewrite(new URL('/404-not-found-security', req.url))
  }

  // Determinar role do utilizador
  const userEmail = user.email
  const userRole = user.app_metadata?.role || user.user_metadata?.role
  const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com']

  let role = 'client'
  if (adminEmails.includes(userEmail || '') || userRole === 'admin') role = 'admin'
  else if (userRole === 'reseller') role = 'reseller'

  // Bloquear /admin para não-admins
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.rewrite(new URL('/404-admin-only', req.url))
  }

  // Bloquear /dashboard para simples clientes
  if (pathname.startsWith('/dashboard') && role === 'client') {
    return NextResponse.redirect(new URL('/client', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard', '/dashboard/:path*',
    '/client', '/client/:path*',
    '/admin', '/admin/:path*'
  ],
}
