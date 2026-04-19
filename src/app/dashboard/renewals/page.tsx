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
  ExternalLink,
  Bell,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'

interface Renewal {
  id: string
  domain_name: string
  expiration_date: string
  renewal_price: number
  currency: string
  auto_renew: boolean
  status: 'active' | 'expired' | 'pending' | 'cancelled' | 'renewed'
  notes?: string
}

export default function RenewalsPage() {
  const [domains, setDomains] = useState<Renewal[]>([])
  const [hosting, setHosting] = useState<Renewal[]>([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    expiring30Days: 0,
    expiring60Days: 0
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'domains' | 'hosting'>('all')

  useEffect(() => {
    loadRenewals()
  }, [])

  const loadRenewals = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/renewals')
      const data = await res.json()
      
      if (data.success) {
        setDomains(data.domains)
        setHosting(data.hosting)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Erro ao carregar renovações:', error)
    } finally {
      setLoading(false)
    }
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
    if (days <= 30) return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    if (days <= 60) return 'bg-blue-50 text-blue-700 border-blue-200'
    return 'bg-green-50 text-green-700 border-green-200'
  }

  const getStatusIcon = (status: string, days: number) => {
    if (status === 'expired') return <AlertTriangle className="w-5 h-5 text-red-500" />
    if (days <= 7) return <AlertTriangle className="w-5 h-5 text-red-500" />
    if (days <= 30) return <Clock className="w-5 h-5 text-yellow-500" />
    if (days <= 60) return <Bell className="w-5 h-5 text-blue-500" />
    return <CheckCircle className="w-5 h-5 text-green-500" />
  }

  const allServices = [...domains, ...hosting].map(s => ({
    ...s,
    type: domains.find(d => d.id === s.id) ? 'domain' : 'hosting' as 'domain' | 'hosting',
    daysRemaining: getDaysRemaining(s.expiration_date)
  })).sort((a, b) => a.daysRemaining - b.daysRemaining)

  const filteredServices = activeTab === 'all' 
    ? allServices 
    : activeTab === 'domains' 
      ? allServices.filter(s => s.type === 'domain')
      : allServices.filter(s => s.type === 'hosting')

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Renovações</h1>
          <p className="text-gray-600">Gerencie as renovações dos seus domínios e hospedagens</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Globe className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total de Serviços</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ativos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Expira em 60 dias</p>
                <p className="text-2xl font-bold text-gray-900">{stats.expiring60Days}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Expira em 30 dias</p>
                <p className="text-2xl font-bold text-gray-900">{stats.expiring30Days}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'all' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Todos ({allServices.length})
            </button>
            <button
              onClick={() => setActiveTab('domains')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'domains' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Globe className="w-4 h-4 inline mr-2" />
              Domínios ({domains.length})
            </button>
            <button
              onClick={() => setActiveTab('hosting')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'hosting' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Server className="w-4 h-4 inline mr-2" />
              Hospedagem ({hosting.length})
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Carregando...</p>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum serviço encontrado</p>
                <p className="text-gray-400 text-sm mt-1">
                  Seus domínios e hospedagens aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredServices.map((service) => (
                  <div
                    key={service.id}
                    className={`p-5 rounded-lg border-2 ${getStatusColor(service.status, service.daysRemaining)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        {getStatusIcon(service.status, service.daysRemaining)}
                        <div>
                          <div className="flex items-center gap-2">
                            {service.type === 'domain' ? (
                              <Globe className="w-4 h-4 text-gray-400" />
                            ) : (
                              <Server className="w-4 h-4 text-gray-400" />
                            )}
                            <h3 className="font-semibold text-lg">{service.domain_name}</h3>
                            <span className="px-2 py-0.5 bg-white/50 text-xs rounded uppercase">
                              {service.type === 'domain' ? 'Domínio' : 'Hospedagem'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Expira em: {new Date(service.expiration_date).toLocaleDateString('pt-PT')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {service.daysRemaining > 0 ? (
                                <span className={service.daysRemaining <= 7 ? 'text-red-600 font-bold' : ''}>
                                  {service.daysRemaining} dias restantes
                                </span>
                              ) : (
                                <span className="text-red-600 font-bold">EXPIRADO</span>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-4 h-4" />
                              {service.renewal_price} {service.currency}
                            </span>
                          </div>

                          {service.notes && (
                            <p className="text-sm mt-2 opacity-75">{service.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {service.auto_renew && (
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            Auto-renovação
                          </span>
                        )}
                        <Link
                          href={`/dashboard/renewals/checkout?service=${service.id}&type=${service.type}`}
                          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                            service.daysRemaining <= 7
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : service.daysRemaining <= 30
                              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          {service.daysRemaining <= 7 ? 'Renovar Urgente' : 'Renovar'}
                        </Link>
                      </div>
                    </div>

                    {/* Alerta visual para serviços próximos do vencimento */}
                    {service.daysRemaining <= 30 && service.daysRemaining > 0 && (
                      <div className={`mt-4 p-3 rounded-lg ${
                        service.daysRemaining <= 7 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        <p className="text-sm font-medium flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          {service.daysRemaining <= 7 
                            ? '⚠️ ATENÇÃO: Seu serviço expira em menos de uma semana! Renove imediatamente para evitar suspensão.'
                            : `⏰ Atenção: Faltam ${service.daysRemaining} dias para o vencimento. Não deixe para depois!`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações Automáticas
          </h3>
          <p className="text-blue-700 text-sm mb-4">
            Você receberá notificações automáticas nos seguintes períodos antes do vencimento:
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">60 dias</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">45 dias</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">30 dias</span>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">15 dias</span>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full">7 dias</span>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full">3 dias</span>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full font-bold">1 dia</span>
          </div>
        </div>
      </div>
    </div>
  )
}
