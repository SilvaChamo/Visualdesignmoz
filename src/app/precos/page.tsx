'use client'

import { useState, useRef, useLayoutEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, ChevronDown, ShoppingCart, Sparkles } from 'lucide-react'
import { BRANDS, CATEGORIES, categoriesForBrand, findCategory, formatMt, SELECAO_STORAGE_KEY, CUSTOM_CATEGORIA_ID, type SelectedCatalogItem } from '@/lib/pricing-catalog'
import { Loader2 } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'

// Marcas cujas categorias são todas serviços "Sob Consulta" de item único —
// em vez de várias subcategorias na barra lateral (cada uma com 1 opção),
// mostram uma única entrada "Serviços" e listam todas as opções juntas na
// coluna direita, para escolha múltipla.
const FLATTENED_BRANDS = new Set(['web', 'transporte'])
const isFlatId = (id: string) => id.startsWith('flat:')
const flatBrandOf = (id: string) => id.slice('flat:'.length)

function PrecosContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCategory = findCategory(searchParams.get('categoria') || '')
  const initialBrandId = initialCategory?.brand ?? BRANDS[0].id
  const initialActiveId = initialCategory
    ? (FLATTENED_BRANDS.has(initialCategory.brand) ? `flat:${initialCategory.brand}` : initialCategory.id)
    : (FLATTENED_BRANDS.has(initialBrandId) ? `flat:${initialBrandId}` : categoriesForBrand(initialBrandId)[0].id)

  const [expandedBrand, setExpandedBrand] = useState(initialBrandId)
  const [activeId, setActiveId] = useState(initialActiveId)
  const [selected, setSelected] = useState<SelectedCatalogItem[]>([])
  const [customDescription, setCustomDescription] = useState('')

  const isCustomActive = activeId === CUSTOM_CATEGORIA_ID

  // Sem botão próprio de "adicionar" — escrever aqui entra logo na selecção
  // (tal como marcar um checkbox), para o botão "Pedir Cotação" ser o único
  // e mesmo botão dinâmico em qualquer separador, incluindo este.
  const handleCustomDescriptionChange = (texto: string) => {
    setCustomDescription(texto)
    setSelected((prev) => {
      const semPersonalizado = prev.filter((s) => s.categoriaId !== CUSTOM_CATEGORIA_ID)
      const trimmed = texto.trim()
      return trimmed
        ? [...semPersonalizado, { categoriaId: CUSTOM_CATEGORIA_ID, produto: trimmed, categoriaLabel: 'Pedido Personalizado' }]
        : semPersonalizado
    })
  }

  const activeIsFlat = isFlatId(activeId)
  const activeFlatBrandId = activeIsFlat ? flatBrandOf(activeId) : null
  const active = activeIsFlat ? undefined : (CATEGORIES.find((c) => c.id === activeId) ?? CATEGORIES[0])

  // Lista unificada de itens a mostrar na coluna direita — cada item já traz
  // consigo a sua categoria real (categoriaId/categoriaLabel), quer estejamos
  // numa categoria normal quer numa marca "achatada" com várias categorias juntas.
  const displayItems = activeIsFlat && activeFlatBrandId
    ? categoriesForBrand(activeFlatBrandId).flatMap((c) => c.items.map((item) => ({ ...item, categoriaId: c.id, categoriaLabel: c.label })))
    : (active ? active.items.map((item) => ({ ...item, categoriaId: active.id, categoriaLabel: active.label })) : [])

  const flatBrandLabel = activeFlatBrandId ? BRANDS.find((b) => b.id === activeFlatBrandId)?.label ?? '' : ''
  const headerTitle = activeIsFlat ? 'Serviços' : active?.label ?? ''
  const headerSubtitle = activeIsFlat ? `Escolha um ou mais serviços de ${flatBrandLabel}.` : active?.subtitle ?? ''
  const headerMinQty = activeIsFlat ? '' : active?.minQty ?? ''

  // A janela de itens não deve encolher em relação ao tamanho da primeira
  // subcategoria mostrada — só medimos essa altura uma vez, e ela passa a
  // servir de altura mínima; categorias com mais itens continuam a crescer.
  const itemsListRef = useRef<HTMLDivElement>(null)
  const [minListHeight, setMinListHeight] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (minListHeight === undefined && itemsListRef.current) {
      setMinListHeight(itemsListRef.current.offsetHeight)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleBrand = (brandId: string) => {
    if (expandedBrand === brandId) return
    setExpandedBrand(brandId)
    if (FLATTENED_BRANDS.has(brandId)) {
      setActiveId(`flat:${brandId}`)
    } else {
      const firstCategory = categoriesForBrand(brandId)[0]
      if (firstCategory) setActiveId(firstCategory.id)
    }
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
    if (selected.length === 0) return
    sessionStorage.setItem(SELECAO_STORAGE_KEY, JSON.stringify(selected))
    router.push(`/cotacao?categoria=${selected[0].categoriaId}`)
  }

  return (
    <div className="min-h-screen bg-zinc-200 dark:bg-zinc-950 text-foreground">
      {/* Hero — mesmo estilo do banner de /cotacao, sem imagem, com o brilho
          vermelho espalhado por todo o banner (não só ao centro) e suave. */}
      <NotchSection shape="start" bg="bg-gradient-to-br from-black via-zinc-900 to-zinc-950" first>
        <div className="absolute top-0 left-[10%] w-[450px] h-[300px] bg-red-600/5 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/5 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-0 right-[10%] w-[450px] h-[300px] bg-red-600/5 rounded-full blur-[130px] pointer-events-none" />
        <div className="container mx-auto max-w-7xl px-[20px] pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10 text-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Tabela de Preços</h1>
            <p className="text-base sm:text-lg text-zinc-300 font-normal max-w-2xl mx-auto leading-relaxed">
              Todos os serviços do Grupo VisualDesign, por marca e categoria.
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-zinc-500 to-transparent" />
          <div className="h-[1px] bg-gradient-to-r from-transparent via-red-600 to-transparent" />
        </div>
      </NotchSection>

      {/* Sidebar + Detalhe */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-[40px]">
          <div className="flex flex-col lg:flex-row gap-[24px] items-start">

            {/* Barra lateral unificada — marcas + categorias */}
            <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
              <nav className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                <div className="px-6 py-4 bg-zinc-100 dark:bg-zinc-800">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Categorias de Serviços</h3>
                  <p className="text-xs text-black dark:text-zinc-400 mt-1">Escolha uma marca para ver os serviços disponíveis.</p>
                </div>
                {BRANDS.map((brand) => {
                  const brandCategories = categoriesForBrand(brand.id)
                  const isOpen = expandedBrand === brand.id
                  if (brandCategories.length === 0) return null
                  const isFlattened = FLATTENED_BRANDS.has(brand.id)
                  return (
                    <div key={brand.id}>
                      <button
                        type="button"
                        onClick={() => toggleBrand(brand.id)}
                        className={`group w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-base transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/40 ${
                          isOpen
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-extrabold cursor-default'
                            : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 font-bold cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-red-600 dark:hover:text-red-500'
                        }`}
                      >
                        <span className={`inline-block transition-transform duration-300 ${isOpen ? '' : 'group-hover:translate-x-1.5'}`}>{brand.label}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <div
                        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                      >
                        <div className="overflow-hidden">
                          <div>
                            {isFlattened ? (
                              <button
                                type="button"
                                onClick={() => setActiveId(`flat:${brand.id}`)}
                                className="group w-full flex items-center justify-between gap-2 px-5 py-2.5 text-sm transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/40 bg-white dark:bg-zinc-900 text-red-600 dark:text-red-500 font-bold cursor-default"
                              >
                                <span>Serviços</span>
                              </button>
                            ) : (
                              brandCategories.map((cat, idx) => {
                                return (
                                  <div key={cat.id}>
                                    <button
                                      type="button"
                                      onClick={() => setActiveId(cat.id)}
                                      className={`group w-full text-left px-5 py-2.5 text-sm transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/40 ${
                                        activeId === cat.id
                                          ? 'bg-white dark:bg-zinc-900 text-red-600 dark:text-red-500 font-bold cursor-default'
                                          : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-red-600 dark:hover:text-red-500'
                                      }`}
                                    >
                                      <span className={`inline-block transition-transform duration-300 ${activeId === cat.id ? '' : 'group-hover:translate-x-1.5'}`}>{cat.label}</span>
                                    </button>
                                    {idx < brandCategories.length - 1 && (
                                      <div className="mx-4 border-b border-zinc-200 dark:border-zinc-700" />
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setActiveId(CUSTOM_CATEGORIA_ID)}
                  className={`group w-full flex items-center gap-2 px-4 py-3 text-left text-base transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/40 ${
                    isCustomActive
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-red-600 dark:text-red-500 font-extrabold cursor-default'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 font-bold cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-red-600 dark:hover:text-red-500'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span className={`inline-block transition-transform duration-300 ${isCustomActive ? '' : 'group-hover:translate-x-1.5'}`}>Pedido Personalizado</span>
                </button>
              </nav>
            </div>

            {/* Detalhe */}
            <div className="flex-1 w-full min-w-0">
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg overflow-hidden">
                {isCustomActive ? (
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0" />
                      <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Pedido Personalizado</h2>
                    </div>
                    <p className="text-sm text-black dark:text-zinc-400">
                      Não encontrou o que precisa na lista? Descreva aqui o que pretende — entraremos em contacto para confirmar os detalhes e o valor.
                    </p>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5 block">
                        Descreva o que precisa
                      </label>
                      <textarea
                        value={customDescription}
                        onChange={(e) => handleCustomDescriptionChange(e.target.value)}
                        rows={5}
                        className="w-full px-4 py-2.5 rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all text-sm"
                        placeholder="Ex: Preciso de um vídeo promocional de 30 segundos para redes sociais, com voz off em português..."
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/40">
                      <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">{headerTitle}</h2>
                      <p className="text-sm text-black dark:text-zinc-400">{headerSubtitle}</p>
                      {headerMinQty && (
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{headerMinQty}</p>
                      )}
                    </div>

                    <div ref={itemsListRef} className="divide-y divide-zinc-100 dark:divide-zinc-800" style={{ minHeight: minListHeight }}>
                      {displayItems.map((item, idx) => (
                        <label
                          key={`${item.categoriaId}:${item.name}`}
                          className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${
                            idx % 2 === 0
                              ? 'bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                              : 'bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected(item.categoriaId, item.name)}
                            onChange={() => toggleItem(item.categoriaId, item.name, item.categoriaLabel)}
                            className="w-4 h-4 text-red-600 rounded border-zinc-300 dark:border-zinc-600 shrink-0"
                          />
                          <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.name}</span>
                          <span className="text-sm font-bold text-red-600 dark:text-red-500 whitespace-nowrap">
                            {item.sobConsulta ? 'Sob Consulta' : `${formatMt(item.price)} MT`}
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 flex items-center gap-4">
                <button
                  type="button"
                  onClick={handlePedirCotacao}
                  disabled={selected.length === 0}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 text-white font-bold px-5 py-2 rounded-md transition-all transform hover:-translate-y-0.5 shadow-lg shadow-red-600/20"
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

export default function PrecosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950">
          <Loader2 className="w-10 h-10 animate-spin text-red-600" />
        </div>
      }
    >
      <PrecosContent />
    </Suspense>
  )
}
