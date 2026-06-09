import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { resolveUserRole, getRedirectPathForRole } from '@/lib/user-roles'
import { fetchUserProductsSummary } from '@/lib/user-products'

export const dynamic = 'force-dynamic'

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value)
  })
}

export async function GET(request: NextRequest) {
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

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login', requestUrl.origin))
  }

  // Cookie jar: session tokens must be written onto the final redirect response
  const cookieJar = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieJar.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const verifier = request.cookies.getAll().find((c) => c.name.includes('code-verifier'))
  console.log('CALLBACK: code-verifier cookie:', verifier ? 'present' : 'missing')

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('CALLBACK: exchange error:', exchangeError.message, exchangeError.status)
  }

  if (exchangeError || !data.user) {
    const loginUrl = new URL('/auth/login', requestUrl.origin)
    loginUrl.searchParams.set('error', 'callback_error')
    loginUrl.searchParams.set('error_description', exchangeError?.message || 'Erro desconhecido')
    return NextResponse.redirect(loginUrl)
  }

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
  const finalResponse = NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
  copyCookies(cookieJar, finalResponse)
  return finalResponse
}
