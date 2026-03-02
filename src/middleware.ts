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

  // Verifica sessão lendo os cookies do request
  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = req.nextUrl

  // Rotas públicas — sem autenticação necessária
  const publicRoutes = ['/', '/servicos', '/portfolio', '/sobre-nos', '/contacto', '/precos', '/auth', '/cursos']
  const isPublic = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
  if (isPublic) return res

  // Sem sessão → redirecionar para login
  if (!session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Determinar role do utilizador
  const userEmail = session.user?.email
  const userRole = session.user?.user_metadata?.role
  const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com']

  let role = 'client'
  if (adminEmails.includes(userEmail || '') || userRole === 'admin') role = 'admin'
  else if (userRole === 'reseller') role = 'reseller'

  // Bloquear /admin para não-admins → enviar para /client
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/client', req.url))
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
