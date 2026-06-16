import { NextRequest, NextResponse } from 'next/server'
import { profileAuthOrFilter } from '@/lib/profile-db'
import { resolveUserRole } from '@/lib/user-roles'
import { fetchUserProductsSummary } from '@/lib/user-products'
import { PUBLIC_PANEL_ENTRY, resolvePostLoginUrl } from '@/lib/panel-origin'
import {
  clearPanelFromCookieHeader,
  readPanelFromCookie,
} from '@/lib/panel-oauth-from'
import { copyAuthCookies, createAppServerClient } from '@/lib/supabase-cookies'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const hostname = request.headers.get('host') ?? undefined

  if (error) {
    const loginUrl = new URL('/auth/login', requestUrl.origin)
    loginUrl.searchParams.set('error', error)
    loginUrl.searchParams.set('error_description', errorDescription || 'Erro ao autenticar com Google')
    return NextResponse.redirect(loginUrl)
  }

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login', requestUrl.origin))
  }

  const cookieJar = NextResponse.next()
  const supabase = createAppServerClient(request, cookieJar)

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
    .or(profileAuthOrFilter(data.user.id))
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

  const from =
    requestUrl.searchParams.get('from') ||
    readPanelFromCookie(request.headers.get('cookie')) ||
    PUBLIC_PANEL_ENTRY

  const target = resolvePostLoginUrl({
    origin: requestUrl.origin,
    role,
    from,
  })
  const finalResponse = NextResponse.redirect(
    target.startsWith('http') ? target : new URL(target, requestUrl.origin),
  )
  copyAuthCookies(cookieJar, finalResponse, hostname)
  const cleared = clearPanelFromCookieHeader()
  finalResponse.cookies.set(cleared.name, cleared.value, cleared.options)
  return finalResponse
}
