import { NextRequest, NextResponse } from 'next/server'
import { copyAuthCookies, createAppServerClient } from '@/lib/supabase-cookies'

export const dynamic = 'force-dynamic'
import {
  buildPanelLoginUrl,
  PUBLIC_PANEL_ENTRY,
  resolvePostLoginUrl,
  isEncomendasAccount,
  applySharedAuthCookieOptions,
  getPublicSiteOrigin,
} from '@/lib/panel-origin'
import { resolveRoleForAuthUser } from '@/lib/server-auth-role'
import { PANEL_FROM_COOKIE, readPanelFromCookie } from '@/lib/panel-oauth-from'
import { userHasQuotationRequests } from '@/lib/quotation-access'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')
  const oauthDesc = searchParams.get('error_description')
  const hostname = request.headers.get('host') ?? undefined

  // Origem explícita (NEXT_PUBLIC_SITE_URL), não request.url/nextUrl.origin —
  // atrás do proxy do Hetzner (Apache -> Node em 127.0.0.1:3003) esse origin
  // por vezes resolve para "localhost:3003", que escapa por não bater certo
  // com o ProxyPassReverse (configurado para 127.0.0.1, não "localhost").
  const siteOrigin = getPublicSiteOrigin()

  const redirectToLogin = (error: string, description: string) => {
    const loginUrl = buildPanelLoginUrl(siteOrigin)
    loginUrl.searchParams.set('error', error)
    loginUrl.searchParams.set('error_description', description)
    return NextResponse.redirect(loginUrl)
  }

  if (oauthError) {
    return redirectToLogin(oauthError, oauthDesc || 'Erro ao autenticar com Google')
  }

  if (!code) {
    return NextResponse.redirect(buildPanelLoginUrl(siteOrigin))
  }

  const cookieJar = NextResponse.next()
  const supabase = createAppServerClient(request, cookieJar)

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    console.error('Auth Callback (OAuth) Error:', error)
    return redirectToLogin('callback_error', error?.message || 'Erro ao validar sessão Google')
  }

  const user = data.session.user

  if (!user.user_metadata?.role) {
    await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        role: 'guest',
        nome:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0],
      },
    })
  }

  const role = await resolveRoleForAuthUser(supabase, user)
  const from = readPanelFromCookie(request.headers.get('cookie'))
  const hasEncomendas =
    role === 'guest' ? isEncomendasAccount(user.user_metadata) || (await userHasQuotationRequests(user.id)) : false

  const target = resolvePostLoginUrl({
    origin: siteOrigin,
    role,
    from: from || PUBLIC_PANEL_ENTRY,
    hasEncomendas,
  })

  const response = NextResponse.redirect(
    target.startsWith('http') ? target : new URL(target, siteOrigin).toString(),
  )

  copyAuthCookies(cookieJar, response, hostname)

  response.cookies.set(
    PANEL_FROM_COOKIE,
    '',
    applySharedAuthCookieOptions({ path: '/', maxAge: 0 }, hostname),
  )

  response.headers.set('Cache-Control', 'no-store')
  return response
}
