import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { resolveUserRole, getRedirectPathForRole } from '@/lib/user-roles'
import { fetchUserProductsSummary } from '@/lib/user-products'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

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
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const allCookies = cookieStore.getAll()
    console.log('CALLBACK: Cookies recebidos:', allCookies.map(c => c.name).join(', '))

    // Verificar se o code_verifier existe
    const verifier = allCookies.find(c => c.name.includes('code-verifier'))
    console.log('CALLBACK: Verifier encontrado:', verifier ? 'SIM' : 'NÃO')

    console.log('CALLBACK: Tentando trocar código:', code.substring(0, 15) + '...')
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('CALLBACK: ERRO DETALHADO:', {
        message: exchangeError.message,
        status: exchangeError.status,
        name: exchangeError.name
      })
    }
    console.log('CALLBACK: Resultado:', exchangeError ? 'ERRO' : 'SUCESSO, user: ' + data?.user?.email)

    if (exchangeError || !data.user) {
      const loginUrl = new URL('/auth/login', requestUrl.origin)
      loginUrl.searchParams.set('error', 'callback_error')
      loginUrl.searchParams.set('error_description', exchangeError?.message || 'Erro desconhecido')
      return NextResponse.redirect(loginUrl)
    }

    // Novos utilizadores OAuth sem role → guest
    if (!data.user.user_metadata?.role) {
      await supabase.auth.updateUser({
        data: {
          ...data.user.user_metadata,
          role: 'guest',
          nome:
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            data.user.email?.split('@')[0],
        },
      })
    }

    const products = await fetchUserProductsSummary(supabase, data.user.id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    const role = resolveUserRole({
      email: data.user.email,
      userMetadata: data.user.user_metadata?.role
        ? data.user.user_metadata
        : { ...data.user.user_metadata, role: 'guest' },
      appMetadata: data.user.app_metadata,
      profileRole: profile?.role,
      hasPaidProducts: products.hasPaidProducts,
    })

    const redirectPath = getRedirectPathForRole(role)
    return NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/auth/login', requestUrl.origin))
}
