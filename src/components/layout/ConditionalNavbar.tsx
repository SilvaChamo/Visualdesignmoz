'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './Navbar'
import { Header } from './Header'

/**
 * Conditionally renders the Header based on the current route.
 * Admin (/dashboard) and Client (/client) panels are excluded.
 */
export function ConditionalNavbar() {
  const pathname = usePathname()

  // Routes that should NOT show the Header. /dev-preview…: páginas locais de pré-visualização do painel — com o
  // cabeçalho do site por cima, a barra do painel no telemóvel ficava tapada (sem o símbolo e o título; 15/10/2026)
  const excludedRoutes = ['/dashboard', '/cliente', '/auth', '/login', '/revendedor', '/guest', '/encomendas', '/contabilidade', '/vhost', '/host/', '/host:', '/dev-preview']

  const isExcluded = excludedRoutes.some(route => pathname.startsWith(route))
  if (isExcluded) return null

  // ?embed=1 abre /cotacao/[id] "limpo" (sem chrome de marketing), ex. a partir do painel de encomendas — escondido por
  // EmbedEstilo.tsx através de data-site-chrome (display: contents: o invólucro não muda o sticky do cabeçalho)
  return (
    <div data-site-chrome style={{ display: 'contents' }}>
      <Navbar />
      <Header />
    </div>
  )
}
