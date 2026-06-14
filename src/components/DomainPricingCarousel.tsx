'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMtPrice, type DomainTldPrice } from '@/lib/domain-tld-prices'

const CARD_GAP = 16
const VISIBLE_CARDS = 4
const AUTO_MS = 3200

const CARD_WIDTH_CSS = `calc((100% - ${CARD_GAP * (VISIBLE_CARDS - 1)}px) / ${VISIBLE_CARDS})`

type DomainPricingCarouselProps = {
  items: DomainTldPrice[]
}

export function DomainPricingCarousel({ items }: DomainPricingCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [step, setStep] = useState(0)
  const [slideIndex, setSlideIndex] = useState(0)
  const [transitionEnabled, setTransitionEnabled] = useState(true)
  const loopItems = [...items, ...items]

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return

    const update = () => {
      setReady(node.clientWidth > 0)
      const card = trackRef.current?.querySelector('article')
      if (card) {
        setStep(card.getBoundingClientRect().width + CARD_GAP)
      }
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (items.length === 0) return
    const timer = setInterval(() => setSlideIndex((prev) => prev + 1), AUTO_MS)
    return () => clearInterval(timer)
  }, [items.length])

  const handleTransitionEnd = useCallback(() => {
    if (slideIndex >= items.length) {
      setTransitionEnabled(false)
      setSlideIndex(0)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTransitionEnabled(true))
      })
    }
  }, [slideIndex, items.length])

  const goPrev = () => {
    if (slideIndex === 0) {
      setTransitionEnabled(false)
      setSlideIndex(items.length)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionEnabled(true)
          setSlideIndex(items.length - 1)
        })
      })
      return
    }
    setSlideIndex((prev) => prev - 1)
  }

  const goNext = () => setSlideIndex((prev) => prev + 1)

  if (items.length === 0) return null

  if (!ready) {
    return <div ref={viewportRef} className="h-[168px] w-full min-w-0" />
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={goPrev}
        aria-label="Anterior"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 transition-colors hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/60"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div ref={viewportRef} className="min-w-0 flex-1 overflow-hidden py-1">
        <div
          ref={trackRef}
          className="flex"
          style={{
            gap: CARD_GAP,
            transform: step > 0 ? `translateX(-${slideIndex * step}px)` : undefined,
            transition: transitionEnabled ? 'transform 500ms ease-in-out' : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {loopItems.map((domain, index) => (
            <article
              key={`${domain.value}-${index}`}
              className="box-border flex shrink-0 flex-col items-center rounded-lg border border-zinc-200 bg-white px-4 py-5 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              style={{ width: CARD_WIDTH_CSS, maxWidth: CARD_WIDTH_CSS }}
            >
              <h4 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                <span className="text-green-600">.</span>
                {domain.label.replace(/^\./, '')}
              </h4>
              <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {formatMtPrice(domain.price)} MT
                <span className="text-zinc-500">/{domain.periodLabel || 'ano'}</span>
              </p>
              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                Registar agora
              </button>
            </article>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={goNext}
        aria-label="Seguinte"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 transition-colors hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/60"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}
