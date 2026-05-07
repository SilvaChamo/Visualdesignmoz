'use client'

import React, { useState, useEffect } from 'react'
import {
  Globe, FileText, MessageSquare, Server, RefreshCw, ExternalLink, 
  Settings, Trash2, AlertCircle, Calendar, CheckCircle
} from 'lucide-react'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'


interface Props {
  sites: DirectAdminWebsite[]
  isFetching: boolean
  onNavigate: (section: string) => void
  onRefresh: () => void
  onSetFileManagerDomain?: (domain: string) => void
  onSetDNSDomain?: (domain: string) => void
  sessionUser?: string | null
}

// Helper para parse de state
const parseState = (state: any): string => {
  if (state === 1 || state === '1' || state === 'Active') return 'Active'
  if (state === 0 || state === '0' || state === 'Suspended') return 'Suspended'
  return state || 'Active'
}

// Extrair extensão do domínio
const getDomainExtension = (domain: string): string => {
  const parts = domain.split('.')
  if (parts.length >= 2) {
    return '.' + parts.slice(-1)[0]
  }
  return ''
}

// Gerar data de expiração simulada (baseada no domínio para ser consistente)
const getExpirationDate = (domain: string): string => {
  // Usar o domínio para gerar uma data consistente
  const hash = domain.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const days = (hash % 180) + 30 // Entre 30 e 210 dias
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

// Calcular dias restantes até a expiração
const getDaysUntilExpiration = (expirationDate: string): number => {
  const today = new Date()
  const expDate = new Date(expirationDate)
  const diffTime = expDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Verificar se deve mostrar botão de pagar fatura (menos de 60 dias)
const shouldShowPayButton = (expirationDate: string): boolean => {
  const days = getDaysUntilExpiration(expirationDate)
  return days <= 60 && days > 0
}

export function ResellerDashboard({ 
  sites, 
  isFetching, 
  onNavigate, 
  onRefresh,
  onSetFileManagerDomain,
  onSetDNSDomain,
  sessionUser 
}: Props) {
  const [faturasPendentes, setFaturasPendentes] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filtrar sites válidos
  const filteredSites = sites.filter(s => 
    !s.domain.includes('contaboserver') && 
    !s.domain.toLowerCase().startsWith('mail.')
  )

  const totalSites = filteredSites.length
  const hoje = new Date()

  useEffect(() => {
    fetchAdditionalData()
  }, [])

  const fetchAdditionalData = async () => {
    setLoading(true)
    try {
      // Simular dados de faturas e tickets para o revendedor
      // Em produção, buscar de API
      setFaturasPendentes([])
      setTickets([])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManageSite = (domain: string) => {
    // @ts-ignore
    window.__selectedManageDomain = domain
    onNavigate('manage-website')
  }

  const handleGerenciar = (domain: string) => {
    // @ts-ignore
    window.__selectedManageDomain = domain
    onNavigate('manage-website')
  }

  if (isFetching || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="flex gap-5 p-5">
      {/* Conteúdo principal */}
      <div className="flex-1 space-y-5">
        
        {/* Saudação */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {sessionUser ? sessionUser.split('@')[0] : 'Revendedor'}!
          </h1>
          <p className="text-gray-500 mt-1">
            Bem-vindo ao teu portal de gestão. Aqui podes gerir os teus serviços e domínios.
          </p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Globe className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sites Activos</p>
              <p className="text-2xl font-bold text-gray-900">{totalSites}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {totalSites > 0 ? 'Websites geridos' : 'Nenhum site'}
              </p>
            </div>
          </div>
          
          <div className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Server className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Domínios</p>
              <p className="text-2xl font-bold text-gray-900">{totalSites}</p>
              <p className="text-xs text-gray-400 mt-0.5">Domínios registados</p>
            </div>
          </div>
          
          <div className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Status da Conta</p>
              <p className="text-2xl font-bold text-gray-900">Activo</p>
              <p className="text-xs text-gray-400 mt-0.5">Revendedor</p>
            </div>
          </div>
          
          <div className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <FileText className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Próxima Renovação</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredSites.length > 0 
                  ? getExpirationDate(filteredSites[0].domain).split('-').reverse().join('/') 
                  : 'N/A'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Ver faturas</p>
            </div>
          </div>
        </div>

        {/* Lista de Sites em Cards - Estilo da imagem */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Meus Sites</h2>
            <button 
              onClick={onRefresh}
              className="text-gray-400 hover:text-red-600 transition-colors"
              title="Actualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {filteredSites.length === 0 ? (
            <div className="bg-white rounded border border-gray-200 shadow-sm p-10 text-center">
              <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum site encontrado.</p>
              <button 
                onClick={() => onNavigate('domains-new')}
                className="mt-4 text-red-600 hover:text-red-700 text-sm font-bold"
              >
                + Criar primeiro site
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSites.map((site) => {
                const extension = getDomainExtension(site.domain)
                const expirationDate = getExpirationDate(site.domain)
                const status = parseState(site.state)
                const isActive = status === 'Active'
                const showPayButton = shouldShowPayButton(expirationDate)

                return (
                  <div 
                    key={site.domain} 
                    className="bg-white rounded border border-gray-200 shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                  >
                    {/* Ícone e info do domínio */}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-50 rounded flex items-center justify-center border border-green-100">
                        <Globe className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900">
                            {site.domain}
                          </h3>
                          <span className="text-xs text-gray-500 font-medium">
                            {extension}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-xs text-green-600 font-medium">
                            Expiração: {expirationDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botões de acção */}
                    <div className="flex items-center gap-3">
                      {/* Botão Pagar Fatura - aparece quando faltam 60 dias ou menos */}
                      {showPayButton && (
                        <button 
                          className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors"
                        >
                          PAGAR FATURA
                        </button>
                      )}
                      
                      {/* Botão Gerenciar */}
                      <button 
                        onClick={() => handleGerenciar(site.domain)}
                        className="px-5 py-2 bg-white border-2 border-gray-800 hover:bg-gray-800 hover:text-white text-gray-800 text-xs font-bold uppercase tracking-wider rounded transition-colors"
                      >
                        GERENCIAR
                      </button>
                      
                      {/* Badge Status */}
                      <span className={`px-3 py-1 rounded text-xs font-bold ${
                        isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {isActive ? 'ATIVO' : 'SUSPENSO'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Notificações */}
        <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              Notificações
            </h2>
            <button className="text-[10px] text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider transition-colors">
              Ver Todos
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-50/50 rounded border border-blue-100 hover:bg-blue-50 transition-colors cursor-pointer group">
              <div className="p-2 bg-blue-100 rounded group-hover:bg-blue-200 transition-colors">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">Pagamento Confirmado</p>
                <p className="text-xs text-gray-500 mt-0.5">Recibo disponível para download</p>
                <p className="text-[10px] text-gray-400 mt-1">Hoje, 14:30</p>
              </div>
              <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0"></span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra lateral direita */}
      <div className="w-64 shrink-0 space-y-4">
        
        {/* Card do revendedor */}
        <div className="bg-white rounded border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col items-center mb-4">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mb-2">
              <span className="text-white text-xl font-bold">
                {sessionUser ? sessionUser.substring(0, 2).toUpperCase() : 'RV'}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
              Activo
            </span>
          </div>
          <div className="space-y-1.5 text-sm border-t border-gray-100 pt-4 text-center">
            <p className="font-bold text-gray-900">
              {sessionUser ? sessionUser.split('@')[0] : 'Revendedor'}
            </p>
            <p className="text-gray-500 text-xs">{sessionUser || 'revendedor@email.com'}</p>
          </div>
        </div>

        {/* Crédito disponível */}
        <div className="bg-white rounded border border-gray-200 shadow-sm p-5 text-center">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Crédito Disponível</p>
          <p className="text-2xl font-bold text-gray-900 mb-3">MT 0</p>
          <button 
            className="w-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded transition-all"
          >
            Adicionar Fundos
          </button>
        </div>

        {/* Acesso rápido */}
        <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
            Acesso Rápido
          </p>
          <div className="space-y-1">
            {[
              { label: 'Criar Website', id: 'domains-new', icon: <Globe className="w-3.5 h-3.5" /> },
              { label: 'Gestão de Sites', id: 'domains', icon: <Server className="w-3.5 h-3.5" /> },
              { label: 'Configurações', id: 'settings-profile', icon: <Settings className="w-3.5 h-3.5" /> },
            ].map((item, i) => (
              <button 
                key={i} 
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-red-600 rounded transition-colors text-left font-medium"
              >
                <span className="text-gray-400">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sites mini list */}
        {filteredSites.length > 0 && (
          <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
              Sites ({filteredSites.length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredSites.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    parseState(s.state) === 'Active' ? 'bg-green-500' : 'bg-red-400'
                  }`}></div>
                  <span className="text-gray-700 truncate font-medium flex-1">{s.domain}</span>
                </div>
              ))}
              {filteredSites.length > 5 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  +{filteredSites.length - 5} mais
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
