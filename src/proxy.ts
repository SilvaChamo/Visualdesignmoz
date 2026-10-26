import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveUserRole, getRedirectPathForRole } from '@/lib/user-roles'
import {
  buildPanelLoginUrl,
  getPublicSiteOrigin,
  isEncomendasAccount,
  isPanelRoute,
  panelRouteFromPublicEntry,
  PUBLIC_LOGIN_ENTRY,
  PUBLIC_PANEL_ENTRY,
  resolveInnerPanelPath,
  resolvePanelInnerRedirect,
} from '@/lib/panel-origin'
import { OAUTH_CALLBACK_PATH } from '@/lib/oauth-callback'
import { getRequestHostname } from '@/lib/request-host'
import { createAppServerClient } from '@/lib/supabase-cookies'

// Simulação de Rate Limiting
const RATE_LIMIT_MS = 2000
const loginAttempts = new Map<string, number>()

const PUBLIC_MARKETING_PREFIXES = [
  '/servicos',
  '/portfolio',
  '/sobre-nos',
  '/contacto',
  '/precos',
  '/cursos',
  '/faq',
] as const

/** Endereços antigos do painel: tudo o que lá chega vai para PAINEL_ENTRADA */
const PANEL_HOSTS = new Set(['host.visualdesignmoz.com'])
/** Endereço único do painel que se dá aos clientes (pedido do Silva, 13/10/2026): https://visualdesignmoz.com/vhost:2026/
 *  Servido pela rota src/app/vhost (reescrita aqui, sem redireccionar). */
const PAINEL_BASE = '/vhost:2026'
// sem a barra final: o Next tira-a com mais um salto
const PAINEL_ENTRADA = `https://visualdesignmoz.com${PAINEL_BASE}`
/** O endereço único como pode chegar (o ":" às vezes vem codificado) */
const PAINEL_FORMAS = [PAINEL_BASE, '/vhost%3A2026', '/vhost%3a2026']
/** Endereços antigos do painel neste site (por esta ordem: o mais comprido primeiro). Ficam só como redirecção para casos omissos:
 *  favoritos, e-mails já enviados e o que ainda apontar para o nome antigo `host` (Silva, 26/10/2026: "redireciona mesmo depois de apagar"). */
const PAINEL_ANTIGOS = ['/host:2026', '/host%3A2026', '/host%3a2026', '/vhost', '/host/2026', '/host']
/** Deixam de existir — "página não encontrada" (pedido do Silva, 13/10/2026: /vhost/2026 só serviu uma noite) */
const PAINEL_INEXISTENTES = ['/vhost/2026']

const comPrefixo = (pathname: string, prefixo: string) => pathname === prefixo || pathname.startsWith(`${prefixo}/`)

/** O resto do caminho depois do endereço único (/vhost:2026/admin → /admin), ou null se não for o endereço único */
function restoPainel(pathname: string): string | null {
  const forma = PAINEL_FORMAS.find((f) => comPrefixo(pathname, f))
  return forma ? pathname.slice(forma.length) : null
}

/** O mesmo ecrã do painel no endereço único, para um endereço antigo (/vhost/admin, /host:2026/admin → /vhost:2026/admin) */
function caminhoPainelAntigo(pathname: string): string | null {
  const antigo = PAINEL_ANTIGOS.find((a) => comPrefixo(pathname, a))
  return antigo ? PAINEL_BASE + pathname.slice(antigo.length) : null
}

/** Origem para onde se redirecciona: https no site em produção, http no servidor local (o `next dev` só fala http;
 *  com https o navegador dá ERR_SSL_PROTOCOL_ERROR e o projecto local parece desligado). */
function origemPublica(publico: string): string {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(publico) ? `http://${publico}` : `https://${publico}`
}

/** Há cookie de sessão do site (Supabase)? Só a presença — a validade confirma-a o servidor de autenticação */
function temCookieSessao(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
}

function isPublicMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_MARKETING_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = getRequestHostname(request.headers, request.url)
  const publicOrigin = getPublicSiteOrigin()
  const hostOnly = hostname.toLowerCase().split(':')[0]

  // 127.0.0.1 → localhost (mesmo sítio, cookies/PKCE iguais — automático)
  if (hostOnly === '127.0.0.1') {
    const canonical = request.nextUrl.clone()
    canonical.hostname = 'localhost'
    return NextResponse.redirect(canonical, 308)
  }

  // host.visualdesignmoz.com (também na porta 2026, a do DirectAdmin no Hetzner, e o /evo/ que os clientes têm
  // guardado) deixou de ser endereço do painel (pedido do Silva, 13/10/2026): vai tudo para o endereço único do
  // painel, https://visualdesignmoz.com/vhost:2026/. O nginx desse nome já redirecciona; isto cobre o resto.
  // (menos /api/: um webhook ou integração apontado a este nome não pode ser redireccionado)
  if (PANEL_HOSTS.has(hostOnly) && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(PAINEL_ENTRADA, 307)
  }
  // O painel vive todo em /vhost:2026/… (endereço único, pedido do Silva a 13/10/2026): abre aqui directamente — a rota
  // do Next é src/app/vhost, por isso reescreve-se (o endereço no browser não muda), com ou sem a barra final.
  const resto = restoPainel(pathname)
  if (resto !== null) {
    const ecra = resto.replace(/\/+$/, '')
    // Sem sessão: o painel mostra a sua própria entrada (nada de redirecionar para o login do site — Silva, 19/10/2026:
    // quem usa o endereço do painel entra pela entrada do painel; só ao sair é que vai para o login do site).
    const rota = request.nextUrl.clone()
    rota.pathname = `/vhost${ecra}`
    // A página do painel lê os dados já no servidor (sem página branca ao recarregar), onde não pode gravar cookies: a
    // sessão renova-se aqui, antes, como nos pedidos /api/vhost
    const { updateSession } = await import('@/utils/supabase/middleware')
    return updateSession(request, (headers) => NextResponse.rewrite(rota, { request: { headers } }))
  }
  // /vhost/2026 não existe: "página não encontrada". A rota interna do painel é src/app/vhost, por isso não se deixa passar
  // (serviria o painel num endereço que não existe): reescreve-se para um caminho sem rota, que dá o 404 do site
  if (PAINEL_INEXISTENTES.some((p) => comPrefixo(pathname, p))) {
    return NextResponse.rewrite(new URL('/pagina-que-nao-existe', request.url))
  }
  // Os endereços antigos (/vhost/…, /host/2026/…, links de e-mails e favoritos) vão, num só salto,
  // para o mesmo ecrã no endereço único
  const antigo = caminhoPainelAntigo(pathname)
  if (antigo) {
    const publico = (request.headers.get('x-forwarded-host') || request.headers.get('host') || hostOnly)
      .split(',')[0]
      .trim()
      .toLowerCase()
    return NextResponse.redirect(new URL(`${antigo.replace(/\/+$/, '')}${request.nextUrl.search}`, origemPublica(publico)), 308)
  }
  // o /evo e outros /host… (que não são do painel) seguem como antes
  if (pathname === '/evo' || pathname.startsWith('/evo/') || pathname.startsWith('/host')) {
    return NextResponse.next()
  }
  // www → apex em login/OAuth (PKCE exige o mesmo host no início e no callback)
  if (
    hostOnly === 'www.visualdesignmoz.com' &&
    (pathname === PUBLIC_LOGIN_ENTRY || pathname.startsWith('/auth/'))
  ) {
    const canonical = new URL(`${pathname}${request.nextUrl.search}`, publicOrigin)
    return NextResponse.redirect(canonical, 308)
  }

  // FIRST: OAuth ?code= fora de /auth/callback → corrigir rota
  const oauthCode = request.nextUrl.searchParams.get('code')
  if (
    oauthCode &&
    pathname !== '/auth/callback' &&
    pathname !== '/auth/confirm'
  ) {
    const callback = request.nextUrl.clone()
    callback.pathname = OAUTH_CALLBACK_PATH
    return NextResponse.redirect(callback)
  }

  // let auth callback pass immediately
  if (pathname === OAUTH_CALLBACK_PATH || pathname === '/auth/confirm') {
    return NextResponse.next()
  }

  // Quem já tem sessão e abre o login (vindo do painel ou do site) segue logo para onde ia: nunca tem de sair para voltar
  // a entrar (Silva, 16/10/2026)
  if (
    (pathname === PUBLIC_LOGIN_ENTRY || pathname === '/auth/login') &&
    request.method === 'GET' &&
    !request.nextUrl.searchParams.has('error') &&
    temCookieSessao(request)
  ) {
    const comSessao = NextResponse.next()
    let user: Awaited<ReturnType<ReturnType<typeof createAppServerClient>['auth']['getUser']>>['data']['user'] = null
    try {
      user = (await createAppServerClient(request, comSessao).auth.getUser()).data.user
    } catch (error) {
      console.error('[proxy] login: auth.getUser falhou (sessão inválida):', error)
    }
    if (user) {
      const pedido = request.nextUrl.searchParams.get('redirect') || request.nextUrl.searchParams.get('next') || ''
      // só caminhos deste site ("/…", nunca "//outro-site")
      const destino = /^\/(?![\/\\])/.test(pedido) ? pedido : PUBLIC_PANEL_ENTRY
      const seguir = NextResponse.redirect(new URL(destino, request.url))
      comSessao.cookies.getAll().forEach((cookie) => seguir.cookies.set(cookie))
      return seguir
    }
  }

  // Login — página estática; limpar ?from= legado (evita loops)
  if (pathname === PUBLIC_LOGIN_ENTRY) {
    if (request.nextUrl.searchParams.has('from')) {
      return NextResponse.redirect(
        buildPanelLoginUrl(request.url, request.nextUrl.searchParams),
      )
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  // Painéis antigos (/dashboard, /cliente, /revendedor, /profissional e o legado /admin): foram apagados a 24/10/2026 (Silva: "o painel
  // vhost é o principal") e qualquer endereço deles — favoritos, e-mails, avisos já guardados — vai para o painel principal, num só
  // salto e sem guardar o resto do endereço (os ecrãs antigos já não existem).
  if (['/dashboard', '/cliente', '/revendedor', '/profissional', '/admin'].some((p) => comPrefixo(pathname, p))) {
    const publico = (request.headers.get('x-forwarded-host') || request.headers.get('host') || hostOnly)
      .split(',')[0]
      .trim()
      .toLowerCase()
    return NextResponse.redirect(new URL(PAINEL_BASE, origemPublica(publico)), 308)
  }

  // Páginas públicas de marketing (home, serviços, portfolio, preços, etc.)
  // — não correr auth no proxy. Isto evita uma chamada de rede à Supabase
  // em CADA visita anónima a estas páginas, que são as mais visitadas do
  // site. Antes disto só cobria a home ('/'), o que gastava Fluid Compute
  // desnecessário em todas as outras páginas públicas.
  if (isPublicMarketingPath(pathname) && !oauthCode) {
    return NextResponse.next()
  }

  // Rotas de API do painel (/api/da, /api/server-exec, /api/admin/*):
  // refrescar a sessão Supabase para que tokens expirados sejam renovados
  // *antes* de o Route Handler os validar. Sem isto, o JWT expira após ~1h
  // e chamadas mutativas (createEmail, createUser, etc.) devolvem 401 "Não
  // autorizado" mesmo que o utilizador ainda veja dados em cache. A função
  // updateSession actualiza os cookies no request (para o Route Handler
  // receber tokens frescos) e na response (para o browser actualizar o
  // cookie). Rotas de webhook/cron com CRON_SECRET ou assinatura própria
  // não passam por aqui (a lista é explícita) — evita latência extra em
  // chamadas que não usam sessão Supabase.
  if (
    pathname === '/api/da' ||
    pathname.startsWith('/api/da/') ||
    pathname === '/api/server-exec' ||
    pathname.startsWith('/api/server-exec/') ||
    pathname.startsWith('/api/admin/') ||
    pathname === '/api/panel/bootstrap' ||
    pathname.startsWith('/api/panel/') ||
    // painel VisualHost (/vhost): sem isto a sessão expirava ao fim de ~1h e o painel pedia para entrar a meio do trabalho
    pathname.startsWith('/api/vhost/')
  ) {
    const { updateSession } = await import('@/utils/supabase/middleware')
    return updateSession(request)
  }

  // Restantes rotas de API: cada uma já se autentica sozinha (webhook,
  // CRON_SECRET, etc.) — não precisam do refresh de sessão.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createAppServerClient(request, response)

  // Um cookie de sessão inválido/expirado (ex.: "Invalid Refresh Token: Refresh
  // Token Not Found") fazia isto rebentar sem apanhar — como este proxy corre em
  // todas as rotas protegidas (/dashboard, /cliente, /revendedor, /guest,
  // /painel), qualquer visitante nessas condições ficava com "Internal Server
  // Error" no sítio todo em vez de simplesmente ser tratado como visitante e
  // reencaminhado para o login (o que já acontece mais abaixo quando `user` é
  // null).
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch (error) {
    console.error('[proxy] auth.getUser falhou (sessão inválida):', error)
  }
  const ip = (request as any).ip || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  // supabase.auth.getUser() pode renovar a sessão (token expirado) e escrever
  // os novos cookies em `response`. Se a seguir devolvermos um
  // NextResponse.redirect(...) diferente, esses cookies novos perdem-se e a
  // sessão "desaparece" a meio da navegação — por isso todo redirect a
  // partir daqui usa este helper para os levar consigo.
  const redirectWithSession = (url: string | URL, status?: number) => {
    const redirect = status ? NextResponse.redirect(url, status) : NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie)
    })
    return redirect
  }

  const isPanelEntryPath =
    pathname === PUBLIC_PANEL_ENTRY || pathname.startsWith(`${PUBLIC_PANEL_ENTRY}/`)

  // Entrada: visualdesignmoz.com/painel
  if (isPanelEntryPath) {
    if (!user) {
      return redirectWithSession(buildPanelLoginUrl(request.url))
    }
    const role = resolveUserRole({
      email: user.email,
      userMetadata: user.user_metadata,
      appMetadata: user.app_metadata,
    })
    // Sem consulta à base de dados aqui (proxy corre em todos os pedidos) — só
    // a marca de conta das encomendas no próprio user_metadata.
    const inner =
      panelRouteFromPublicEntry(pathname) ??
      resolveInnerPanelPath(null, role, role === 'guest' && isEncomendasAccount(user.user_metadata))
    const target = resolvePanelInnerRedirect(request.url, inner, request.nextUrl.search)
    return redirectWithSession(target)
  }

  // Rotas do painel: /guest (os painéis antigos redireccionam mais acima)
  if (isPanelRoute(pathname) && !pathname.startsWith(PUBLIC_PANEL_ENTRY)) {
    if (!user) {
      return redirectWithSession(buildPanelLoginUrl(request.url))
    }
    return response
  }

  // Honeypot/Rate Limit logic
  if ((pathname === '/auth/login' || pathname === PUBLIC_LOGIN_ENTRY) && request.method === 'POST') {
    const lastAttempt = loginAttempts.get(ip) || 0
    const now = Date.now()
    if (now - lastAttempt < RATE_LIMIT_MS) {
      return new NextResponse('Muitas solicitações.', { status: 429 })
    }
    loginAttempts.set(ip, now)
    if (loginAttempts.size > 1000) loginAttempts.clear()
  }

  // Hidden paths
  const pathsToHide = ['/autenticacao']
  if (pathsToHide.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.rewrite(new URL('/404-obfuscated', request.url))
  }

  // Public routes
  const publicRoutes = ['/', '/servicos', '/portfolio', '/sobre-nos', '/contacto', '/precos', '/auth', '/cursos']
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return response
  }
  if (!user) {
    return redirectWithSession(buildPanelLoginUrl(request.url))
  }

  const role = resolveUserRole({
    email: user.email,
    userMetadata: user.user_metadata,
    appMetadata: user.app_metadata,
  })

  if (pathname.startsWith('/guest') && role !== 'guest') {
    return redirectWithSession(new URL(getRedirectPathForRole(role), request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/painel',
    '/painel/:path*',
    '/servicos',
    '/servicos/:path*',
    '/portfolio',
    '/portfolio/:path*',
    '/sobre-nos',
    '/contacto',
    '/precos',
    '/precos/:path*',
    '/cursos',
    '/cursos/:path*',
    '/faq',
    '/faq/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/admin',
    '/admin/:path*',
    '/api/:path*',
    '/cliente/:path*',
    '/guest/:path*',
    '/revendedor/:path*',
    '/profissional/:path*',
    '/login',
    '/auth/:path*',
    '/autenticacao',
    // endereço antigo do DirectAdmin, o painel (/host/2026/…) e os seus endereços antigos (/vhost/…, /host:2026/…)
    '/evo',
    '/evo/:path*',
    // (o "(.*)" apanha também /vhost:2026, que o ":" impede de escrever como parâmetro)
    '/vhost(.*)',
    '/host(.*)',
  ],
}
