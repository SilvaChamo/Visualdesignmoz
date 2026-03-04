import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
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
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    console.log('--- OAuth Callback Debug ---')
    console.log('Code received:', code ? 'present' : 'missing')
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

    // Troca o código OAuth por uma sessão (cookies são escritos automaticamente)
    console.log('Trocando código por sessão...')
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Erro na troca de código:', exchangeError)
      console.error('Error details:', {
        message: exchangeError.message,
        status: exchangeError.status,
        code: exchangeError.code
      })
      const loginUrl = new URL('/auth/login', requestUrl.origin)
      loginUrl.searchParams.set('error', 'callback_error')
      loginUrl.searchParams.set('error_description', `Falha na autenticação: ${exchangeError.message}`)
      return NextResponse.redirect(loginUrl)
    }

    if (!data.user) {
      console.error('Nenhum usuário retornado na troca de código')
      const loginUrl = new URL('/auth/login', requestUrl.origin)
      loginUrl.searchParams.set('error', 'callback_error')
      loginUrl.searchParams.set('error_description', 'Nenhum usuário encontrado na autenticação')
      return NextResponse.redirect(loginUrl)
    }

    console.log('Exchange successful for user:', data.user.email)

    // Determinar destino com base no role/email
    const userEmail = data.user.email || ''
    const userRole = data.user.user_metadata?.role
    const adminEmails = ['admin@visualdesigne.com', 'geral@visualdesigne.com', 'silva.chamo@gmail.com', 'silva.chamo@visualdesigne.com']

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
