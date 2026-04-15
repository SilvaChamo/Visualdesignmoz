'use client'

import { useState, useEffect } from 'react'
import { 
  Globe, Server, RefreshCw, CheckCircle, XCircle, 
  AlertCircle, ArrowRightLeft, Plus, Settings, 
  ChevronDown, ChevronRight, ExternalLink, Webhook
} from 'lucide-react'
import { DNSWebhookConfig } from './DNSWebhookConfig'

interface DomainDNSStatus {
  domain: string
  mozserverRegistered: boolean
  cyberPanelZone: boolean
  synced: boolean
  lastSync?: string
  records: DNSRecord[]
}

interface DNSRecord {
  id?: string
  name: string
  type: string
  content: string
  ttl: string
}

interface DomainDetail {
  domain: string
  mozserverData?: {
    status: 'active' | 'pending' | 'expired'
    createdAt: string
    expiresAt: string
    nameservers: string[]
  }
  cyberPanelData?: {
    records: DNSRecord[]
    zoneCreated: boolean
  }
}

export function DNSCentralSection() {
  const [domains, setDomains] = useState<DomainDNSStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [domainDetail, setDomainDetail] = useState<DomainDetail | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'sync' | 'records' | 'webhook'>('overview')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newDomain, setNewDomain] = useState('')

  // Carregar lista de domínios
  useEffect(() => {
    loadDomains()
  }, [])

  const loadDomains = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dns-sync?action=list')
      const data = await response.json()
      
      if (data.success) {
        setDomains(data.data)
      }
    } catch (error) {
      console.error('Error loading domains:', error)
    } finally {
      setLoading(false)
    }
  }

  const syncDomain = async (domain: string) => {
    try {
      setSyncing(domain)
      const response = await fetch('/api/dns-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', domain }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Recarregar lista
        await loadDomains()
      } else {
        alert(`Erro ao sincronizar: ${data.message}`)
      }
    } catch (error) {
      console.error('Error syncing domain:', error)
      alert('Erro ao sincronizar domínio')
    } finally {
      setSyncing(null)
    }
  }

  const syncAllDomains = async () => {
    if (!confirm('Sincronizar todos os domínios para o CyberPanel?')) return
    
    try {
      setLoading(true)
      const response = await fetch('/api/dns-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all' }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert(`Sincronização concluída! ${data.summary.synced} de ${data.summary.total} domínios sincronizados.`)
        await loadDomains()
      }
    } catch (error) {
      console.error('Error syncing all domains:', error)
      alert('Erro ao sincronizar domínios')
    } finally {
      setLoading(false)
    }
  }

  const getSyncStatusIcon = (status: DomainDNSStatus) => {
    if (status.synced) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    } else if (status.mozserverRegistered && !status.cyberPanelZone) {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />
    } else {
      return <XCircle className="w-5 h-5 text-red-500" />
    }
  }

  const getSyncStatusText = (status: DomainDNSStatus) => {
    if (status.synced) return 'Sincronizado'
    if (status.mozserverRegistered && !status.cyberPanelZone) return 'Pendente'
    if (!status.mozserverRegistered) return 'Não registado'
    return 'Não sincronizado'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-red-600" />
            DNS Central
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestão unificada de DNS - Mozserver ↔ Contabo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDomains}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={syncAllDomains}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Sincronizar Todos
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Domínios</p>
              <p className="text-2xl font-bold text-gray-900">{domains.length}</p>
            </div>
            <Globe className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Sincronizados</p>
              <p className="text-2xl font-bold text-green-600">
                {domains.filter(d => d.synced).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">
                {domains.filter(d => d.mozserverRegistered && !d.synced).length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Mozserver</p>
              <p className="text-2xl font-bold text-blue-600">
                {domains.filter(d => d.mozserverRegistered).length}
              </p>
            </div>
            <Server className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sync'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sincronização
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'records'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Registros DNS
            </button>
            <button
              onClick={() => setActiveTab('webhook')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'webhook'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Webhook className="w-4 h-4 inline mr-1" />
              Automação
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Status dos Domínios</h3>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
                </div>
              ) : domains.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum domínio encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domínio</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mozserver</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CyberPanel</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registros</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {domains.map((domain) => (
                        <tr key={domain.domain} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{domain.domain}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {domain.mozserverRegistered ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                <CheckCircle className="w-3 h-3" /> Registado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                <XCircle className="w-3 h-3" /> N/A
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {domain.cyberPanelZone ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                <CheckCircle className="w-3 h-3" /> Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                <XCircle className="w-3 h-3" /> Inativo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {getSyncStatusIcon(domain)}
                              <span className="text-sm text-gray-700">{getSyncStatusText(domain)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">{domain.records.length} registos</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!domain.synced && (
                                <button
                                  onClick={() => syncDomain(domain.domain)}
                                  disabled={syncing === domain.domain}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                                >
                                  <RefreshCw className={`w-3 h-3 ${syncing === domain.domain ? 'animate-spin' : ''}`} />
                                  {syncing === domain.domain ? 'Sincronizando...' : 'Sincronizar'}
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedDomain(domain.domain)}
                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sync Tab */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5" />
                  Como funciona a sincronização
                </h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>Quando um domínio é registado na Mozserver, ele aparece aqui automaticamente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>O painel admin (cérebro) sincroniza a zona DNS para o CyberPanel na Contabo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>Registros padrão (A, MX, TXT SPF) são criados automaticamente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">4.</span>
                    <span>Nameservers da Mozserver apontam para o IP do servidor Contabo</span>
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Server className="w-5 h-5 text-blue-600" />
                    Mozserver (Registro)
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Responsável pelo registro de domínios .mz e .co.mz. 
                    Fornece nameservers e gestão de WHOIS.
                  </p>
                  <a 
                    href="https://mozserver.co.mz" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    Acessar Mozserver <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-green-600" />
                    Contabo (Hospedagem)
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    VPS com CyberPanel que hospeda os websites e servidores DNS.
                    IP: 109.199.104.22
                  </p>
                  <a 
                    href="https://109.199.104.22:8090" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    Acessar CyberPanel <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Webhook Tab */}
          {activeTab === 'webhook' && (
            <DNSWebhookConfig />
          )}

          {/* Records Tab */}
          {activeTab === 'records' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Registros DNS</h3>
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={selectedDomain || ''}
                  onChange={(e) => setSelectedDomain(e.target.value || null)}
                >
                  <option value="">Selecionar domínio...</option>
                  {domains.map(d => (
                    <option key={d.domain} value={d.domain}>{d.domain}</option>
                  ))}
                </select>
              </div>

              {selectedDomain ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conteúdo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TTL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {domains.find(d => d.domain === selectedDomain)?.records.map((record, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{record.name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {record.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-mono">{record.content}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{record.ttl}</td>
                        </tr>
                      )) || (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                            Nenhum registro encontrado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Selecione um domínio para ver seus registros DNS</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Domain Detail Modal */}
      {selectedDomain && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{selectedDomain}</h3>
              <button 
                onClick={() => setSelectedDomain(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500">Detalhes do domínio serão carregados aqui...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
