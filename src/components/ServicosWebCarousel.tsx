'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  MonitorSmartphone,
  Settings,
  TrendingUp,
  Share2,
  ShoppingCart,
  ArrowRight,
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

  // Clones: último item no início, primeiros (VISIBLE) no fim — janela de 4 sempre preenchida.
  const track = [
    SERVICOS[total - 1],
    ...SERVICOS,
    ...SERVICOS.slice(0, VISIBLE),
  ]
  const trackLength = track.length // 1 + 5 + 3 = 9

  const firstReal = 1
  const lastReal = total // 5

  const [index, setIndex] = useState(firstReal)
  const [withTransition, setWithTransition] = useState(true)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef = useRef<number | null>(null)

  const next = useCallback(() => {
    setWithTransition(true)
    setIndex((i) => i + 1)
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

  // Depois de desligar a transição para o salto, volta a ligá-la só depois do
  // browser ter pintado a posição "saltada" — duplo rAF evita o piscar/flash
  // que acontece se a transição for reactivada demasiado cedo.
  useEffect(() => {
    if (!withTransition) {
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => setWithTransition(true))
        rafRef.current = raf2
      })
      rafRef.current = raf1
      return () => cancelAnimationFrame(rafRef.current!)
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
    </div>
  )
}
