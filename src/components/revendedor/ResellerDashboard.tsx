'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Globe, FileText, Server, RefreshCw, Settings, Calendar, CheckCircle,
} from 'lucide-react'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'
import { directAdminAPI } from '@/lib/directadmin-api'

interface Props {
  sites: DirectAdminWebsite[]
  isFetching: boolean
  onNavigate: (section: string) => void
  onRefresh: () => void
  onSetFileManagerDomain?: (domain: string) => void
  onSetDNSDomain?: (domain: string) => void
  sessionUser?: string | null
  displayName?: string | null
  activeDaUsername?: string | null
}

type RenewalRow = {
  domain_name?: string
  domain?: string
  expiration_date: string
}

const EXPIRING_WINDOW_DAYS = 90
const RENEW_BUTTON_DAYS = 60

const parseState = (state: unknown): string => {
  if (state === 1 || state === '1' || state === 'Active') return 'Active'
  if (state === 0 || state === '0' || state === 'Suspended') return 'Suspended'
  return String(state || 'Active')
}

const getDomainExtension = (domain: string): string => {
  const parts = domain.split('.')
  if (parts.length >= 2) return '.' + parts.slice(-1)[0]
  return ''
}

const getDaysUntilExpiration = (expirationDate: string): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expDate = new Date(expirationDate)
  expDate.setHours(0, 0, 0, 0)
  const diffTime = expDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const shouldShowRenewButton = (expirationDate: string): boolean => {
  const days = getDaysUntilExpiration(expirationDate)
  return days <= RENEW_BUTTON_DAYS && days > 0
}

const formatExpirationLabel = (expirationDate: string): string => {
  const parsed = new Date(expirationDate)
  if (Number.isNaN(parsed.getTime())) return expirationDate
  return parsed.toLocaleDateString('pt-PT')
}

const SERVER_STATUS_LABELS: Record<string, string> = {
  load: 'Carga',
  memory: 'Memória',
  disk: 'Disco',
  uptime: 'Tempo activo',
  cpu: 'Processador',
}

export function ResellerDashboard({
  sites,
  isFetching,
  onNavigate,
  onRefresh,
  sessionUser,
  displayName,
  activeDaUsername,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [renewalsLoading, setRenewalsLoading] = useState(true)
  const [domainRenewals, setDomainRenewals] = useState<RenewalRow[]>([])
  const [hostingRenewals, setHostingRenewals] = useState<RenewalRow[]>([])
  const [serverStatus, setServerStatus] = useState<Record<string, string> | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)

  const filteredSites = sites.filter(
    (s) =>
      !s.domain.includes('contaboserver') &&
      !s.domain.toLowerCase().startsWith('mail.'),
  )

  const totalSites = filteredSites.length

  const expirationByDomain = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of [...domainRenewals, ...hostingRenewals]) {
      const domain = (row.domain_name || row.domain || '').toLowerCase()
      if (domain && row.expiration_date) map.set(domain, row.expiration_date)
    }
    return map
  }, [domainRenewals, hostingRenewals])

  const expiringSites = useMemo(
    () =>
      filteredSites.filter((site) => {
        const exp = expirationByDomain.get(site.domain.toLowerCase())
        if (!exp) return false
        const days = getDaysUntilExpiration(exp)
        return days > 0 && days <= EXPIRING_WINDOW_DAYS
      }),
    [filteredSites, expirationByDomain],
  )

  const nextRenewal = useMemo(() => {
    let earliest: { date: string; days: number } | null = null
    for (const site of filteredSites) {
      const exp = expirationByDomain.get(site.domain.toLowerCase())
      if (!exp) continue
      const days = getDaysUntilExpiration(exp)
      if (days <= 0) continue
      if (!earliest || days < earliest.days) earliest = { date: exp, days }
    }
    return earliest
  }, [filteredSites, expirationByDomain])

  const loadRenewals = useCallback(async () => {
    setRenewalsLoading(true)
    try {
      const [domRes, hostRes] = await Promise.all([
        fetch(`/api/renewals?type=domain&days=${EXPIRING_WINDOW_DAYS}`, { credentials: 'include' }),
        fetch(`/api/renewals?type=hosting&days=${EXPIRING_WINDOW_DAYS}`, { credentials: 'include' }),
      ])
      const domData = await domRes.json()
      const hostData = await hostRes.json()
      if (domData.success) setDomainRenewals(domData.domains || [])
      if (hostData.success) setHostingRenewals(hostData.hosting || [])
    } catch {
      /* mantém lista vazia */
    } finally {
      setRenewalsLoading(false)
      setLoading(false)
    }
  }, [])

  const loadServerStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const status = await directAdminAPI.getServerStatus()
      setServerStatus(status as Record<string, string>)
    } catch {
      setServerStatus(null)
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    void loadRenewals()
    void loadServerStatus()
  }, [loadRenewals, loadServerStatus])

  const handleGerenciar = (domain: string) => {
    // @ts-ignore
    window.__selectedManageDomain = domain
    onNavigate('manage-website')
  }

  const profileLabel = displayName || (sessionUser ? sessionUser.split('@')[0] : 'Revendedor')
  const profileInitials = profileLabel.substring(0, 2).toUpperCase()

  const serverStatusRows = serverStatus
    ? Object.entries(serverStatus).filter(
        ([key]) => !['status', 'error_message', 'source', 'cores'].includes(key),
      ).slice(0, 5)
    : []

  if (isFetching || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="flex gap-5 p-5">
      <div className="flex-1 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="p-3 bg-blue-50 rounded-lg dark:bg-blue-950/40">
              <Globe className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Sites Activos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{totalSites}</p>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-zinc-500">
                {totalSites > 0 ? 'Websites geridos' : 'Nenhum site'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="p-3 bg-purple-50 rounded-lg dark:bg-purple-950/40">
              <Server className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Domínios</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{totalSites}</p>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-zinc-500">Domínios registados</p>
            </div>
          </div>

          <div className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="p-3 bg-green-50 rounded-lg dark:bg-green-950/40">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Estado da Conta</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Activo</p>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-zinc-500">Revendedor</p>
            </div>
          </div>

          <div className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="p-3 bg-red-50 rounded-lg dark:bg-red-950/40">
              <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Próxima Renovação</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                {nextRenewal ? formatExpirationLabel(nextRenewal.date) : 'N/A'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-zinc-500">Ver faturas</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {renewalsLoading ? (
            <div className="bg-white rounded border border-gray-200 shadow-sm p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <RefreshCw className="w-6 h-6 animate-spin text-red-600 mx-auto" />
            </div>
          ) : expiringSites.length === 0 ? (
            <div className="bg-white rounded border border-gray-200 shadow-sm p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4 dark:text-zinc-600" />
              <p className="text-gray-500 dark:text-zinc-400">
                Nenhum domínio a expirar nos próximos 3 meses.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {expiringSites.map((site) => {
                const extension = getDomainExtension(site.domain)
                const expirationDate =
                  expirationByDomain.get(site.domain.toLowerCase()) || ''
                const status = parseState(site.state)
                const isActive = status === 'Active'
                const showRenewButton = shouldShowRenewButton(expirationDate)

                return (
                  <div
                    key={site.domain}
                    className="bg-white rounded border border-gray-200 shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-50 rounded flex items-center justify-center border border-green-100 dark:bg-green-950/30 dark:border-green-900/50">
                        <Globe className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                            {site.domain}
                          </h3>
                          <span className="text-xs text-gray-500 font-medium dark:text-zinc-400">
                            {extension}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                          <span className="text-xs text-green-600 font-medium dark:text-green-400">
                            Expiração: {formatExpirationLabel(expirationDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {showRenewButton ? (
                        <button
                          type="button"
                          className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors"
                        >
                          PAGAR FATURA
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleGerenciar(site.domain)}
                        className="px-5 py-2 bg-white border border-gray-800 hover:bg-gray-800 hover:text-white text-gray-800 text-xs font-bold uppercase tracking-wider rounded transition-colors dark:bg-transparent dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        GERENCIAR
                      </button>

                      <span
                        className={`px-3 py-1 rounded text-xs font-bold ${
                          isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                        }`}
                      >
                        {isActive ? 'ATIVO' : 'SUSPENSO'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="w-64 shrink-0 space-y-4">
        <div className="bg-white rounded border border-gray-200 shadow-sm p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-col items-center mb-4">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mb-2">
              <span className="text-white text-xl font-bold">{profileInitials}</span>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400">
              Activo
            </span>
          </div>
          <div className="space-y-1.5 text-sm border-t border-gray-100 pt-4 text-center dark:border-zinc-800">
            <p className="font-bold text-gray-900 dark:text-zinc-100">{profileLabel}</p>
            <p className="text-gray-500 text-xs dark:text-zinc-400">{sessionUser || 'revendedor@email.com'}</p>
          </div>
        </div>

        <div className="bg-white rounded border border-gray-200 shadow-sm p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider dark:text-zinc-400">
                Estado do servidor
              </p>
              {activeDaUsername ? (
                <p className="text-xs text-gray-500 mt-0.5 dark:text-zinc-500">Conta: {activeDaUsername}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void loadServerStatus()}
              disabled={loadingStatus}
              className="p-1.5 text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
              title="Actualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {loadingStatus && !serverStatus ? (
            <div className="py-4 text-center">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mx-auto dark:text-zinc-500" />
            </div>
          ) : serverStatusRows.length > 0 ? (
            <div className="space-y-2">
              {serverStatusRows.map(([key, val]) => (
                <div key={key} className="flex justify-between items-center text-xs gap-2">
                  <span className="text-gray-500 dark:text-zinc-400">
                    {SERVER_STATUS_LABELS[key] || key.replace(/_/g, ' ')}
                  </span>
                  <span className="font-medium text-gray-900 text-right dark:text-zinc-200">{String(val)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              Não foi possível obter o estado do servidor.
            </p>
          )}
        </div>

        <div className="bg-white rounded border border-gray-200 shadow-sm p-5 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 dark:text-zinc-400">Crédito Disponível</p>
          <p className="text-2xl font-bold text-gray-900 mb-3 dark:text-zinc-100">MT 0</p>
          <button
            type="button"
            className="w-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded transition-all"
          >
            Adicionar Fundos
          </button>
        </div>

        <div className="bg-white rounded border border-gray-200 shadow-sm p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 dark:text-zinc-400">
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
                type="button"
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-red-600 rounded transition-colors text-left font-medium dark:text-zinc-300 dark:hover:bg-transparent dark:hover:text-red-400"
              >
                <span className="text-gray-400 dark:text-zinc-500">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filteredSites.length > 0 ? (
          <div className="bg-white rounded border border-gray-200 shadow-sm p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 dark:text-zinc-400">
              Sites ({filteredSites.length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredSites.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      parseState(s.state) === 'Active' ? 'bg-green-500' : 'bg-red-400'
                    }`}
                  />
                  <span className="text-gray-700 truncate font-medium flex-1 dark:text-zinc-300">{s.domain}</span>
                </div>
              ))}
              {filteredSites.length > 5 ? (
                <p className="text-xs text-gray-400 text-center pt-1 dark:text-zinc-500">
                  +{filteredSites.length - 5} mais
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
