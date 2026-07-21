'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Info, ChevronDown, ShoppingCart } from 'lucide-react'
import { BRANDS, CATEGORIES, categoriesForBrand, formatMt, SELECAO_STORAGE_KEY, type SelectedCatalogItem } from '@/lib/pricing-catalog'

export default function PrecosPage() {
  const router = useRouter()
  const [expandedBrand, setExpandedBrand] = useState(BRANDS[0].id)
  const [activeId, setActiveId] = useState(categoriesForBrand(BRANDS[0].id)[0].id)
  const [selected, setSelected] = useState<SelectedCatalogItem[]>([])

  const active = CATEGORIES.find((c) => c.id === activeId) ?? CATEGORIES[0]

  const toggleBrand = (brandId: string) => {
    if (expandedBrand === brandId) return
    setExpandedBrand(brandId)
    const firstCategory = categoriesForBrand(brandId)[0]
    if (firstCategory) setActiveId(firstCategory.id)
  }

  const isSelected = (categoriaId: string, produto: string) =>
    selected.some((s) => s.categoriaId === categoriaId && s.produto === produto)

  const toggleItem = (categoriaId: string, produto: string, categoriaLabel: string) => {
    setSelected((prev) => {
      if (prev.some((s) => s.categoriaId === categoriaId && s.produto === produto)) {
        return prev.filter((s) => !(s.categoriaId === categoriaId && s.produto === produto))
      }
      return [...prev, { categoriaId, produto, categoriaLabel }]
    })
  }

  const handlePedirCotacao = () => {
    if (selected.length > 0) {
      sessionStorage.setItem(SELECAO_STORAGE_KEY, JSON.stringify(selected))
      router.push(`/cotacao?categoria=${selected[0].categoriaId}`)
    } else {
      router.push(`/cotacao?categoria=${active.id}`)
    }
  }

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
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Tabela de Preços</h1>
            <p className="text-base sm:text-lg text-zinc-300 font-normal max-w-2xl mx-auto leading-relaxed">
              Todos os serviços do Grupo VisualDesign, por marca e categoria.
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar + Detalhe */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* Barra lateral unificada — marcas + categorias */}
            <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
              <nav className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                {BRANDS.map((brand) => {
                  const brandCategories = categoriesForBrand(brand.id)
                  const isOpen = expandedBrand === brand.id
                  if (brandCategories.length === 0) return null
                  return (
                    <div key={brand.id}>
                      <button
                        type="button"
                        onClick={() => toggleBrand(brand.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm font-bold transition-colors ${
                          isOpen
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                            : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span>{brand.label}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                          {brandCategories.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setActiveId(cat.id)}
                              className={`w-full text-left px-5 py-2.5 text-sm transition-colors ${
                                activeId === cat.id
                                  ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-500 font-bold'
                                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
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
                  <label
                    key={item.name}
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected(active.id, item.name)}
                      onChange={() => toggleItem(active.id, item.name, active.label)}
                      className="w-4 h-4 text-red-600 rounded border-zinc-300 dark:border-zinc-600 shrink-0"
                    />
                    <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.name}</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-500 whitespace-nowrap">
                      {item.sobConsulta ? 'Sob Consulta' : `${formatMt(item.price)} MT`}
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex items-start gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Preços com IVA incluído, quando aplicável. Inclui o rascunho do projecto (layout).</p>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <button
                  type="button"
                  onClick={handlePedirCotacao}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-md transition-all transform hover:-translate-y-0.5 shadow-lg shadow-red-600/20"
                >
                  <span>{selected.length > 0 ? `Pedir Cotação (${selected.length})` : 'Pedir Cotação'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {selected.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <ShoppingCart className="w-4 h-4" />
                    {selected.length} serviço(s) seleccionado(s)
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
