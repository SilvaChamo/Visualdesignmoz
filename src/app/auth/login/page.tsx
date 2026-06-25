import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { buildPanelLoginUrl } from '@/lib/panel-origin'

/** Legado — tudo passa por /login */
export default async function AuthLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const key of ['error', 'error_description', 'reason', 'reset', 'redirect', 'next'] as const) {
    const value = params[key]
    if (typeof value === 'string') qs.set(key, value)
  }
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host') || 'localhost:3002'
  const proto = headerStore.get('x-forwarded-proto') || 'http'
  const dest = buildPanelLoginUrl(`${proto}://${host}`, qs)
  redirect(`${dest.pathname}${dest.search}`)
}
