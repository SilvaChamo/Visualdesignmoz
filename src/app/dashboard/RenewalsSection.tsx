'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  Globe,
  Server,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Bell,
  Send,
  Users,
  TrendingUp,
  DollarSign,
  Search
} from 'lucide-react'
import { panelTabList, panelTabBtn } from '@/lib/panel-ui'

interface Renewal {
  id: string
  user_id: string
  domain_name: string
  expiration_date: string
  renewal_price: number
  currency: string
  auto_renew: boolean
  status: 'active' | 'expired' | 'pending' | 'cancelled' | 'renewed'
  notes?: string
  user_email?: string
}

interface Stats {
  total: number
  active: number
  expired: number
  expiring30Days: number
  expiring60Days: number
  totalRevenue: number
}

interface RenewalsSectionProps {
  initialTab?: 'overview' | 'domains' | 'hosting' | 'add'
  hideTabs?: boolean
}

export function RenewalsSection({ initialTab = 'overview', hideTabs = false }: RenewalsSectionProps) {
  const [domains, setDomains] = useState<Renewal[]>([])
  const [hosting, setHosting] = useState<Renewal[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    expired: 0,
    expiring30Days: 0,
    expiring60Days: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'hosting' | 'add'>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [runningCheck, setRunningCheck] = useState(false)
  const [checkResult, setCheckResult] = useState<any>(null)

  // Form states
  const [formType, setFormType] = useState<'domain' | 'hosting'>('domain')
  const [formUserEmail, setFormUserEmail] = useState('')
  const [formDomain, setFormDomain] = useState('')
  const [formRegistrationDate, setFormRegistrationDate] = useState('')
  const [formExpiration, setFormExpiration] = useState('')
  const [formPackage, setFormPackage] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formAutoRenew, setFormAutoRenew] = useState(false)
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [packageOptions, setPackageOptions] = useState<Array<{ packageName: string; allowedDomains: number | string }>>([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupHint, setLookupHint] = useState('')

  useEffect(() => {
    loadRenewals()
    fetch('/api/admin/packages')
      .then(res => res.json())
      .then(data => { if (data.success) setPackageOptions(data.packages) })
      .catch(() => {})
  }, [])

  const lookupDomain = async () => {
    const domain = formDomain.trim().toLowerCase()
    if (!domain) return
    setLookupLoading(true)
    setLookupHint('')
    try {
      const res = await fetch(`/api/admin/renewals/domain-lookup?domain=${encodeURIComponent(domain)}`)
      const data = await res.json()
      if (data.found) {
        if (data.registrationDate) {
          setFormRegistrationDate(data.registrationDate)
          // Sugere vencimento a 1 ano da data de registo, sem sobrepor uma data já escolhida manualmente
          if (!formExpiration) {
            const suggested = new Date(data.registrationDate)
            suggested.setFullYear(suggested.getFullYear() + 1)
            setFormExpiration(suggested.toISOString().split('T')[0])
          }
        }
        if (data.suggestedPackage && formType === 'hosting') {
          setFormPackage(data.suggestedPackage)
        }
        setLookupHint(
          data.registrationDate
            ? (data.dateSource === 'directadmin'
                ? '✓ Data de registo confirmada via DirectAdmin'
                : '≈ Data estimada (última sincronização) — confirme se necessário')
            : ''
        )
      } else {
        setLookupHint('Domínio não encontrado no DirectAdmin — preencha manualmente')
      }
    } catch (error) {
      console.error('Erro na busca de domínio:', error)
    } finally {
      setLookupLoading(false)
    }
  }

  const loadRenewals = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/renewals?admin=true')
      const data = await res.json()
      
      if (data.success) {
        setDomains(data.domains)
        setHosting(data.hosting)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Erro ao carregar:', error)
    } finally {
      setLoading(false)
    }
  }

  const runRenewalCheck = async () => {
    setRunningCheck(true)
    setCheckResult(null)
    try {
      const res = await fetch('/api/cron/renewal-check', {
        method: 'POST'
      })
      const data = await res.json()
      setCheckResult(data)
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setRunningCheck(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      // Buscar user ID pelo email
      const userRes = await fetch(`/api/users/search?email=${encodeURIComponent(formUserEmail)}`)
      const userData = await userRes.json()
      
      if (!userData.user) {
        alert('Usuário não encontrado')
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          userId: userData.user.id,
          domainName: formDomain,
          registrationDate: formRegistrationDate || undefined,
          expirationDate: formExpiration,
          packageName: formType === 'hosting' ? (formPackage || undefined) : undefined,
          renewalPrice: parseFloat(formPrice),
          autoRenew: formAutoRenew,
          notes: formNotes
        })
      })

      if (res.ok) {
        alert('✅ Cadastrado com sucesso!')
        setFormDomain('')
        setFormRegistrationDate('')
        setFormExpiration('')
        setFormPackage('')
        setFormPrice('')
        setFormNotes('')
        setLookupHint('')
        loadRenewals()
        setActiveTab('overview')
      } else {
        const errBody = await res.json().catch(() => ({}))
        alert(`❌ ${errBody.error || 'Erro ao cadastrar'}`)
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('❌ Erro ao cadastrar')
    } finally {
      setSubmitting(false)
    }
  }

  const getDaysRemaining = (expirationDate: string) => {
    const exp = new Date(expirationDate)
    const today = new Date()
    const diff = exp.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const allServices = [...domains, ...hosting].map(s => ({
    ...s,
    type: domains.find(d => d.id === s.id) ? 'domain' : 'hosting' as 'domain' | 'hosting',
    daysRemaining: getDaysRemaining(s.expiration_date)
  })).sort((a, b) => a.daysRemaining - b.daysRemaining)

  const filteredServices = searchQuery 
    ? allServices.filter(s => 
        s.domain_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allServices

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded p-4">
          <div className="flex items-center gap-3">
            <Globe className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Serviços</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
            <div>
              <p className="text-sm text-emerald-600 font-medium">Activos</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-sm text-amber-600 font-medium">60 dias</p>
              <p className="text-2xl font-bold">{stats.expiring60Days}</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <div>
              <p className="text-sm text-red-600 font-medium">30 dias</p>
              <p className="text-2xl font-bold">{stats.expiring30Days}</p>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 rounded p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-indigo-400" />
            <div>
              <p className="text-sm text-indigo-600 font-medium">Receita Anual</p>
              <p className="text-2xl font-bold">
                {(stats?.totalRevenue || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(',', '.')} MT
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - Simplified when hideTabs is true (hide Cadastrar and Templates) */}
      <div className="bg-white rounded shadow-sm border border-gray-200">
        <div className={panelTabList}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`${panelTabBtn} flex items-center gap-2 ${
              activeTab === 'overview' ? 'border-b-blue-500 text-blue-600' : 'text-gray-600'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline" />
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('domains')}
            className={`${panelTabBtn} flex items-center gap-2 ${
              activeTab === 'domains' ? 'border-b-blue-500 text-blue-600' : 'text-gray-600'
            }`}
          >
            <Globe className="w-4 h-4 inline" />
            Domínios ({domains.length})
          </button>
          <button
            onClick={() => setActiveTab('hosting')}
            className={`${panelTabBtn} flex items-center gap-2 ${
              activeTab === 'hosting' ? 'border-b-blue-500 text-blue-600' : 'text-gray-600'
            }`}
          >
            <Server className="w-4 h-4 inline" />
            Hospedagem ({hosting.length})
          </button>
          {!hideTabs && (
            <button
              onClick={() => setActiveTab('add')}
              className={`${panelTabBtn} flex items-center gap-2 ${
                activeTab === 'add' ? 'border-b-blue-500 text-blue-600' : 'text-gray-600'
              }`}
            >
              <Plus className="w-4 h-4 inline" />
              Cadastrar
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Visão Geral */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Botão de Verificação */}
              <div className="bg-gray-50 rounded p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Bell className="w-5 h-5" />
                      Verificação Automática
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Execute a verificação manual para enviar notificações de renovação
                    </p>
                  </div>
                  <button
                    onClick={runRenewalCheck}
                    disabled={runningCheck}
                    className="px-6 py-3 bg-blue-50 border border-blue-200 text-blue-600 rounded font-medium hover:bg-blue-100 hover:text-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className={`w-5 h-5 ${runningCheck ? 'animate-spin' : ''}`} />
                    {runningCheck ? 'A verificar...' : 'Executar Verificação'}
                  </button>
                </div>

                {checkResult && (
                  <div className={`mt-4 p-4 rounded ${checkResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <p className="font-medium">{checkResult.success ? '✅ Verificação Concluída' : '❌ Erro'}</p>
                    {checkResult.success && (
                      <div className="mt-2 text-sm">
                        <p>Processados: {checkResult.processed}</p>
                        <p>Notificações: {checkResult.notifications}</p>
                        {checkResult.errors?.length > 0 && (
                          <p className="text-red-600 mt-1">Erros: {checkResult.errors.length}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lista de Urgentes */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Serviços Próximos do Vencimento</h3>
                {filteredServices.filter(s => s.daysRemaining <= 60).length === 0 ? (
                  <p className="text-gray-500">Nenhum serviço próximo do vencimento</p>
                ) : (
                  <div className="space-y-3">
                    {filteredServices.filter(s => s.daysRemaining <= 60).slice(0, 10).map(service => (
                      <div 
                        key={service.id} 
                        className={`p-4 rounded border ${
                          service.daysRemaining <= 7 ? 'bg-red-50 border-red-200' :
                          service.daysRemaining <= 30 ? 'bg-yellow-50 border-yellow-200' :
                          'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{service.domain_name}</p>
                            <p className="text-sm text-gray-500">
                              {service.type === 'domain' ? 'Domínio' : 'Hospedagem'} | 
                              expira em {service.daysRemaining} dias | 
                              {service.renewal_price} MT
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            service.daysRemaining <= 7 ? 'bg-red-100 text-red-700' :
                            service.daysRemaining <= 30 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {service.daysRemaining} dias
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lista de Domínios/Hospedagem */}
          {(activeTab === 'domains' || activeTab === 'hosting') && (
            <div>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por domínio ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded"
                  />
                </div>
              </div>

              {filteredServices.filter(s => 
                activeTab === 'domains' ? s.type === 'domain' : s.type === 'hosting'
              ).length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum serviço encontrado</p>
              ) : (
                <div className="space-y-3">
                  {filteredServices
                    .filter(s => activeTab === 'domains' ? s.type === 'domain' : s.type === 'hosting')
                    .map(service => (
                    <div key={service.id} className="p-4 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{service.domain_name}</p>
                          <p className="text-sm text-gray-500">
                            Cliente: {service.user_email || service.user_id} | 
                            Expira: {new Date(service.expiration_date).toLocaleDateString('pt-PT')} | 
                            {service.renewal_price} MT
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            service.status === 'active' ? 'bg-green-100 text-green-700' :
                            service.status === 'expired' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {service.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Formulário de Cadastro */}
          {activeTab === 'add' && (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'domain' | 'hosting')}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="domain">Domínio</option>
                    <option value="hosting">Hospedagem</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email do Cliente</label>
                  <input
                    type="email"
                    value={formUserEmail}
                    onChange={(e) => setFormUserEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Domínio</label>
                <input
                  type="text"
                  value={formDomain}
                  onChange={(e) => setFormDomain(e.target.value)}
                  onBlur={lookupDomain}
                  placeholder="exemplo.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  required
                />
                {lookupLoading && (
                  <p className="text-xs text-gray-500 mt-1">A procurar no DirectAdmin...</p>
                )}
                {!lookupLoading && lookupHint && (
                  <p className={`text-xs mt-1 ${lookupHint.startsWith('✓') ? 'text-emerald-600' : lookupHint.startsWith('≈') ? 'text-amber-600' : 'text-gray-500'}`}>
                    {lookupHint}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Registo</label>
                  <input
                    type="date"
                    value={formRegistrationDate}
                    onChange={(e) => setFormRegistrationDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento</label>
                  <input
                    type="date"
                    value={formExpiration}
                    onChange={(e) => setFormExpiration(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {formType === 'hosting' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pacote</label>
                    <select
                      value={formPackage}
                      onChange={(e) => setFormPackage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    >
                      <option value="">Selecione um pacote...</option>
                      {packageOptions.map(pkg => (
                        <option key={pkg.packageName} value={pkg.packageName}>
                          {pkg.packageName} ({pkg.allowedDomains === '-' ? 'domínios ilimitados' : `${pkg.allowedDomains} domínio(s)`})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Renovação (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="Ex: 5000.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formAutoRenew}
                    onChange={(e) => setFormAutoRenew(e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Auto-renovação habilitada</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Observações opcionais..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-50 text-blue-600 border border-blue-200 rounded font-bold hover:bg-blue-100 hover:text-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                {submitting ? 'Cadastrando...' : 'Cadastrar Serviço'}
              </button>
            </form>
          )}

          </div>
        </div>
    </div>
  )
}
