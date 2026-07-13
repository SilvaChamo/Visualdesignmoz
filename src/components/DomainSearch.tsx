'use client'

import { useState } from 'react'
import { Check, X, Loader2, Globe } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useCart } from '@/contexts/CartContext'
import { DomainPricingCarousel } from '@/components/DomainPricingCarousel'
import { DOMAIN_TLD_PRICES, formatMtPrice } from '@/lib/domain-tld-prices'
import { panelTabBtn, panelTabList } from '@/lib/panel-ui'

interface SearchResult {
  domain: string
  available: boolean
  price?: number
  renewPrice?: number
  currency?: string
  loading?: boolean
  error?: string
  costPennies?: number
}

interface DomainSearchProps {
  onResultsAction?: (results: SearchResult[]) => void
  onLoadingAction?: (loading: boolean) => void
  hideResultsInternal?: boolean
  isAdmin?: boolean
  /** Mesmo arredondamento `rounded` dos campos no painel admin (sem alterar cores). */
  panelFieldRounding?: boolean
  searchContainerClassName?: string
}

const TLDS = DOMAIN_TLD_PRICES

function calculatePrice(usdPrice: number) {
  return formatMtPrice(usdPrice)
}

export default function DomainSearch({
  onResultsAction,
  onLoadingAction,
  hideResultsInternal = false,
  isAdmin = false,
  panelFieldRounding = false,
  searchContainerClassName = '',
}: DomainSearchProps) {
  const { t } = useI18n()
  const { addItem, setIsCartOpen } = useCart()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTLD, setSelectedTLD] = useState('.com')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [resultsTab, setResultsTab] = useState<'domains' | 'pricing' | 'plans'>('domains')
  const [billingCycle, setBillingCycle] = useState<'mensal' | 'anual'>('anual')

  const searchRound = isAdmin || panelFieldRounding ? 'rounded' : 'rounded-lg'
  const fieldClass = isAdmin
    ? `w-full px-4 py-2 ${searchRound} bg-white text-zinc-900 border border-zinc-300 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all font-medium shadow-sm`
    : `w-full px-4 py-2 ${searchRound} bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all font-medium`
  const mutedText = isAdmin ? 'text-zinc-600 dark:text-zinc-400' : 'text-slate-500'
  const headingText = isAdmin ? 'text-zinc-900 dark:text-zinc-100' : 'text-white'

  const renderPricingCards = () => <DomainPricingCarousel items={TLDS} />

  const renderPricingTable = () => (
    <div className="w-full overflow-hidden rounded border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
          <tr>
            <th className="p-3 font-bold text-zinc-700 dark:text-zinc-300">Extensão</th>
            <th className="p-3 font-bold text-zinc-700 dark:text-zinc-300">Registo</th>
            <th className="p-3 font-bold text-zinc-700 dark:text-zinc-300">Renovação</th>
            <th className="p-3 font-bold text-zinc-700 dark:text-zinc-300">Transferência</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {TLDS.map((domain) => (
            <tr key={domain.value} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
              <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-100">{domain.label}</td>
              <td className="p-3 text-zinc-600 dark:text-zinc-400">{calculatePrice(domain.price)} MT</td>
              <td className="p-3 text-zinc-600 dark:text-zinc-400">{calculatePrice(domain.renewPrice)} MT</td>
              <td className="p-3 text-zinc-600 dark:text-zinc-400">{calculatePrice(domain.transfer)} MT</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setHasSearched(true)
    setResultsTab('domains')
    if (onLoadingAction) onLoadingAction(true)
    setResults([])
    if (onResultsAction) onResultsAction([])

    try {
      // Otimização: Pesquisa apenas o TLD selecionado e os TLDs mais populares para reduzir latência e evitar 429
      const POPULAR_TLDS = ['.com', '.net', '.org', '.online', '.tech', '.co', '.site']
      const tldsToSearch = Array.from(new Set([selectedTLD, ...POPULAR_TLDS]))
      
      const fetchPromises = tldsToSearch.map(async (tld) => {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 15000)

          const res = await fetch('/api/domain-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: searchQuery.trim(), tld }),
            signal: controller.signal,
          })
          clearTimeout(timeoutId)

          const data = await res.json()
          const tldData = TLDS.find((row) => row.value === tld)

          return {
            domain: data.domain || `${searchQuery.trim().replace(/^www\./, '').split('.')[0]}${tld}`,
            available: data.available,
            price:
              typeof data.price === 'number'
                ? data.price
                : parseFloat(String(data.price || '')) || (tldData ? tldData.price : 8.88),
            renewPrice: tldData ? tldData.renewPrice : 8.88,
            currency: data.currency || 'USD',
            error: data.error,
            costPennies: typeof data.costPennies === 'number' ? data.costPennies : undefined,
          } as SearchResult
        } catch {
          return {
            domain: `${searchQuery.trim().replace(/^www\./, '').split('.')[0]}${tld}`,
            available: false,
            error: 'Erro de verificação',
          } as SearchResult
        }
      })

      const allResults = await Promise.all(fetchPromises)

      allResults.sort((a, b) => {
        if (a.domain.endsWith(selectedTLD)) return -1
        if (b.domain.endsWith(selectedTLD)) return 1
        return 0
      })

      setResults(allResults)
      if (onResultsAction) onResultsAction(allResults)
    } catch (error: unknown) {
      console.error('Search error:', error)
      const errorResult = {
        domain: searchQuery.trim() + selectedTLD,
        available: false,
        error: 'Erro ao verificar disponibilidade.',
      }
      setResults([errorResult])
      if (onResultsAction) onResultsAction([errorResult])
    } finally {
      setLoading(false)
      if (onLoadingAction) onLoadingAction(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  const closeResults = () => {
    setHasSearched(false)
    setResults([])
    setResultsTab('domains')
    if (onResultsAction) onResultsAction([])
  }

  const handleRegisterAction = async (domain: string) => {
    const row = results.find((r) => r.domain === domain)
    if (row && row.price !== undefined) {
      setActionLoading(domain)
      setTimeout(() => {
        setActionLoading(null)
        const finalPrice = Math.round(row.price! * 65 * 1.5 * 1.075)
        const finalRenewPrice = row.renewPrice ? Math.round(row.renewPrice * 65 * 1.5 * 1.075) : undefined

        addItem({
          id: domain,
          type: 'domain',
          name: domain,
          price: finalPrice,
          period: 1,
          renewPrice: finalRenewPrice,
        })

        if (isAdmin) {
          window.location.href = '/checkout'
        } else {
          setIsCartOpen(true)
        }
      }, 500)
    }
  }

  const renderDomainResults = () => (
    <div className="flex flex-col gap-3">
      {results.map((result, index) => (
        <div
          key={result.domain}
          className={`flex w-full flex-col items-start gap-3 rounded border bg-white py-3 px-3 sm:grid sm:grid-cols-3 sm:items-center sm:px-4 dark:bg-zinc-900 ${
            index === 0 && result.available
              ? 'border-red-200 ring-1 ring-red-50 dark:border-red-900/50 dark:ring-red-950/30'
              : 'border-zinc-200 dark:border-zinc-700'
          }`}
        >
          <div className="flex w-full items-center justify-start gap-3">
            {result.available ? (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Check className="h-3.5 w-3.5" />
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-base font-normal text-zinc-900 dark:text-zinc-100">
              {result.domain}
              {index === 0 ? (
                <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:bg-red-950/40 dark:text-red-400">
                  A sua escolha
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-1 sm:items-end sm:pr-4">
            {result.error && !result.available ? (
              <span className="text-left text-xs font-medium text-red-500 sm:text-right">{result.error}</span>
            ) : result.price !== undefined ? (
              <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-lg font-bold text-zinc-700 dark:text-zinc-200">
                  {calculatePrice(result.price)} MT
                </span>
                {result.renewPrice ? (
                  <span className="text-[11px] font-medium text-zinc-500">
                    Renovação: <span className="text-red-500">{calculatePrice(result.renewPrice)} MT</span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex w-full items-start justify-start sm:items-center sm:justify-end">
            {result.available ? (
              <button
                type="button"
                onClick={() => void handleRegisterAction(result.domain)}
                disabled={actionLoading === result.domain}
                className="flex w-auto items-center justify-start gap-2 whitespace-nowrap rounded bg-green-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-700 sm:min-w-[130px]"
              >
                {actionLoading === result.domain ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> …
                  </>
                ) : isAdmin ? (
                  'Registar'
                ) : (
                  'Adicionar'
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-auto cursor-not-allowed rounded bg-zinc-400 px-5 py-2 text-left text-sm font-bold text-white sm:min-w-[130px] dark:bg-zinc-600"
              >
                Indisponível
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  const renderResultsPanel = (panelMode: boolean) => (
    <div className="w-full text-left">
      <div
        className={`mb-4 flex flex-col items-start gap-4 border-b pb-2 sm:flex-row sm:items-center sm:justify-between ${
          isAdmin ? 'border-zinc-200 dark:border-zinc-700' : 'border-slate-700/60'
        }`}
      >
        <h3 className={`flex items-center gap-2 text-lg font-bold ${headingText}`}>
          <Globe className="h-5 w-5 text-red-600" />
          {resultsTab === 'domains'
            ? 'Domínios disponíveis'
            : resultsTab === 'pricing'
              ? 'Tabela de preços'
              : 'Planos e serviços'}
        </h3>
        <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto">
          <div className={panelTabList}>
            <button
              type="button"
              onClick={() => setResultsTab('domains')}
              className={`${panelTabBtn} font-bold ${
                resultsTab === 'domains'
                  ? 'border-b-red-600 text-red-600'
                  : `border-transparent ${mutedText} hover:text-red-600`
              }`}
            >
              Domínios
            </button>
            {!panelMode ? (
              <button
                type="button"
                onClick={() => setResultsTab('pricing')}
                className={`${panelTabBtn} font-bold ${
                  resultsTab === 'pricing'
                    ? 'border-b-red-600 text-red-600'
                    : `border-transparent ${mutedText} hover:text-red-600`
                }`}
              >
                Preços
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setResultsTab('plans')}
              className={`${panelTabBtn} font-bold ${
                resultsTab === 'plans'
                  ? 'border-b-red-600 text-red-600'
                  : `border-transparent ${mutedText} hover:text-red-600`
              }`}
            >
              Planos e preços
            </button>
          </div>
          {panelMode ? (
            <button
              type="button"
              onClick={closeResults}
              className="p-1 text-zinc-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
              aria-label="Fechar resultados"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={closeResults}
              className="p-1 text-slate-400 transition-colors hover:text-white sm:ml-2"
              aria-label="Fechar resultados"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {resultsTab === 'domains' ? renderDomainResults() : null}
      {resultsTab === 'pricing' && !panelMode ? renderPricingTable() : null}
      {resultsTab === 'plans' ? renderPlansSection() : null}
    </div>
  )

  const renderPlansSection = () => (
    <div className="mt-2">
      <div className="mb-8 flex justify-center">
        <div className="inline-flex gap-1 rounded-full bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setBillingCycle('mensal')}
            className={`rounded-full px-5 py-1.5 text-sm font-semibold transition-all ${billingCycle === 'mensal' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('anual')}
            className={`flex items-center gap-2 rounded-full px-5 py-1.5 text-sm font-semibold transition-all ${billingCycle === 'anual' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
          >
            Anual <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] text-white">-20%</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg">
          <h4 className="mb-2 text-xl font-bold text-slate-800">Webhost Básico</h4>
          <p className="mb-4 text-sm text-slate-500">Ideal para sites e blogs pessoais.</p>
          <div className="mb-6">
            <span className="text-3xl font-black text-red-600">{billingCycle === 'anual' ? '7.344' : '680'} MT</span>
            <span className="ml-1 text-sm font-normal text-slate-500">/{billingCycle === 'anual' ? 'ano' : 'mês'}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              addItem({ id: 'hosting-basico', type: 'hosting', name: 'Webhost Básico', price: billingCycle === 'anual' ? 7344 : 680, period: 1 })
              setIsCartOpen(true)
            }}
            className="mt-auto w-full rounded-lg bg-red-600 py-2.5 font-bold text-white transition-colors hover:bg-red-700"
          >
            Adicionar
          </button>
        </div>
        <div className="relative flex flex-col rounded-xl border-2 border-red-600 bg-white p-6 shadow-lg">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1 text-[10px] font-bold text-white">
            MAIS POPULAR
          </div>
          <h4 className="mb-2 mt-1 text-xl font-bold text-slate-800">Webhost Pro</h4>
          <p className="mb-4 text-sm text-slate-500">Para negócios e lojas online.</p>
          <div className="mb-6">
            <span className="text-3xl font-black text-red-600">{billingCycle === 'anual' ? '16.200' : '1.500'} MT</span>
            <span className="ml-1 text-sm font-normal text-slate-500">/{billingCycle === 'anual' ? 'ano' : 'mês'}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              addItem({ id: 'hosting-pro', type: 'hosting', name: 'Webhost Pro', price: billingCycle === 'anual' ? 16200 : 1500, period: 1 })
              setIsCartOpen(true)
            }}
            className="mt-auto w-full rounded-lg bg-red-600 py-2.5 font-bold text-white transition-colors hover:bg-red-700"
          >
            Adicionar
          </button>
        </div>
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg">
          <h4 className="mb-2 text-xl font-bold text-slate-800">Email Profissional</h4>
          <p className="mb-4 text-sm text-slate-500">Emails corporativos.</p>
          <div className="mb-6">
            <span className="text-3xl font-black text-red-600">{billingCycle === 'anual' ? '2.700' : '250'} MT</span>
            <span className="ml-1 text-sm font-normal text-slate-500">/{billingCycle === 'anual' ? 'ano' : 'mês'}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              addItem({ id: 'email-pro', type: 'email', name: 'Email Profissional', price: billingCycle === 'anual' ? 2700 : 250, period: 1 })
              setIsCartOpen(true)
            }}
            className="mt-auto w-full rounded-lg bg-red-600 py-2.5 font-bold text-white transition-colors hover:bg-red-700"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )

  const renderSearchRow = () => (
    <div className={`flex w-full flex-col gap-4 sm:flex-row ${searchContainerClassName}`}>
      <div className="relative min-w-0 flex-1">
        <input
          type="text"
          placeholder={t('home.search.placeholder') || 'Digite o nome do seu domínio'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${fieldClass} pr-12 shadow-sm dark:shadow-none`}
        />
        {loading ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="h-5 w-5 animate-spin text-red-600" />
          </div>
        ) : (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Globe className="h-5 w-5 text-zinc-400" />
          </div>
        )}
      </div>

      <select
        value={selectedTLD}
        onChange={(e) => setSelectedTLD(e.target.value)}
        className={`${fieldClass} w-full shrink-0 cursor-pointer shadow-sm sm:w-56`}
      >
        {TLDS.map((tld) => (
          <option key={tld.value} value={tld.value}>
            {tld.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => void handleSearch()}
        disabled={loading}
        aria-disabled={loading || !searchQuery.trim()}
        className={`flex w-full shrink-0 items-center justify-start gap-2 ${searchRound} bg-red-600 px-8 py-2 font-bold text-white shadow-md transition-colors hover:bg-red-700 sm:w-auto sm:justify-center ${
          loading ? 'cursor-not-allowed opacity-50' : !searchQuery.trim() ? 'cursor-not-allowed opacity-100' : 'cursor-pointer'
        }`}
      >
        {t('home.search.button') || 'Buscar'}
      </button>
    </div>
  )

  const showAdminResults = isAdmin && hasSearched && !loading
  const showAdminCarousel = isAdmin && (!hasSearched || loading)

  return (
    <div className="flex w-full flex-col items-stretch">
      {isAdmin ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-[25px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/40">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Registo de domínios</h3>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                Pesquise disponibilidade e registe domínios com preço em tempo real.
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-zinc-100/90 p-[20px] dark:bg-zinc-800/50">{renderSearchRow()}</div>
        </div>
      ) : (
        renderSearchRow()
      )}

      {showAdminCarousel ? <div className="mt-5 w-full min-w-0">{renderPricingCards()}</div> : null}

      {showAdminResults ? <div className="mt-5 w-full">{renderResultsPanel(true)}</div> : null}

      {!isAdmin && !hideResultsInternal && hasSearched && results.length > 0 ? (
        <div className="mt-6 w-full transition-all duration-300">{renderResultsPanel(false)}</div>
      ) : null}
    </div>
  )
}
