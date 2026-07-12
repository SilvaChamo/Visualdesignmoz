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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type ServiceItem = {
  id: string
  Icon: typeof MonitorSmartphone
  title: string
  description: string
  href: string
}

const SERVICOS: ServiceItem[] = [
  {
    id: 'web-design',
    Icon: MonitorSmartphone,
    title: 'Web Design',
    description: 'Desenvolvimento de websites modernos, institucionais e landing pages responsivos, aplicativos moveis e sistemas de gestão, adaptadas ao seu negócio',
    href: '/servicos/webdesign',
  },
  {
    id: 'sistemas',
    Icon: Settings,
    title: 'Aplicações & Sistemas de Gestão',
    description: 'Desenvolvimento de aplicações web personalizadas, plataformas SaaS e sistemas para automação de processos internos.',
    href: '/servicos/webdesign',
  },
  {
    id: 'seo',
    Icon: TrendingUp,
    title: 'Otimização para Buscadores (SEO)',
    description: 'Engenharia de posicionamento orgânico e auditoria técnica para colocar o seu site no topo dos resultados de pesquisa.',
    href: '/servicos/seo',
  },
  {
    id: 'redes-sociais',
    Icon: Share2,
    title: 'Gestão de Redes Sociais',
    description: 'Fazemos Gestão de tráfego do seu site, fortificamos a sua presença digital e criamos estratégias de engajamento integradas aos canais digitais.',
    href: '/servicos/redes-sociais',
  },
  {
    id: 'loja-online',
    Icon: ShoppingCart,
    title: 'Lojas Online (E-commerce)',
    description: 'Criação de lojas online completas, com catálogo, pagamentos e gestão de encomendas integrados ao seu site.',
    href: '/servicos/webdesign',
  },
]

const VISIBLE = 3
const AUTOPLAY_MS = 4500
const TRANSITION_MS = 500

function ServiceCard({ item }: { item: ServiceItem }) {
  const { Icon } = item
  return (
    <div className="group w-full flex-1 flex flex-col items-center text-center bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-4 sm:p-5 rounded-lg transition-colors">
      <div className="w-12 h-12 rounded-lg border border-red-600/30 bg-red-600/5 flex items-center justify-center mb-4 transition-colors group-hover:bg-red-600 group-hover:border-red-600">
        <Icon className="w-6 h-6 text-red-600 transition-colors group-hover:text-white" strokeWidth={2} />
      </div>
      <h4 className="font-bold mb-2 text-black dark:text-white w-full truncate">{item.title}</h4>
      <p className="text-black/70 dark:text-zinc-300 text-sm mb-[20px] line-clamp-4">{item.description}</p>
      <Link
        href={item.href}
        className="group/link inline-flex items-center gap-1.5 text-black dark:text-white font-medium text-sm hover:text-red-600 dark:hover:text-red-500 transition-colors"
      >
        Ver Serviços
        <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/link:translate-x-1" />
      </Link>
    </div>
  )
}

export default function ServicosWebCarousel() {
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
                <ServiceCard item={item} />
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
            aria-label={`Ir para ${item.title}`}
            onClick={() => goToReal(i)}
            className={`h-2 rounded-full transition-all ${
              activeDot === i ? 'w-6 bg-red-600' : 'w-2 bg-black/20 dark:bg-white/20'
            }`}
          />
        ))}
      </div>

      <div className="mt-8 p-4 sm:p-6 bg-white dark:bg-white/10 dark:border dark:border-white/15 rounded-lg border border-dashed border-black/20 text-center">
        <p className="text-black/70 dark:text-zinc-300 text-sm">
          Procura soluções de identidade visual, fotografia ou vídeo?{' '}
          <Link href="/servicos" className="text-red-600 dark:text-red-400 font-medium underline hover:text-red-700 transition-colors">
            Aceda à nossa divisão de Design Criativo
          </Link>
        </p>
      </div>
    </div>
  )
}
