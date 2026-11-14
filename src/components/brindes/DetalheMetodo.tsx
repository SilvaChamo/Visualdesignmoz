// A cor e a área máxima de um método de personalização, em pedaços separados (para a tradução ao inglês trocar cada um).

import { corMetodo } from '@/lib/catalogo-personalizacao'
import type { FichaMetodo } from '@/lib/catalogo-fichas'

export function DetalheMetodo({ m }: { m: FichaMetodo }) {
  const cor = corMetodo(m.c)
  const area = m.w && m.h ? `${m.w} × ${m.h} mm` : null
  return (
    <>
      {cor && <span>{cor}</span>}
      {cor && area && <span>{' · '}</span>}
      {area && (
        <>
          <span>até</span> <span>{area}</span>
        </>
      )}
    </>
  )
}
