'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { CATEGORIES, formatMt } from '@/lib/pricing-catalog'

export default function PrecosPage() {
  const [activeId, setActiveId] = useState(CATEGORIES[0].id)
  const active = CATEGORIES.find((c) => c.id === activeId) ?? CATEGORIES[0]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      {/* Hero */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10 text-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Tabela de Preços — VisualDesign</h1>
            <p className="text-base sm:text-lg text-zinc-300 font-normal max-w-2xl mx-auto leading-relaxed">
              Design gráfico, impressão, têxteis e produção audiovisual, por categoria.
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar + Detalhe */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* Categorias */}
            <div className="w-full lg:w-64 shrink-0">
              <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveId(cat.id)}
                    className={`whitespace-nowrap lg:whitespace-normal text-left px-4 py-3 rounded-md border text-sm font-bold transition-colors ${
                      activeId === cat.id
                        ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-zinc-900'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-red-400'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Detalhe */}
            <div className="flex-1 w-full min-w-0">
              <div className="mb-6 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg px-5 py-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{active.label}</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{active.subtitle}</p>
                {active.minQty && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{active.minQty}</p>
                )}
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {active.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.name}</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-500 whitespace-nowrap">
                      {formatMt(item.price)} MT
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-start gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Preços com IVA incluído. Inclui o rascunho do projecto (layout).</p>
              </div>

              <div className="mt-8">
                <Link
                  href={`/cotacao?categoria=${active.id}`}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-md transition-all transform hover:-translate-y-0.5 shadow-lg shadow-red-600/20"
                >
                  <span>Pedir Cotação</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
