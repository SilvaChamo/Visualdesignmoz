'use client'

// O resto da página /brindes (apresentação, serviços, porquê a VisualGifts): vem do mesmo conteúdo das outras marcas, que
// leva ícones (funções) e por isso tem de ser lido aqui, no cliente, e não passado da página (servidor).

import { BrandLandingBody } from '@/components/brands/BrandLanding'
import { BRAND_LANDING_CONTENT } from '@/lib/brand-landing-content'

export function BrindesSobre() {
  return <BrandLandingBody data={BRAND_LANDING_CONTENT['brindes']} />
}
