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
  Search,
  Palette,
  Eye,
  Save,
  Variable,
  Mail,
  MessageSquare,
  Undo2
} from 'lucide-react'
import { defaultRenewalTemplates, RenewalTemplate, processTemplate, TemplateVariables } from '@/lib/renewal-templates'

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
  initialTab?: 'overview' | 'domains' | 'hosting' | 'add' | 'templates'
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
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'hosting' | 'add' | 'templates'>(initialTab)
  
  // Templates editor states
  const [templates, setTemplates] = useState<RenewalTemplate[]>(defaultRenewalTemplates)
  const [selectedTemplate, setSelectedTemplate] = useState<RenewalTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<RenewalTemplate | null>(null)
  const [previewVariables, setPreviewVariables] = useState<TemplateVariables>({
    clientName: 'João Silva',
    serviceName: 'exemplo.com',
    expirationDate: '31/12/2025',
    daysRemaining: 60,
    renewalPrice: '15.00 MT',
    renewalLink: 'https://visualdesigne.com/renovar',
    companyName: 'VisualDesign',
    supportEmail: 'suporte@visualdesigne.com',
    supportPhone: '+351 912 345 678'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [runningCheck, setRunningCheck] = useState(false)
  const [checkResult, setCheckResult] = useState<any>(null)

  // Form states
  const [formType, setFormType] = useState<'domain' | 'hosting'>('domain')
  const [formUserEmail, setFormUserEmail] = useState('')
  const [formDomain, setFormDomain] = useState('')
  const [formExpiration, setFormExpiration] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formAutoRenew, setFormAutoRenew] = useState(false)
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadRenewals()
  }, [])

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
          expirationDate: formExpiration,
          renewalPrice: parseFloat(formPrice) || (formType === 'domain' ? 15 : 50),
          autoRenew: formAutoRenew,
          notes: formNotes
        })
      })

      if (res.ok) {
        alert('✅ Cadastrado com sucesso!')
        setFormDomain('')
        setFormExpiration('')
        setFormPrice('')
        setFormNotes('')
        loadRenewals()
        setActiveTab('overview')
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
              <p className="text-sm text-emerald-600 font-medium">Ativos</p>
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
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'overview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('domains')}
            className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'domains' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600'
            }`}
          >
            <Globe className="w-4 h-4 inline mr-2" />
            Domínios ({domains.length})
          </button>
          <button
            onClick={() => setActiveTab('hosting')}
            className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'hosting' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600'
            }`}
          >
            <Server className="w-4 h-4 inline mr-2" />
            Hospedagem ({hosting.length})
          </button>
          {!hideTabs && (
            <>
              <button
                onClick={() => setActiveTab('add')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'add' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600'
                }`}
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Cadastrar
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'templates' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-600'
                }`}
              >
                <Palette className="w-4 h-4 inline mr-2" />
                Templates ({templates.length})
              </button>
            </>
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
                  placeholder="exemplo.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Renovação (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder={formType === 'domain' ? '15.00' : '50.00'}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
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

          {/* Templates Editor */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              {/* Header do Editor */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-purple-600" />
                    Editor de Templates de Notificação
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Personalize as mensagens de renovação enviadas aos clientes
                  </p>
                </div>
                {editingTemplate && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate : t))
                        setEditingTemplate(null)
                        alert('✅ Template salvo!')
                      }}
                      className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded font-bold hover:bg-emerald-100 hover:text-emerald-700 flex items-center gap-2 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Salvar Alterações
                    </button>
                    <button
                      onClick={() => setEditingTemplate(null)}
                      className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-600 font-bold rounded hover:bg-gray-100 hover:text-gray-700 transition-colors flex items-center gap-2"
                    >
                      <Undo2 className="w-4 h-4" />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lista de Templates */}
                <div className="lg:col-span-1 space-y-3">
                  <h4 className="font-medium text-gray-700 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Templates Disponíveis ({templates.length})
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {templates.map(template => (
                      <div
                        key={template.id}
                        onClick={() => {
                          setSelectedTemplate(template)
                          setEditingTemplate({ ...template })
                        }}
                        className={`p-3 rounded border cursor-pointer transition-colors ${
                          editingTemplate?.id === template.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            template.urgency === 'critical' ? 'bg-red-500' :
                            template.urgency === 'high' ? 'bg-orange-500' :
                            template.urgency === 'medium' ? 'bg-yellow-500' :
                            'bg-blue-500'
                          }`} />
                          <span className="font-medium text-sm">{template.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span className="px-2 py-0.5 bg-gray-100 rounded">
                            {template.daysBefore === 0 ? 'Confirmação' : `${template.daysBefore} dias`}
                          </span>
                          <span className={`px-2 py-0.5 rounded ${
                            template.type === 'error' ? 'bg-red-100 text-red-700' :
                            template.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                            template.type === 'success' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {template.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Variáveis Disponíveis */}
                  <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
                    <h4 className="font-medium text-blue-900 flex items-center gap-2 mb-3">
                      <Variable className="w-4 h-4" />
                      Variáveis Disponíveis
                    </h4>
                    <p className="text-xs text-blue-700 mb-2">
                      Use estas variáveis nos templates:
                    </p>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between">
                        <code className="text-blue-800">{'{{clientName}}'}</code>
                        <span className="text-blue-600">Nome do cliente</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="text-blue-800">{'{{serviceName}}'}</code>
                        <span className="text-blue-600">Domínio/Serviço</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="text-blue-800">{'{{expirationDate}}'}</code>
                        <span className="text-blue-600">Data de vencimento</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="text-blue-800">{'{{daysRemaining}}'}</code>
                        <span className="text-blue-600">Dias restantes</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="text-blue-800">{'{{renewalPrice}}'}</code>
                        <span className="text-blue-600">Preço</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="text-blue-800">{'{{renewalLink}}'}</code>
                        <span className="text-blue-600">Link de renovação</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="text-blue-800">{'{{companyName}}'}</code>
                        <span className="text-blue-600">VisualDesign</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="text-blue-800">{'{{supportEmail}}'}</code>
                        <span className="text-blue-600">Email suporte</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="text-blue-800">{'{{supportPhone}}'}</code>
                        <span className="text-blue-600">Telefone</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Editor e Preview */}
                <div className="lg:col-span-2 space-y-6">
                  {editingTemplate ? (
                    <>
                      {/* Editor */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nome do Template
                            </label>
                            <input
                              type="text"
                              value={editingTemplate.name}
                              onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Dias antes do vencimento
                            </label>
                            <input
                              type="number"
                              value={editingTemplate.daysBefore}
                              onChange={(e) => setEditingTemplate({ ...editingTemplate, daysBefore: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Tipo
                            </label>
                            <select
                              value={editingTemplate.type}
                              onChange={(e) => setEditingTemplate({ ...editingTemplate, type: e.target.value as any })}
                              className="w-full px-3 py-2 border border-gray-300 rounded"
                            >
                              <option value="info">ℹ️ Informativo</option>
                              <option value="success">✅ Sucesso</option>
                              <option value="warning">⚠️ Aviso</option>
                              <option value="error">❌ Erro/Urgente</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Urgência
                            </label>
                            <select
                              value={editingTemplate.urgency}
                              onChange={(e) => setEditingTemplate({ ...editingTemplate, urgency: e.target.value as any })}
                              className="w-full px-3 py-2 border border-gray-300 rounded"
                            >
                              <option value="low">🟢 Baixa</option>
                              <option value="medium">🟡 Média</option>
                              <option value="high">🟠 Alta</option>
                              <option value="critical">🔴 Crítica</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Título da Notificação (Dashboard)
                          </label>
                          <input
                            type="text"
                            value={editingTemplate.title}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Mensagem Curta (Preview)
                          </label>
                          <textarea
                            value={editingTemplate.message}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, message: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Assunto do Email
                          </label>
                          <input
                            type="text"
                            value={editingTemplate.emailSubject}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, emailSubject: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Corpo do Email (suporta HTML)
                          </label>
                          <textarea
                            value={editingTemplate.emailBody}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, emailBody: e.target.value })}
                            rows={12}
                            className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                          />
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="border-t border-gray-200 pt-6">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-4">
                          <Eye className="w-5 h-5" />
                          Preview ao Vivo
                        </h4>
                        
                        {/* Preview Dashboard */}
                        <div className={`p-4 rounded border-l-4 mb-4 ${
                          editingTemplate.type === 'error' ? 'bg-red-50 border-red-400' :
                          editingTemplate.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                          editingTemplate.type === 'success' ? 'bg-green-50 border-green-400' :
                          'bg-blue-50 border-blue-400'
                        }`}>
                          <p className="font-medium">
                            {processTemplate(editingTemplate, previewVariables).title}
                          </p>
                          <p className="text-sm mt-1 opacity-80">
                            {processTemplate(editingTemplate, previewVariables).message}
                          </p>
                        </div>

                        {/* Preview Email */}
                        <div className="border border-gray-200 rounded overflow-hidden">
                          <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                            <p className="text-sm font-medium text-gray-700">
                              Assunto: {processTemplate(editingTemplate, previewVariables).emailSubject}
                            </p>
                          </div>
                          <div 
                            className="p-4 bg-white prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ 
                              __html: processTemplate(editingTemplate, previewVariables).emailBody 
                            }}
                          />
                        </div>

                        {/* Editar Variáveis de Preview */}
                        <div className="mt-4 p-4 bg-gray-50 rounded">
                          <p className="text-sm font-medium text-gray-700 mb-2">Editar Variáveis de Preview:</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <input
                              type="text"
                              value={previewVariables.clientName}
                              onChange={(e) => setPreviewVariables({ ...previewVariables, clientName: e.target.value })}
                              placeholder="Nome do cliente"
                              className="px-2 py-1 border rounded"
                            />
                            <input
                              type="text"
                              value={previewVariables.serviceName}
                              onChange={(e) => setPreviewVariables({ ...previewVariables, serviceName: e.target.value })}
                              placeholder="Nome do serviço"
                              className="px-2 py-1 border rounded"
                            />
                            <input
                              type="text"
                              value={previewVariables.expirationDate}
                              onChange={(e) => setPreviewVariables({ ...previewVariables, expirationDate: e.target.value })}
                              placeholder="Data de vencimento"
                              className="px-2 py-1 border rounded"
                            />
                            <input
                              type="text"
                              value={previewVariables.renewalPrice}
                              onChange={(e) => setPreviewVariables({ ...previewVariables, renewalPrice: e.target.value })}
                              placeholder="Preço"
                              className="px-2 py-1 border rounded"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded border-2 border-dashed border-gray-200">
                      <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Selecione um template à esquerda para editar</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
    </div>
  )
}
