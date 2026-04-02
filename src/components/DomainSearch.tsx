'use client'

import { useState, useEffect } from 'react'
import { Search, Check, X, Loader2 } from 'lucide-react'
import { checkDomainAvailability, checkApiConnection } from '@/lib/mozserver-api'
import { useI18n } from '@/lib/i18n'

interface SearchResult {
  domain: string;
  available: boolean;
  price?: number;
  currency?: string;
  loading?: boolean;
  error?: string;
  details?: string;
}

interface DomainSearchProps {
  onResultsAction?: (results: SearchResult[]) => void;
  onLoadingAction?: (loading: boolean) => void;
  hideResultsInternal?: boolean;
}

export default function DomainSearch({ onResultsAction, onLoadingAction, hideResultsInternal = false }: DomainSearchProps) {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTLD, setSelectedTLD] = useState('.mz')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isApiConnected, setIsApiConnected] = useState(true)

  const tlds = [
    { value: '.mz', label: '.mz', price: '1500 MT' },
    { value: '.co.mz', label: '.co.mz', price: '1200 MT' },
    { value: '.com', label: '.com', price: '$15 USD' },
    { value: '.org', label: '.org', price: '$12 USD' },
    { value: '.net', label: '.net', price: '$13 USD' }
  ]

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    // Verificar se a API está conectada antes de fazer a busca
    const apiConnected = await checkApiConnection()
    setIsApiConnected(apiConnected)

    if (!apiConnected) {
      const errorResult = {
        domain: searchQuery.trim() + selectedTLD,
        available: false,
        loading: false,
        error: 'API não está acessível. Tente novamente mais tarde.'
      }
      setResults([errorResult])
      if (onResultsAction) onResultsAction([errorResult])
      setLoading(false)
      setShowResults(true)
      return
    }

    setLoading(true)
    if (onLoadingAction) onLoadingAction(true)
    setShowResults(true)

    try {
      const result = await checkDomainAvailability(searchQuery.trim(), selectedTLD)

      const searchResult: SearchResult = {
        domain: searchQuery.trim() + selectedTLD,
        available: result.available,
        price: result.price,
        currency: result.currency,
        loading: false
      }

      setResults([searchResult])
      if (onResultsAction) onResultsAction([searchResult])
    } catch (error: any) {
      console.error('Search error:', error)
      const errorResult = {
        domain: searchQuery.trim() + selectedTLD,
        available: false,
        loading: false,
        error: error.message || 'Erro ao verificar disponibilidade',
        details: error.details || ''
      }
      setResults([errorResult])
      if (onResultsAction) onResultsAction([errorResult])
    } finally {
      setLoading(false)
      if (onLoadingAction) onLoadingAction(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const closeResults = () => {
    setShowResults(false)
    setResults([])
  }

  useEffect(() => {
    // Verificar conectividade da API ao carregar o componente
    const checkConnection = async () => {
      const connected = await checkApiConnection()
      setIsApiConnected(connected)
    }

    checkConnection()
  }, [])

  return (
    <div className="w-full max-w-3xl">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={t('home.search.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full px-4 py-2 rounded-lg bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 pr-4"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
            </div>
          )}
        </div>

        <select
          value={selectedTLD}
          onChange={(e) => setSelectedTLD(e.target.value)}
          className="px-4 py-2 rounded-lg bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 w-32"
        >
          {tlds.map(tld => (
            <option key={tld.value} value={tld.value}>
              {tld.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleSearch}
          disabled={loading || !searchQuery.trim()}
          className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : null}
          {t('home.search.button')}
        </button>
      </div>

      {/* Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-black">{t('domain.results.title')}</h3>
              <button
                onClick={closeResults}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {results.map((result, index) => (
              <div key={index} className="border-b border-gray-100 last:border-0 pb-3 mb-3 last:pb-0 last:mb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${result.available ? 'bg-green-500' : 'bg-red-800'}`}>
                      {result.available ? (
                        <Check className="w-3 h-3 text-white p-0.5" />
                      ) : (
                        <X className="w-3 h-3 text-white p-0.5" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-black">{result.domain}</div>
                      <div className="text-sm text-gray-600">
                        {result.available ? (
                          <span className="text-green-600">✓ {t('domain.results.available')}</span>
                        ) : (
                          <span className="text-red-600">✗ {t('domain.results.unavailable')}</span>
                        )}
                      </div>
                      {result.price && (
                        <div className="text-sm text-gray-700">
                          {result.currency} {result.price}/ano
                        </div>
                      )}
                    </div>
                  </div>

                  {result.available && (
                    <button className="bg-red-600 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      {t('domain.results.register')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
