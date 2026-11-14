// Banner da página /brindes (VisualGifts): fundo de brindes, texto à esquerda e, à direita, um cartão com produtos
// diversos do catálogo (cada um leva à sua subcategoria). Só servidor: recebe os destaques já escolhidos.

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { PREFIXO_IMAGENS, type ProdutoPublico } from '@/lib/catalogo-brindes'
import { hrefGrupo, grupoPorId, subPorId } from '@/lib/catalogo-grupos'
import type { BrandLandingContent } from '@/lib/brand-landing-content'

export type Destaque = { produto: ProdutoPublico; grupo: string; sub: string }

export function BrindesHero({ hero, destaques, total }: { hero: BrandLandingContent['hero']; destaques: Destaque[]; total: number }) {
  const arredondado = (Math.floor(total / 100) * 100).toLocaleString('pt-PT')

  return (
    <NotchSection shape="start" bg="bg-[#141414]" first className="z-30">
      <Image src="/assets/brindes-hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-center opacity-45" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center px-4 pb-[80px] pt-[145px] sm:px-6 sm:pt-[160px] md:pt-[170px]">
        <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="flex flex-col items-start space-y-6 text-left lg:col-span-7">
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400 sm:text-sm">Início / Marcas / VisualGifts</div>
            <h1 className="max-w-2xl text-[clamp(1.75rem,3.2vw+1rem,2.75rem)] font-bold leading-[1.15] text-white">{hero.title}</h1>
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

          <div className="hidden lg:col-span-5 lg:block">
            <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/20 backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-2">
                {destaques.map(({ produto, grupo, sub }) => {
                  const g = grupoPorId(grupo)
                  const s = subPorId(g, sub)
                  if (!g || !s) return null
                  return (
                    <Link key={produto.sku} href={hrefGrupo(g, s)} className="group/tile flex flex-col overflow-hidden rounded-lg bg-white">
                      <div className="relative aspect-square">
                        <Image
                          src={`${PREFIXO_IMAGENS}${encodeURI(produto.imagem)}`}
                          alt={s.nome}
                          fill
                          sizes="160px"
                          className="object-contain p-2 transition-transform duration-300 group-hover/tile:scale-105"
                        />
                      </div>
                      <span className="truncate bg-zinc-100 px-2 py-1.5 text-center text-[11px] font-bold text-zinc-800 group-hover/tile:text-red-600">{s.nome}</span>
                    </Link>
                  )
                })}
              </div>
              <p className="mt-3 flex items-baseline justify-center gap-1.5 text-center text-sm text-zinc-200">
                <span className="font-extrabold text-white">{`+${arredondado}`}</span>
                <span>produtos para personalizar com a sua marca</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </NotchSection>
  )
}
