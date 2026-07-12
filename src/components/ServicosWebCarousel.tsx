'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  MonitorSmartphone,
  Settings,
  TrendingUp,
  Share2,
  ShoppingCart,
  Palette,
  CalendarDays,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'

type ServiceItem = {
  id: string
  Icon: typeof MonitorSmartphone
  titleKey: string
  descKey: string
  href: string
}

const SERVICOS: ServiceItem[] = [
  {
    id: 'web-design',
    Icon: MonitorSmartphone,
    titleKey: 'carousel.web-design.title',
    descKey: 'carousel.web-design.desc',
    href: '/servicos/webdesign',
  },
  {
    id: 'sistemas',
    Icon: Settings,
    titleKey: 'carousel.sistemas.title',
    descKey: 'carousel.sistemas.desc',
    href: '/servicos/webdesign',
  },
  {
    id: 'seo',
    Icon: TrendingUp,
    titleKey: 'carousel.seo.title',
    descKey: 'carousel.seo.desc',
    href: '/servicos/seo',
  },
  {
    id: 'redes-sociais',
    Icon: Share2,
    titleKey: 'carousel.redes-sociais.title',
    descKey: 'carousel.redes-sociais.desc',
    href: '/servicos/redes-sociais',
  },
  {
    id: 'loja-online',
    Icon: ShoppingCart,
    titleKey: 'carousel.loja-online.title',
    descKey: 'carousel.loja-online.desc',
    href: '/servicos/webdesign',
  },
]

const VISIBLE = 3
const AUTOPLAY_MS = 4500
const TRANSITION_MS = 500

function ServiceCard({ item, t }: { item: ServiceItem; t: (k: string) => string }) {
  const { Icon } = item
  return (
    <div className="group w-full flex-1 flex flex-col items-center text-center bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-4 sm:p-5 rounded-lg transition-colors">
      <div className="w-12 h-12 rounded-lg border border-red-600/30 bg-red-600/5 flex items-center justify-center mb-4 transition-colors group-hover:bg-red-600 group-hover:border-red-600">
        <Icon className="w-6 h-6 text-red-600 transition-colors group-hover:text-white" strokeWidth={2} />
      </div>
      <h4 className="font-bold mb-2 text-black dark:text-white w-full truncate">{t(item.titleKey)}</h4>
      <p className="text-black/70 dark:text-zinc-300 text-sm mb-[20px] line-clamp-2">{t(item.descKey)}</p>
      <Link
        href={item.href}
        className="inline-flex items-center gap-1.5 text-black dark:text-white font-medium text-sm transition-colors group-hover:text-red-600 dark:group-hover:text-red-500"
      >
        {t('services.view')}
        <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1.5" />
      </Link>
    </div>
  )
}

export default function ServicosWebCarousel() {
  const { t } = useI18n()
  const total = SERVICOS.length // 5

  // Clones: último item no início, primeiros (VISIBLE-1) no fim — janela de 4 sempre preenchida.
  const track = [
    SERVICOS[total - 1],
    ...SERVICOS,
    ...SERVICOS.slice(0, VISIBLE - 1),
  ]
  const trackLength = track.length // 1 + 5 + 3 = 9

  const firstReal = 1
  const lastReal = total // 5

  const [index, setIndex] = useState(firstReal)
  const [withTransition, setWithTransition] = useState(true)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const next = useCallback(() => {
    setWithTransition(true)
    setIndex((i) => i + 1)
  }, [])

  const prev = useCallback(() => {
    setWithTransition(true)
    setIndex((i) => i - 1)
  }, [])

  useEffect(() => {
    if (paused) return
    timerRef.current = setInterval(next, AUTOPLAY_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [next, paused])

  // Ao chegar a uma zona clonada, salta sem transição para a posição real equivalente.
  const handleTransitionEnd = () => {
    if (index > lastReal) {
      setWithTransition(false)
      setIndex(firstReal)
    } else if (index < firstReal) {
      setWithTransition(false)
      setIndex(lastReal)
    }
  }

  useEffect(() => {
    if (!withTransition) {
      const raf = requestAnimationFrame(() => setWithTransition(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [withTransition])

  const goToReal = (realIdx: number) => {
    setWithTransition(true)
    setIndex(firstReal + realIdx)
  }

  const activeDot = ((index - firstReal) % total + total) % total

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Wrapper relativo apenas para os cards — garante setas centradas na altura do card */}
      <div className="relative">
        <div className="overflow-hidden">
          <div
            className="flex"
            style={{
              width: `${(trackLength / VISIBLE) * 100}%`,
              transform: `translateX(-${(index * 100) / trackLength}%)`,
              transition: withTransition ? `transform ${TRANSITION_MS}ms ease` : 'none',
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {track.map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                className="shrink-0 px-1.5 sm:px-2 flex flex-col"
                style={{ width: `${100 / trackLength}%` }}
              >
                <ServiceCard item={item} t={t} />
              </div>
            ))}
          </div>
        </div>

        {/* Setas — top-1/2 agora é relativo só à altura dos cards */}
        <button
          type="button"
          onClick={prev}
          aria-label="Anterior"
          className="hidden md:flex absolute left-[-14px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/15 items-center justify-center shadow hover:bg-red-600 hover:text-white dark:hover:bg-red-600 transition-colors z-10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Seguinte"
          className="hidden md:flex absolute right-[-14px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/15 items-center justify-center shadow hover:bg-red-600 hover:text-white dark:hover:bg-red-600 transition-colors z-10"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex justify-center gap-2 mt-6 sm:mt-8">
        {SERVICOS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Ir para ${t(item.titleKey)}`}
            onClick={() => goToReal(i)}
            className={`h-2 rounded-full transition-all ${
              activeDot === i ? 'w-6 bg-red-600' : 'w-2 bg-black/20 dark:bg-white/20'
            }`}
          />
        ))}
      </div>

      <div className="mt-4 mx-2 sm:mx-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Coluna 1: Design Criativo */}
        <Link
          href="/servicos"
          className="group flex items-center gap-4 bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 border border-black/5 rounded-lg p-4 sm:p-5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.06]"
        >
          <div className="shrink-0 w-12 h-12 rounded-lg border border-red-600/30 bg-red-600/5 flex items-center justify-center transition-colors group-hover:bg-red-600 group-hover:border-red-600">
            <Palette className="w-6 h-6 text-red-600 transition-colors group-hover:text-white" strokeWidth={2} />
          </div>
          <div>
            <h3 className="font-bold text-black dark:text-white mb-1">{t('carousel.design-criativo.title')}</h3>
            <p className="text-sm text-black/70 dark:text-zinc-300 line-clamp-2">{t('carousel.design-criativo.desc')}</p>
          </div>
        </Link>

        {/* Coluna 2: Feiras e Eventos */}
        <Link
          href="/servicos"
          className="group flex items-center gap-4 bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 border border-black/5 rounded-lg p-4 sm:p-5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.06]"
        >
          <div className="shrink-0 w-12 h-12 rounded-lg border border-red-600/30 bg-red-600/5 flex items-center justify-center transition-colors group-hover:bg-red-600 group-hover:border-red-600">
            <CalendarDays className="w-6 h-6 text-red-600 transition-colors group-hover:text-white" strokeWidth={2} />
          </div>
          <div>
            <h3 className="font-bold text-black dark:text-white mb-1">{t('carousel.feiras-eventos.title')}</h3>
            <p className="text-sm text-black/70 dark:text-zinc-300 line-clamp-2">{t('carousel.feiras-eventos.desc')}</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
