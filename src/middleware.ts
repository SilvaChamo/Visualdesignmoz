import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Usa createServerClient que lê/escreve cookies do request correctamente
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({ name, value, ...options })
        },
        remove: (name, options) => {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = req.nextUrl
  const ip = req.ip || 'unknown'

  // 0. Rate Limiting para Login
  if (pathname === '/auth/login' && req.method === 'POST') {
    const lastAttempt = loginAttempts.get(ip) || 0;
    const now = Date.now();
    if (now - lastAttempt < RATE_LIMIT_MS) {
      return new NextResponse('Muitas solicitações. Aguarde um momento.', { status: 429 });
    }
    loginAttempts.set(ip, now);

    // Auto-clean old entries
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

  // 3. Sem sessão em rotas protegidas (/admin, /dashboard, /client)
  // Requisito especial do utilizador: em vez de redirect para login, dar 404 para "esconder" a página.
  if (!session) {
    // Só mostramos o login se for explicitamente solicitado via /auth/login
    // Se tentarem entrar directo em /admin, fingimos que não existe
    return NextResponse.rewrite(new URL('/404-not-found-security', req.url))
  }

  // Se chegou aqui, tem sessão. Determinar role do utilizador
  const userEmail = session.user?.email
  const userRole = session.user?.user_metadata?.role
  const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com']

  let role = 'client'
  if (adminEmails.includes(userEmail || '') || userRole === 'admin') role = 'admin'
  else if (userRole === 'reseller') role = 'reseller'

  // Bloquear /admin para não-admins → enviar para /client (ou 404 se preferires obscuridade total)
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.rewrite(new URL('/404-admin-only', req.url))
  }

  // Bloquear /dashboard para simples clientes → enviar para /client
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
