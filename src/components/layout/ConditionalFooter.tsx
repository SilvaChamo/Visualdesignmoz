'use client'

import { usePathname } from 'next/navigation'
import { CompactFooter } from './CompactFooter'

/**
 * Rodapé único do site público — o mesmo da home (CompactFooter) em todas as
 * páginas/tabs. Painéis (admin/cliente/revendedor/guest) e autenticação têm o
 * seu próprio layout e não mostram este rodapé, tal como o Header (ver ConditionalNavbar).
 */
export function ConditionalFooter() {
  const pathname = usePathname()

  const excludedRoutes = ['/dashboard', '/client', '/auth', '/login', '/revendedor', '/guest']
  const isExcluded = excludedRoutes.some((route) => pathname.startsWith(route))

  if (isExcluded) return null

  // Mesmo efeito de sobreposição (-mt) que a home já usava para o rodapé "encaixar"
  // no fim da última secção — mantido igual em todas as páginas para ficar consistente.
  return (
    <div className="relative -mt-[16px] z-10">
      <CompactFooter />
    </div>
  )
}
