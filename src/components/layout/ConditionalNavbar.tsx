'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Navbar } from './Navbar'
import { Header } from './Header'

/**
 * Conditionally renders the Header based on the current route.
 * Admin (/dashboard) and Client (/client) panels are excluded.
 */
export function ConditionalNavbar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Routes that should NOT show the Header
  const excludedRoutes = ['/dashboard', '/cliente', '/auth', '/login', '/revendedor', '/guest', '/encomendas']

  const isExcluded = excludedRoutes.some(route => pathname.startsWith(route))
  // ?embed=1 é usado para abrir /cotacao/[id] "limpo" (sem chrome de marketing),
  // ex. a partir do painel de encomendas — independente da rota estar ou não
  // na lista acima.
  const isEmbedded = searchParams?.get('embed') === '1'

  if (isExcluded || isEmbedded) return null

  return (
    <>
      <Navbar />
      <Header />
    </>
  )
}
