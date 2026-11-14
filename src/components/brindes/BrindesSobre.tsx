'use client'

// O resto da página /brindes (apresentação, serviços, porquê a VisualGifts): vem do mesmo conteúdo das outras marcas, que
// leva ícones (funções) e por isso tem de ser lido aqui, no cliente, e não passado da página (servidor).
// Fica fechado até o visitante clicar (Silva, 14/11/2026: esta informação não interessa a quem vem ver produtos).

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { BrandLandingBody } from '@/components/brands/BrandLanding'
import { BRAND_LANDING_CONTENT } from '@/lib/brand-landing-content'

export function BrindesSobre() {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <div className="bg-zinc-50 pb-14 text-center dark:bg-zinc-950">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <span>Sobre a VisualGifts</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {aberto && <BrandLandingBody data={BRAND_LANDING_CONTENT['brindes']} recuo />}
    </>
  )
}
