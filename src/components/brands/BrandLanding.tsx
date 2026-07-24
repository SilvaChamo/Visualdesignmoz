'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import type { BrandLandingContent } from '@/lib/brand-landing-content'

export function BrandHero({ data, breadcrumb }: { data: BrandLandingContent; breadcrumb?: string }) {
  const pathname = usePathname()

  const getBrandSegment = () => {
    switch (pathname) {
      case '/eventos': return 'VisualEventos'
      case '/producoes': return 'VisualPro'
      case '/transporte': return 'VisualTransporte'
      case '/brindes': return 'VisualGifts'
      default: return 'Marcas'
    }
  }

  return (
    <NotchSection shape="start" bg="bg-black" first className="z-30">
      {data.hero.imageSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.hero.imageSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top opacity-30 dark:opacity-35"
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-black/20 dark:bg-black/25" />
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-[145px] pb-[50px] sm:pt-[160px] sm:pb-[60px] md:pt-[180px] md:pb-[70px] relative z-10 flex items-center h-[560px] sm:h-[640px] md:h-[760px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full">
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6 pb-[50px]">
            <div className="text-xs sm:text-sm text-zinc-400 font-bold uppercase tracking-widest mb-1">
              {breadcrumb ?? `Início / Marcas / ${getBrandSegment()}`}
            </div>
            <h1 className="font-bold leading-[1.15] text-white text-[clamp(1.75rem,3.2vw+1rem,2.75rem)] max-w-2xl">
              {data.hero.title}
            </h1>
            <p className="text-sm sm:text-base text-zinc-300 max-w-xl leading-relaxed">
              {data.hero.subtitle}
            </p>
            {data.hero.badges.length > 0 && (
              <div className="flex items-start flex-nowrap mr-0 sm:mr-[30px] text-zinc-300 bg-transparent">
                {data.hero.badges.map((badge, idx) => (
                  <div key={badge} className="contents">
                    {idx > 0 && <span className="w-px h-10 bg-white/20 shrink-0" />}
                    <span className={`text-sm sm:text-base font-bold leading-snug flex-1 min-w-0 ${idx === 0 ? 'pr-4' : idx === data.hero.badges.length - 1 ? 'pl-4' : 'px-4'}`}>{badge}</span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href={data.hero.ctaHref}
              className="group/btn bg-red-600 hover:bg-red-700 text-white font-bold px-10 py-2 rounded-md transition-all duration-300 transform hover:-translate-y-0.5 inline-flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
            >
              <span>{data.hero.ctaLabel}</span>
              <ArrowRight className="w-4 h-4 transition-all duration-300 transform translate-x-[-4px] opacity-0 group-hover/btn:translate-x-0 group-hover/btn:opacity-100" />
            </Link>
          </div>
          <div className="lg:col-span-5 hidden lg:block" />
        </div>
      </div>
    </NotchSection>
  )
}

export function BrandLandingBody({ data }: { data: BrandLandingContent }) {
  const [openWhyUs, setOpenWhyUs] = useState<Record<number, boolean>>({})
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    setSubscribed(true)
    setTimeout(() => setSubscribed(false), 5000)
  }

  const whyUsColumns = [data.whyUs.slice(0, Math.ceil(data.whyUs.length / 2)), data.whyUs.slice(Math.ceil(data.whyUs.length / 2))]

  return (
    <>
      {/* Introdução + Serviços */}
      <div className="-mt-[16px] relative z-20 bg-zinc-200 dark:bg-zinc-900">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 pt-0 pb-8">
          <div className="text-center pt-[30px] max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-4">
              <span className="text-zinc-400 dark:text-zinc-500 font-normal">—</span> {data.intro.title} <span className="text-zinc-400 dark:text-zinc-500 font-normal">—</span>
            </h2>
            <p className="text-sm sm:text-base text-black/60 dark:text-zinc-400 leading-relaxed">
              {data.intro.text}
            </p>
          </div>
        </div>
      </div>

      <NotchSection shape="end" bg="bg-white dark:bg-zinc-950" first className="pt-16 pb-16 sm:pt-24 sm:pb-24">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center mb-10 sm:mb-12 flex flex-col items-center max-w-3xl mx-auto">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-600 dark:text-red-500 mb-2">
                <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
                {data.servicesPretitle}
                <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-4">
                {data.servicesTitle}
              </h2>
              <p className="text-sm text-black/60 dark:text-zinc-400">{data.servicesSubtitle}</p>
            </div>

            <div className="mt-12 sm:mt-16 mx-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-12">
                {data.services.map(({ Icon, title, desc, href }) => {
                  const hasSubPage = href !== '#' && href !== '' && href !== '/visualdesign' && href !== '/eventos' && href !== '/producoes' && href !== '/transporte' && href !== '/brindes' && href !== '/web'
                  return (
                    <div key={title} className="flex flex-col items-start text-left space-y-4">
                      <div className="text-red-600 dark:text-red-500 flex items-center justify-center shrink-0">
                        <Icon className="w-8 h-8" strokeWidth={2} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-black dark:text-white text-lg mb-2">
                          {title}
                        </h3>
                        <p className="text-sm text-black/60 dark:text-zinc-400 leading-relaxed mb-3">
                          {desc}
                        </p>
                        {hasSubPage && (
                          <Link
                            href={href}
                            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-500 hover:underline transition-all"
                          >
                            <span>Saber Mais</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </NotchSection>

      {/* Como Trabalhamos */}
      <NotchSection shape="mid" bg="bg-zinc-200 dark:bg-black" className="pt-16 pb-16 sm:pt-24 sm:pb-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="text-center flex flex-col items-center max-w-3xl mx-auto mb-12">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-600 dark:text-red-500 mb-2">
              <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
              Processo
              <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-3">
              Como Trabalhamos
            </h2>
            <p className="text-sm text-black/60 dark:text-white/70">
              Do primeiro contacto à entrega final, seguimos um processo claro e transparente para garantir resultados que superam as expectativas.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 mx-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { step: '1', title: 'Briefing & Diagnóstico', desc: 'Ouvimos atentamente as suas necessidades, estudamos o mercado e o contexto da sua marca para definir os objectivos do projecto.' },
                { step: '2', title: 'Criação & Revisão', desc: 'Desenvolvemos conceitos criativos, apresentamos propostas e refinamos iterativamente até chegar à solução que melhor representa a sua marca.' },
                { step: '3', title: 'Entrega & Suporte', desc: 'Entregamos todos os ficheiros nos formatos corretos, com acompanhamento pós-entrega para garantir a correcta implementação.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4 p-4 rounded-lg border bg-white dark:bg-zinc-800 border-zinc-200/80 dark:border-white/10">
                  <span className="shrink-0 w-11 h-11 rounded-lg border flex items-center justify-center border-red-600/40 dark:border-red-500/40 bg-red-600/5 dark:bg-red-500/5 font-extrabold text-red-600 dark:text-red-500 text-lg">
                    {step}
                  </span>
                  <div>
                    <h3 className="font-bold text-black dark:text-white mb-1">{title}</h3>
                    <p className="text-sm text-black/60 dark:text-zinc-400 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </NotchSection>

      {/* Porquê nós */}
      <NotchSection shape="mid-alt" bg="bg-white dark:bg-zinc-950" className="pt-16 pb-16 sm:pt-24 sm:pb-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="text-center flex flex-col items-center max-w-3xl mx-auto mb-0">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-600 dark:text-red-500 mb-2">
              <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
              {data.whyUsPretitle}
              <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-3">
              {data.whyUsTitle}
            </h2>
            <p className="text-sm text-black/60 dark:text-white/70">{data.whyUsSubtitle}</p>
          </div>

          <div className="mt-8 sm:mt-10 mx-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {whyUsColumns.map((column, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-3">
                  {column.map((item, itemIdx) => {
                    const idx = colIdx * column.length + itemIdx
                    const isOpen = Boolean(openWhyUs[idx])
                    const { Icon } = item
                    return (
                      <div key={item.title} className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenWhyUs((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                          className="w-full flex items-stretch text-left bg-white dark:bg-zinc-800 rounded-md overflow-hidden shadow-sm"
                        >
                          <span className="shrink-0 w-20 flex items-center justify-center bg-red-600">
                            <Icon className="w-6 h-6 text-white" />
                          </span>
                          <span className="flex-1 flex items-center justify-between gap-3 px-4 py-4">
                            <span className="flex flex-col gap-1 min-w-0 flex-1">
                              <span className="text-base sm:text-lg font-bold text-black dark:text-white leading-tight">
                                {item.title}
                              </span>
                              <span className="text-xs sm:text-sm text-black/60 dark:text-zinc-400 line-clamp-1 block">
                                {item.teaser}
                              </span>
                            </span>
                            <span className="shrink-0 w-6 h-6 flex items-center justify-center text-red-600 dark:text-red-500 text-lg font-bold leading-none">
                              {isOpen ? '−' : '+'}
                            </span>
                          </span>
                        </button>
                        <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="px-4 py-8 text-sm text-black/70 dark:text-white/70 bg-white dark:bg-zinc-800 rounded-md shadow-sm">
                              {item.desc}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </NotchSection>

      {/* CTA */}
      <NotchSection shape="mid" bg="bg-zinc-200 dark:bg-black" className="py-16 sm:py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="text-center flex flex-col items-center max-w-2xl mx-auto gap-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white">
              {data.cta.title}
            </h2>
            <p className="text-sm text-black/60 dark:text-zinc-400">{data.cta.subtitle}</p>
            <Link
              href={data.cta.buttonHref}
              className="mt-2 bg-red-600 hover:bg-red-700 text-white font-bold px-10 py-3 rounded-md transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
            >
              {data.cta.buttonLabel}
            </Link>
          </div>
        </div>
      </NotchSection>

      {/* Newsletter */}
      <NotchSection shape="mid-alt" bg="bg-white dark:bg-zinc-950" className="py-8 sm:py-10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="mx-5 flex flex-col md:flex-row items-center justify-between gap-6 py-2">
            <div className="text-center md:text-left">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-black dark:text-white mb-1">
                Fique a par das novidades
              </h3>
              <p className="text-xs sm:text-sm text-black/60 dark:text-white/70">
                Subscreva e receba dicas e novidades da VisualDesign.
              </p>
            </div>
            <div className="w-full md:w-auto max-w-2xl md:flex-1 flex justify-end">
              {subscribed ? (
                <div className="bg-green-600/10 dark:bg-green-500/10 border border-green-600/30 dark:border-green-500/30 text-green-600 dark:text-green-500 px-4 py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 w-full max-w-md">
                  <span>✓</span> Subscrição confirmada!
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex items-center gap-[15px] w-full max-w-xl md:max-w-2xl">
                  <input
                    type="email"
                    placeholder="O seu email"
                    className="px-4 py-3.5 text-sm rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 w-full"
                    required
                  />
                  <button
                    type="submit"
                    className="px-5 py-3.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold transition-colors whitespace-nowrap shadow-sm"
                  >
                    Subscrever
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </NotchSection>
    </>
  )
}

/** Marca completa (hero + secções) — usada nas páginas standalone /visualdesign, /eventos, etc. */
export function BrandLanding({ data }: { data: BrandLandingContent }) {
  return (
    <>
      <BrandHero data={data} />
      <BrandLandingBody data={data} />
    </>
  )
}
