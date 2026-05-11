'use client'

import { useState } from 'react'
import { Search, Check, X, Loader2, Globe, DollarSign } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useCart } from '@/contexts/CartContext'

interface SearchResult {
  domain: string;
  available: boolean;
  price?: number;
  renewPrice?: number;
  currency?: string;
  loading?: boolean;
  error?: string;
  costPennies?: number;
}

interface DomainSearchProps {
  onResultsAction?: (results: SearchResult[]) => void;
  onLoadingAction?: (loading: boolean) => void;
  hideResultsInternal?: boolean;
  isAdmin?: boolean;
  searchContainerClassName?: string;
  activeTab?: 'domains' | 'pricing';
}

export default function DomainSearch({ onResultsAction, onLoadingAction, hideResultsInternal = false, isAdmin = false, searchContainerClassName = '', activeTab = 'domains' }: DomainSearchProps) {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTLD, setSelectedTLD] = useState('.com')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [internalTab, setInternalTab] = useState<'domains' | 'pricing' | 'plans'>('domains')

  const calculatePrice = (usdPrice: number) => {
    return ((usdPrice * 65 * 1.5) * 1.075).toFixed(2);
  }

  // Preços base em USD da Spaceship
  const tlds = [
    { value: '.com', label: '.com', price: 8.88, renewPrice: 9.98, icann: 0.20, transfer: 9.48 },
    { value: '.net', label: '.net', price: 11.20, renewPrice: 11.20, icann: 0.20, transfer: 11.20 },
    { value: '.org', label: '.org', price: 6.48, renewPrice: 9.80, icann: 0.20, transfer: 9.50 },
    { value: '.farm', label: '.farm', price: 4.14, renewPrice: 31.05, icann: 0.20, transfer: 31.05 },
    { value: '.ai', label: '.ai', price: 69.98, renewPrice: 79.98, icann: 0.20, transfer: 69.98 },
    { value: '.co', label: '.co', price: 25.00, renewPrice: 25.00, icann: 0.20, transfer: 25.00 },
    { value: '.io', label: '.io', price: 35.00, renewPrice: 35.00, icann: 0.20, transfer: 35.00 },
    { value: '.app', label: '.app', price: 15.00, renewPrice: 15.00, icann: 0.20, transfer: 15.00 },
    { value: '.dev', label: '.dev', price: 15.00, renewPrice: 15.00, icann: 0.20, transfer: 15.00 },
    { value: '.online', label: '.online', price: 5.00, renewPrice: 5.00, icann: 0.20, transfer: 5.00 },
    { value: '.tech', label: '.tech', price: 5.00, renewPrice: 5.00, icann: 0.20, transfer: 5.00 },
    { value: '.store', label: '.store', price: 5.00, renewPrice: 5.00, icann: 0.20, transfer: 5.00 },
    { value: '.biz', label: '.biz', price: 12.00, renewPrice: 12.00, icann: 0.20, transfer: 12.00 },
    { value: '.info', label: '.info', price: 15.00, renewPrice: 15.00, icann: 0.20, transfer: 15.00 },
    { value: '.me', label: '.me', price: 10.00, renewPrice: 10.00, icann: 0.20, transfer: 10.00 },
  ]

  const { addItem } = useCart()

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    if (onLoadingAction) onLoadingAction(true)
    setShowResults(true)
    setResults([])
    if (onResultsAction) onResultsAction([])

    try {
      // 1. Definir lista de extensões a pesquisar: todas as 13 opções disponíveis
      const tldsToSearch = Array.from(new Set([selectedTLD, ...tlds.map(t => t.value)]));

      // 2. Lançar pesquisas em lotes para evitar que o servidor ou a API congelem
      const allResults: SearchResult[] = [];
      const batchSize = 3;

      for (let i = 0; i < tldsToSearch.length; i += batchSize) {
        const batch = tldsToSearch.slice(i, i + batchSize);
        const fetchPromises = batch.map(async (tld) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout

            const res = await fetch('/api/domain-check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ domain: searchQuery.trim(), tld }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await res.json();
            const tldData = tlds.find(t => t.value === tld);

            return {
              domain: data.domain || `${searchQuery.trim().replace(/^www\./, '').split('.')[0]}${tld}`,
              available: data.available,
              price: typeof data.price === 'number' ? data.price : parseFloat(String(data.price || '')) || (tldData ? tldData.price : 8.88),
              renewPrice: tldData ? tldData.renewPrice : 8.88,
              currency: data.currency || 'USD',
              error: data.error,
              costPennies: typeof data.costPennies === 'number' ? data.costPennies : undefined,
            } as SearchResult;
          } catch (e) {
            return {
              domain: `${searchQuery.trim().replace(/^www\./, '').split('.')[0]}${tld}`,
              available: false,
              error: 'Erro de verificação'
            } as SearchResult;
          }
        });

        const batchResults = await Promise.all(fetchPromises);
        allResults.push(...batchResults);
        
        // Pequena pausa entre lotes para não saturar a API de verificação
        if (i + batchSize < tldsToSearch.length) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

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
    setInternalTab('domains')
    if (onResultsAction) onResultsAction([])
  }

  const handleRegisterAction = async (domain: string) => {
    if (isAdmin) {
      const confirm = window.confirm(`ATENÇÃO: Tem a certeza que deseja registar "${domain}"?\n\nIsto irá descontar o valor do seu saldo na conta de registo de forma irreversível.`);
      if (!confirm) return;

      const row = results.find(r => r.domain === domain);

      setActionLoading(domain);
      try {
        const res = await fetch('/api/domain-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            domain,
            agreeToTerms: true,
            costPennies: row?.costPennies,
          }),
        });
        const data = await res.json();

        if (data.success) {
          alert(`Sucesso! O domínio ${domain} foi registado e ficará disponível na lista «Os seus domínios».`);
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
      // Adicionar ao carrinho (User Flow)
      const row = results.find(r => r.domain === domain);
      if (row && row.price !== undefined) {
        setActionLoading(domain);
        setTimeout(() => {
          setActionLoading(null);
          // O preço base da Spaceship já está convertido no UI via calculatePrice
          const finalPrice = Math.round(row.price * 65 * 1.5 * 1.075);
          const finalRenewPrice = row.renewPrice ? Math.round(row.renewPrice * 65 * 1.5 * 1.075) : undefined;
          
          addItem({
            id: domain,
            type: 'domain',
            name: domain,
            price: finalPrice,
            period: 1,
            renewPrice: finalRenewPrice
          });
        }, 500);
      }
    }
  }

  return (
    <div className="w-full flex flex-col items-center">

      <div className={`flex flex-col sm:flex-row gap-2 w-full ${searchContainerClassName}`}>
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
          className={`bg-red-600 hover:bg-red-700 text-white px-8 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors font-bold cursor-pointer shadow-md w-full sm:w-auto ${loading ? 'opacity-50 cursor-not-allowed' : (!searchQuery.trim() ? 'cursor-not-allowed' : '')}`}
        >
          {t('home.search.button') || "Procurar"}
        </button>
      </div>

      {/* Lista de Resultados - Fica fora do container com fundo para herdar o branco no admin */}
      {!hideResultsInternal && showResults && results.length > 0 && (
        <div className="w-full mt-6 transition-all duration-300">
          <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 pb-2 border-b ${isAdmin ? 'border-slate-200' : 'border-slate-700/60'} gap-4`}>
            <h3 className={`font-bold ${isAdmin ? 'text-slate-800' : 'text-white'} text-lg flex items-center gap-2`}>
              <Globe className="w-5 h-5 text-red-600" />
              {internalTab === 'domains' ? 'Domínios Disponíveis' : internalTab === 'pricing' ? 'Tabela de Preços' : 'Planos e Serviços'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex gap-4 p-1`}>
                <button 
                  onClick={() => setInternalTab('domains')}
                  className={`px-2 py-1 text-sm font-bold transition-all border-b-2 ${internalTab === 'domains' ? 'text-red-600 border-red-600' : (isAdmin ? 'text-slate-500 border-transparent hover:text-slate-800' : 'text-slate-300 border-transparent hover:text-white')}`}>
                  Domínios
                </button>
                <button 
                  onClick={() => setInternalTab('pricing')}
                  className={`px-2 py-1 text-sm font-bold transition-all border-b-2 ${internalTab === 'pricing' ? 'text-red-600 border-red-600' : (isAdmin ? 'text-slate-500 border-transparent hover:text-slate-800' : 'text-slate-300 border-transparent hover:text-white')}`}>
                  Preços
                </button>
                <button 
                  onClick={() => setInternalTab('plans')}
                  className={`px-2 py-1 text-sm font-bold transition-all border-b-2 ${internalTab === 'plans' ? 'text-red-600 border-red-600' : (isAdmin ? 'text-slate-500 border-transparent hover:text-slate-800' : 'text-slate-300 border-transparent hover:text-white')}`}>
                  Planos e Preços
                </button>
              </div>
              <button
                onClick={closeResults}
                className={`${isAdmin ? 'text-slate-400 hover:text-slate-600' : 'text-slate-400 hover:text-white'} transition-colors p-1 sm:ml-2`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {internalTab === 'domains' ? (
            <div className="flex flex-col gap-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`bg-white border ${index === 0 && result.available ? 'border-red-200 shadow-md ring-1 ring-red-50' : 'border-slate-200 shadow-sm'} rounded-lg py-2 px-3 sm:px-4 hover:border-slate-300 transition-colors grid grid-cols-1 sm:grid-cols-3 items-center gap-3`}
                >
                  {/* Coluna 1: Nome do Domínio (Ajustado à esquerda) */}
                  <div className="flex items-center gap-3 justify-start">
                    {result.available && (
                      <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-green-100 text-green-600">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div className={`font-normal text-[16px] text-slate-900 flex flex-wrap items-center gap-2`}>
                      {result.domain}
                      {index === 0 && <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full font-bold uppercase tracking-wider">A sua escolha</span>}
                    </div>
                  </div>

                  {/* Coluna 2: Preço ou Erro (Ajustado à direita) */}
                  <div className="flex items-center justify-end sm:pr-4">
                    {result.error && !result.available ? (
                      <span className="text-red-500 text-xs text-right font-medium">{result.error}</span>
                    ) : result.price !== undefined ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700 font-bold text-lg">
                          {calculatePrice(result.price)} MT
                        </span>
                        {result.renewPrice && (
                          <span className="text-slate-500 text-[11px] font-medium">
                            Renovação: <span className="text-red-400">{calculatePrice(result.renewPrice)} MT</span>
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Coluna 3: Botão (Ajustado à direita) */}
                  <div className="flex items-center justify-end">
                    {result.available ? (
                      <button
                        onClick={() => handleRegisterAction(result.domain)}
                        disabled={actionLoading === result.domain}
                        className="bg-green-600 hover:bg-green-700 hover:scale-105 hover:shadow-md text-white px-5 py-2 rounded text-sm font-bold transition-all duration-200 shadow-sm flex items-center gap-2 whitespace-nowrap min-w-[130px] justify-center"
                      >
                        {actionLoading === result.domain ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> ...</>
                        ) : (
                          isAdmin ? "Registar" : "Adicionar"
                        )}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="bg-blue-600 text-white px-5 py-2 rounded text-sm font-bold cursor-not-allowed shadow-sm min-w-[130px]"
                      >
                        Indisponível
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : internalTab === 'pricing' ? (
            <div className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-700">Extensão</th>
                    <th className="p-4 font-bold text-slate-700">Registo</th>
                    <th className="p-4 font-bold text-slate-700">Renovação</th>
                    <th className="p-4 font-bold text-slate-700">Transferência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tlds.map((domain, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-900">{domain.label}</td>
                      <td className="p-4 text-slate-600">{calculatePrice(domain.price)} MT</td>
                      <td className="p-4 text-slate-600">{calculatePrice(domain.renewPrice)} MT</td>
                      <td className="p-4 text-slate-600">{calculatePrice(domain.transfer)} MT</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : internalTab === 'plans' ? (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`p-6 rounded-xl border ${isAdmin ? 'bg-white border-slate-200' : 'bg-slate-800/50 border-slate-700/60'}`}>
                <h4 className={`text-xl font-bold mb-2 ${isAdmin ? 'text-slate-800' : 'text-white'}`}>Hospedagem Web</h4>
                <p className="text-slate-400 text-sm mb-4">Servidor rápido e fiável para o seu site.</p>
                <div className="text-3xl font-black text-red-500 mb-6">1.500 MT <span className="text-sm text-slate-500 font-normal">/ano</span></div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500"/> 10GB Espaço SSD</li>
                  <li className="flex items-center gap-2 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500"/> Tráfego Ilimitado</li>
                  <li className="flex items-center gap-2 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500"/> Painel cPanel</li>
                </ul>
                <button className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">Ver Mais</button>
              </div>
              
              <div className={`p-6 rounded-xl border-2 border-red-600 relative ${isAdmin ? 'bg-white' : 'bg-slate-800/80'}`}>
                <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">MAIS POPULAR</div>
                <h4 className={`text-xl font-bold mb-2 ${isAdmin ? 'text-slate-800' : 'text-white'}`}>Email Profissional</h4>
                <p className="text-slate-400 text-sm mb-4">Emails com o nome do seu domínio.</p>
                <div className="text-3xl font-black text-red-500 mb-6">950 MT <span className="text-sm text-slate-500 font-normal">/ano</span></div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500"/> 5 Contas de Email</li>
                  <li className="flex items-center gap-2 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500"/> Anti-Spam e Vírus</li>
                  <li className="flex items-center gap-2 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500"/> Webmail Incluído</li>
                </ul>
                <button className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">Ver Mais</button>
              </div>

              <div className={`p-6 rounded-xl border ${isAdmin ? 'bg-white border-slate-200' : 'bg-slate-800/50 border-slate-700/60'}`}>
                <h4 className={`text-xl font-bold mb-2 ${isAdmin ? 'text-slate-800' : 'text-white'}`}>Criador de Sites</h4>
                <p className="text-slate-400 text-sm mb-4">Crie o seu site arrastando e soltando.</p>
                <div className="text-3xl font-black text-red-500 mb-6">2.500 MT <span className="text-sm text-slate-500 font-normal">/ano</span></div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500"/> +200 Templates</li>
                  <li className="flex items-center gap-2 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500"/> Loja Online Básica</li>
                  <li className="flex items-center gap-2 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500"/> Certificado SSL Grátis</li>
                </ul>
                <button className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">Ver Mais</button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
