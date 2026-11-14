// Banner da página /brindes (VisualGifts): fundo de brindes (gradiente da cor do fundo, mais claro à direita) e o texto à esquerda.
// Só servidor. Imagem webp de 94 KB, com a altura dos banners das outras marcas (560/640/760 px, como em BrandLanding) e o fundo
// escurecido à esquerda (a direita fica sem fundo) para se lerem as letras (Silva, 14/11/2026).

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
      <Image src="/assets/brindes-hero.webp" alt="" fill priority unoptimized sizes="100vw" className="object-cover object-center" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/95 via-[#141414]/70 to-transparent" />
      <div className="relative z-10 mx-auto flex h-[560px] w-full max-w-7xl items-center px-[41px] pb-[50px] pt-[145px] sm:h-[640px] sm:px-[49px] sm:pb-[60px] sm:pt-[160px] md:h-[760px] md:pb-[70px] md:pt-[180px]">
        <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="flex flex-col items-start space-y-6 text-left lg:col-span-7">
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400 sm:text-sm">Início / Marcas / VisualGifts</div>
            <h1 className="max-w-2xl text-[clamp(1.75rem,3.2vw+1rem,2.75rem)] font-bold leading-[1.15] text-white">{linhas.length > 1 ? linhas.map((l) => <span key={l} className="block">{l}</span>) : hero.title}</h1>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-300 sm:text-base">{hero.subtitle}</p>
            {hero.badges.length > 0 && (
              <div className="mr-0 flex flex-nowrap items-start bg-transparent text-zinc-300 sm:mr-[30px]">
                {hero.badges.map((badge, idx) => (
                  <div key={badge} className="contents">
                    {idx > 0 && <span className="h-5 w-px shrink-0 self-center bg-white/25" />}
                    <span className={`min-w-0 flex-1 text-sm font-bold leading-snug sm:flex-none sm:whitespace-nowrap sm:text-base ${idx === 0 ? 'pr-5' : idx === hero.badges.length - 1 ? 'pl-5' : 'px-5'}`}>{badge}</span>
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
