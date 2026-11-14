// Banner da página /brindes (VisualGifts): fundo de brindes (gradiente da cor do fundo, mais claro à direita) e o texto à esquerda.
// Só servidor. A altura mínima (418 px em ecrã largo) é a que o banner tinha com o cartão de produtos, já retirado.

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import type { BrandLandingContent } from '@/lib/brand-landing-content'

export function BrindesHero({ hero }: { hero: BrandLandingContent['hero'] }) {
  // «Brindes que representam» / «a sua marca»: o título em duas linhas (Silva, 14/11/2026)
  const linhas = hero.title.split(/\s+(?=a sua marca)/)

  return (
    <NotchSection shape="start" bg="bg-[#141414]" first className="z-30">
      <Image src="/assets/brindes-hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-center opacity-45" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/90 via-[#141414]/55 to-transparent" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center px-4 pb-[80px] pt-[145px] sm:px-6 sm:pt-[160px] md:pt-[170px]">
        <div className="grid w-full grid-cols-1 items-center gap-12 lg:min-h-[418px] lg:grid-cols-12">
          <div className="flex flex-col items-start space-y-6 text-left lg:col-span-7">
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400 sm:text-sm">Início / Marcas / VisualGifts</div>
            <h1 className="max-w-2xl text-[clamp(1.75rem,3.2vw+1rem,2.75rem)] font-bold leading-[1.15] text-white">{linhas.length > 1 ? linhas.map((l) => <span key={l} className="block">{l}</span>) : hero.title}</h1>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-300 sm:text-base">{hero.subtitle}</p>
            {hero.badges.length > 0 && (
              <div className="mr-0 flex flex-nowrap items-start bg-transparent text-zinc-300 sm:mr-[30px]">
                {hero.badges.map((badge, idx) => (
                  <div key={badge} className="contents">
                    {idx > 0 && <span className="h-10 w-px shrink-0 bg-white/20" />}
                    <span className={`min-w-0 flex-1 text-sm font-bold leading-snug sm:text-base ${idx === 0 ? 'pr-4' : idx === hero.badges.length - 1 ? 'pl-4' : 'px-4'}`}>{badge}</span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href={hero.ctaHref}
              className="group/btn inline-flex transform items-center justify-center gap-2 rounded-md bg-red-600 px-10 py-2 font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-700"
            >
              <span>{hero.ctaLabel}</span>
              <ArrowRight className="h-4 w-4 translate-x-[-4px] opacity-0 transition-all duration-300 group-hover/btn:translate-x-0 group-hover/btn:opacity-100" />
            </Link>
          </div>
        </div>
      </div>
    </NotchSection>
  )
}
