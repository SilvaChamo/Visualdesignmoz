'use client'

import { useState } from 'react'
import { Search, Check, X, Loader2, Globe } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface SearchResult {
  domain: string;
  available: boolean;
  price?: number;
  currency?: string;
  loading?: boolean;
  error?: string;
}

interface DomainSearchProps {
  onResultsAction?: (results: SearchResult[]) => void;
  onLoadingAction?: (loading: boolean) => void;
  hideResultsInternal?: boolean;
  isAdmin?: boolean;
  searchContainerClassName?: string;
}

export default function DomainSearch({ onResultsAction, onLoadingAction, hideResultsInternal = false, isAdmin = false, searchContainerClassName = '' }: DomainSearchProps) {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTLD, setSelectedTLD] = useState('.com')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const tlds = [
    { value: '.com', label: '.com', price: 10.37 },
    { value: '.net', label: '.net', price: 11.48 },
    { value: '.org', label: '.org', price: 10.70 },
    { value: '.co', label: '.co', price: 25.00 },
    { value: '.io', label: '.io', price: 35.00 },
    { value: '.app', label: '.app', price: 15.00 },
    { value: '.dev', label: '.dev', price: 15.00 },
    { value: '.online', label: '.online', price: 5.00 },
    { value: '.tech', label: '.tech', price: 5.00 },
    { value: '.store', label: '.store', price: 5.00 },
    { value: '.biz', label: '.biz', price: 12.00 },
    { value: '.info', label: '.info', price: 15.00 },
    { value: '.me', label: '.me', price: 10.00 },
  ]

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    if (onLoadingAction) onLoadingAction(true)
    setShowResults(true)
    setResults([])

    try {
      // 1. Definir lista de extensões a pesquisar: todas as 13 opções disponíveis
      const tldsToSearch = Array.from(new Set([selectedTLD, ...tlds.map(t => t.value)]));

      // 2. Lançar pesquisas em paralelo
      const fetchPromises = tldsToSearch.map(async (tld) => {
        try {
          const res = await fetch('/api/domain-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: searchQuery.trim(), tld })
          });
          const data = await res.json();

          const tldData = tlds.find(t => t.value === tld);

          return {
            domain: data.domain || `${searchQuery.trim().replace(/^www\./, '').split('.')[0]}${tld}`,
            available: data.available,
            price: tldData ? tldData.price : (data.price || 10.37),
            currency: data.currency || 'USD',
          } as SearchResult;
        } catch (e) {
          return {
            domain: `${searchQuery.trim().replace(/^www\./, '').split('.')[0]}${tld}`,
            available: false,
            error: 'Erro de verificação'
          } as SearchResult;
        }
      });

      const allResults = await Promise.all(fetchPromises);

      // Ordenar para que a extensão que o usuário seleccionou explicitamente apareça primeiro
      allResults.sort((a, b) => {
        if (a.domain.endsWith(selectedTLD)) return -1;
        if (b.domain.endsWith(selectedTLD)) return 1;
        return 0;
      });

      setResults(allResults);
      if (onResultsAction) onResultsAction(allResults);

    } catch (error: any) {
      console.error('Search error:', error)
      const errorResult = {
        domain: searchQuery.trim() + selectedTLD,
        available: false,
        error: 'Erro ao verificar disponibilidade.'
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

  const handleRegisterAction = async (domain: string) => {
    if (isAdmin) {
      const confirm = window.confirm(`ATENÇÃO: Tem a certeza que deseja registar "${domain}"?\n\nIsto irá descontar o valor do seu saldo no Porkbun de forma irreversível.`);
      if (!confirm) return;

      setActionLoading(domain);
      try {
        const res = await fetch('/api/domain-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain })
        });
        const data = await res.json();

        if (data.success) {
          alert(`Sucesso! O domínio ${domain} foi registado na sua conta Porkbun.`);
          setResults(prev => prev.map(r => r.domain === domain ? { ...r, available: false } : r));
        } else {
          alert(`Erro ao registar: ${data.error}`);
        }
      } catch (err) {
        alert('Erro ao tentar conectar à API de registo.');
      } finally {
        setActionLoading(null);
      }
    } else {
      window.location.href = `/precos/dominios?domain=${domain}`;
    }
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className={`flex flex-col sm:flex-row gap-2 w-full max-w-4xl ${searchContainerClassName}`}>
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={t('home.search.placeholder') || "Escreva o nome do domínio..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full px-4 py-2.5 rounded-lg bg-white text-black border border-slate-300 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all pr-12 shadow-sm font-medium"
          />
          {loading ? (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
            </div>
          ) : (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <Globe className="w-5 h-5 text-slate-400" />
            </div>
          )}
        </div>

        <select
          value={selectedTLD}
          onChange={(e) => setSelectedTLD(e.target.value)}
          className="px-4 py-2.5 rounded-lg bg-white text-black border border-slate-300 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 w-full sm:w-48 shadow-sm font-medium cursor-pointer"
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
          className="bg-red-600 hover:bg-red-700 text-white px-8 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md w-full sm:w-auto"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : null}
          {t('home.search.button') || "Procurar"}
        </button>
      </div>

      {/* Lista de Resultados - Largura Total, Fundo Transparente/Branco */}
      {!hideResultsInternal && showResults && (
        <div className="w-full mt-6 transition-all duration-300">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-red-600" />
              Domínios Disponíveis
            </h3>
            <button
              onClick={closeResults}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {results.length === 0 && loading && (
            <div className="text-center py-12 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-red-600" />
              <p>Verificando disponibilidade global...</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`bg-white border ${index === 0 && result.available ? 'border-red-200 shadow-md ring-1 ring-red-50' : 'border-slate-200 shadow-sm'} rounded-lg p-3 sm:p-4 hover:border-slate-300 transition-colors flex flex-col sm:flex-row items-center justify-between gap-4`}
              >
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Ícone apenas se estiver disponível, sem o X */}
                  {result.available && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-green-100 text-green-600">
                      <Check className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`font-normal text-[17px] text-slate-900 flex flex-wrap items-center gap-2`}>
                    {result.domain}
                    
                    {/* Preço imediatamente após o domínio, na mesma linha, em Meticais */}
                    {result.available && result.price && (
                      <span className="text-slate-600 text-sm ml-1">
                        {result.domain.endsWith('.com') 
                          ? (1000 * 1.075).toFixed(2) 
                          : (result.price * 65 * 2).toFixed(2)} MT
                      </span>
                    )}

                    {index === 0 && <span className="ml-2 inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-bold uppercase tracking-wider">A sua escolha</span>}
                  </div>
                </div>

                {/* Botões do lado direito, sem preços empilhados */}
                <div className="flex items-center justify-end w-full sm:w-auto">
                  {result.available ? (
                    <button
                      onClick={() => handleRegisterAction(result.domain)}
                      disabled={actionLoading === result.domain}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2 whitespace-nowrap min-w-[140px] justify-center"
                    >
                      {actionLoading === result.domain ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> ...</>
                      ) : (
                        isAdmin ? "Registar" : "Adicionar ao carrinho"
                      )}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="bg-slate-100 text-slate-400 px-6 py-2.5 rounded-lg text-sm font-bold cursor-not-allowed border border-slate-200 min-w-[140px]"
                    >
                      Indisponível
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
