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

  const excludedRoutes = ['/dashboard', '/client', '/auth', '/login', '/revendedor', '/guest', '/encomendas']
  const isExcluded = excludedRoutes.some((route) => pathname.startsWith(route))

  if (isExcluded) return null

  // Sobreposição -mt confirmada no histórico do git como o padrão original
  // (sempre presente antes de qualquer alteração desta sessão) — o rodapé
  // (rectângulo sólido, sem recorte próprio) encaixa por cima do "dente" da
  // última secção (Newsletter, forma 'mid'), criando o efeito pretendido:
  // preto a aparecer nas pontas, cor da secção a aparecer no meio.
  return (
    <div className="relative -mt-[16px] z-10">
      <CompactFooter />
    </div>
  )
}
