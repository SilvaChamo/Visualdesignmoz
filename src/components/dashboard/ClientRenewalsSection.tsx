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
  RefreshCw,
  Bell,
  Mail,
  Wallet
} from 'lucide-react'
import PaymentMethodForm from './PaymentMethodForm'

interface Renewal {
  id: string
  domain_name: string
  expiration_date: string
  renewal_price: number
  currency: string
  auto_renew: boolean
  status: 'active' | 'expired' | 'pending' | 'cancelled' | 'renewed'
  notes?: string
  type: 'domain' | 'hosting'
}

interface SiteInfo {
  domain: string
  emailAccounts: number
  diskUsage: string
  bandwidth: string
  status: string
}

export default function ClientRenewalsSection({ sites }: { sites: any[] }) {
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    expiring30Days: 0,
    expiring60Days: 0,
    totalValue: 0
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'domains' | 'hosting'>('all')
  const [siteDetails, setSiteDetails] = useState<SiteInfo[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [processingPayment, setProcessingPayment] = useState<string | null>(null)

  useEffect(() => {
    loadRenewals()
    generateSiteDetails()
    loadPaymentMethods()
  }, [sites])

  const loadPaymentMethods = async () => {
    try {
      const res = await fetch('/api/payments')
      const data = await res.json()
      if (data.success) {
        setPaymentMethods(data.methods)
      }
    } catch (error) {
      console.error('Erro ao carregar métodos de pagamento:', error)
    }
  }

  const handlePay = async (renewal: Renewal) => {
    if (paymentMethods.length === 0) {
      setShowPaymentForm(true)
      return
    }

    const defaultMethod = paymentMethods.find(m => m.is_default) || paymentMethods[0]
    
    setProcessingPayment(renewal.id)
    try {
      const res = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renewal_id: renewal.id,
          renewal_type: renewal.type,
          payment_method_id: defaultMethod.id,
          amount: renewal.renewal_price
        })
      })

      const data = await res.json()
      
      if (data.success) {
        alert('Pagamento processado com sucesso!')
        loadRenewals()
      } else {
        alert('Erro no pagamento: ' + data.message)
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao processar pagamento')
    } finally {
      setProcessingPayment(null)
    }
  }

  const loadRenewals = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/renewals')
      const data = await res.json()
      
      if (data.success) {
        const allRenewals = [
          ...(data.domains || []).map((d: any) => ({ ...d, type: 'domain' as const })),
          ...(data.hosting || []).map((h: any) => ({ ...h, type: 'hosting' as const }))
        ]
        setRenewals(allRenewals)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Erro ao carregar renovações:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateSiteDetails = () => {
    if (!sites || sites.length === 0) return
    
    const details: SiteInfo[] = sites.map(site => ({
      domain: site.domain,
      emailAccounts: Math.floor(Math.random() * 5) + 1,
      diskUsage: `${(Math.random() * 2 + 0.1).toFixed(1)} GB`,
      bandwidth: `${(Math.random() * 50 + 10).toFixed(0)} GB`,
      status: site.state === 1 ? 'active' : 'suspended'
    }))
    
    setSiteDetails(details)
  }

  const getDaysRemaining = (expirationDate: string) => {
    const exp = new Date(expirationDate)
    const today = new Date()
    const diff = exp.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const getStatusColor = (status: string, days: number) => {
    if (status === 'expired') return 'bg-red-100 text-red-800 border-red-200'
    if (days <= 7) return 'bg-red-50 text-red-700 border-red-200'
    if (days <= 30) return 'bg-amber-50 text-amber-700 border-amber-200'
    if (days <= 60) return 'bg-blue-50 text-blue-700 border-blue-200'
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  const getStatusIcon = (status: string, days: number) => {
    if (status === 'expired') return <AlertTriangle className="w-4 h-4 text-red-600" />
    if (days <= 30) return <Clock className="w-4 h-4 text-amber-600" />
    return <CheckCircle className="w-4 h-4 text-emerald-600" />
  }

  const filteredRenewals = activeTab === 'all' 
    ? renewals 
    : renewals.filter(r => r.type === activeTab)

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Serviços</h2>
          <p className="text-gray-500 mt-1">Gerencie seus domínios, hospedagem e renovações</p>
        </div>
        <button 
          onClick={loadRenewals}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-emerald-100">Domínios Ativos</p>
              <p className="text-2xl font-bold">{sites?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-blue-100">Contas Email</p>
              <p className="text-2xl font-bold">
                {siteDetails.reduce((acc, s) => acc + s.emailAccounts, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-amber-100">Vencem em 30 dias</p>
              <p className="text-2xl font-bold">{stats.expiring30Days}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-red-100">Valor Total</p>
              <p className="text-2xl font-bold">
                {stats.totalValue?.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' }) || 'MT 0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detalhes dos Sites */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-gray-600" />
            Informações dos Serviços
          </h3>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
                  <th className="pb-3 pl-2">Domínio</th>
                  <th className="pb-3">Contas Email</th>
                  <th className="pb-3">Armazenamento</th>
                  <th className="pb-3">Tráfego</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {siteDetails.map((site, idx) => (
                  <tr key={idx} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{site.domain}</span>
                      </div>
                    </td>
                    <td className="py-3">{site.emailAccounts}</td>
                    <td className="py-3">{site.diskUsage}</td>
                    <td className="py-3">{site.bandwidth}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        site.status === 'active' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {site.status === 'active' ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Renovações */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              Renovações
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activeTab === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button 
                onClick={() => setActiveTab('domains')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activeTab === 'domains' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Domínios
              </button>
              <button 
                onClick={() => setActiveTab('hosting')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activeTab === 'hosting' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Hospedagem
              </button>
            </div>
          </div>
        </div>

        {filteredRenewals.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma renovação pendente</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredRenewals.map((renewal) => {
              const days = getDaysRemaining(renewal.expiration_date)
              return (
                <div key={renewal.id} className={`p-4 flex items-center justify-between ${getStatusColor(renewal.status, days)}`}>
                  <div className="flex items-center gap-3">
                    {renewal.type === 'domain' ? (
                      <Globe className="w-5 h-5" />
                    ) : (
                      <Server className="w-5 h-5" />
                    )}
                    <div>
                      <p className="font-medium">{renewal.domain_name}</p>
                      <p className="text-sm opacity-75">
                        Expira em {days} dias ({new Date(renewal.expiration_date).toLocaleDateString('pt-BR')})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold">
                        {renewal.renewal_price?.toLocaleString('pt-MZ', { style: 'currency', currency: renewal.currency || 'MZN' })}
                      </p>
                      <p className="text-xs opacity-75">
                        {renewal.auto_renew ? 'Renovação automática' : 'Renovação manual'}
                      </p>
                    </div>
                    {getStatusIcon(renewal.status, days)}
                    
                    {/* Botão Pagar */}
                    {days <= 60 && renewal.status !== 'renewed' && (
                      <button
                        onClick={() => handlePay(renewal)}
                        disabled={processingPayment === renewal.id}
                        className="ml-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {processingPayment === renewal.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <Wallet className="w-3.5 h-3.5" />
                            Pagar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Adicionar Método de Pagamento */}
      {showPaymentForm && (
        <PaymentMethodForm 
          onClose={() => setShowPaymentForm(false)} 
          onSuccess={() => {
            setShowPaymentForm(false)
            loadPaymentMethods()
          }} 
        />
      )}
    </div>
  )
}
