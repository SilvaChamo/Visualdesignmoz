'use client'

// Galeria da ficha do produto: foto grande com setas e ampliação, miniaturas por baixo. As fotos mudam com a cor escolhida.

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { urlImagem } from '@/lib/catalogo-imagens'

export function GaleriaProduto({ imagens, nome, indice, aoMudar, selos }: { imagens: string[]; nome: string; indice: number; aoMudar: (i: number) => void; selos?: React.ReactNode }) {
  const [ampliada, setAmpliada] = useState(false)
  const n = imagens.length
  const ir = useCallback((i: number) => aoMudar(((i % n) + n) % n), [aoMudar, n])

  useEffect(() => {
    if (!ampliada) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAmpliada(false)
      else if (e.key === 'ArrowRight') ir(indice + 1)
      else if (e.key === 'ArrowLeft') ir(indice - 1)
    }
    window.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = antes
    }
  }, [ampliada, indice, ir])

  if (n === 0) return null
  const botao =
    'absolute top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white text-zinc-800 shadow-md ring-1 ring-black/5 transition hover:bg-red-600 hover:text-white'

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/70 dark:bg-zinc-800/80 dark:ring-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={imagens[indice]} src={urlImagem(imagens[indice], 900)} alt={nome} decoding="async" className="absolute inset-0 h-full w-full object-contain p-[6%]" />
        {selos && <div className="absolute left-4 top-4 flex flex-col items-start gap-1.5">{selos}</div>}
        {n > 1 && (
          <>
            <button type="button" onClick={() => ir(indice - 1)} aria-label="Foto anterior" className={`${botao} left-3`}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => ir(indice + 1)} aria-label="Foto seguinte" className={`${botao} right-3`}>
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 left-4 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-semibold text-white">{`${indice + 1} / ${n}`}</span>
          </>
        )}
        <button type="button" onClick={() => setAmpliada(true)} aria-label="Ampliar a foto" className="absolute bottom-3 right-3 z-10 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-zinc-800 shadow-md ring-1 ring-black/5 transition hover:bg-red-600 hover:text-white">
          <ZoomIn className="h-5 w-5" />
        </button>
      </div>

      {n > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2.5 sm:grid-cols-6">
          {imagens.slice(0, 12).map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => aoMudar(i)}
              aria-label={`Foto ${i + 1}`}
              aria-current={i === indice}
              className={`relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-zinc-100 transition dark:bg-zinc-800/80 ${i === indice ? 'ring-2 ring-red-600' : 'ring-1 ring-zinc-200 hover:ring-red-600/50 dark:ring-white/10'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlImagem(src, 160)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-contain p-1.5" />
            </button>
          ))}
        </div>
      )}

      {ampliada && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={nome} onClick={() => setAmpliada(false)}>
          <button type="button" onClick={() => setAmpliada(false)} aria-label="Fechar" className="absolute right-4 top-4 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30">
            <X className="h-6 w-6" />
          </button>
          {n > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); ir(indice - 1) }} aria-label="Foto anterior" className="absolute left-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30">
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); ir(indice + 1) }} aria-label="Foto seguinte" className="absolute right-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30">
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlImagem(imagens[indice], 1200)} alt={nome} className="max-h-[90vh] max-w-[92vw] rounded-2xl bg-white object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
