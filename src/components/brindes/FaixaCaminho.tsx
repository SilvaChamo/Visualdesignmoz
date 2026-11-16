// Faixa do caminho («Início › VisualGifts › …») das páginas interiores dos brindes: clara e lisa (sem linha nem sombra; `linha` põe a linha e a sombra de baixo, na ficha do produto), fina, encostada ao cabeçalho; o cinzento da busca começa logo a seguir, sem sobreposição. `margens` é o espaço dos lados (o mesmo do conteúdo da página). Só servidor.

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

/** O caminho em si («Início › VisualGifts › …»), para pôr dentro de qualquer faixa. */
export function Migalhas({ migalhas, atual }: { migalhas: { nome: string; href: string }[]; atual: string }) {
  return (
    <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:text-sm">
      {migalhas.map((m) => (
        <span key={m.href} className="flex items-center gap-1.5">
          <Link href={m.href} className="transition-colors hover:text-red-600">
            {m.nome}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        </span>
      ))}
      <span className="max-w-[60vw] truncate text-red-600 dark:text-red-500">{atual}</span>
    </nav>
  )
}

export function FaixaCaminho({ migalhas, atual, margens = 'px-4 sm:px-6', linha = false }: { migalhas: { nome: string; href: string }[]; atual: string; margens?: string; linha?: boolean }) {
  return (
    <div className={`relative z-10 bg-zinc-50 pb-3 pt-[119px] dark:bg-zinc-950 sm:pt-[120px] ${linha ? 'border-b border-zinc-200 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.25)] dark:border-zinc-800' : ''}`}>
      <div className={`container mx-auto max-w-7xl ${margens}`}>
        <Migalhas migalhas={migalhas} atual={atual} />
      </div>
    </div>
  )
}
