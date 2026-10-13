'use client'

import { useState } from 'react'
import { Check, X, Loader2, Globe } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useCart } from '@/contexts/CartContext'
import { DomainPricingCarousel } from '@/components/DomainPricingCarousel'
import { DOMAIN_TLD_PRICES, domainRegistrationPriceMt, domainRenewalPriceMt } from '@/lib/domain-tld-prices'
import { Spinner } from '@/components/ui/spinner'
import { panelTabBtn, panelTabList } from '@/lib/panel-ui'
import { getHostingPlan, getHostingCyclePrice, getHostingMonthlyEquivalent } from '@/lib/hosting-plans'
import { EMAIL_BASICO_ID, EMAIL_BASICO_PRICE_MT } from '@/lib/package-catalog'
import { useCurrency } from '@/contexts/CurrencyContext'
import { MZN_TO_USD_RATE } from '@/lib/currency'
import { DOMAIN_STEP_PATH } from '@/lib/checkout-flow'

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
  /** Texto escuro (com variante dark:) em vez de branco, para usar sobre secções de fundo claro. */
  lightSection?: boolean
  /** Padding vertical ligeiramente maior nos campos e no botão de busca. */
  spacious?: boolean
  searchContainerClassName?: string
}

const TLDS = DOMAIN_TLD_PRICES

export default function DomainSearch({
  onResultsAction,
  onLoadingAction,
  hideResultsInternal = false,
  isAdmin = false,
  panelFieldRounding = false,
  lightSection = false,
  spacious = false,
  searchContainerClassName = '',
}: DomainSearchProps) {
  const { t } = useI18n()
  const { addItem, setIsCartOpen } = useCart()
  const { formatPrice } = useCurrency()
  // Os preços de domínio vêm em USD (catálogo de TLDs) — converte sempre
  // para MT primeiro (o valor real cobrado) antes de formatar na moeda
  // escolhida, para nunca divergir do que o checkout depois calcula.
  const formatDomainPrice = (usdPrice: number) => formatPrice(usdPrice * MZN_TO_USD_RATE)
  const findTld = (domain: string) => TLDS.find((t) => domain.toLowerCase().endsWith(t.value))
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTLD, setSelectedTLD] = useState('.com')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [resultsTab, setResultsTab] = useState<'domains' | 'pricing' | 'plans'>('domains')
  const [billingCycle, setBillingCycle] = useState<'mensal' | 'anual'>('anual')

  const searchRound = isAdmin || panelFieldRounding ? 'rounded' : 'rounded-lg'
  const fieldPaddingY = spacious ? 'py-2.5' : 'py-2'
  const fieldClass = isAdmin
    ? `w-full px-4 ${fieldPaddingY} ${searchRound} bg-white text-zinc-900 border border-zinc-300 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all font-medium shadow-sm`
    : `w-full px-4 ${fieldPaddingY} ${searchRound} bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all font-medium`
  const mutedText = isAdmin ? 'text-zinc-600 dark:text-zinc-400' : lightSection ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-500'
  const headingText = isAdmin ? 'text-zinc-900 dark:text-zinc-100' : lightSection ? 'text-zinc-900 dark:text-white' : 'text-white'

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
              <td className="p-3 text-zinc-600 dark:text-zinc-400">{formatPrice(domainRegistrationPriceMt(domain, 1))}</td>
              <td className="p-3 text-zinc-600 dark:text-zinc-400">{formatDomainPrice(domain.renewPrice)}</td>
              <td className="p-3 text-zinc-600 dark:text-zinc-400">{formatDomainPrice(domain.transfer)}</td>
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
      // Otimização: Pesquisa apenas o TLD seleccionado e os TLDs mais populares para reduzir latência e evitar 429
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

  // Uma falha a verificar disponibilidade (timeout, limite do registador sob
  // os vários pedidos em paralelo) não significa que o domínio esteja
  // indisponível — só que não sabemos ainda. Deixa tentar de novo só essa
  // linha, em vez de a app afirmar "Indisponível" sem ter a certeza.
  const retryDomainCheck = async (domain: string) => {
    setResults((prev) => prev.map((r) => (r.domain === domain ? { ...r, loading: true, error: undefined } : r)))
    try {
      const res = await fetch('/api/domain-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const data = await res.json()
      const tld = findTld(domain)
      setResults((prev) =>
        prev.map((r) =>
          r.domain === domain
            ? {
                ...r,
                loading: false,
                available: data.available,
                error: data.error,
                price: tld ? tld.price : r.price,
                renewPrice: tld ? tld.renewPrice : r.renewPrice,
              }
            : r,
        ),
      )
    } catch {
      setResults((prev) =>
        prev.map((r) => (r.domain === domain ? { ...r, loading: false, error: 'Erro de verificação' } : r)),
      )
    }
  }

  const handleRegisterAction = async (domain: string) => {
    const row = results.find((r) => r.domain === domain)
    if (row && row.price !== undefined) {
      setActionLoading(domain)
      // Regista sempre por 1 ano a partir da pesquisa — o número de anos
      // escolhe-se depois, no carrinho/checkout (selector lá, não aqui).
      const tld = findTld(domain)
      setTimeout(() => {
        setActionLoading(null)
        const finalPrice = tld ? domainRegistrationPriceMt(tld, 1) : Math.round(row.price! * 65 * 1.5 * 1.075)
        const finalRenewPrice = tld
          ? domainRenewalPriceMt(tld, 1)
          : row.renewPrice
            ? Math.round(row.renewPrice * 65 * 1.5 * 1.075)
            : undefined

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
              <span className="text-left text-xs font-medium text-amber-600 sm:text-right">
                Não foi possível confirmar disponibilidade agora.
              </span>
            ) : result.price !== undefined ? (
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-lg font-bold text-zinc-700 dark:text-zinc-200">
                    {(() => {
                      const tld = findTld(result.domain)
                      return tld ? formatPrice(domainRegistrationPriceMt(tld, 1)) : formatDomainPrice(result.price)
                    })()}
                    <span className="text-xs font-normal text-zinc-400">/1º ano</span>
                  </span>
                  {result.renewPrice ? (
                    <span className="text-[11px] font-medium text-zinc-500">
                      Renovação: <span className="text-red-500">{formatDomainPrice(result.renewPrice)}/ano</span>
                    </span>
                  ) : null}
                </div>
                {findTld(result.domain)?.manualRegistration ? (
                  <span className="text-[11px] font-medium text-amber-600 dark:text-amber-500">
                    Activação em até 1 dia útil (registo confirmado pela nossa equipa).
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
                    <Spinner className="h-4 w-4" /> …
                  </>
                ) : isAdmin ? (
                  'Registar'
                ) : (
                  'Adicionar'
                )}
              </button>
            ) : result.error ? (
              <button
                type="button"
                onClick={() => void retryDomainCheck(result.domain)}
                disabled={result.loading}
                className="flex w-auto items-center justify-center gap-2 whitespace-nowrap rounded border border-amber-400 bg-amber-50 px-5 py-2 text-sm font-bold text-amber-700 transition-all hover:bg-amber-100 disabled:opacity-60 sm:min-w-[130px] dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
              >
                {result.loading ? <Spinner className="h-4 w-4" /> : 'Tentar novamente'}
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

  const renderPlansSection = () => {
    const cycle = billingCycle === 'anual' ? 'annual' : 'monthly'
    const basico = getHostingPlan('hosting-basico')!
    const pro = getHostingPlan('hosting-pro')!
    const basicoPrice = getHostingCyclePrice(basico.basePrice, cycle)
    const proPrice = getHostingCyclePrice(pro.basePrice, cycle)
    const basicoSavings = basico.basePrice - getHostingMonthlyEquivalent(basico.basePrice, cycle)
    const proSavings = pro.basePrice - getHostingMonthlyEquivalent(pro.basePrice, cycle)

    return (
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
              Anual <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] text-white">até -20%</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg">
            <h4 className="mb-2 text-xl font-bold text-slate-800">Webhost Básico</h4>
            <p className="mb-4 text-sm text-slate-500">Ideal para sites e blogs pessoais.</p>
            <div className="mb-6">
              <span className="text-3xl font-black text-red-600">{formatPrice(basicoPrice)}</span>
              <span className="ml-1 text-sm font-normal text-slate-500">/{billingCycle === 'anual' ? 'ano' : 'mês'}</span>
              {billingCycle === 'anual' && basicoSavings > 0 && (
                <p className="mt-1 text-xs font-semibold text-green-600">Poupe {formatPrice(basicoSavings)}/mês!</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                addItem({ id: 'hosting-basico', type: 'hosting', name: 'Webhost Básico', price: basicoPrice, period: billingCycle === 'anual' ? 12 : 1 })
                window.location.href = DOMAIN_STEP_PATH
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
              <span className="text-3xl font-black text-red-600">{formatPrice(proPrice)}</span>
              <span className="ml-1 text-sm font-normal text-slate-500">/{billingCycle === 'anual' ? 'ano' : 'mês'}</span>
              {billingCycle === 'anual' && proSavings > 0 && (
                <p className="mt-1 text-xs font-semibold text-green-600">Poupe {formatPrice(proSavings)}/mês!</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                addItem({ id: 'hosting-pro', type: 'hosting', name: 'Webhost Pro', price: proPrice, period: billingCycle === 'anual' ? 12 : 1 })
                window.location.href = DOMAIN_STEP_PATH
              }}
              className="mt-auto w-full rounded-lg bg-red-600 py-2.5 font-bold text-white transition-colors hover:bg-red-700"
            >
              Adicionar
            </button>
          </div>
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg">
            <h4 className="mb-2 text-xl font-bold text-slate-800">Email Básico</h4>
            <p className="mb-4 text-sm text-slate-500">Emails corporativos. O domínio escolhe-se depois, no painel.</p>
            <div className="mb-6">
              <span className="text-3xl font-black text-red-600">{formatPrice(EMAIL_BASICO_PRICE_MT)}</span>
              <span className="ml-1 text-sm font-normal text-slate-500">/mês</span>
            </div>
            <button
              type="button"
              onClick={() => {
                addItem({ id: EMAIL_BASICO_ID, type: 'email', name: 'Email Básico', price: EMAIL_BASICO_PRICE_MT, period: 1 })
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
  }

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
            <Spinner className="h-5 w-5" />
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
        className={`flex w-full shrink-0 items-center justify-start gap-2 ${searchRound} bg-red-600 px-8 ${fieldPaddingY} font-bold text-white shadow-md transition-colors hover:bg-red-700 sm:w-auto sm:justify-center ${
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
