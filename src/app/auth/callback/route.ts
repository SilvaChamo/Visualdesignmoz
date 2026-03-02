import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Se houver erro no OAuth → redirecionar para login com mensagem de erro
  if (error) {
    const loginUrl = new URL('/auth/login', requestUrl.origin)
    loginUrl.searchParams.set('error', error)
    loginUrl.searchParams.set('error_description', errorDescription || 'Erro ao autenticar com Google')
    return NextResponse.redirect(loginUrl)
  }

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Troca o código OAuth por uma sessão
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError || !data.user) {
      const loginUrl = new URL('/auth/login', requestUrl.origin)
      loginUrl.searchParams.set('error', 'callback_error')
      loginUrl.searchParams.set('error_description', exchangeError?.message || 'Falha ao trocar código por sessão')
      return NextResponse.redirect(loginUrl)
    }

    // Determinar destino com base no role/email
    const userEmail = data.user.email || ''
    const userRole = data.user.user_metadata?.role
    const adminEmails = ['admin@visualdesigne.com', 'geral@visualdesigne.com', 'silva.chamo@gmail.com']

    let redirectPath = '/client'
    if (adminEmails.includes(userEmail) || userRole === 'admin') {
      redirectPath = '/admin'
    } else if (userRole === 'reseller') {
      redirectPath = '/dashboard'
    }

    return NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
  }

  // Sem código nem erro → redirecionar para login
  return NextResponse.redirect(new URL('/auth/login', requestUrl.origin))
}
