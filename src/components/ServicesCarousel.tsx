'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type ServiceItem = {
  titleKey: string
  descKey: string
  href: string
}

const SERVICES: ServiceItem[] = [
  { titleKey: 'services.graphic', descKey: 'services.graphic.desc', href: '/servicos/design-grafico' },
  { titleKey: 'services.web', descKey: 'services.web.desc', href: '/servicos/webdesign' },
  { titleKey: 'services.marketing', descKey: 'services.marketing.desc', href: '/servicos/marketing-digital' },
  { titleKey: 'services.branding', descKey: 'services.branding.desc', href: '/servicos/branding' },
  { titleKey: 'services.seo', descKey: 'services.seo.desc', href: '/servicos/seo' },
  { titleKey: 'services.social', descKey: 'services.social.desc', href: '/servicos/redes-sociais' },
  { titleKey: 'services.video', descKey: 'services.video.desc', href: '/servicos/video-producao' },
  { titleKey: 'services.photography', descKey: 'services.photography.desc', href: '/servicos/fotografia' },
]

const CARDS_PER_SLIDE = 4
const AUTOPLAY_MS = 5000
const TRANSITION_MS = 500

// Agrupa os 8 serviços em slides de 4.
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function ServiceCard({ item, t }: { item: ServiceItem; t: (k: string) => string }) {
  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-3 sm:p-4 rounded-lg">
      <h4 className="font-bold mb-2">{t(item.titleKey)}</h4>
      <p className="text-black/70 dark:text-zinc-300 text-sm mb-4 flex-1">{t(item.descKey)}</p>
      <Link
        href={item.href}
        className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white dark:bg-transparent dark:border dark:border-white/25 dark:text-white dark:hover:bg-red-600 dark:hover:border-red-600 transition-colors inline-block cursor-pointer self-start"
      >
        {t('services.view')}
      </Link>
    </div>
  )
}

export function ServicesCarousel({ t }: { t: (k: string) => string }) {
  const realSlides = chunk(SERVICES, CARDS_PER_SLIDE) // [[0,1,2,3],[4,5,6,7]]
  const slideCount = realSlides.length // 2
  // Track renderizado = slides reais + clone do 1º slide no fim, para o loop ficar suave.
  const trackSlides = [...realSlides, realSlides[0]]

  const [index, setIndex] = useState(0) // índice dentro de trackSlides
  const [withTransition, setWithTransition] = useState(true)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const goTo = useCallback((i: number) => {
    setWithTransition(true)
    setIndex(i)
  }, [])

  const next = useCallback(() => {
    setWithTransition(true)
    setIndex((i) => i + 1)
  }, [])

  const prev = useCallback(() => {
    setWithTransition(true)
    setIndex((i) => {
      if (i === 0) {
        // Salta sem animação para o clone final antes de recuar, para o loop parecer contínuo.
        setWithTransition(false)
        return slideCount - 1
      }
      return i - 1
    })
  }, [slideCount])

  // Autoplay
  useEffect(() => {
    if (paused) return
    timerRef.current = setInterval(next, AUTOPLAY_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [next, paused])

  // Quando o slide "clone" termina de entrar, salta sem transição de volta ao slide real 0.
  const handleTransitionEnd = () => {
    if (index === slideCount) {
      setWithTransition(false)
      setIndex(0)
    }
  }

  // Depois de desligar a transição para o salto, volta a ligá-la no próximo frame.
  useEffect(() => {
    if (!withTransition) {
      const raf = requestAnimationFrame(() => setWithTransition(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [withTransition])

  const activeDot = index % slideCount

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Altura fixa por cartão garante que a secção nunca muda de altura entre slides */}
      <div className="overflow-hidden rounded-lg">
        <div
          className="flex"
          style={{
            width: `${trackSlides.length * 100}%`,
            transform: `translateX(-${(100 / trackSlides.length) * index}%)`,
            transition: withTransition ? `transform ${TRANSITION_MS}ms ease` : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {trackSlides.map((slide, slideIdx) => (
            <div
              key={slideIdx}
              className="grid grid-cols-4 gap-3 sm:gap-4 md:gap-6 shrink-0"
              style={{ width: `${100 / trackSlides.length}%` }}
            >
              {slide.map((item) => (
                <div key={item.titleKey} className="min-h-[220px] sm:min-h-[240px]">
                  <ServiceCard item={item} t={t} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Setas */}
      <button
        type="button"
        onClick={prev}
        aria-label="Anterior"
        className="hidden md:flex absolute left-[-14px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/15 items-center justify-center shadow hover:bg-red-600 hover:text-white dark:hover:bg-red-600 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Seguinte"
        className="hidden md:flex absolute right-[-14px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/15 items-center justify-center shadow hover:bg-red-600 hover:text-white dark:hover:bg-red-600 transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Indicadores */}
      <div className="flex justify-center gap-2 mt-4">
        {realSlides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ir para slide ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all ${
              activeDot === i ? 'w-6 bg-red-600' : 'w-2 bg-black/20 dark:bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
