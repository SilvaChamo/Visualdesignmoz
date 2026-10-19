import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  buildPanelLoginUrl,
  PUBLIC_PANEL_ENTRY,
  panelRouteFromPublicEntry,
  resolveInnerPanelPath,
  isEncomendasAccount,
  resolvePanelInnerRedirect,
  getPublicSiteOrigin,
} from '@/lib/panel-origin'
import { profileAuthOrFilter } from '@/lib/profile-db'
import { resolveUserRole } from '@/lib/user-roles'
import { fetchUserProductsSummary } from '@/lib/user-products'
import { userHasQuotationRequests } from '@/lib/quotation-access'

type Props = {
  params: Promise<{ slug?: string[] }>
}

/** Entrada /painel — fallback se o proxy não interceptar; lógica igual. */
export default async function PainelEntryPage({ params }: Props) {
  const { slug } = await params
  const sub = slug?.length ? `/${slug.join('/')}` : ''
  const pathname = `${PUBLIC_PANEL_ENTRY}${sub}`

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Origem explícita (NEXT_PUBLIC_SITE_URL), não cabeçalhos de proxy — atrás
  // do Cloudflare + Apache, x-forwarded-host pode chegar duplicado
  // ("visualdesignmoz.com, visualdesignmoz.com"), o que rebenta o new URL().
  const requestUrl = `${getPublicSiteOrigin()}/`

  if (!user) {
    const login = buildPanelLoginUrl(requestUrl)
    redirect(login.toString())
  }

  const products = await fetchUserProductsSummary(supabase, user.id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .or(profileAuthOrFilter(user.id))
    .maybeSingle()

  const role = resolveUserRole({
    email: user.email,
    userMetadata: user.user_metadata,
    appMetadata: user.app_metadata,
    profileRole: profile?.role,
    hasPaidProducts: products.hasPaidProducts,
  })

  const hasEncomendas =
    role === 'guest' ? isEncomendasAccount(user.user_metadata) || (await userHasQuotationRequests(user.id)) : false

  const inner =
    panelRouteFromPublicEntry(pathname) ?? resolveInnerPanelPath(null, role, hasEncomendas)

  redirect(resolvePanelInnerRedirect(requestUrl, inner))
}
