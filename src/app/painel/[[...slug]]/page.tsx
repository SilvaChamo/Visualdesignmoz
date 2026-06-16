import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  PUBLIC_LOGIN_ENTRY,
  PUBLIC_PANEL_ENTRY,
  panelRouteFromPublicEntry,
  resolveInnerPanelPath,
  resolvePanelInnerRedirect,
} from '@/lib/panel-origin'
import { profileAuthOrFilter } from '@/lib/profile-db'
import { resolveUserRole } from '@/lib/user-roles'
import { fetchUserProductsSummary } from '@/lib/user-products'

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

  if (!user) {
    redirect(`${PUBLIC_LOGIN_ENTRY}?from=${encodeURIComponent(pathname)}`)
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

  const inner =
    panelRouteFromPublicEntry(pathname) ?? resolveInnerPanelPath(null, role)

  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host') || 'localhost:3002'
  const proto = headerStore.get('x-forwarded-proto') || 'http'
  const requestUrl = `${proto}://${host}/`

  redirect(resolvePanelInnerRedirect(requestUrl, inner))
}
