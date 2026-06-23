'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { panelBtnPrimary, panelBtnSecondary, panelCard, panelField, panelInnerDetailCard, panelMobileActions, panelMobileCardGrid, panelMobileStack, panelMobileStackCard } from '@/lib/panel-ui'
import { PanelIconTip } from '@/components/panel/PanelIconTip'
import { directAdminAPI } from '@/lib/directadmin-api'
import type {
  DirectAdminWebsite, DirectAdminSubdomain, DirectAdminUser, DirectAdminDatabase,
  DirectAdminFTPAccount, DirectAdminEmail, DirectAdminPHPConfig, DirectAdminPackage
} from '@/lib/directadmin-api'
import { syncUserToSupabase, removeUserFromSupabase, getUsersFromSupabase, syncWebsiteToSupabase, removeWebsiteFromSupabase, markWPInstalledInSupabase, syncPackageToSupabase, removePackageFromSupabase } from '@/lib/supabase-sync'
import {
  clearPanelUsersCache,
  readPanelUsersCache,
  writePanelUsersCache,
  fetchPanelUsers,
  fetchPanelUsersStaleWhileRevalidate,
} from '@/lib/panel-users-cache'
import { readPackagesCache, writePackagesCache, clearPackagesCache } from '@/lib/panel-packages-cache'
import { readBootstrapCache, clearPanelBootstrapCache } from '@/lib/panel-data-from-server'
import {
  readDomainListCache,
  readRegistrarDomainListCache,
  writeDomainListCache,
  writeRegistrarDomainListCache,
  type CachedDomainRow,
} from '@/lib/panel-domain-list-cache'
import { readDnsCache, writeDnsCache } from '@/lib/panel-dns-cache'
import {
  readSslCertCache,
  readSslHostsCache,
  writeSslCertCache,
  writeSslHostsCache,
  type CachedSslCert,
} from '@/lib/panel-ssl-cert-cache'
import { writeSiteSslCache } from '@/lib/site-ssl-cache'
import { supabase } from '@/lib/supabase'
import { cpGetUsers, cpSaveUser, cpRemoveUser, cpSaveSubdomain, cpRemoveSubdomain, cpGetSubdomains, cpSaveDatabase, cpRemoveDatabase, cpGetDatabases, cpSaveFTP, cpRemoveFTP, cpGetFTP, cpSaveEmail, cpRemoveEmail, cpGetEmails } from '@/lib/cp-local-store'
import { EmailWebmailSection } from '@/components/dashboard/EmailWebmailSection'
import { getServerHost, getHestiaUrl, getDirectAdminAccessUrl, getDirectAdminFileManagerUrl, getDirectAdminWordPressUrl, getWebmailUrlForDomain } from '@/lib/server-config'
import { AddEmailAccountModal } from '@/components/AddEmailAccountModal'
import { EmailConfigResultModal, fetchEmailConfigBundle, type EmailConfigBundle } from '@/components/admin/EmailConfigResultModal'
import { prefetchEmailConfigs, writeEmailConfigCache } from '@/lib/panel-email-config-cache'
import { buildEmailConfigBundle } from '@/lib/email-client-config-export'
import { buildPanelAccessConfigText } from '@/lib/panel-access-credentials'
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome'
import { HostingPackageFormInline } from '@/app/dashboard/HostingPackageFormInline'
import { composePackageName, createDefaultResellerPackageForm, normalizePackageFormForEditor, packageListRowToForm, splitCompositePackageName, type ResellerPackageFormState } from '@/lib/reseller-package-form'
import { parseJsonResponse } from '@/lib/safe-fetch-json'
import { VISUALDESIGN_DEFAULT_NS } from '@/lib/visualdesign-dns'
import {
  RefreshCw, Globe, Globe2, PlusCircle, Plus, Package, Trash2, Database, Users, Mail, Lock, LockOpen, Shield, ShieldCheck,
  Server, HardDrive, Key, Settings, Code, AlertCircle, AlertTriangle, CheckCircle, Eye, EyeOff, Zap,
  ExternalLink, Copy, FolderOpen, Layers, Play, Pause, Edit, Edit2, Cloud, RotateCcw, MoreVertical,
  Upload, UploadCloud, Download, Power, Plug, FileText, ArrowRight, ArrowRightLeft, Rocket, Archive, Check, X, Clock, Loader2, Calendar, Search,
  Image as ImageIcon, FileCode, FileArchive, Terminal, FileJson, PlaySquare, FolderPlus, FilePlus
} from 'lucide-react'

function isDaCommandOk(result: unknown): boolean {
  if (result === true) return true
  if (result && typeof result === 'object' && 'success' in result) {
    return (result as { success?: boolean }).success !== false
  }
  return Boolean(result)
}

// ============================================================
// SHARED UTILITIES & SKELETONS
// ============================================================
const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-gray-200 rounded", className)} />
)

const TableSkeleton = ({ columns, rows = 5 }: { columns: number, rows?: number }) => (
  <div className="w-full space-y-4">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-4 px-4 py-4 border-b border-gray-50">
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton key={c} className={cn("h-4", c === 0 ? "w-1/4" : "w-1/6")} />
        ))}
      </div>
    ))}
  </div>
)

const EmailFormSkeleton = () => (
  <div className="p-6 space-y-5">
    {/* Website / Domínio */}
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-10 w-full rounded" />
    </div>
    {/* Email Username */}
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-28" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 rounded" />
        <Skeleton className="h-10 w-24 rounded" />
      </div>
    </div>
    {/* Senha e Confirmar Senha */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-10 w-full rounded" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-full rounded" />
      </div>
    </div>
  </div>
)

const BulkActionBar = ({ count, onAction, onClear, label = "itens selecionados" }: { count: number, onAction: (action: string) => void, onClear: () => void, label?: string }) => {
  if (count === 0) return null
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-gray-900  px-6 py-4 rounded-[10px] shadow-2xl flex items-center gap-6 border border-white/10 ring-1 ring-black">
        <div className="flex items-center gap-3 pr-6 border-r border-white/10">
          <div className="w-6 h-6 bg-red-50 border border-red-300 text-red-600 rounded-full flex items-center justify-center text-[10px] font-bold">{count}</div>
          <span className="text-sm font-medium">{count} {label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onAction('delete')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/20 text-red-400 rounded-[10px] transition-colors text-xs font-bold">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
          <button onClick={() => onAction('suspend')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 text-gray-300 rounded-[10px] transition-colors text-xs font-bold">
            <Pause className="w-3.5 h-3.5" /> Suspender
          </button>
          <button onClick={onClear} className="ml-2 text-xs text-gray-500 hover: transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
const ConfirmModal = ({
  show,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Sim, eliminar",
  cancelText = "Cancelar",
  isDanger = true
}: {
  show: boolean,
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel: () => void,
  confirmText?: string,
  cancelText?: string,
  isDanger?: boolean
}) => {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-white/40 animate-in fade-in duration-200" onClick={onCancel} />
      <div className="relative bg-white border border-gray-200 rounded-[10px] w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-300">
        <div className="px-8 py-10 text-center space-y-4">
          <div className={cn(
            "w-14 h-14 mx-auto rounded-[10px] flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-300",
            isDanger ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
          )}>
            {isDanger ? <AlertCircle className="w-7 h-7" /> : <CheckCircle className="w-7 h-7" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 tracking-tight">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed px-2">{message}</p>
          </div>
        </div>
        <div className="px-6 py-6 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-[10px] transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); onCancel(); }}
            className={cn(
              "px-4 py-2 text-xs font-bold  rounded-[10px] transition-all active:scale-95",
              isDanger ? "bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700" : "bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SUBDOMAINS SECTION
// ============================================================
export function SubdomainsSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [subdomains, setSubdomains] = useState<DirectAdminSubdomain[]>([])
  const [loading, setLoading] = useState(false)
  const [newSub, setNewSub] = useState('')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')

  const loadSubs = async (domain: string) => {
    if (!domain) return
    setMsg('')
    const ls = cpGetSubdomains(domain)
    if (ls.length > 0) setSubdomains(ls)
    else setLoading(true)

    try {
      const data = await directAdminAPI.listSubdomains(domain) as DirectAdminSubdomain[]
      if (data.length > 0) {
        setSubdomains(data)
        data.forEach((s: any) => cpSaveSubdomain(s.domain, s.subdomain?.replace(`.${s.domain}`, '') || s.subdomain, s.path || ''))
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!selectedDomain || !newSub.trim()) return
    setCreating(true); setMsg('')
    try {
      const res = await directAdminAPI.createSubdomain(selectedDomain, newSub.trim()) as { success?: boolean; error?: string }
      const ok = res?.success === true
      if (ok) {
        cpSaveSubdomain(selectedDomain, newSub.trim())
        setMsg('Subdomínio criado com sucesso!')
      } else {
        setMsg('Erro: ' + (res?.error || 'Não foi criado no DirectAdmin'))
      }
      setNewSub('')
      loadSubs(selectedDomain)
    } catch (e: unknown) {
      setMsg('Erro: ' + (e instanceof Error ? e.message : 'Falha ao criar subdomínio'))
    }
    setCreating(false)
  }

  const handleDelete = async (sub: string) => {
    if (!confirm(`Eliminar subdomínio ${sub}?`)) return
    await directAdminAPI.deleteSubdomain(selectedDomain, sub)
    cpRemoveSubdomain(sub)
    loadSubs(selectedDomain)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">

      </div>

      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadSubs(e.target.value) }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
              <option value="">Seleccione um domínio...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Novo Subdomínio</label>
            <div className="flex gap-2">
              <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="blog"
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-[10px] text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              <button onClick={handleCreate} disabled={creating || !selectedDomain || !newSub.trim()}
                className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 hover:text-green-700 px-4 py-2.5 rounded-[10px] text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                Criar
              </button>
            </div>
          </div>
        </div>

        {msg && <div className={`mb-4 px-4 py-2.5 rounded-[10px] text-sm font-medium ${msg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

        {loading && <TableSkeleton columns={4} rows={5} />}
        {!loading && selectedDomain && subdomains.length === 0 ? (
          <div className="py-12 text-center text-gray-400"><Layers className="w-10 h-10 mx-auto mb-2 opacity-50" /><p className="text-sm">Nenhum subdomínio encontrado.</p></div>
        ) : !loading && subdomains.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-bold text-gray-500 uppercase border-b"><th className="px-4 py-3">Subdomínio</th><th className="px-4 py-3">Domínio</th><th className="px-4 py-3">Caminho</th><th className="px-4 py-3 w-20">Ações</th></tr></thead>
            <tbody>
              {subdomains.map((s, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.subdomain}</td>
                  <td className="px-4 py-3 text-gray-600">{s.domain}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.path}</td>
                  <td className="px-4 py-3"><button onClick={() => handleDelete(s.subdomain)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  )
}

export function WebsitePreviewSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [screenshotLoading, setScreenshotLoading] = useState(false)
  const [screenshotError, setScreenshotError] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    if (selectedDomain) {
      loadScreenshot(selectedDomain)
    }
  }, [selectedDomain])

  useEffect(() => {
    if (sites.length > 0 && !selectedDomain) {
      setSelectedDomain(sites[0].domain)
    }
  }, [sites, selectedDomain])

  const loadScreenshot = async (domain: string) => {
    try {
      setScreenshotLoading(true)
      setScreenshotError('')

      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getScreenshot',
          params: { domain }
        })
      })

      if (!res.ok) throw new Error('Falha ao carregar screenshot')

      const data = await res.json()
      if (data.success && data.data?.screenshotUrl) {
        setScreenshotUrl(data.data.screenshotUrl)
        setLastUpdate(new Date())
      } else {
        setScreenshotUrl(`https://image.thum.io/get/width/1200/crop/800/noanimate/https://${domain}`)
        setLastUpdate(new Date())
      }
    } catch (error) {
      setScreenshotError(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`)
      console.error('Screenshot error:', error)
    } finally {
      setScreenshotLoading(false)
    }
  }

  const handleRefresh = () => {
    if (selectedDomain) {
      loadScreenshot(selectedDomain)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
          <RefreshCw size={14} />
          Último check: {lastUpdate ? lastUpdate.toLocaleTimeString('pt-PT') : 'N/A'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-gray-200 rounded-[10px] shadow-sm p-4">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Website
            </label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-[10px] text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-gray-50 transition-all"
            >
              <option value="">Selecione...</option>
              {sites.map((site) => (
                <option key={site.domain} value={site.domain}>
                  {site.domain}
                </option>
              ))}
            </select>

            <button
              onClick={handleRefresh}
              disabled={!selectedDomain || screenshotLoading}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-300 text-red-600 rounded-[10px] hover:bg-red-100 hover:text-red-700 disabled:bg-gray-100 disabled:text-gray-400 transition-all text-sm font-bold shadow-sm"
            >
              <RefreshCw size={16} className={screenshotLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>

          {selectedDomain && (
            <div className="bg-white border border-gray-200 rounded-[10px] shadow-sm p-4">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Ações Rápidas
              </label>
              <a
                href={`https://${selectedDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded transition-colors border border-gray-100"
              >
                <span>Visitar Site</span>
                <ExternalLink size={14} className="text-gray-400" />
              </a>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            {screenshotLoading && (
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50">
                <RefreshCw size={40} className="text-red-600 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Capturando imagem do site...</p>
                <p className="text-xs text-gray-400 mt-1">Isso pode levar alguns segundos</p>
              </div>
            )}

            {screenshotError && !screenshotLoading && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-red-50/30">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle size={32} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Ops! Falha no Preview</h3>
                <p className="text-gray-600 max-w-xs mx-auto mb-6">{screenshotError}</p>
                <button
                  onClick={handleRefresh}
                  className="px-6 py-2 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors font-bold text-sm shadow-sm"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {screenshotUrl && !screenshotLoading && !screenshotError && (
              <div className="p-4 flex-1 bg-gray-100">
                <div className="relative group">
                  <img
                    src={screenshotUrl}
                    alt={`Preview de ${selectedDomain}`}
                    className="w-full rounded border border-gray-300 shadow-xl bg-white"
                    onError={() => setScreenshotError('Não foi possível processar a imagem do servidor thum.io')}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none rounded" />
                </div>
              </div>
            )}

            {!selectedDomain && !screenshotLoading && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50/50">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Eye size={40} className="text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Escolha um Website</h3>
                <p className="text-gray-500 max-w-xs mx-auto">
                  Selecione um dos seus domínios no menu lateral para visualizar o estado visual atual.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type DNSFilterType = 'All' | 'A' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS'

type DNSRecordRow = {
  id: string
  name: string
  type: string
  content: string
  ttl: number
}

type DNSFormState = {
  name: string
  type: string
  value: string
  ttl: string
  priority?: string
}

export function DNSZoneEditorSection({
  sites,
  initialDomain,
  variant = 'default',
  isActive = true,
}: {
  sites: DirectAdminWebsite[]
  initialDomain?: string
  variant?: 'default' | 'central'
  isActive?: boolean
}) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [records, setRecords] = useState<DNSRecordRow[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<DNSFilterType>('All')
  const [search, setSearch] = useState('')
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<DNSFormState | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRecord, setNewRecord] = useState<DNSFormState>({
    name: '',
    type: 'A',
    value: '',
    ttl: '14400',
    priority: '10',
  })
  const [msg, setMsg] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 20
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showActionsDropdown, setShowActionsDropdown] = useState(false)
  const isCentral = variant === 'central'
  const { setChrome } = useAdminSectionChrome()

  const typeColors: Record<string, string> = {
    A: 'bg-blue-100 text-blue-800',
    CNAME: 'bg-green-100 text-green-800',
    MX: 'bg-orange-100 text-orange-800',
    TXT: 'bg-purple-100 text-purple-800',
    SRV: 'bg-pink-100 text-pink-800',
    NS: 'bg-gray-100 text-gray-800',
  }

  const mapApiRecords = (
    list: { id?: string; name?: string; type?: string; content?: string; ttl?: number }[],
  ): DNSRecordRow[] =>
    list.map((r) => ({
      id: String(r.id || `${r.name}-${r.type}-${r.content}`),
      name: String(r.name || ''),
      type: String(r.type || '').toUpperCase(),
      content: String(r.content || ''),
      ttl: Number(r.ttl) || 0,
    }))

  const fetchRecords = async (domain: string, opts?: { background?: boolean }) => {
    if (!domain) return
    const cached = isCentral ? readDnsCache(domain) : []
    if (cached.length > 0) {
      setRecords(cached)
      setPage(1)
    }
    if (!opts?.background && cached.length === 0) setLoading(true)
    else if (opts?.background || cached.length > 0) setRefreshing(true)
    setMsg('')
    setEditingRecordId(null)
    setEditForm(null)
    setSelectedIds([])
    try {
      const res = await fetch(`/api/panel-dns?domain=${encodeURIComponent(domain)}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        const list = Array.isArray(data.records) ? data.records : []
        const mapped = mapApiRecords(list)
        setRecords(mapped)
        if (isCentral) writeDnsCache(domain, mapped)
        setPage(1)
      } else {
        setMsg('Erro ao carregar registos: ' + (data.error || data.message || ''))
      }
    } catch (e: unknown) {
      setMsg('Erro de ligação: ' + (e instanceof Error ? e.message : 'desconhecido'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    if (selectedDomain) return
    if (initialDomain) {
      setSelectedDomain(initialDomain)
      return
    }
    if (sites.length > 0) {
      setSelectedDomain(sites[0].domain)
    }
  }, [sites, selectedDomain, initialDomain])

  useEffect(() => {
    if (!selectedDomain) return
    const cached = isCentral ? readDnsCache(selectedDomain) : []
    void fetchRecords(selectedDomain, { background: cached.length > 0 })
  }, [selectedDomain])

  const handleDomainChange = (domain: string) => {
    setSelectedDomain(domain)
    if (!domain) {
      setRecords([])
      setSelectedIds([])
      setEditingRecordId(null)
      setEditForm(null)
    }
  }

  const handleSyncMirror = () => {
    if (!selectedDomain) return
    void fetchRecords(selectedDomain)
    setSyncing(true)
    void fetch('/api/admin/da-full-sync', { method: 'POST', credentials: 'include' })
      .catch(() => undefined)
      .finally(() => setSyncing(false))
  }

  useEffect(() => {
    if (!isCentral || !isActive) return
    setChrome({
      description: selectedDomain
        ? `Zone records for "${selectedDomain}"`
        : 'Seleccione um domínio para ver os registos',
      toolbar: (
        <button
          type="button"
          onClick={handleSyncMirror}
          disabled={!selectedDomain || syncing}
          className="px-4 py-2 flex items-center justify-center gap-1.5 bg-transparent border border-green-500 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-zinc-800 rounded text-sm font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing || refreshing ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      ),
    })
    return () => setChrome(null)
  }, [isCentral, isActive, selectedDomain, syncing, refreshing, setChrome])

  const handleFilterChange = (next: DNSFilterType) => {
    setFilter(next)
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const parseMxContent = (content: string) => {
    const parts = content.trim().split(/\s+/)
    if (parts.length < 2) return { priority: '', value: content.trim() }
    return {
      priority: parts[0],
      value: parts.slice(1).join(' '),
    }
  }

  const handleCreateRecord = async () => {
    if (!selectedDomain || !newRecord.name || !newRecord.type || !newRecord.value) return
    setLoading(true)
    setMsg('')
    try {
      const ttlNumber = parseInt(newRecord.ttl || '14400', 10) || 14400
      const value =
        newRecord.type === 'MX' && newRecord.priority
          ? `${newRecord.priority} ${newRecord.value}`
          : newRecord.value

      const res = await fetch('/api/panel-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: selectedDomain,
          name: newRecord.name,
          type: newRecord.type,
          value,
          ttl: ttlNumber,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setMsg(json.error || 'Erro ao criar registo DNS.')
      } else {
        setMsg(json.message || 'Registo DNS criado com sucesso.')
        setShowAddForm(false)
        setNewRecord({
          name: '',
          type: 'A',
          value: '',
          ttl: '14400',
          priority: '10',
        })
        void fetchRecords(selectedDomain)
      }
    } catch (e: any) {
      setMsg(e?.message || 'Erro inesperado ao criar registo DNS.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRecord = async (record: DNSRecordRow) => {
    if (!selectedDomain) return
    if (!confirm(`Remover o registo "${record.name}" (${record.type})?`)) return
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/panel-dns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainName: selectedDomain, id: record.id }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setMsg(json.error || 'Erro ao remover registo DNS.')
      } else {
        setMsg(json.message || 'Registo DNS removido com sucesso.')
        void fetchRecords(selectedDomain)
      }
    } catch (e: any) {
      setMsg(e?.message || 'Erro inesperado ao remover registo DNS.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (!selectedDomain || selectedIds.length === 0) return
    if (!confirm(`Remover ${selectedIds.length} registo(s) seleccionado(s)?`)) return
    setLoading(true)
    setMsg('')
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch('/api/panel-dns', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domainName: selectedDomain, id }),
          }),
        ),
      )
      setMsg('Registos seleccionados removidos com sucesso.')
      setSelectedIds([])
      void fetchRecords(selectedDomain)
    } catch (e: any) {
      setMsg(e?.message || 'Erro ao remover registos seleccionados.')
    } finally {
      setLoading(false)
    }
  }

  const startEditRecord = (record: DNSRecordRow) => {
    setEditingRecordId(record.id)
    if (record.type === 'MX') {
      const { priority, value } = parseMxContent(record.content)
      setEditForm({
        name: record.name,
        type: record.type,
        value,
        ttl: String(record.ttl || 14400),
        priority: priority || '10',
      })
    } else {
      setEditForm({
        name: record.name,
        type: record.type,
        value: record.content,
        ttl: String(record.ttl || 14400),
      })
    }
  }

  const cancelEditRecord = () => {
    setEditingRecordId(null)
    setEditForm(null)
  }

  const handleSaveEditRecord = async () => {
    if (!selectedDomain || !editingRecordId || !editForm) return
    if (!editForm.name || !editForm.type || !editForm.value) return
    setLoading(true)
    setMsg('')
    try {
      await fetch('/api/panel-dns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainName: selectedDomain, id: editingRecordId }),
      })

      const ttlNumber = parseInt(editForm.ttl || '14400', 10) || 14400
      const value =
        editForm.type === 'MX' && editForm.priority
          ? `${editForm.priority} ${editForm.value}`
          : editForm.value

      const res = await fetch('/api/panel-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: selectedDomain,
          name: editForm.name,
          type: editForm.type,
          value,
          ttl: ttlNumber,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setMsg(json.error || 'Erro ao guardar alterações no registo.')
      } else {
        setMsg(json.message || 'Registo actualizado com sucesso.')
        setEditingRecordId(null)
        setEditForm(null)
        void fetchRecords(selectedDomain)
      }
    } catch (e: any) {
      setMsg(e?.message || 'Erro inesperado ao actualizar registo DNS.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSelectAllVisible = (checked: boolean, visibleRecords: DNSRecordRow[]) => {
    if (!checked) {
      setSelectedIds(prev => prev.filter(id => !visibleRecords.some(r => r.id === id)))
      return
    }
    const idsToAdd = visibleRecords.map(r => r.id)
    setSelectedIds(prev => Array.from(new Set([...prev, ...idsToAdd])))
  }

  const handleToggleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]))
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id))
    }
  }

  const filters: DNSFilterType[] = ['All', 'A', 'CNAME', 'MX', 'TXT', 'SRV', 'NS']

  const filteredRecords = records.filter(r => {
    if (filter !== 'All' && r.type !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.name.toLowerCase().includes(q) && !r.content.toLowerCase().includes(q)) return false
    }
    return true
  })

  const total = filteredRecords.length
  const totalPages = total === 0 ? 1 : Math.ceil(total / perPage)
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const pageRecords = filteredRecords.slice(startIndex, endIndex)
  const displayFrom = total === 0 ? 0 : startIndex + 1
  const displayTo = total === 0 ? 0 : Math.min(endIndex, total)

  const allVisibleSelected = pageRecords.length > 0 && pageRecords.every(r => selectedIds.includes(r.id))

  const handleSaveAll = () => {
    if (selectedDomain) {
      void fetchRecords(selectedDomain)
    }
  }

  return (
    <div className="w-full space-y-4">
      {!isCentral && (
        <div className="flex flex-col md:flex-row md:items-end md:justify-end gap-4">
          <div className="w-full md:w-64">
            <select
              value={selectedDomain}
              onChange={e => handleDomainChange(e.target.value)}
              className={`${panelField} w-full`}
            >
              <option value="">Seleccione um domínio...</option>
              {sites.map(s => (
                <option key={s.domain} value={s.domain}>
                  {s.domain}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => handleFilterChange(f)}
              className={`px-4 py-2 rounded text-xs font-semibold border transition-colors ${filter === f
                  ? 'border-red-300 bg-red-600/10 text-red-600 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:text-red-400'
                }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {!isCentral && (
            <>
              <input
                type="text"
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Pesquisar por nome ou registo..."
                className={`${panelField} w-full sm:w-72`}
              />
              <button
                type="button"
                onClick={handleSyncMirror}
                disabled={!selectedDomain || syncing}
                className={panelBtnPrimary}
              >
                <RefreshCw className={`w-4 h-4 ${syncing || refreshing ? 'animate-spin' : ''}`} />
                Sincronizar
              </button>
            </>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40"
            >
              {'<<'}
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40"
            >
              {'<'}
            </button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40"
            >
              {'>'}
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40"
            >
              {'>>'}
            </button>
            <span className="ml-2">
              Displaying {displayFrom} to {displayTo} of {total} items
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              disabled={selectedIds.length === 0 || loading}
              onClick={() => setShowActionsDropdown(!showActionsDropdown)}
              className={`${panelBtnSecondary} text-xs font-semibold`}
            >
              Acções
              <span className="text-gray-400 text-[10px]">▼</span>
            </button>
            {showActionsDropdown && selectedIds.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg z-10 dark:border-zinc-700 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowActionsDropdown(false)
                    handleDeleteSelected()
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 first:rounded-t last:rounded-b"
                >
                  Remover ({selectedIds.length})
                </button>
              </div>
            )}
          </div>
          {isCentral && (
            <>
              <select
                value={selectedDomain}
                onChange={e => handleDomainChange(e.target.value)}
                className={`${panelField} min-w-[12rem] text-xs`}
              >
                <option value="">Seleccione um domínio...</option>
                {sites.map(s => (
                  <option key={s.domain} value={s.domain}>
                    {s.domain}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-600 dark:text-zinc-400">
                <span className="font-semibold uppercase tracking-wide">Nameservers:</span>{' '}
                <span className="font-mono">
                  {VISUALDESIGN_DEFAULT_NS.ns1}; {VISUALDESIGN_DEFAULT_NS.ns2}
                </span>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={loading || !selectedDomain}
            className={panelBtnSecondary}
          >
            Save All Records
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            disabled={!selectedDomain}
            className={panelBtnPrimary}
          >
            + Add Record
          </button>
        </div>
      </div>

      {/* FORMULÁRIO ADICIONAR — aparece quando showAddForm=true */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nome</label>
              <input
                type="text"
                value={newRecord.name}
                onChange={e => setNewRecord({ ...newRecord, name: e.target.value })}
                placeholder={`sub.${selectedDomain || 'example.com'}`}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">TTL</label>
              <input
                type="number"
                value={newRecord.ttl}
                onChange={e => setNewRecord({ ...newRecord, ttl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Tipo</label>
              <select
                value={newRecord.type}
                onChange={e =>
                  setNewRecord({
                    ...newRecord,
                    type: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="A">A</option>
                <option value="CNAME">CNAME</option>
                <option value="MX">MX</option>
                <option value="TXT">TXT</option>
                <option value="SRV">SRV</option>
                <option value="NS">NS</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">
                {newRecord.type === 'MX' ? 'Prioridade' : '—'}
              </label>
              {newRecord.type === 'MX' ? (
                <input
                  type="number"
                  value={newRecord.priority}
                  onChange={e => setNewRecord({ ...newRecord, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              ) : (
                <div className="text-xs text-gray-400 mt-2">MX only</div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Valor / Registo</label>
            <input
              type="text"
              value={newRecord.value}
              onChange={e => setNewRecord({ ...newRecord, value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder={
                newRecord.type === 'A'
                  ? '192.0.2.1'
                  : newRecord.type === 'CNAME' || newRecord.type === 'MX'
                    ? 'mail.example.com'
                    : 'Valor do registo'
              }
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded border border-gray-300 text-xs font-semibold text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading || !selectedDomain}
              onClick={handleCreateRecord}
              className="px-4 py-2 rounded bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 text-xs font-semibold disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      <div className={`rounded border border-gray-200 bg-white overflow-hidden dark:border-zinc-700 dark:bg-zinc-900 ${refreshing ? 'opacity-80' : ''}`}>
        {loading && records.length === 0 ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : !selectedDomain ? (
          <div className="py-12 text-center text-gray-400 text-sm">Selecione um domínio para ver os registos.</div>
        ) : pageRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Nenhum registo encontrado para este filtro.</div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {pageRecords.map((record) => {
                const displayContent =
                  record.type === 'MX'
                    ? (() => {
                      const { priority, value } = parseMxContent(record.content)
                      return `Prioridade: ${priority || '-'} / Destino: ${value || '-'}`
                    })()
                    : record.content
                return (
                  <article
                    key={record.id}
                    className={`${panelInnerDetailCard} space-y-2 bg-white dark:bg-zinc-900`}
                  >
                    <div className="flex items-center justify-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(record.id)}
                        onChange={(e) => handleToggleSelectOne(record.id, e.target.checked)}
                      />
                      <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">{record.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-start gap-2 text-xs">
                      <span className="text-gray-500">TTL: {record.ttl || 0}</span>
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${typeColors[record.type] || 'bg-gray-200 text-gray-800'}`}
                      >
                        {record.type}
                      </span>
                    </div>
                    <p className="break-all text-sm text-gray-700 dark:text-zinc-300">{displayContent}</p>
                    <div className="flex flex-wrap items-center justify-start gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startEditRecord(record)}
                        className="inline-flex items-center gap-1 rounded border border-blue-500 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        <Edit className="w-3 h-3" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(record)}
                        className="inline-flex items-center gap-1 rounded border border-red-500 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" /> Remover
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-gray-600 uppercase border-b bg-gray-100">
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={e => handleToggleSelectAllVisible(e.target.checked, pageRecords)}
                      />
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap pr-6">Nome</th>
                    <th className="px-3 py-3 w-20 text-center pl-3">TTL</th>
                    <th className="px-3 py-3 w-24 text-center">Tipo</th>
                    <th className="px-3 py-3 flex-1">Registo</th>
                    <th className="px-3 py-3 w-32 text-center">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map(record => {
                    const isEditing = editingRecordId === record.id
                    const displayContent =
                      record.type === 'MX'
                        ? (() => {
                          const { priority, value } = parseMxContent(record.content)
                          return `Prioridade: ${priority || '-'} / Destino: ${value || '-'}`
                        })()
                        : record.content
                    return (
                      <React.Fragment key={record.id}>
                        <tr className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-3 align-middle">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(record.id)}
                              onChange={e => handleToggleSelectOne(record.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-3 align-middle whitespace-nowrap pr-6">
                            <div className="text-gray-900">{record.name}</div>
                          </td>
                          <td className="px-3 py-3 align-middle text-gray-600 text-center pl-3">{record.ttl || 0}</td>
                          <td className="px-3 py-3 align-middle text-center">
                            <span
                              className={`inline-block px-3 py-1 rounded text-xs font-semibold ${typeColors[record.type] || 'bg-gray-200 text-gray-800'
                                }`}
                            >
                              {record.type}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-middle text-gray-700 break-all text-sm">{displayContent}</td>
                          <td className="px-3 py-3 align-middle">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditRecord(record)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-500 text-blue-600 hover:bg-blue-50 rounded text-xs font-medium transition-colors"
                              >
                                <Edit className="w-3 h-3" /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(record)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-500 text-red-600 hover:bg-red-50 rounded text-xs font-medium transition-colors"
                              >
                                <Trash2 className="w-3 h-3" /> Remover
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isEditing && editForm && (
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <td />
                            <td colSpan={5} className="px-4 py-4">
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                  <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nome</label>
                                    <input
                                      type="text"
                                      value={editForm.name}
                                      onChange={e => setEditForm({ ...(editForm || newRecord), name: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">TTL</label>
                                    <input
                                      type="number"
                                      value={editForm.ttl}
                                      onChange={e => setEditForm({ ...(editForm || newRecord), ttl: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Tipo</label>
                                    <select
                                      value={editForm.type}
                                      onChange={e =>
                                        setEditForm({
                                          ...(editForm || newRecord),
                                          type: e.target.value,
                                        })
                                      }
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    >
                                      <option value="A">A</option>
                                      <option value="CNAME">CNAME</option>
                                      <option value="MX">MX</option>
                                      <option value="TXT">TXT</option>
                                      <option value="SRV">SRV</option>
                                      <option value="NS">NS</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">
                                      {editForm.type === 'MX' ? 'Prioridade' : '—'}
                                    </label>
                                    {editForm.type === 'MX' ? (
                                      <input
                                        type="number"
                                        value={editForm.priority || ''}
                                        onChange={e =>
                                          setEditForm({
                                            ...(editForm || newRecord),
                                            priority: e.target.value,
                                          })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                      />
                                    ) : (
                                      <div className="text-xs text-gray-400 mt-2">MX only</div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">
                                    Valor / Registo
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.value}
                                    onChange={e => setEditForm({ ...(editForm || newRecord), value: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelEditRecord}
                                    className="px-4 py-2 rounded border border-gray-300 text-xs font-semibold text-gray-700"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={loading}
                                    onClick={handleSaveEditRecord}
                                    className="px-4 py-2 rounded bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 text-xs font-semibold disabled:opacity-50"
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {msg && (
        <div
          className={`px-4 py-2.5 rounded text-sm font-medium ${msg.toLowerCase().includes('erro')
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
            }`}
        >
          {msg}
        </div>
      )}
    </div>
  )
}


// ============================================================
// DATABASES SECTION
// ============================================================
export function DatabasesSection({ sites, initialDomain }: { sites: DirectAdminWebsite[]; initialDomain?: string }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [databases, setDatabases] = useState<DirectAdminDatabase[]>([])
  const [loading, setLoading] = useState(false)
  const [dbName, setDbName] = useState('')
  const [dbUser, setDbUser] = useState('')
  const [dbPass, setDbPass] = useState('')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [lastCreated, setLastCreated] = useState<{ dbName: string; dbUser: string; dbPass: string } | null>(null)

  useEffect(() => {
    if (initialDomain) {
      setSelectedDomain(initialDomain)
      loadDBs(initialDomain)
    }
  }, [initialDomain])

  const loadDBs = async (domain: string) => {
    if (!domain) return
    const ls = cpGetDatabases(domain)
    if (ls.length > 0) setDatabases(ls)
    else setLoading(true)

    try {
      const data = await directAdminAPI.listDatabases(domain)
      if (data.length > 0) {
        setDatabases(data)
        data.forEach((d: any) => cpSaveDatabase(domain, d.dbName, d.dbUser))
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!selectedDomain || !dbName || !dbUser || !dbPass) return
    setCreating(true); setMsg('')
    try {
      const ok = await directAdminAPI.createDatabase({ domain: selectedDomain, dbName, dbUser, dbPassword: dbPass })
      if (isDaCommandOk(ok)) {
        cpSaveDatabase(selectedDomain, dbName, dbUser)
        setLastCreated({ dbName, dbUser, dbPass })
        setMsg('Base de dados criada com sucesso!')
        setDbName(''); setDbUser(''); setDbPass('')
        loadDBs(selectedDomain)
      } else {
        setMsg('Erro ao criar base de dados no servidor.')
      }
    } catch (e: any) {
      setMsg('Erro: ' + e.message)
    }
    setCreating(false)
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Eliminar base de dados ${name}?`)) return
    try {
      const ok = await directAdminAPI.deleteDatabase({ dbName: name })
      if (isDaCommandOk(ok)) {
        cpRemoveDatabase(selectedDomain, name)
        loadDBs(selectedDomain)
      } else {
        alert('Erro ao eliminar base de dados.')
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
  }

  return (
    <div className="space-y-6">

      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadDBs(e.target.value) }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
              <option value="">Seleccione...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nome da BD</label>
            <input value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="minha_bd" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Utilizador BD</label>
            <input value={dbUser} onChange={(e) => setDbUser(e.target.value)} placeholder="db_user" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Senha BD</label>
            <input type="password" value={dbPass} onChange={(e) => setDbPass(e.target.value)} placeholder="••••••" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
        </div>
        <button onClick={handleCreate} disabled={creating || !selectedDomain || !dbName || !dbUser || !dbPass}
          className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} Criar Base de Dados
        </button>

        {msg && <div className={`mt-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('criada') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

        {lastCreated && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded text-sm">
            <p className="font-bold text-blue-800 mb-2">Credenciais da Base de Dados Criada:</p>
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div><span className="text-blue-600 font-bold">BD:</span> {lastCreated.dbName}</div>
              <div><span className="text-blue-600 font-bold">User:</span> {lastCreated.dbUser}</div>
              <div><span className="text-blue-600 font-bold">Pass:</span> {lastCreated.dbPass}</div>
            </div>
            <div className="mt-2 flex gap-2">
              <a href={`${getHestiaUrl()}/phpmyadmin/`} target="_blank" rel="noopener noreferrer" className="text-xs bg-orange-50 border border-orange-300 text-orange-600 hover:bg-orange-50 border border-orange-300 text-orange-600  px-3 py-1.5 rounded font-bold">Abrir phpMyAdmin</a>
              <button onClick={() => setLastCreated(null)} className="text-xs text-blue-600 hover:underline">Fechar</button>
            </div>
          </div>
        )}

        {loading && <TableSkeleton columns={3} rows={5} />}
        {!loading && databases.length > 0 && (
          <table className="w-full text-sm mt-6">
            <thead><tr className="text-left text-xs font-bold text-gray-500 uppercase border-b"><th className="px-4 py-3">Base de Dados</th><th className="px-4 py-3">Utilizador</th><th className="px-4 py-3 w-32">Ações</th></tr></thead>
            <tbody>
              {databases.map((db, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium font-mono text-sm">{db.dbName}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-sm">{db.dbUser}</td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <a href={`${getHestiaUrl()}/phpmyadmin/`} target="_blank" rel="noopener noreferrer" className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded font-medium">phpMyAdmin</a>
                    <button onClick={() => handleDelete(db.dbName)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ============================================================
// FTP SECTION
// ============================================================
export function FTPSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [accounts, setAccounts] = useState<DirectAdminFTPAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [ftpUser, setFtpUser] = useState('')
  const [ftpPass, setFtpPass] = useState('')
  const [ftpPath, setFtpPath] = useState('/')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')

  const loadFTP = async (domain: string) => {
    if (!domain) return
    const ls = cpGetFTP(domain)
    if (ls.length > 0) setAccounts(ls)
    else setLoading(true)

    try {
      const data = await directAdminAPI.listFTPAccounts(domain)
      if (data.length > 0) {
        setAccounts(data)
        data.forEach((a: any) => cpSaveFTP(domain, a.userName, a.path || ''))
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!selectedDomain || !ftpUser || !ftpPass) return
    setCreating(true); setMsg('')
    try {
      const ok = await directAdminAPI.createFTPAccount({ domain: selectedDomain, username: ftpUser, password: ftpPass, path: ftpPath })
      if (isDaCommandOk(ok)) {
        cpSaveFTP(selectedDomain, ftpUser, ftpPath)
        setMsg('Conta FTP criada com sucesso!')
        setFtpUser(''); setFtpPass(''); setFtpPath('/')
        loadFTP(selectedDomain)
      } else {
        setMsg('Erro ao criar conta FTP no servidor.')
      }
    } catch (e: any) {
      setMsg('Erro: ' + e.message)
    }
    setCreating(false)
  }

  const handleDelete = async (user: string) => {
    if (!confirm(`Eliminar conta FTP ${user}?`)) return
    try {
      const ok = await directAdminAPI.deleteFTPAccount({ username: user })
      if (isDaCommandOk(ok)) {
        cpRemoveFTP(selectedDomain, user)
        loadFTP(selectedDomain)
      } else {
        alert('Erro ao eliminar conta FTP.')
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
  }

  return (
    <div className="space-y-6">

      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadFTP(e.target.value) }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
              <option value="">Seleccione...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Utilizador FTP</label>
            <input value={ftpUser} onChange={(e) => setFtpUser(e.target.value)} placeholder="ftp_user" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Senha</label>
            <input type="password" value={ftpPass} onChange={(e) => setFtpPass(e.target.value)} placeholder="••••••" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Caminho</label>
            <input value={ftpPath} onChange={(e) => setFtpPath(e.target.value)} placeholder="/" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
        </div>
        <button onClick={handleCreate} disabled={creating || !selectedDomain || !ftpUser || !ftpPass}
          className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />} Criar Conta FTP
        </button>

        {msg && <div className={`mt-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('criada') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

        {loading && <TableSkeleton columns={3} rows={5} />}
        {!loading && accounts.length > 0 && (
          <table className="w-full text-sm mt-6">
            <thead><tr className="text-left text-xs font-bold text-gray-500 uppercase border-b"><th className="px-4 py-3">Utilizador</th><th className="px-4 py-3">Caminho</th><th className="px-4 py-3 w-20">Ações</th></tr></thead>
            <tbody>
              {accounts.map((a, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{a.userName}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.path}</td>
                  <td className="px-4 py-3"><button onClick={() => handleDelete(a.userName || a.username || "")} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ============================================================
// EMAIL MANAGEMENT SECTION (Extended)
// ============================================================
export function EmailManagementSection({
  sites,
  preSelectedDomain,
  isActive = true,
}: {
  sites: DirectAdminWebsite[]
  preSelectedDomain?: string
  isActive?: boolean
}) {
  const [selectedDomain, setSelectedDomain] = useState(preSelectedDomain || '__ALL__')
  const [emails, setEmails] = useState<DirectAdminEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Modal Único para Criação/Edição de E-mail
  const [emailModal, setEmailModal] = useState<{ show: boolean, mode: 'create' | 'edit', data: any }>({
    show: false,
    mode: 'create',
    data: { user: '', password: '', confirmPassword: '', quota_mb: 500, status: 'active', cliente_id: '' }
  })
  const [showEmailPass, setShowEmailPass] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [changingPass, setChangingPass] = useState<string | null>(null)
  const [mostrarAdicionarConta, setMostrarAdicionarConta] = useState(false)
  const [modalAdicionarPasso, setModalAdicionarPasso] = useState<'escolher' | 'webmail' | 'google' | 'hotmail'>('escolher')
  const [emailConfigModal, setEmailConfigModal] = useState<EmailConfigBundle | null>(null)
  const [emailRowMenu, setEmailRowMenu] = useState<{ email: string; rect: DOMRect } | null>(null)
  const [confirm, setConfirm] = useState<{ show: boolean, title: string, message: string, onConfirm: () => void, isDanger?: boolean }>({
    show: false, title: '', message: '', onConfirm: () => { }
  })

  // Carregar clientes para o dropdown de proprietário
  useEffect(() => {
    const fetchClientes = async () => {
      setLoadingClientes(true)
      try {
        const { data, error } = await supabase.from('clientes').select('id, nome, email')
        if (!error) setClientes(data || [])
      } catch (e) { console.error(e) }
      setLoadingClientes(false)
    }
    fetchClientes()
  }, [])

  const openEmailConfigModal = async (emailAddress: string, passwordHint?: string) => {
    try {
      if (passwordHint) {
        const bundle = buildEmailConfigBundle(emailAddress, passwordHint)
        writeEmailConfigCache(emailAddress, {
          email: emailAddress,
          password: passwordHint,
          ...bundle,
        })
        setEmailConfigModal({
          email: emailAddress,
          password: passwordHint,
          ...bundle,
        })
        return
      }
      const cached = (await import('@/lib/panel-email-config-cache')).readEmailConfigCache(emailAddress)
      if (cached?.plainText) {
        setEmailConfigModal(cached)
        return
      }
      const bundle = await fetchEmailConfigBundle(emailAddress)
      setEmailConfigModal(bundle)
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro ao obter configurações.')
      setMsgType('error')
    }
  }

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const loadEmails = async (domain: string) => {
    if (!domain) return
    const ls = cpGetEmails(domain)
    if (ls.length > 0) setEmails(ls.map((e: any) => ({ email: e.email || `${e.user}@${domain}`, user: e.user, domain, quota_mb: e.quota_mb || 500, usage: e.usage || '0', status: 'active' })))
    else setLoading(true)

    try {
      // 1. Carregar do DirectAdmin
      const daEmails = await directAdminAPI.listEmails(domain).catch(() => [])
      const cpEmails = daEmails.length > 0 ? daEmails : cpGetEmails(domain)

      // 2. Carregar metadados do Supabase
      const { data: sbData } = await supabase.from('email_contas').select('*').eq('id', 'dummy') // bypass RLS via API

      // 3. Cruzar dados
      const merged: DirectAdminEmail[] = cpEmails.map((cpE: any) => {
        const emailStr = cpE.email || `${cpE.user}@${domain}`
        const sbE = sbData?.find((s: any) => s.email === emailStr)
        return {
          email: emailStr,
          user: cpE.user || emailStr.split('@')[0],
          domain: domain,
          quota_mb: cpE.quota_mb || (sbE?.quota_mb) || 500,
          usage: cpE.usage || '0',
          status: sbE ? sbE.status : 'active',
          cliente_id: sbE ? sbE.cliente_id : null
        }
      })

      setEmails(merged)
      merged.forEach((e: any) => cpSaveEmail(domain, e.user, { quota_mb: e.quota_mb }))
      prefetchEmailConfigs(merged.map((e) => e.email).filter(Boolean))

    } catch (err) {
      console.error('Erro na sincronização:', err)
    }
    setLoading(false)
  }

  // Carregar todos os emails de todos os sites
  const loadAllEmails = async () => {
    if (sites.length === 0) return
    setLoading(true)
    setEmails([])

    try {
      let allEmails: any[] = []

      for (const site of sites) {
        try {
          const daEmails = await directAdminAPI.listEmails(site.domain).catch(() => [])
          if (daEmails.length > 0) {
            const siteEmails = daEmails.map((cpE: any) => ({
              email: cpE.email || `${cpE.user}@${site.domain}`,
              user: cpE.user || cpE.email?.split('@')[0],
              domain: site.domain,
              quota_mb: cpE.quota_mb || 500,
              usage: cpE.usage || '0',
              status: 'active'
            }))
            allEmails = [...allEmails, ...siteEmails]
          }
        } catch (e) {
          console.error(`Erro ao carregar emails de ${site.domain}:`, e)
        }
      }

      setEmails(allEmails)
      prefetchEmailConfigs(allEmails.map((e) => e.email).filter(Boolean))
    } catch (err) {
      console.error('Erro ao carregar todos os emails:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!preSelectedDomain) return
    loadEmails(preSelectedDomain)
  }, [preSelectedDomain])

  useEffect(() => {
    if (!isActive) return
    if (selectedDomain === '__ALL__') loadAllEmails()
    else if (selectedDomain) loadEmails(selectedDomain)
  }, [isActive, selectedDomain, sites])

  const [isSyncingGlobal, setIsSyncingGlobal] = useState(false)

  const handleSyncGlobal = async () => {
    setIsSyncingGlobal(true)
    setMsg('A sincronizar contas com o servidor DirectAdmin...')
    setMsgType('success')
    try {
      const res = await fetch('/api/admin/sync-directadmin-users', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setMsg(`Sincronização concluída: ${data.results.emailsFound} emails encontrados, ${data.results.usersCreated} novos utilizadores Auth.`)
        setMsgType('success')
        if (selectedDomain === '__ALL__') loadAllEmails()
        else loadEmails(selectedDomain)
      } else {
        setMsg('Erro na sincronização: ' + data.error)
        setMsgType('error')
      }
    } catch (e: any) {
      setMsg('Erro de ligação: ' + e.message)
      setMsgType('error')
    }
    setIsSyncingGlobal(false)
  }

  const handleCreateEmail = async (data: any) => {
    if (data.password !== data.confirmPassword) {
      setMsg('As senhas não coincidem!'); setMsgType('error')
      return
    }
    if (selectedDomain === '__ALL__' || !selectedDomain || !data.user || !data.password) {
      setMsg('Selecione um domínio específico para criar o e-mail.'); setMsgType('error')
      return
    }
    setCreating(true); setMsg('')
    try {
      const resData = await directAdminAPI.createEmail({
        domain: selectedDomain,
        userName: data.user,
        password: data.password,
        quota: data.quota_mb || 500
      })
      if (resData?.success !== false) {
        const emailCompleto = `${data.user}@${selectedDomain}`
        cpSaveEmail(selectedDomain, data.user, { quota_mb: data.quota_mb || 500 })
        await fetch('/api/email-contas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailCompleto,
            password: data.password,
            nome: data.user,
            tipo: 'webmail',
            cliente_id: data.cliente_id || null
          })
        })

        setEmailModal({ ...emailModal, show: false })
        loadEmails(selectedDomain)
        const bundle = buildEmailConfigBundle(emailCompleto, data.password, data.quota_mb || 500)
        writeEmailConfigCache(emailCompleto, {
          email: emailCompleto,
          password: data.password,
          ...bundle,
        })
        setEmailConfigModal({
          email: emailCompleto,
          password: data.password,
          ...bundle,
        })
        setMsg('E-mail criado com sucesso! Configurações enviadas para a caixa de correio.')
        setMsgType('success')
      } else {
        setMsg('Erro: ' + (resData.error || 'Falha no servidor.')); setMsgType('error')
      }
    } catch (e: any) { setMsg('Erro: ' + e.message); setMsgType('error') }
    setCreating(false)
  }

  const handleUpdateEmail = async (data: any) => {
    if (data.password && data.password !== data.confirmPassword) {
      setMsg('As senhas não coincidem!'); setMsgType('error')
      return
    }
    setLoading(true); setMsg('')
    try {
      // 1. Password no DirectAdmin
      if (data.password) {
        await directAdminAPI.changeEmailPassword({ email: data.email, password: data.password })
      }
      // 2. Metadados e credenciais SMTP no Supabase
      // Usar API para bypass de RLS
      const updateRes = await fetch('/api/email-contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password || 'dummy',
          nome: data.email.split('@')[0],
          tipo: 'webmail',
          cliente_id: data.cliente_id || null
        })
      })
      const updateData = await updateRes.json()
      if (!updateData.success) throw new Error(updateData.error || 'Erro ao atualizar')

      setMsg('Configurações guardadas.'); setMsgType('success')
      setEmailModal({ ...emailModal, show: false })
      loadEmails(selectedDomain)
      if (data.password) {
        const bundle = buildEmailConfigBundle(data.email, data.password)
        setEmailConfigModal({ email: data.email, password: data.password, ...bundle })
      }
    } catch (e: any) {
      setMsg('Erro: ' + e.message); setMsgType('error')
    }
  }

  const handleDelete = async (email: string) => {
    setConfirm({
      show: true,
      title: 'Eliminar Conta',
      message: `Tens a certeza que desejas eliminar a conta ${email}? Esta ação não pode ser desfeita.`,
      isDanger: true,
      onConfirm: async () => {
        setDeleting(email)
        try {
          const [user, domain] = email.split('@')
          const data = await directAdminAPI.deleteEmail({ email, userName: user, domain })
          if (data?.success !== false) {
            await fetch(`/api/email-contas?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
            setMsg('Conta eliminada com sucesso.')
            setMsgType('success')
            loadEmails(selectedDomain)
          } else {
            setMsg('Erro: ' + (data?.error || 'Falha no servidor.'))
            setMsgType('error')
          }
        } catch (e: any) {
          setMsg('Erro: ' + e.message)
          setMsgType('error')
        }
        setDeleting(null)
      }
    })
  }

  const handleBulkAction = async (action: string) => {
    if (selected.length === 0) return
    const count = selected.length

    if (action === 'delete') {
      setConfirm({
        show: true,
        title: `Eliminar ${count} Contas`,
        message: `Estás prestes a eliminar permanentemente ${count} contas selecionadas. Desejas continuar?`,
        isDanger: true,
        onConfirm: async () => {
          setLoading(true)
          for (const email of selected) {
            setMsg(`A eliminar ${email}...`)
            try {
              const [user, domain] = email.split('@')
              const data = await directAdminAPI.deleteEmail({ email, userName: user, domain })
              if (data?.success !== false) {
                await fetch(`/api/email-contas?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
              }
            } catch (e) { console.error(`Erro ao eliminar ${email}:`, e) }
          }
          setMsg(`${count} contas processadas.`)
          setMsgType('success')
          setSelected([])
          loadEmails(selectedDomain)
          setLoading(false)
        }
      })
    } else if (action === 'suspend') {
      setConfirm({
        show: true,
        title: `Suspender ${count} Contas`,
        message: `Desejas suspender o acesso de ${count} contas selecionadas?`,
        isDanger: false,
        onConfirm: async () => {
          setLoading(true)
          for (const email of selected) {
            await directAdminAPI.suspendEmail(email)
            // Status update via API - RLS bypassed
          }
          setMsg(`${count} contas suspensas.`)
          setMsgType('success')
          setSelected([])
          loadEmails(selectedDomain)
          setLoading(false)
        }
      })
    }
  }

  const handleUpdateAccount = async (formData: any) => {
    setLoading(true)
    try {
      // 1. Atualizar DirectAdmin se houver nova password
      if (formData.password) {
        await directAdminAPI.changeEmailPassword({ email: formData.email, password: formData.password })
      }

      // 2. Atualizar suspensão no DirectAdmin quando suportado
      if (formData.status === 'active') {
        await directAdminAPI.unsuspendEmail(formData.email)
      } else {
        await directAdminAPI.suspendEmail(formData.email)
      }

      // 3. Atualizar Supabase (Mestre da verdade para Proprietário e Estado)
      const updateRes = await fetch('/api/email-contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password || 'dummy',
          nome: formData.email.split('@')[0],
          tipo: 'webmail',
          cliente_id: formData.cliente_id || null
        })
      })
      const updateData = await updateRes.json()
      if (!updateData.success) throw new Error(updateData.error || 'Erro ao atualizar')

      setMsg('Conta atualizada com sucesso.')
      setMsgType('success')
      setEmailModal({ show: false, mode: 'create', data: {} })
      loadEmails(selectedDomain)
    } catch (e: any) {
      setMsg('Erro ao atualizar: ' + e.message)
      setMsgType('error')
    }
    setLoading(false)
  }

  const [showEditPass, setShowEditPass] = useState(false)


  const handleChangePass = async (email: string) => {
    if (!newPass) return
    const ok = await directAdminAPI.changeEmailPassword({ email, password: newPass })
    if (ok) {
      setMsg('Senha alterada com sucesso!')
      setMsgType('success')
      setChangingPass(null)
      setNewPass('')
    } else {
      setMsg('Erro ao alterar senha.')
      setMsgType('error')
    }
  }

  const toggleSelect = (email: string) => {
    setSelected(prev => prev.includes(email) ? prev.filter(x => x !== email) : [...prev, email])
  }

  const filtered = emails.filter(e =>
    (e.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const getStoragePct = (usage: string, quota: string) => {
    const u = parseFloat(usage) || 0
    const q = parseFloat(quota) || 500
    return Math.min((u / q) * 100, 100)
  }

  const getStorageColor = (pct: number) => {
    if (pct > 80) return '#ef4444'
    if (pct > 50) return '#f59e0b'
    return '#22c55e'
  }

  const { setChrome } = useAdminSectionChrome()
  useEffect(() => {
    if (!isActive) return
    setChrome({
      toolbar: (
        <div className="flex items-center gap-2 text-sm text-gray-600 rounded border border-gray-200 bg-white px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <span className="font-semibold text-gray-900 dark:text-zinc-100">∞</span> Disponíveis
          <span className="mx-1 text-gray-400">|</span>
          <span className="font-semibold text-gray-900 dark:text-zinc-100">{emails.length}</span> Usadas
        </div>
      ),
    })
    return () => setChrome(null)
  }, [isActive, emails.length, setChrome])

  return (
    <div className="text-gray-900">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <select
          value={selectedDomain}
          onChange={e => {
            const domain = e.target.value
            setSelectedDomain(domain)
            if (domain === '__ALL__') loadAllEmails()
            else loadEmails(domain)
          }}
          className="min-w-[18rem] shrink-0 rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 sm:min-w-[22rem]"
        >
          <option value="__ALL__">Todos os domínios</option>
          {sites.length > 0
            ? sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)
            : <option value="example.com">example.com</option>
          }
        </select>
        <div className="flex-1">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar contas..."
            className="w-full bg-white border border-gray-300 rounded px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEmailModal({
              show: true,
              mode: 'create',
              data: { user: '', password: '', quota_mb: 500, status: 'active', cliente_id: '' }
            })}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-300 text-red-600  rounded text-sm font-bold hover:bg-red-100 hover:text-red-700 transition-all "
          >
            <Plus className="w-4 h-4" /> Criar E-mail
          </button>
          <button
            onClick={() => { setMostrarAdicionarConta(true); setModalAdicionarPasso('escolher') }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-300 text-blue-600  rounded text-sm font-bold hover:bg-blue-100 hover:text-blue-700 transition-all "
          >
            <Plus className="w-4 h-4" /> Sincronizar Conta
          </button>
        </div>
      </div>

      {/* Mensagem de feedback */}
      {msg && (
        <div className={`flex items-center gap-2 text-xs px-4 py-3 rounded mb-4 border font-medium ${msgType === 'success'
          ? 'text-green-700 bg-green-50 border-green-200'
          : 'text-red-700 bg-red-50 border-red-200'
          }`}>
          <span>{msgType === 'success' ? '✓' : '⚠'}</span> {msg}
        </div>
      )}

      {/* Modal de Adicionar Conta - Componente Reutilizável */}
      <AddEmailAccountModal
        isOpen={mostrarAdicionarConta}
        onClose={() => {
          setMostrarAdicionarConta(false)
          setModalAdicionarPasso('escolher')
        }}
        onAccountAdded={(account) => {
          // Recarregar lista de emails
          loadEmails(selectedDomain)
        }}
      />

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="grid grid-cols-[40px_1fr_120px_180px_auto] gap-4 border-b border-gray-200 bg-gray-50/50 px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-500">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selected.length === emails.length && emails.length > 0}
              onChange={() => setSelected(selected.length === emails.length ? [] : emails.map(e => e.email))}
              className="w-4 h-4 accent-red-600 cursor-pointer"
            />
          </div>
          <div>Conta</div>
          <div>Estado</div>
          <div>Armazenamento</div>
          <div className="text-right">Ações</div>
        </div>

        {/* Loading Skeleton */}
        {loading && <TableSkeleton columns={5} rows={8} />}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">
            {selectedDomain && selectedDomain !== '__ALL__' ? 'Nenhuma conta encontrada neste domínio.' : 'Nenhuma conta de e-mail encontrada.'}
          </div>
        )}

        {/* Rows */}
        {!loading && filtered.map(email => {
          const pct = getStoragePct(email.usage || '0', String(email.quota_mb || 500))
          const color = getStorageColor(pct)
          const emailStr = email.email || ''

          return (
            <div key={emailStr} className={`grid grid-cols-[40px_1fr_120px_180px_auto] gap-4 border-b border-gray-50 px-4 py-1.5 transition-all hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40 ${selected.includes(emailStr) ? 'bg-red-50/30 dark:bg-red-950/20' : ''}`}>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selected.includes(emailStr)}
                  onChange={() => toggleSelect(emailStr)}
                  className="w-4 h-4 accent-red-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-200">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{emailStr}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">Quota: {email.quota_mb}MB</p>
                </div>
              </div>

              <div className="flex items-center">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${email.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {email.status === 'active' ? 'Ativo' : 'Suspenso'}
                </span>
              </div>

              <div className="flex items-center">
                <div className="flex flex-col gap-1 w-full max-w-[140px]">
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                    <span>{email.usage || '0'} MB</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              </div>

              <div className="relative flex items-center justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    if (emailRowMenu?.email === emailStr) setEmailRowMenu(null)
                    else setEmailRowMenu({ email: emailStr, rect })
                  }}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-transparent dark:hover:text-red-400"
                  aria-label="Mais opções"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {emailRowMenu && (
        <EmailRowActionsMenu
          anchorRect={emailRowMenu.rect}
          onClose={() => setEmailRowMenu(null)}
          onAction={(action) => {
            const row = filtered.find((e) => (e.email || '') === emailRowMenu.email)
            if (action === 'webmail') {
              window.open(getWebmailUrlForDomain(row?.domain || selectedDomain), '_blank', 'noopener,noreferrer')
            } else if (action === 'edit' && row) {
              setEmailModal({ show: true, mode: 'edit', data: { ...row, password: '' } })
            } else if (action === 'download') {
              void openEmailConfigModal(emailRowMenu.email)
            } else if (action === 'delete') {
              void handleDelete(emailRowMenu.email)
            }
          }}
        />
      )}

      <EmailConfigResultModal
        open={Boolean(emailConfigModal)}
        config={emailConfigModal}
        onClose={() => setEmailConfigModal(null)}
      />

      {/* Modal de E-mail (Unified) */}
      {emailModal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEmailModal({ ...emailModal, show: false })} />
          <div className="relative bg-white border border-gray-200 rounded-lg w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 border border-red-300 text-red-600 rounded flex items-center justify-center "><Mail className="w-5 h-5 " /></div>
                <div><h2 className="text-sm font-bold text-gray-900 dark:text-white block">{emailModal.mode === 'create' ? 'Novo E-mail' : 'Editar E-mail'}</h2><span className="text-[11px] text-gray-500 font-mono">{emailModal.mode === 'create' ? `No domínio: ${selectedDomain}` : `Gerir: ${emailModal.data.email}`}</span></div>
              </div>
              <button onClick={() => setEmailModal({ ...emailModal, show: false })} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            {loadingClientes ? (
              <EmailFormSkeleton />
            ) : (
              <div className="p-6 space-y-5">
                {emailModal.mode === 'create' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Website / Domínio</label>
                      <select
                        value={selectedDomain}
                        onChange={e => setSelectedDomain(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                      >
                        <option value="">Selecione um website</option>
                        {sites.map(site => (
                          <option key={site.domain} value={site.domain}>{site.domain}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Username</label>
                      <div className="flex items-center gap-2">
                        <input
                          value={emailModal.data.user}
                          onChange={e => setEmailModal({ ...emailModal, data: { ...emailModal.data, user: e.target.value } })}
                          placeholder="admin"
                          className="flex-1 bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                        />
                        <span className="text-gray-400 text-sm">@{selectedDomain || 'dominio.com'}</span>
                      </div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Palavra-passe</label><div className="relative"><input type={showEmailPass ? 'text' : 'password'} value={emailModal.data.password} onChange={e => setEmailModal({ ...emailModal, data: { ...emailModal.data, password: e.target.value } })} placeholder={emailModal.mode === 'edit' ? 'Manter actual' : '••••••••'} className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all pr-12" /><button type="button" onClick={() => setShowEmailPass(!showEmailPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showEmailPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>{emailModal.mode === 'create' && <button type="button" onClick={() => { const p = generatePassword(); setEmailModal({ ...emailModal, data: { ...emailModal.data, password: p, confirmPassword: p } }) }} className="text-xs font-semibold text-red-600 hover:text-red-700">Gerar palavra-passe</button>}</div>
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirmar palavra-passe</label><div className="relative"><input type={showEmailPass ? 'text' : 'password'} value={emailModal.data.confirmPassword || ''} onChange={e => setEmailModal({ ...emailModal, data: { ...emailModal.data, confirmPassword: e.target.value } })} placeholder="Confirmar palavra-passe" className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all pr-12" /><button type="button" onClick={() => setShowEmailPass(!showEmailPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showEmailPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
                </div>
                {emailModal.mode === 'edit' && (
                  <div className="mt-4 flex items-center justify-between p-4 bg-gray-50 rounded border border-gray-100">
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded flex items-center justify-center ${emailModal.data.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}><Power className="w-5 h-5" /></div><div><p className="text-xs font-bold text-gray-900 dark:text-white">Estado da Conta</p><p className="text-[10px] text-gray-500">{emailModal.data.status === 'active' ? 'Ativa' : 'Suspensa'}</p></div></div>
                    <button onClick={() => setEmailModal({ ...emailModal, data: { ...emailModal.data, status: emailModal.data.status === 'active' ? 'suspended' : 'active' } })} className={`relative w-12 h-6 rounded-full transition-colors ${emailModal.data.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${emailModal.data.status === 'active' ? 'translate-x-6' : ''}`} /></button>
                  </div>
                )}
              </div>
            )}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button onClick={() => setEmailModal({ ...emailModal, show: false })} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700">Cancelar</button>
              <button onClick={() => { if (emailModal.mode === 'create') handleCreateEmail(emailModal.data); else handleUpdateEmail(emailModal.data) }} disabled={loading || creating} className="px-6 py-2 bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 rounded text-xs font-bold  transition-all flex items-center gap-2">{(loading || creating) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {emailModal.mode === 'create' ? 'Criar E-mail' : 'Guardar Alterações'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        count={selected.length}
        onAction={handleBulkAction}
        onClear={() => setSelected([])}
        label="contas de e-mail"
      />
      <ConfirmModal
        show={confirm.show}
        title={confirm.title}
        message={confirm.message}
        isDanger={confirm.isDanger}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ ...confirm, show: false })}
      />
    </div>
  )
}

// ============================================================
// PANEL USERS SECTION
// ============================================================
type PanelRoleFilter = 'all' | 'admin' | 'reseller' | 'client' | 'guest'
type PanelUsersScope = 'users' | 'reseller' | 'client'
type UsersScopeFilter = 'all' | 'admin' | 'manager' | 'guest' | 'client' | 'reseller'

type PanelAccount = {
  id: string
  email: string
  userName: string
  daUsername?: string | null
  panelRole: PanelRoleFilter extends 'all' ? string : PanelRoleFilter | string
  panelPath: string
  state?: string
  lastSignIn?: string | null
  nome?: string | null
}

const PANEL_ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestão',
  reseller: 'Revendedor',
  client: 'Cliente',
  guest: 'Visitante',
}

const PANEL_ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  reseller: 'bg-blue-100 text-blue-700',
  client: 'bg-gray-100 text-gray-700',
  guest: 'bg-amber-100 text-amber-800',
}

function floatingMenuPosition(anchorRect: DOMRect, menuW: number, itemCount: number) {
  const rowH = 32
  const estimatedH = itemCount * rowH + 4
  let top = anchorRect.top + anchorRect.height / 2 - estimatedH / 2
  let left = Math.max(8, anchorRect.right - menuW)
  if (typeof window !== 'undefined') {
    top = Math.max(8, Math.min(top, window.innerHeight - estimatedH - 8))
  }
  return { top, left, estimatedH }
}

function PanelAccountActionsMenu({
  anchorRect,
  account,
  onAction,
  onClose,
}: {
  anchorRect: DOMRect
  account: PanelAccount
  onAction: (action: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const items = [
    ...(account.panelRole === 'reseller'
      ? [{ id: 'loginAs', label: 'Entrar como revendedor' }]
      : []),
    ...(account.email.includes('@')
      ? [{ id: 'downloadEmailConfig', label: 'Baixar credenciais de acesso' }]
      : []),
    { id: 'edit', label: 'Editar conta' },
    { id: 'delete', label: 'Eliminar', danger: true },
  ]

  const menuW = 200
  const { top, left } = floatingMenuPosition(anchorRect, menuW, items.length)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onScroll = () => onClose()
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 9999 }}
      className="w-max rounded border border-zinc-200 bg-white py-0.5 text-xs shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => { onAction(item.id); onClose() }}
          className={`block w-full whitespace-nowrap text-left px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:hover:text-red-400 ${item.danger ? 'text-red-600' : 'text-zinc-700 dark:text-zinc-300'}`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

function EmailRowActionsMenu({
  anchorRect,
  onAction,
  onClose,
}: {
  anchorRect: DOMRect
  onAction: (action: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const items = [
    { id: 'webmail', label: 'Abrir webmail' },
    { id: 'edit', label: 'Editar conta' },
    { id: 'download', label: 'Baixar configurações de e-mail' },
    { id: 'delete', label: 'Eliminar', danger: true },
  ]
  const menuW = 220
  const { top, left } = floatingMenuPosition(anchorRect, menuW, items.length)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onScroll = () => onClose()
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 9999 }}
      className="w-max rounded border border-zinc-200 bg-white py-0.5 text-xs shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => { onAction(item.id); onClose() }}
          className={`block w-full whitespace-nowrap text-left px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:hover:text-red-400 ${item.danger ? 'text-red-600' : 'text-zinc-700 dark:text-zinc-300'}`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

function fileManagerDropdownPosition(anchorRect: DOMRect, menuW: number, itemCount: number) {
  const rowH = 32
  const estimatedH = itemCount * rowH + 8
  let top = anchorRect.bottom + 4
  let left = anchorRect.left
  if (typeof window !== 'undefined') {
    if (top + estimatedH > window.innerHeight - 8) {
      top = anchorRect.top - estimatedH - 4
    }
    left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8))
  }
  return { top, left }
}

function FileManagerMoreMenu({
  anchorRect,
  onAction,
  onClose,
}: {
  anchorRect: DOMRect
  onAction: (action: 'rename' | 'permissions' | 'extract' | 'delete') => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const items = [
    { id: 'rename' as const, label: 'Renomear' },
    { id: 'permissions' as const, label: 'Definir permissões' },
    { id: 'extract' as const, label: 'Descompactar' },
    { id: 'delete' as const, label: 'Eliminar', danger: true },
  ]
  const menuW = 176
  const { top, left } = fileManagerDropdownPosition(anchorRect, menuW, items.length)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onScroll = () => onClose()
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 9999, width: menuW }}
      className="rounded-lg border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => { onAction(item.id); onClose() }}
          className={`block w-full px-3 py-2 text-left hover:text-red-600 dark:hover:text-red-400 ${item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-zinc-300'}`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

const PANEL_PAGE_TITLES: Record<PanelRoleFilter, { title: string; description: string }> = {
  all: {
    title: 'Utilizadores dos Painéis',
    description: 'Todos os emails com acesso aos painéis Admin, Revenda, Cliente e Visitante.',
  },
  admin: {
    title: 'Utilizadores',
    description: '',
  },
  reseller: {
    title: 'Revendedores',
    description: 'Contas de revenda com acesso ao painel revendedor.',
  },
  client: {
    title: 'Clientes',
    description: 'Clientes finais com acesso ao painel cliente.',
  },
  guest: {
    title: 'Visitantes',
    description: 'Contas registadas sem produto activo.',
  },
};

export function CPUsersSection({
  variant = 'directadmin',
  fixedPanelFilter,
  panelScope,
  onBootstrapRefresh,
  onNavigate,
  isActive = true,
}: {
  variant?: 'directadmin' | 'panels';
  fixedPanelFilter?: PanelRoleFilter;
  /** Secção Utilizadores: admin + visitante + cliente, com filtro local. */
  panelScope?: PanelUsersScope;
  /** Actualiza bootstrap global (sites + contas) após mutações. */
  onBootstrapRefresh?: () => void | Promise<void>;
  onNavigate?: (section: string, opts?: { accountType?: 'client' | 'reseller' | 'admin' }) => void;
  isActive?: boolean;
}) {
  const isPanelsMode = variant === 'panels'
  const { setChrome } = useAdminSectionChrome()
  const [users, setUsers] = useState<DirectAdminUser[]>([])
  const [panelAccounts, setPanelAccounts] = useState<PanelAccount[]>(() => {
    if (typeof window === 'undefined') return []
    return readBootstrapCache()?.accounts ?? readPanelUsersCache()?.users ?? []
  })
  const [panelFilter, setPanelFilter] = useState<PanelRoleFilter>(fixedPanelFilter ?? 'all')
  const [usersScopeFilter, setUsersScopeFilter] = useState<UsersScopeFilter>(() => {
    if (panelScope === 'users') return 'all'
    if (panelScope === 'client') return 'client'
    if (panelScope === 'reseller') return 'reseller'
    return 'all'
  })
  const [panelCounts, setPanelCounts] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {}
    return readBootstrapCache()?.accountCounts ?? readPanelUsersCache()?.counts ?? {}
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return false
    if (!isPanelsMode) return false
    const boot = readBootstrapCache()
    return !(boot?.accounts?.length || readPanelUsersCache()?.users?.length)
  })
  const [acls, setAcls] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [panelOpenMenu, setPanelOpenMenu] = useState<{ accountId: string; rect: DOMRect } | null>(null)
  const [panelEmailConfig, setPanelEmailConfig] = useState<EmailConfigBundle | null>(null)
  const [msg, setMsg] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [selectedPanelIds, setSelectedPanelIds] = useState<string[]>([])
  const [bulkPanelRole, setBulkPanelRole] = useState<string>('manager')
  const [userModal, setUserModal] = useState<{ show: boolean, mode: 'create' | 'edit', data: any }>({
    show: false,
    mode: 'create',
    data: { firstName: '', lastName: '', email: '', userName: '', password: '', confirmPassword: '', websitesLimit: 10, emailsLimit: 100, acl: 'user' }
  })
  const [showUserPass, setShowUserPass] = useState(false)
  const [confirm, setConfirm] = useState<{ show: boolean, title: string, message: string, onConfirm: () => void, isDanger?: boolean }>({
    show: false, title: '', message: '', onConfirm: () => { }
  })

  const applyPanelAccounts = (data: { users?: PanelAccount[]; counts?: Record<string, number> }) => {
    setPanelAccounts(data.users || [])
    setPanelCounts(data.counts || {})
  }

  const loadPanelAccounts = async (options?: { fresh?: boolean }) => {
    if (options?.fresh) {
      clearPanelUsersCache()
      setLoading(true)
      try {
        const data = await fetchPanelUsers({ fresh: true })
        applyPanelAccounts(data)
      } catch (e: unknown) {
        console.error('[CPUsersSection] panel-users:', e)
      } finally {
        setLoading(false)
      }
      return
    }

    const bootCached = readBootstrapCache()
    if (bootCached?.accounts?.length) {
      const payload = { users: bootCached.accounts, counts: bootCached.accountCounts || {} }
      applyPanelAccounts(payload)
      writePanelUsersCache(payload)
      setLoading(false)
      void fetchPanelUsersStaleWhileRevalidate(applyPanelAccounts)
      return
    }

    const cached = readPanelUsersCache()
    if (cached) {
      applyPanelAccounts(cached)
      setLoading(false)
      void fetchPanelUsersStaleWhileRevalidate(applyPanelAccounts)
      return
    }

    setLoading(true)
    try {
      await fetchPanelUsersStaleWhileRevalidate((data) => {
        applyPanelAccounts(data)
        setLoading(false)
      })
    } catch (e: unknown) {
      console.error('[CPUsersSection] panel-users:', e)
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    if (isPanelsMode) {
      await loadPanelAccounts()
      return
    }

    const bootCached = readBootstrapCache()
    if (bootCached?.users?.length) {
      setUsers(bootCached.users as DirectAdminUser[])
      setAcls(['user', 'reseller'])
      setLoading(false)
      return
    }

    const lsUsers = cpGetUsers()
    if (lsUsers.length > 0) setUsers(lsUsers)
    else setLoading(false)
  }

  useEffect(() => { loadUsers() }, [variant])

  useEffect(() => {
    if (!msg) return
    const timer = window.setTimeout(() => setMsg(''), 5000)
    return () => window.clearTimeout(timer)
  }, [msg])

  useEffect(() => {
    if (!isActive || !isPanelsMode || !panelScope) return
    if (panelScope === 'users') setUsersScopeFilter('all')
    else if (panelScope === 'client') setUsersScopeFilter('client')
    else if (panelScope === 'reseller') setUsersScopeFilter('reseller')
    setSelectedPanelIds([])
  }, [isActive, panelScope, isPanelsMode])

  useEffect(() => {
    if (!isActive || !isPanelsMode || !panelScope) {
      return
    }
    setChrome({
      search: {
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder: 'Pesquisar por email ou nome…',
      },
    })
    return () => setChrome(null)
  }, [isActive, isPanelsMode, panelScope, searchQuery, setChrome])

  const activePanelFilter = fixedPanelFilter ?? panelFilter
  const usersScopeRoles: UsersScopeFilter[] = ['admin', 'manager', 'reseller', 'guest', 'client']

  const scopedPanelAccounts = panelScope === 'users'
    ? panelAccounts.filter((account) => usersScopeRoles.includes(account.panelRole as UsersScopeFilter))
    : panelScope === 'reseller' || panelScope === 'client'
      ? panelAccounts.filter((account) => account.panelRole === usersScopeFilter)
      : panelAccounts

  const usersScopeCounts = usersScopeRoles.reduce<Record<string, number>>((acc, role) => {
    acc[role] = panelAccounts.filter((a) => a.panelRole === role).length
    return acc
  }, { all: panelAccounts.length })

  const filteredPanelAccounts = scopedPanelAccounts.filter((account) => {
    const matchesRole = panelScope === 'users'
      ? (usersScopeFilter === 'all' || account.panelRole === usersScopeFilter)
      : (activePanelFilter === 'all' || account.panelRole === activePanelFilter)
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !q ||
      account.email.toLowerCase().includes(q) ||
      account.userName.toLowerCase().includes(q) ||
      (account.nome || '').toLowerCase().includes(q)
    return matchesRole && matchesSearch
  })

  const panelHeaderTitle = isPanelsMode
    ? (panelScope === 'users'
      ? PANEL_PAGE_TITLES.admin.title
      : panelScope === 'reseller'
        ? PANEL_PAGE_TITLES.reseller.title
        : panelScope === 'client'
          ? PANEL_PAGE_TITLES.client.title
          : (PANEL_PAGE_TITLES[activePanelFilter]?.title || 'Utilizadores dos Painéis'))
    : 'Utilizadores DirectAdmin'

  const panelHeaderDescription = isPanelsMode
    ? (panelScope === 'users'
      ? PANEL_PAGE_TITLES.admin.description
      : panelScope === 'reseller'
        ? PANEL_PAGE_TITLES.reseller.description
        : panelScope === 'client'
          ? PANEL_PAGE_TITLES.client.description
          : (PANEL_PAGE_TITLES[activePanelFilter]?.description || PANEL_PAGE_TITLES.all.description))
    : 'Gira acessos e permissões do servidor.'

  const panelCreateButtonLabel =
    panelScope === 'client'
      ? 'Adicionar novo cliente'
      : panelScope === 'reseller'
        ? 'Adicionar novo revendedor'
        : 'Adicionar novo'

  const refreshPanelAccounts = async () => {
    setRefreshing(true)
    try {
      clearPanelUsersCache()
      clearPanelBootstrapCache()
      if (onBootstrapRefresh) await onBootstrapRefresh()
      await loadPanelAccounts({ fresh: true })
    } catch (e: unknown) {
      console.error('[CPUsersSection] refresh:', e)
    }
    setRefreshing(false)
  }

  const openPanelEditModal = (account: PanelAccount) => {
    const fullName = account.nome || account.userName || ''
    const spaceIdx = fullName.indexOf(' ')
    setUserModal({
      show: true,
      mode: 'edit',
      data: {
        userId: account.id,
        firstName: spaceIdx > 0 ? fullName.slice(0, spaceIdx) : fullName,
        lastName: spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : '',
        email: account.email,
        panelRole: account.panelRole,
        acl: 'panel',
        password: '',
        confirmPassword: '',
      },
    })
  }

  const handlePanelLoginAs = (account: PanelAccount) => {
    const daUser = account.daUsername?.trim()
    if (daUser) {
      window.location.href = `/api/admin/impersonate?user=${encodeURIComponent(daUser)}`
      return
    }
    setCreating(true)
    setMsg('')
    void fetch('/api/admin/impersonate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: account.id,
        email: account.email,
      }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível entrar como revendedor')
        window.location.href = data.redirect || '/revendedor?impersonate=1'
      })
      .catch((e: unknown) => {
        setMsg(`❌ ${e instanceof Error ? e.message : 'Erro'}`)
        setCreating(false)
      })
  }

  const handlePanelRowAction = (account: PanelAccount, action: string) => {
    if (action === 'loginAs') {
      void handlePanelLoginAs(account)
      return
    }
    if (action === 'downloadEmailConfig') {
      void (async () => {
        try {
          const bundle = await fetchEmailConfigBundle(account.email)
          setPanelEmailConfig(bundle)
        } catch (e: unknown) {
          setMsg(`❌ ${e instanceof Error ? e.message : 'Erro ao obter configurações'}`)
        }
      })()
      return
    }
    if (action === 'edit') {
      openPanelEditModal(account)
      return
    }
    if (action === 'delete') {
      handlePanelDelete(account)
    }
  }

  const handlePanelDelete = (account: PanelAccount) => {
    setConfirm({
      show: true,
      title: 'Eliminar conta',
      message: `Eliminar permanentemente ${account.email}? Esta acção não pode ser desfeita.`,
      isDanger: true,
      onConfirm: async () => {
        setCreating(true)
        setMsg('')
        try {
          const res = await fetch(`/api/admin/panel-users?userId=${encodeURIComponent(account.id)}`, {
            method: 'DELETE',
          })
          const d = await res.json()
          if (d.success) {
            setMsg('✅ Conta eliminada.')
            await loadPanelAccounts({ fresh: true })
          } else {
            setMsg(`❌ ${d.error}`)
          }
        } catch (e: unknown) {
          setMsg(`❌ ${e instanceof Error ? e.message : 'Erro'}`)
        }
        setCreating(false)
        setConfirm({ ...confirm, show: false })
      },
    })
  }

  const handlePanelUpdate = async (data: Record<string, unknown>) => {
    if (data.password && data.password !== data.confirmPassword) {
      setMsg('As passwords não coincidem!')
      return
    }
    setCreating(true)
    setMsg('')
    try {
      await supabase.auth.getSession()
      const res = await fetch('/api/admin/panel-users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.userId,
          role: data.panelRole,
          email: data.email,
          nome: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          password: data.password || undefined,
          provisionDa: false,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || payload.success === false) {
        const raw = payload.error || payload.message || 'Falha ao actualizar'
        throw new Error(String(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
      }
      const note = payload.provisionWarning ? ` (${payload.provisionWarning})` : ''
      setMsg(`✅ ${payload.message || 'Conta actualizada.'}${note}`)
      setUserModal({ ...userModal, show: false })
      clearPanelUsersCache()
      clearPanelBootstrapCache()
      await loadPanelAccounts({ fresh: true })
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Erro'}`)
    }
    setCreating(false)
  }

  const applyBulkPanelRole = async () => {
    if (!selectedPanelIds.length || !bulkPanelRole) return
    setCreating(true)
    setMsg('')
    let ok = 0
    let fail = 0
    try {
      await supabase.auth.getSession()
      for (const id of selectedPanelIds) {
        const account = panelAccounts.find((a) => a.id === id)
        if (!account) {
          fail += 1
          continue
        }
        const fullName = account.nome || account.userName || ''
        const spaceIdx = fullName.indexOf(' ')
        const res = await fetch('/api/admin/panel-users', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: account.id,
            role: bulkPanelRole,
            email: account.email,
            nome: fullName,
            provisionDa: false,
          }),
        })
        const payload = await res.json().catch(() => ({}))
        if (res.ok && payload.success !== false) ok += 1
        else fail += 1
      }
      if (fail > 0) {
        setMsg(`✅ ${ok} actualizada(s). ${fail} falharam.`)
      } else {
        setMsg(`✅ ${ok} conta(s) actualizada(s).`)
      }
      setSelectedPanelIds([])
      clearPanelUsersCache()
      clearPanelBootstrapCache()
      await loadPanelAccounts({ fresh: true })
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Erro'}`)
    }
    setCreating(false)
  }

  const generatePanelPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#!$%&*'
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const openPanelCreateModal = () => {
    const generated = generatePanelPassword()
    const base = {
      firstName: '',
      lastName: '',
      email: '',
      password: generated,
      confirmPassword: generated,
    }
    if (panelScope === 'reseller') {
      setUserModal({
        show: true,
        mode: 'create',
        data: {
          ...base,
          acl: 'panel',
          panelRole: 'reseller',
        },
      })
      return;
    }
    setUserModal({
      show: true,
      mode: 'create',
      data: {
        ...base,
        acl: 'panel',
        panelRole: 'client',
      },
    })
  }

  const isPanelAuthForm =
    isPanelsMode && userModal.data.acl === 'panel'

  const isPanelAuthCreate = isPanelAuthForm && userModal.mode === 'create'

  const panelModalTitle =
    userModal.mode === 'edit'
      ? 'Editar conta'
      : panelScope === 'client'
        ? 'Novo cliente'
        : panelScope === 'reseller'
          ? 'Novo revendedor'
          : 'Novo utilizador'

  const handleCreate = async (data: any) => {
    if (data.password !== data.confirmPassword) {
      setMsg('As senhas não coincidem!'); return
    }
    if (isPanelsMode && data.acl === 'panel' && data.password && data.password.length < 6) {
      setMsg('A palavra-passe deve ter pelo menos 6 caracteres.')
      return
    }
    setCreating(true); setMsg('')
    try {
      if (isPanelsMode && data.acl === 'panel' && data.panelRole) {
        await supabase.auth.getSession()
        const res = await fetch('/api/admin/panel-users', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
            role: data.panelRole,
            provisionDa: false,
          }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok || payload.success === false) {
          throw new Error(
            String(payload.error || payload.message || 'Falha ao criar conta')
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim(),
          )
        }
        setMsg(`✅ ${payload.message}`)
        setUserModal({ ...userModal, show: false })
        await loadPanelAccounts({ fresh: true })
        const role = data.panelRole || 'client'
        const accessBundle = buildPanelAccessConfigText({
          email: data.email,
          password: data.password,
          panelRole: role,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        })
        setPanelEmailConfig({
          email: data.email,
          password: data.password,
          ...accessBundle,
        })
        setCreating(false)
        return
      }

      if (data.acl === 'reseller') {
        const provRes = await fetch('/api/admin/reseller-provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            firstName: data.firstName,
            lastName: data.lastName,
            nome: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
            userName: data.userName,
            domain: data.domain,
            packageName: data.packageName,
            websitesLimit: data.websitesLimit,
            emailsLimit: data.emailsLimit,
            linkExisting: data.linkExisting ?? true,
          }),
        })
        const provData = await provRes.json()
        if (!provRes.ok || !provData.success) {
          throw new Error(provData.error || 'Falha ao provisionar revendedor')
        }
        const daUser = provData.result?.daUsername || '—'
        const autoNote = provData.result?.generatedPassword
          ? ' Password gerada automaticamente (login Visual = DirectAdmin).'
          : ''
        setMsg(`✅ Revendedor automático: DA "${daUser}" → /revendedor.${autoNote}`)
        setUserModal({ ...userModal, show: false })
        loadUsers()
        if (isPanelsMode) {
          await onBootstrapRefresh?.()
          await loadPanelAccounts({ fresh: true })
        }
        setCreating(false)
        return
      }

      console.log('[handleCreate] Sending to API:', JSON.stringify(data).substring(0, 300))
      const res = await directAdminAPI.createUser(data)
      console.log('[handleCreate] API Response:', JSON.stringify(res).substring(0, 500))
      const serverSuccess = res?.success === true
      const newUser = { ...data, state: 'Active', existsOnServer: serverSuccess }
      cpSaveUser(data.userName, newUser)
      void syncUserToSupabase({
        username: data.userName,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        acl: data.acl,
        websitesLimit: data.websitesLimit,
        status: 'Active'
      })
      if (serverSuccess) {
        setMsg('✅ Utilizador criado com sucesso no DirectAdmin!')
        setUserModal({ ...userModal, show: false })
      } else {
        // Melhor diagnóstico do erro
        const rawOutput = res?.output || ''
        const errorMsg = res?.error || ''
        console.log('[handleCreate] Failed. Raw output:', rawOutput)
        console.log('[handleCreate] Error field:', errorMsg)

        // Tentar extrair mensagem de erro do JSON se existir
        let parsedError = ''
        try {
          const jsonMatch = rawOutput.match(/\{[^}]+\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            parsedError = parsed.error_message || parsed.message || ''
          }
        } catch { }

        const errorDetail = parsedError || errorMsg || rawOutput || 'Verifique o console (F12) para detalhes'
        setMsg(`❌ Falhou: ${errorDetail.substring(0, 250)}`)
      }
      loadUsers()
    } catch (e: any) {
      console.error('[handleCreate] Exception:', e)
      setMsg(`❌ Erro: ${e.message}`)
    }
    setCreating(false)
  }

  const handleRetrySync = async (u: any) => {
    setLoading(true); setMsg('')
    try {
      // Gerar password temporária se não existir (DirectAdmin exige password)
      const syncData = { ...u }
      if (!syncData.password) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
        syncData.password = Array.from({ length: 16 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('')
        syncData.confirmPassword = syncData.password
      }
      console.log('[handleRetrySync] Syncing user:', u.userName, JSON.stringify(syncData).substring(0, 300))
      const res = await directAdminAPI.createUser(syncData)
      console.log('[handleRetrySync] Response:', JSON.stringify(res).substring(0, 500))
      if (res?.success === true) {
        setMsg(`✅ Utilizador ${u.userName} sincronizado com sucesso no DirectAdmin!`)
        loadUsers()
      } else {
        const rawOutput = res?.output || ''
        const errorMsg = res?.error || ''
        let parsedError = ''
        try {
          const jsonMatch = rawOutput.match(/\{[^}]+\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            parsedError = parsed.error_message || parsed.message || ''
          }
        } catch { }
        const errorDetail = parsedError || errorMsg || rawOutput || 'Erro desconhecido'
        setMsg(`❌ Erro: ${errorDetail.substring(0, 300)}`)
      }
    } catch (e: any) {
      console.error('[handleRetrySync] Exception:', e)
      setMsg(`❌ Erro: ${e.message}`)
    }
    setLoading(false)
  }

  const handleDelete = async (userName: string) => {
    setConfirm({
      show: true,
      title: 'Eliminar Utilizador',
      message: `Tens a certeza que desejas eliminar o utilizador ${userName}? Esta ação removerá permanentemente o utilizador do DirectAdmin e da base de dados.`,
      isDanger: true,
      onConfirm: async () => {
        setLoading(true)
        try {
          await directAdminAPI.deleteUser({ userName })
        } catch (e) {
          console.warn('API deletion failed, but removing locally:', e)
        }
        cpRemoveUser(userName)
        void removeUserFromSupabase(userName)
        await loadUsers()
        setLoading(false)
        setConfirm({ ...confirm, show: false })
      }
    })
  }

  const handleBulkAction = async (action: string) => {
    if (selected.length === 0) return
    const count = selected.length

    if (action === 'delete') {
      setConfirm({
        show: true,
        title: `Eliminar ${count} Utilizadores`,
        message: `Desejas eliminar permanentemente os ${count} utilizadores selecionados?`,
        isDanger: true,
        onConfirm: async () => {
          setLoading(true)
          for (const user of selected) {
            await directAdminAPI.deleteUser({ userName: user })
            cpRemoveUser(user)
            void removeUserFromSupabase(user)
          }
          setSelected([])
          loadUsers()
          setLoading(false)
        }
      })
    } else if (action === 'suspend') {
      setConfirm({
        show: true,
        title: `Suspender ${count} Utilizadores`,
        message: `Desejas suspender o acesso dos ${count} utilizadores selecionados?`,
        isDanger: false,
        onConfirm: async () => {
          setLoading(true)
          // DirectAdmin suspend logic if available via API, or just update state
          for (const user of selected) {
            // Note: directAdminAPI.modifyUser can handle suspension if implemented
          }
          setSelected([])
          loadUsers()
          setLoading(false)
        }
      })
    }
  }

  const handleUpdate = async (data: any) => {
    if (data.password && data.password !== data.confirmPassword) {
      setMsg('As senhas não coincidem!'); return
    }
    setLoading(true)
    try {
      if (data.password) {
        await directAdminAPI.execCommand(`directadmin changeUserPassword --userName ${data.userName} --password '${data.password}'`)
      }
      const currentState = (users.find(u => u.userName === data.userName) as any)?.state || 'Active'
      if (data.state !== currentState) {
        await directAdminAPI.execCommand(`directadmin ${data.state === 'Suspended' ? 'suspendUser' : 'unsuspendUser'} --userName ${data.userName}`)
      }

      // Sync profile changes to DirectAdmin original server
      await directAdminAPI.modifyUser(data)
      cpSaveUser(data.userName, data)
      await syncUserToSupabase({
        username: data.userName,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        acl: data.acl,
        websitesLimit: data.websitesLimit,
        emailsLimit: data.emailsLimit,
        status: data.state
      })
      setMsg('Utilizador atualizado com sucesso!')
      setUserModal({ ...userModal, show: false })
      loadUsers()
    } catch (e: any) {
      setMsg('Erro: ' + e.message)
    }
    setLoading(false)
  }

  const displayCount = isPanelsMode ? filteredPanelAccounts.length : users.length

  return (
    <div className="space-y-6">
      <div className={`flex flex-col gap-3 ${isPanelsMode ? 'sm:flex-row sm:items-center sm:justify-between' : 'lg:flex-row lg:items-end lg:justify-end'}`}>
        <div className={`flex flex-col gap-2 sm:flex-row sm:items-center ${isPanelsMode ? 'w-full sm:justify-between' : 'w-full lg:w-auto lg:shrink-0'}`}>
          {isPanelsMode && (
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {(panelScope === 'users' || panelScope === 'client') && (
                <>
                  <select
                    value={usersScopeFilter}
                    onChange={(e) => setUsersScopeFilter(e.target.value as UsersScopeFilter)}
                    className={`${panelField} w-full shrink-0 sm:min-w-[18rem] sm:w-[20rem]`}
                  >
                    {panelScope === 'users' && (
                      <option value="all">Todos ({usersScopeCounts.all ?? 0})</option>
                    )}
                    <option value="admin">Administradores ({usersScopeCounts.admin ?? 0})</option>
                    <option value="manager">Gestão ({usersScopeCounts.manager ?? 0})</option>
                    <option value="reseller">Revendedores ({usersScopeCounts.reseller ?? 0})</option>
                    <option value="guest">Visitantes ({usersScopeCounts.guest ?? 0})</option>
                    <option value="client">Clientes ({usersScopeCounts.client ?? 0})</option>
                  </select>
                  {panelScope === 'users' && selectedPanelIds.length > 0 && (
                    <>
                      <select
                        value={bulkPanelRole}
                        onChange={(e) => setBulkPanelRole(e.target.value)}
                        className={`${panelField} w-full shrink-0 sm:min-w-[11rem] sm:w-auto`}
                        disabled={creating}
                      >
                        <option value="manager">Promover para Gestão</option>
                        <option value="admin">Promover para Administrador</option>
                        <option value="reseller">Promover para Revendedor</option>
                        <option value="client">Promover para Cliente</option>
                        <option value="guest">Promover para Visitante</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void applyBulkPanelRole()}
                        disabled={creating}
                        className="shrink-0 px-4 py-2 flex items-center justify-center gap-1.5 bg-transparent border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-black dark:hover:text-white rounded text-sm font-bold transition-all disabled:opacity-50"
                      >
                        Aplicar
                      </button>
                      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                        {selectedPanelIds.length} seleccionada(s)
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          {!isPanelsMode && (
            <>
              <button onClick={loadUsers} className="font-semibold px-4 py-2 flex items-center justify-center gap-1.5 bg-transparent border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-black dark:hover:text-white rounded text-sm transition-all disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
              <button
                onClick={() => setUserModal({ show: true, mode: 'create', data: { firstName: '', lastName: '', email: '', userName: '', password: '', confirmPassword: '', websitesLimit: 0, acl: 'user', securityLevel: 'HIGH' } })}
                className="px-4 py-2 flex items-center justify-center gap-1.5 bg-transparent border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-black dark:hover:text-white rounded text-sm font-bold transition-all disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" /> Novo Utilizador
              </button>
            </>
          )}
          {isPanelsMode && panelScope && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={openPanelCreateModal}
                className="whitespace-nowrap px-4 py-2 flex items-center justify-center gap-1.5 bg-transparent border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-black dark:hover:text-white rounded text-sm font-bold transition-all disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" /> {panelCreateButtonLabel}
              </button>
              <button
                type="button"
                onClick={() => void refreshPanelAccounts()}
                disabled={refreshing || loading}
                title="Actualizar"
                className="px-4 py-2 flex items-center justify-center gap-1.5 bg-transparent border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-black dark:hover:text-white rounded text-sm transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {msg && (
        <div
          className={`rounded border px-4 py-2.5 text-sm font-medium transition-opacity duration-500 ${msg.includes('✅') || msg.includes('sucesso') || msg.includes('actualizada')
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-400'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400'
            }`}
        >
          {msg}
        </div>
      )}

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden relative dark:border-zinc-800 dark:bg-zinc-950">
        {loading && <TableSkeleton columns={5} rows={8} />}
        {!loading && displayCount === 0 ? (
          <div className="py-12 text-center text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-50" /><p className="text-sm">Nenhum utilizador encontrado.</p></div>
        ) : !loading && isPanelsMode ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-500 uppercase border-b border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                {panelScope === 'users' && <th className="w-10 px-4 py-3" aria-hidden="true" />}
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Painel</th>
                <th className="px-4 py-3">Papel</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3 text-right">Acções</th>
              </tr>
            </thead>
            <tbody>
              {filteredPanelAccounts.map((account) => (
                <tr
                  key={account.id}
                  className={`border-b border-gray-200 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-transparent dark:hover:[&_td:not(:last-child)]:text-red-400 ${selectedPanelIds.includes(account.id) ? 'bg-red-50/40 dark:bg-red-950/10' : ''
                    }`}
                >
                  {panelScope === 'users' && (
                    <td className="px-4 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedPanelIds.includes(account.id)}
                        onChange={() => {
                          setSelectedPanelIds((prev) =>
                            prev.includes(account.id)
                              ? prev.filter((x) => x !== account.id)
                              : [...prev, account.id],
                          )
                        }}
                        className="h-4 w-4 cursor-pointer accent-red-600"
                        aria-label={`Seleccionar ${account.email}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-1.5 font-medium text-gray-900 dark:text-zinc-100">{account.email}</td>
                  <td className="px-4 py-1.5 text-gray-600 dark:text-zinc-400">{account.nome || account.userName || '—'}</td>
                  <td className="px-4 py-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-tight bg-slate-100 text-slate-700">
                      {account.panelPath}
                    </span>
                  </td>
                  <td className="px-4 py-1.5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-tight ${PANEL_ROLE_BADGE[account.panelRole] || 'bg-gray-100 text-gray-700'}`}>
                      {PANEL_ROLE_LABELS[account.panelRole] || account.panelRole}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-gray-500 text-xs dark:text-zinc-500">
                    {account.lastSignIn
                      ? new Date(account.lastSignIn).toLocaleString('pt-PT')
                      : 'Nunca'}
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {account.panelRole === 'reseller' && (
                        account.daUsername ? (
                          <a
                            href={`/api/admin/impersonate?user=${encodeURIComponent(account.daUsername)}`}
                            className="hidden sm:inline-flex h-8 items-center rounded border border-gray-300 dark:border-zinc-700 bg-transparent px-2.5 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white"
                          >
                            Entrar
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled={creating}
                            onClick={() => handlePanelLoginAs(account)}
                            className="hidden sm:inline-flex h-8 items-center rounded border border-gray-300 dark:border-zinc-700 bg-transparent px-2.5 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white disabled:opacity-50"
                          >
                            Entrar
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          if (panelOpenMenu?.accountId === account.id) setPanelOpenMenu(null)
                          else setPanelOpenMenu({ accountId: account.id, rect })
                        }}
                        className="inline-flex rounded p-2 hover:bg-gray-100 dark:hover:bg-transparent dark:hover:text-red-400"
                        aria-label="Mais opções"
                      >
                        <MoreVertical className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-500 uppercase border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                <th className="px-4 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={selected.length === users.length && users.length > 0}
                    onChange={() => setSelected(selected.length === users.length ? [] : users.map(u => u.userName))}
                    className="w-4 h-4 accent-red-600 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-2.5">Utilizador</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Tipo de Conta</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Acções</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} className={`border-b border-gray-50 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${selected.includes(u.userName) ? 'bg-red-50/30 dark:bg-red-900/20' : ''}`}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(u.userName)}
                      onChange={() => setSelected(prev => prev.includes(u.userName) ? prev.filter(x => x !== u.userName) : [...prev, u.userName])}
                      className="w-4 h-4 accent-red-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {u.userName}
                      {!u.existsOnServer && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 text-[9px] font-bold border border-orange-100 uppercase tracking-tighter" title="Esta conta existe apenas localmente e falhou ao sincronizar com o DirectAdmin.">
                          <AlertCircle className="w-2.5 h-2.5" /> Off-Sync
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{u.email || 'N/A'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-tight ${(u as any).acl === 'admin' ? 'bg-purple-100 text-purple-700' :
                        (u as any).acl === 'reseller' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                      }`}>
                      {(u as any).acl === 'admin' ? 'Administrador' :
                        (u as any).acl === 'reseller' ? 'Revendedor' : 'Cliente'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-tight ${(u as any).state === 'Suspended' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {(u as any).state || 'Active'}
                      {!u.existsOnServer && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRetrySync(u)}
                            className="text-[9px] text-blue-600 hover:underline font-bold uppercase transition-all"
                            title="Tentar criar esta conta no DirectAdmin agora"
                          >
                            🔄 Sincronizar
                          </button>
                        </div>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setUserModal({ show: true, mode: 'edit', data: { ...u, password: '' } })}
                        className="p-1.5 text-gray-600 dark:text-gray-400 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 hover:text-black dark:hover:text-white rounded transition-all"
                        title="Gerir Utilizador"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {u.userName !== 'admin' && (
                        <button onClick={() => handleDelete(u.userName)} className="p-1.5 text-red-600 dark:text-red-500 border border-transparent hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/10 rounded transition-all" title="Apagar"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {panelOpenMenu && (() => {
        const account = filteredPanelAccounts.find((a) => a.id === panelOpenMenu.accountId)
        if (!account) return null
        return (
          <PanelAccountActionsMenu
            anchorRect={panelOpenMenu.rect}
            account={account}
            onAction={(action) => handlePanelRowAction(account, action)}
            onClose={() => setPanelOpenMenu(null)}
          />
        )
      })()}

      <EmailConfigResultModal
        open={Boolean(panelEmailConfig)}
        config={panelEmailConfig}
        onClose={() => setPanelEmailConfig(null)}
      />

      {/* Modal de Utilizador (Unified) */}
      {userModal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setUserModal({ ...userModal, show: false })} />
          <div className="relative bg-white border border-gray-200 rounded-lg w-full max-w-3xl shadow-2xl dark:bg-zinc-900 dark:border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 border border-red-300 text-red-600 rounded flex items-center justify-center "><Users className="w-5 h-5 " /></div>
                <div><h2 className="text-sm font-bold text-gray-900 block">{isPanelsMode ? panelModalTitle : (userModal.mode === 'create' ? 'Novo Utilizador' : 'Editar Utilizador')}</h2><span className="text-[11px] text-gray-500 font-mono">{userModal.mode === 'create' ? (isPanelAuthCreate ? 'Conta de acesso ao painel (sem DirectAdmin)' : 'Configurar acesso ao servidor') : (isPanelAuthForm ? userModal.data.email : `Gerir: ${userModal.data.userName}`)}</span></div>
              </div>
              <button onClick={() => setUserModal({ ...userModal, show: false })} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 max-h-[min(80vh,720px)] overflow-y-auto overflow-x-visible">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nome</label><input value={userModal.data.firstName || ''} onChange={e => setUserModal({ ...userModal, data: { ...userModal.data, firstName: e.target.value } })} placeholder="João" className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Apelido</label><input value={userModal.data.lastName || ''} onChange={e => setUserModal({ ...userModal, data: { ...userModal.data, lastName: e.target.value } })} placeholder="Silva" className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">E-mail</label><input value={userModal.data.email || ''} disabled={isPanelAuthForm && userModal.mode === 'edit'} onChange={e => setUserModal({ ...userModal, data: { ...userModal.data, email: e.target.value } })} placeholder="exemplo@email.com" className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all disabled:opacity-60" /></div>
                {isPanelAuthForm && (
                  <div className="space-y-1.5 col-span-1 relative z-[1]">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Papel</label>
                    <select
                      value={userModal.data.panelRole || 'client'}
                      onChange={(e) => setUserModal({ ...userModal, data: { ...userModal.data, panelRole: e.target.value } })}
                      className="relative z-[2] w-full bg-white dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                    >
                      {panelScope === 'reseller' ? (
                        <option value="reseller">Revendedor</option>
                      ) : panelScope === 'client' ? (
                        <option value="client">Cliente</option>
                      ) : (
                        <>
                          <option value="manager">Gestão</option>
                          <option value="client">Cliente</option>
                          <option value="admin">Administrador</option>
                          <option value="reseller">Revendedor</option>
                          {userModal.mode === 'edit' && userModal.data.panelRole === 'guest' ? (
                            <option value="guest">Visitante</option>
                          ) : null}
                        </>
                      )}
                    </select>
                  </div>
                )}
                {userModal.data.acl === 'reseller' && userModal.mode === 'create' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Domínio revenda</label>
                      <input value={userModal.data.domain || ''} onChange={e => setUserModal({ ...userModal, data: { ...userModal.data, domain: e.target.value } })} placeholder="oshercollective.com (opcional — detecta do email)" className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-1.5 col-span-1 flex items-end">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={Boolean(userModal.data.linkExisting)} onChange={e => setUserModal({ ...userModal, data: { ...userModal.data, linkExisting: e.target.checked } })} className="rounded border-gray-300" />
                        Ligar conta DA já existente (não criar nova)
                      </label>
                    </div>
                  </>
                )}
                {!isPanelAuthForm && (
                  <>
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo de Utilizador (ACL)</label>
                      <select
                        value={userModal.data.acl || 'user'}
                        onChange={e => setUserModal({ ...userModal, data: { ...userModal.data, acl: e.target.value } })}
                        className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                      >
                        <option value="admin">Administrador</option>
                        <option value="reseller">Revendedor</option>
                        <option value="user">Cliente</option>
                      </select>
                      <p className="text-[9px] text-gray-500 mt-1 italic leading-tight">Selecione o nível de acesso para este utilizador</p>
                    </div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Websites Limit</label><input type="number" value={userModal.data.websitesLimit ?? 0} onChange={e => setUserModal({ ...userModal, data: { ...userModal.data, websitesLimit: parseInt(e.target.value) || 0 } })} placeholder="0 = Unlimited" className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" /><p className="text-[9px] text-gray-500 mt-1 italic leading-tight">Número máximo de websites que este utilizador pode criar. 0 = Ilimitado</p></div>
                    <div className="space-y-1.5 lg:col-span-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-red-600">Username</label>
                      <input
                        value={userModal.data.userName || ''}
                        disabled={userModal.mode === 'edit'}
                        onChange={e => {
                          const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
                          setUserModal({ ...userModal, data: { ...userModal.data, userName: val } })
                        }}
                        placeholder="ex: provisual"
                        className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all disabled:opacity-50"
                      />
                      <p className="text-[9px] text-gray-500 mt-1 italic leading-tight">Escolha um username único para login (apenas letras e números)</p>
                    </div>
                  </>
                )}
                <div className="space-y-1.5 lg:col-span-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
                  <div className="relative">
                    <input
                      type={showUserPass ? 'text' : 'password'}
                      value={userModal.data.password || ''}
                      onChange={e => setUserModal({ ...userModal, data: { ...userModal.data, password: e.target.value } })}
                      placeholder={userModal.mode === 'edit' ? 'Alterar password...' : '••••••••'}
                      className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all pr-10"
                    />
                    <button type="button" onClick={() => setShowUserPass(!showUserPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showUserPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {userModal.mode === 'edit' && (
                    <p className="text-[9px] text-gray-400 mt-1 italic">
                      {isPanelAuthForm
                        ? 'Vazio = manter a password actual.'
                        : 'Vazio = manter a password actual (o servidor não permite ler a password antiga).'}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 lg:col-span-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirmar Password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showUserPass ? 'text' : 'password'}
                        value={userModal.data.confirmPassword || ''}
                        onChange={e => setUserModal({ ...userModal, data: { ...userModal.data, confirmPassword: e.target.value } })}
                        placeholder="Confirmar Password"
                        className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
                        let p = ''
                        for (let i = 0; i < 16; i++) p += chars.charAt(Math.floor(Math.random() * chars.length))
                        setUserModal({ ...userModal, data: { ...userModal.data, password: p, confirmPassword: p } })
                      }}
                      className="px-3 py-2 bg-transparent border border-green-500 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-zinc-800 rounded text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Gerar
                    </button>
                  </div>
                </div>
                {!isPanelAuthForm && (
                  <div className="space-y-1.5 col-span-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Security Level</label><select value={userModal.data.securityLevel || 'HIGH'} onChange={e => setUserModal({ ...userModal, data: { ...userModal.data, securityLevel: e.target.value } })} className="w-full bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"><option value="HIGH">HIGH</option><option value="LOW">LOW</option></select><p className="text-[9px] text-gray-500 mt-1 italic leading-tight">Escolha o nível de segurança para esta conta</p></div>
                )}
              </div>
              {userModal.mode === 'edit' && (
                <div className="mt-6 flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded border border-gray-100 dark:border-zinc-700">
                  <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded flex items-center justify-center ${userModal.data.state !== 'Suspended' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}><Power className="w-5 h-5" /></div><div><p className="text-xs font-bold text-gray-900">Estado da Conta</p><p className="text-[10px] text-gray-500">{userModal.data.state !== 'Suspended' ? 'Ativo - Acesso total' : 'Suspenso - Acesso bloqueado'}</p></div></div>
                  <button onClick={() => setUserModal({ ...userModal, data: { ...userModal.data, state: userModal.data.state === 'Suspended' ? 'Active' : 'Suspended' } })} className={`relative w-12 h-6 rounded-full transition-colors ${userModal.data.state !== 'Suspended' ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${userModal.data.state !== 'Suspended' ? 'translate-x-6' : ''}`} /></button>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800">
              {msg && <div className={`mb-3 px-4 py-2.5 rounded text-sm font-medium border ${msg.includes('✅') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg}</div>}
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setUserModal({ ...userModal, show: false })} className="px-4 py-2 bg-transparent border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-black dark:hover:text-white rounded text-sm font-bold transition-all">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (userModal.mode === 'create') handleCreate(userModal.data)
                    else if (isPanelAuthForm) handlePanelUpdate(userModal.data)
                    else handleUpdate(userModal.data)
                  }}
                  disabled={loading || creating}
                  className={panelBtnPrimary}
                >
                  {(loading || creating) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {userModal.mode === 'create' ? (isPanelAuthCreate ? 'Criar conta' : 'Criar Utilizador') : 'Guardar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Added Missing ConfirmModal */}
      <ConfirmModal
        show={confirm.show}
        title={confirm.title}
        message={confirm.message}
        isDanger={confirm.isDanger}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ ...confirm, show: false })}
      />
    </div>
  )
}

// ============================================================
// RESELLER CENTER (ACL) SECTION
// ============================================================
export function ResellerSection() {
  const [acls, setAcls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    name: '', createWebsite: true, deleteWebsite: true, suspendWebsite: true,
    createPackage: false, deletePackage: false, createEmail: true, deleteEmail: true,
    createDNS: true, createDatabase: true, createFTP: true
  })

  const loadACLs = async () => {
    setLoading(true)
    const a = await directAdminAPI.listACLs()
    setAcls(
      Array.isArray(a)
        ? a.map((x: string | { id?: number; name?: string }) =>
          typeof x === 'string' ? x : (x.name || String(x.id ?? '')),
        ).filter(Boolean)
        : [],
    )
    setLoading(false)
  }
  useEffect(() => { loadACLs() }, [])

  const handleCreate = async () => {
    if (!form.name) return
    setCreating(true); setMsg('')
    const ok = await directAdminAPI.createACL(form)
    if (ok) { setMsg('ACL criada!'); setShowForm(false); setForm({ ...form, name: '' }); loadACLs() }
    else setMsg('Erro ao criar ACL.')
    setCreating(false)
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Eliminar ACL ${name}?`)) return
    const ok = await directAdminAPI.deleteACL(name)
    if (ok) loadACLs()
    else setMsg('Erro ao eliminar.')
  }

  const toggleField = (field: string) => setForm({ ...form, [field]: !(form as any)[field] })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button onClick={() => setShowForm(!showForm)} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-4 py-2 rounded text-sm font-bold transition-all flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Nova ACL</button>
      </div>

      {msg && <div className={`px-4 py-2.5 rounded text-sm font-medium ${msg.includes('criada') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

      {showForm && (
        <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">Criar Nova ACL</h3>
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nome da ACL</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded text-sm" placeholder="reseller_basic" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {[
              { key: 'createWebsite', label: 'Criar Website' }, { key: 'deleteWebsite', label: 'Eliminar Website' },
              { key: 'suspendWebsite', label: 'Suspender Website' }, { key: 'createPackage', label: 'Criar Pacote' },
              { key: 'deletePackage', label: 'Eliminar Pacote' }, { key: 'createEmail', label: 'Criar E-mail' },
              { key: 'deleteEmail', label: 'Eliminar E-mail' }, { key: 'createDNS', label: 'Gerir DNS' },
              { key: 'createDatabase', label: 'Criar BD' }, { key: 'createFTP', label: 'Criar FTP' },
            ].map(p => (
              <label key={p.key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 border border-gray-100">
                <input type="checkbox" checked={(form as any)[p.key]} onChange={() => toggleField(p.key)} className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500" />
                <span className="text-sm text-gray-700">{p.label}</span>
              </label>
            ))}
          </div>
          <button onClick={handleCreate} disabled={creating || !form.name} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50">
            {creating ? 'Criando...' : 'Criar ACL'}
          </button>
        </div>
      )}

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        {loading ? <div className="py-12 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div> : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(Array.isArray(acls) ? acls : []).map((acl, i) => (
              <div key={i} className="border border-gray-200 rounded p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><Shield className="w-5 h-5 text-gray-600" /></div>
                  <span className="font-bold text-sm">{acl}</span>
                </div>
                {acl !== 'admin' && <button onClick={() => handleDelete(acl)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// PHP CONFIGURATION SECTION
// ============================================================
export function PHPConfigSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [config, setConfig] = useState<DirectAdminPHPConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [phpVersion, setPhpVersion] = useState('PHP 8.1')

  const loadConfig = async (domain: string) => {
    if (!domain) return
    setLoading(true); setMsg('')
    const data = await directAdminAPI.getPHPConfig(domain)
    setConfig(data || { phpVersion: 'PHP 8.1', maxExecutionTime: '30', memoryLimit: '256M', uploadMaxFilesize: '50M', postMaxSize: '50M', maxInputVars: '1000', maxInputTime: '60' })
    if (data?.phpVersion) setPhpVersion(data.phpVersion)
    setLoading(false)
  }

  const handleSave = async () => {
    if (!selectedDomain || !config) return
    setSaving(true); setMsg('')
    const ok = await directAdminAPI.savePHPConfig({ domain: selectedDomain, config })
    if (ok) setMsg('Configurações PHP guardadas!')
    else setMsg('Erro ao guardar configurações.')
    setSaving(false)
  }

  const handleChangePHP = async () => {
    if (!selectedDomain) return
    setSaving(true); setMsg('')
    const ok = await directAdminAPI.changePHPVersion({ domain: selectedDomain, phpVersion })
    if (ok) setMsg(`Versão PHP alterada para ${phpVersion}!`)
    else setMsg('Erro ao alterar versão PHP.')
    setSaving(false)
  }

  const updateConfig = (key: string, value: string) => {
    if (config) setConfig({ ...config, [key]: value })
  }

  return (
    <div className="space-y-6">

      <div className="bg-white rounded shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadConfig(e.target.value) }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
              <option value="">Seleccione...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Versão PHP</label>
            <div className="flex items-center gap-2">
              <select value={phpVersion} onChange={(e) => setPhpVersion(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded text-sm">
                <option>PHP 7.4</option><option>PHP 8.0</option><option>PHP 8.1</option><option>PHP 8.2</option><option>PHP 8.3</option>
              </select>
              <button onClick={handleChangePHP} disabled={saving || !selectedDomain} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-4 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 whitespace-nowrap">Alterar</button>
            </div>
          </div>
        </div>

        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('!') && !msg.includes('Erro') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

        {loading ? <div className="py-12 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div> : config && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[
                { key: 'maxExecutionTime', label: 'Max Execution Time', placeholder: '30', suffix: 's' },
                { key: 'memoryLimit', label: 'Memory Limit', placeholder: '256M', suffix: '' },
                { key: 'uploadMaxFilesize', label: 'Upload Max Filesize', placeholder: '50M', suffix: '' },
                { key: 'postMaxSize', label: 'Post Max Size', placeholder: '50M', suffix: '' },
                { key: 'maxInputVars', label: 'Max Input Vars', placeholder: '1000', suffix: '' },
                { key: 'maxInputTime', label: 'Max Input Time', placeholder: '60', suffix: 's' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{f.label}</label>
                  <input value={(config as any)[f.key] || ''} onChange={(e) => updateConfig(f.key, e.target.value)}
                    placeholder={f.placeholder} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                </div>
              ))}
            </div>
            <button onClick={handleSave} disabled={saving} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />} Guardar Configurações PHP
            </button>
          </>
        )}
      </div>

      {/* PHP Extensions */}
      <div className="bg-white rounded shadow-sm border border-gray-200 p-4 md:p-6">
        <div className={`${panelMobileStack} mb-5 md:justify-between`}>
          <div>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Extensões PHP</h3>
            <p className="text-xs text-gray-500 mt-0.5">Extensões recomendadas para WordPress e aplicações web</p>
          </div>
          <a href={`${getHestiaUrl()}/list/php/`} target="_blank" rel="noopener noreferrer"
            className="w-full sm:w-auto bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 text-xs font-bold px-4 py-2 rounded transition-all flex items-center justify-start gap-2 sm:justify-center">
            <ExternalLink className="w-3.5 h-3.5" /> Gerir no DirectAdmin
          </a>
        </div>
        <div className={`${panelMobileCardGrid} md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}>
          {[
            { name: 'mbstring', desc: 'Texto multibyte', wp: true },
            { name: 'mysqli', desc: 'MySQL melhorado', wp: true },
            { name: 'curl', desc: 'Transferência HTTP', wp: true },
            { name: 'gd', desc: 'Imagens GD', wp: true },
            { name: 'xml', desc: 'Processamento XML', wp: true },
            { name: 'zip', desc: 'Compressão ZIP', wp: true },
            { name: 'intl', desc: 'Internacionalização', wp: false },
            { name: 'bcmath', desc: 'Matemática precisão', wp: false },
            { name: 'imagick', desc: 'Processamento imagens', wp: false },
            { name: 'redis', desc: 'Cache Redis', wp: false },
            { name: 'opcache', desc: 'Cache PHP', wp: true },
            { name: 'soap', desc: 'Serviços SOAP', wp: false },
            { name: 'imap', desc: 'Email IMAP', wp: false },
            { name: 'exif', desc: 'Metadados imagens', wp: true },
            { name: 'fileinfo', desc: 'Info de ficheiros', wp: true },
          ].map(ext => (
            <div key={ext.name} className={`flex flex-col items-stretch gap-1 p-3 rounded-lg border text-left ${ext.wp ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-bold text-gray-800">{ext.name}</code>
                {ext.wp && <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-1 rounded">WP</span>}
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">{ext.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          As extensões marcadas <span className="font-bold text-indigo-600">WP</span> são necessárias para WordPress.
          Para instalar, clica em "Gerir no DirectAdmin" → selecciona a versão PHP → activa a extensão.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// SECURITY & FIREWALL SECTION
// ============================================================
export function SecuritySection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [firewallOn, setFirewallOn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAdvancedUpload, setShowAdvancedUpload] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [blockedIPs, setBlockedIPs] = useState<string[]>([])
  const [newIP, setNewIP] = useState('')
  const [msg, setMsg] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [modsecOn, setModsecOn] = useState(false)
  const [modsecLoading, setModsecLoading] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const [fw, ips] = await Promise.all([directAdminAPI.getFirewallStatus(), directAdminAPI.getBlockedIPs()])
        setFirewallOn(fw)
        setBlockedIPs(Array.isArray(ips) ? ips : [])
      } catch (error) {
        console.error('Error loading security status:', error)
        setMsg('Erro ao carregar dados de segurança/firewall.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleToggleFirewall = async () => {
    setToggling(true)
    const ok = await directAdminAPI.toggleFirewall(!firewallOn)
    if (ok) setFirewallOn(!firewallOn)
    else setMsg('Erro ao alterar firewall.')
    setToggling(false)
  }

  const handleBlockIP = async () => {
    if (!newIP.trim()) return
    const ok = await directAdminAPI.blockIP(newIP.trim())
    if (ok) { setBlockedIPs([...blockedIPs, newIP.trim()]); setNewIP('') }
    else setMsg('Erro ao bloquear IP.')
  }

  const handleUnblockIP = async (ip: string) => {
    const ok = await directAdminAPI.unblockIP(ip)
    if (ok) setBlockedIPs(blockedIPs.filter(i => i !== ip))
    else setMsg('Erro ao desbloquear IP.')
  }

  const loadModSec = async (domain: string) => {
    if (!domain) return
    setModsecLoading(true)
    const status = await directAdminAPI.getModSecurityStatus()
    setModsecOn(status)
    setModsecLoading(false)
  }

  const handleToggleModSec = async () => {
    if (!selectedDomain) return
    setModsecLoading(true)
    const ok = await directAdminAPI.toggleModSecurity({ enable: !modsecOn })
    if (ok) setModsecOn(!modsecOn)
    else setMsg('Erro ao alterar ModSecurity.')
    setModsecLoading(false)
  }

  return (
    <div className="space-y-6">

      {msg && <div className="px-4 py-2.5 rounded text-sm font-medium bg-red-50 text-red-700 border border-red-200">{msg}</div>}

      {loading ? <div className="py-12 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Firewall */}
          <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${firewallOn ? 'bg-green-100' : 'bg-red-100'}`}>
                  <Shield className={`w-6 h-6 ${firewallOn ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Firewall</h3>
                  <p className="text-xs text-gray-500">{firewallOn ? 'Ativo e a proteger o servidor' : 'Desativado'}</p>
                </div>
              </div>
              <button onClick={handleToggleFirewall} disabled={toggling}
                className={`px-4 py-2 rounded text-sm font-bold transition-all ${firewallOn ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                {toggling ? <RefreshCw className="w-4 h-4 animate-spin" /> : firewallOn ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>

          {/* ModSecurity */}
          <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">ModSecurity (WAF)</h3>
            <div className="flex gap-3 items-end mb-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
                <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadModSec(e.target.value) }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
                  <option value="">Seleccione...</option>
                  {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
                </select>
              </div>
              {selectedDomain && (
                <button onClick={handleToggleModSec} disabled={modsecLoading}
                  className={`px-4 py-2.5 rounded text-sm font-bold transition-all ${modsecOn ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                  {modsecLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : modsecOn ? 'Desativar' : 'Ativar'}
                </button>
              )}
            </div>
            {selectedDomain && <p className="text-xs text-gray-500">ModSecurity: <span className={`font-bold ${modsecOn ? 'text-green-600' : 'text-red-600'}`}>{modsecOn ? 'Ativo' : 'Inativo'}</span></p>}
          </div>

          {/* Blocked IPs */}
          <div className="bg-white rounded shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <h3 className="font-bold text-gray-900 mb-4">IPs Bloqueados</h3>
            <div className="flex gap-2 mb-4">
              <input value={newIP} onChange={(e) => setNewIP(e.target.value)} placeholder="192.168.1.100" className="flex-1 max-w-sm px-3 py-2.5 border border-gray-300 rounded text-sm font-mono" />
              <button onClick={handleBlockIP} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-4 py-2.5 rounded text-sm font-bold transition-all flex items-center gap-2"><Lock className="w-4 h-4" /> Bloquear</button>
            </div>
            {blockedIPs.length === 0 ? <p className="text-sm text-gray-400">Nenhum IP bloqueado.</p> : (
              <div className="flex flex-wrap gap-2">
                {blockedIPs.map((ip, i) => (
                  <div key={i} className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded">
                    <span className="text-sm font-mono text-red-700">{ip}</span>
                    <button onClick={() => handleUnblockIP(ip)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// SSL CERTIFICATES SECTION (estilo cPanel — domínio + subdomínios + email)
// ============================================================
type SslHostRow = {
  hostname: string
  parentDomain: string
  type: string
}

function sslHostEntries(domain: string, subdomains: string[]): SslHostRow[] {
  const rows: SslHostRow[] = []
  const seen = new Set<string>()
  const add = (hostname: string, type: string) => {
    const key = hostname.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    rows.push({ hostname, parentDomain: domain, type })
  }
  add(domain, 'Domínio principal')
  add(`www.${domain}`, 'Alias www')
  add(`mail.${domain}`, 'Email')
  add(`webmail.${domain}`, 'Webmail')
  for (const sub of subdomains) {
    const name = sub.trim()
    if (!name) continue
    if (name.includes('.')) {
      add(name, 'Subdomínio')
    } else {
      add(`${name}.${domain}`, 'Subdomínio')
    }
  }
  return rows
}

function parseSslRenewalDate(dates?: string): string {
  if (!dates) return '—'
  const match = String(dates).match(/notAfter=([^\n]+)/i)
  if (!match) return '—'
  try {
    return new Date(match[1].trim()).toLocaleString('pt-PT')
  } catch {
    return match[1].trim()
  }
}

function sslHostRowsFromCachedSsl(domain: string, hostSsl: Record<string, boolean>): SslHostRow[] {
  const domainLower = domain.toLowerCase()
  return Object.keys(hostSsl)
    .sort((a, b) => a.localeCompare(b))
    .map((hostname) => {
      const h = hostname.toLowerCase()
      let type = 'Subdomínio'
      if (h === domainLower) type = 'Domínio principal'
      else if (h === `www.${domainLower}`) type = 'Alias www'
      else if (h === `mail.${domainLower}`) type = 'Email'
      else if (h === `webmail.${domainLower}`) type = 'Webmail'
      return { hostname, parentDomain: domain, type }
    })
}

export function SSLSection({
  sites,
  initialDomain,
  setActiveSection,
  setSelectedSslViewHostname,
}: {
  sites: DirectAdminWebsite[]
  initialDomain?: string
  setActiveSection?: (section: string) => void
  setSelectedSslViewHostname?: (hostname: string) => void
}) {
  const defaultDomain = initialDomain || sites[0]?.domain || ''
  const [filterDomain, setFilterDomain] = useState(defaultDomain)
  const [hosts, setHosts] = useState<SslHostRow[]>([])
  const [hostSsl, setHostSsl] = useState<Record<string, boolean>>({})
  const [selectedHosts, setSelectedHosts] = useState<Set<string>>(new Set())
  const [issuing, setIssuing] = useState<string | null>(null)
  const [bulkIssuing, setBulkIssuing] = useState(false)
  const [loadingHosts, setLoadingHosts] = useState(false)
  const [msg, setMsg] = useState('')
  const [forceIssue, setForceIssue] = useState(false)
  const [renewMode, setRenewMode] = useState(false)
  const [autoRenewDays, setAutoRenewDays] = useState('60')
  const [sslRenewalDate, setSslRenewalDate] = useState('—')
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    if (initialDomain) setFilterDomain(initialDomain)
    else if (!filterDomain && sites[0]?.domain) setFilterDomain(sites[0].domain)
  }, [initialDomain, sites])

  const visibleSites = useMemo(
    () => (filterDomain ? sites.filter((s) => s.domain === filterDomain) : sites),
    [filterDomain, sites],
  )

  const siteDomainsKey = useMemo(
    () => `${filterDomain}|${visibleSites.map((s) => s.domain).sort().join('|')}`,
    [filterDomain, visibleSites],
  )

  useEffect(() => {
    let cancelled = false

    const refreshSslNetwork = async (
      allRows: SslHostRow[],
      renewalSeed: string,
      hostSslSeed: Record<string, boolean>,
    ) => {
      const hostnames = allRows.map((h) => h.hostname)
      let renewalDate = renewalSeed
      let nextHostSsl = hostSslSeed

      try {
        const [certRes, sslRes] = await Promise.all([
          fetch('/api/da', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getSslCertificate', params: { hostname: filterDomain } }),
          }),
          hostnames.length
            ? fetch('/api/server-exec', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'checkSitesSsl', params: { domains: hostnames } }),
            })
            : Promise.resolve(null),
        ])

        if (cancelled) return

        const certJson = await certRes.json()
        if (certJson.success && certJson.data?.success !== false && certJson.data?.certificate) {
          writeSslCertCache(filterDomain, certJson.data as CachedSslCert)
          renewalDate = parseSslRenewalDate(certJson.data.dates)
          setSslRenewalDate(renewalDate)
        }

        if (sslRes) {
          const sslData = await sslRes.json()
          if (sslData.success && sslData.data?.ssl) {
            nextHostSsl = sslData.data.ssl as Record<string, boolean>
            setHostSsl(nextHostSsl)
            writeSiteSslCache(nextHostSsl)
            setHosts(sslHostRowsFromCachedSsl(filterDomain, nextHostSsl))
          }
        }

        if (Object.keys(nextHostSsl).length > 0) {
          writeSslHostsCache(filterDomain, { hostSsl: nextHostSsl, renewalDate })
        }
      } catch {
        /* mantém cache */
      }
    }

    const loadHosts = async () => {
      if (!filterDomain || !visibleSites.length) {
        setHosts([])
        setHostSsl({})
        setSelectedHosts(new Set())
        setSslRenewalDate('—')
        return
      }

      const cached = readSslHostsCache(filterDomain, true)
      const cachedCert = readSslCertCache(filterDomain, true)
      const hadCache = Boolean(cached?.hostSsl && Object.keys(cached.hostSsl).length > 0)

      if (hadCache && cached?.hostSsl) {
        setHostSsl(cached.hostSsl)
        setHosts(sslHostRowsFromCachedSsl(filterDomain, cached.hostSsl))
        if (cached.renewalDate) setSslRenewalDate(cached.renewalDate)
        setLoadingHosts(false)

        const rows = sslHostRowsFromCachedSsl(filterDomain, cached.hostSsl)
        const renewalSeed = cached.renewalDate || parseSslRenewalDate(cachedCert?.dates)
        void refreshSslNetwork(rows, renewalSeed, cached.hostSsl)
        return
      }

      setLoadingHosts(true)

      if (cachedCert?.dates) {
        setSslRenewalDate(parseSslRenewalDate(cachedCert.dates))
      }

      const allRows: SslHostRow[] = []

      await Promise.all(
        visibleSites.map(async (site) => {
          let subs: string[] = []
          try {
            const res = await fetch('/api/da', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'listSubdomains', params: { domain: site.domain } }),
            })
            const json = await res.json()
            if (json.success && Array.isArray(json.data)) {
              subs = json.data.map((row: { subdomain?: string }) => String(row.subdomain || ''))
            }
          } catch {
            /* espelho vazio */
          }
          allRows.push(...sslHostEntries(site.domain, subs))
        }),
      )

      if (cancelled) return
      setHosts(allRows)
      setSelectedHosts(new Set())

      const renewalSeed = parseSslRenewalDate(cachedCert?.dates)
      await refreshSslNetwork(allRows, renewalSeed, {})

      if (!cancelled) setLoadingHosts(false)
    }

    void loadHosts()
    return () => { cancelled = true }
  }, [siteDomainsKey, reloadTick])

  const sslOptions = () => ({
    force: forceIssue,
    renew: renewMode,
    autoRenewDays,
  })

  const runSslAction = async (
    action: 'issueSSL' | 'replaceSSL' | 'deleteSSL' | 'cancelSslRenewal' | 'setForceSsl',
    hostname: string,
    confirmMsg?: string,
  ) => {
    if (confirmMsg && !confirm(`⚠️ ${confirmMsg}`)) return false
    setIssuing(`${action}-${hostname}`)
    setMsg('')
    try {
      const body: Record<string, unknown> = { action, params: { domain: hostname, hostname } }
      if (action === 'issueSSL') body.params = { domain: hostname, ...sslOptions() }
      if (action === 'setForceSsl') body.params = { domain: hostname, enabled: true }
      const res = await fetch('/api/da', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      const ok = data.success && (data.data?.success !== false)
      const output = data.data?.output || data.error || ''
      if (ok) {
        if (action === 'deleteSSL') {
          setHostSsl((prev) => ({ ...prev, [hostname]: false }))
        } else if (action !== 'cancelSslRenewal') {
          setHostSsl((prev) => ({ ...prev, [hostname]: true }))
        }
        if ((action === 'issueSSL' || action === 'replaceSSL') && forceIssue) {
          await fetch('/api/da', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'setForceSsl', params: { domain: hostname, enabled: true } }),
          })
        }
        setMsg(`${hostname}: operação concluída com sucesso.`)
        return true
      }
      setMsg(output || `Falha em ${hostname}`)
      return false
    } catch (e: unknown) {
      setMsg('Erro: ' + (e instanceof Error ? e.message : 'desconhecido'))
      return false
    } finally {
      setIssuing(null)
    }
  }

  const handleIssueSSL = (hostname: string) => void runSslAction('issueSSL', hostname)

  const handleBulkIssue = async () => {
    const targets = selectedHosts.size
      ? [...selectedHosts]
      : hosts.filter((h) => !hostSsl[h.hostname]).map((h) => h.hostname)
    if (!targets.length) {
      setMsg('Seleccione pelo menos um hostname sem SSL.')
      return
    }
    setBulkIssuing(true)
    setMsg('')
    let ok = 0
    for (const hostname of targets) {
      const res = await fetch('/api/da', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'issueSSL', params: { domain: hostname, ...sslOptions() } }),
      })
      const data = await res.json()
      if (data.success && data.data?.success !== false) {
        ok++
        setHostSsl((prev) => ({ ...prev, [hostname]: true }))
        if (forceIssue) {
          await fetch('/api/da', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'setForceSsl', params: { domain: hostname, enabled: true } }),
          })
        }
      }
    }
    setMsg(`${ok}/${targets.length} certificado(s) emitido(s).`)
    setBulkIssuing(false)
    setSelectedHosts(new Set())
  }

  const toggleHost = (hostname: string) => {
    setSelectedHosts((prev) => {
      const next = new Set(prev)
      if (next.has(hostname)) next.delete(hostname)
      else next.add(hostname)
      return next
    })
  }

  const toggleAllHosts = () => {
    if (selectedHosts.size === hosts.length) setSelectedHosts(new Set())
    else setSelectedHosts(new Set(hosts.map((h) => h.hostname)))
  }

  const openViewSsl = (hostname: string) => {
    setSelectedSslViewHostname?.(hostname)
    setActiveSection?.('cp-ssl-view')
  }

  const isHostSecure = (hostname: string) => hostSsl[hostname] === true

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900 rounded shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div className="flex items-end gap-2">
            <div className="w-full max-w-xs">
              <label className="text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase block mb-1.5">Website</label>
              <select
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-zinc-600 rounded text-sm bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              >
                {sites.map((s) => (
                  <option key={s.domain} value={s.domain}>{s.domain}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setReloadTick((t) => t + 1)}
              disabled={loadingHosts || !filterDomain}
              className="px-3 py-2.5 border border-gray-300 dark:border-zinc-600 rounded text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 inline-flex items-center justify-center"
              aria-label="Sincronizar"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHosts ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 ml-auto">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
              <span className="text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase">Renovação</span>
              <span>{sslRenewalDate}</span>
            </div>
            <button
              type="button"
              onClick={() => filterDomain && openViewSsl(filterDomain)}
              disabled={!filterDomain}
              className="px-4 py-2.5 border border-gray-300 dark:border-zinc-600 rounded text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              Ver certificado
            </button>
            {filterDomain && !isHostSecure(filterDomain) ? (
              <button
                type="button"
                onClick={() => void handleIssueSSL(filterDomain)}
                disabled={issuing === `issueSSL-${filterDomain}`}
                className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-4 py-2 rounded text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
              >
                {issuing === `issueSSL-${filterDomain}` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Emitir SSL
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 p-4 bg-gray-50 rounded border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
              <input type="checkbox" checked={forceIssue} onChange={(e) => setForceIssue(e.target.checked)} className="rounded" />
              Forçar SSL
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
              <input type="checkbox" checked={renewMode} onChange={(e) => setRenewMode(e.target.checked)} className="rounded" />
              Renovar
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase">Renovação automática</span>
            <select
              value={autoRenewDays}
              onChange={(e) => setAutoRenewDays(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded text-sm bg-white dark:bg-zinc-800"
            >
              <option value="30">30 dias antes</option>
              <option value="60">60 dias antes</option>
              <option value="90">90 dias antes</option>
            </select>
            <button
              type="button"
              onClick={() => void handleBulkIssue()}
              disabled={bulkIssuing || !hosts.length}
              className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-4 py-2 rounded text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
            >
              {bulkIssuing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Emitir em massa
            </button>
          </div>
        </div>

        {msg && (
          <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium whitespace-pre-line ${msg.includes('sucesso') || msg.includes('emitido') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg}
          </div>
        )}

        <div className="overflow-x-auto rounded border border-gray-200 dark:border-zinc-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 text-left">
                <th className="px-3 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={hosts.length > 0 && selectedHosts.size === hosts.length}
                    onChange={toggleAllHosts}
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase">Domínio</th>
                <th className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase">Tipo</th>
                <th className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase">Certificado</th>
                <th className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase text-right">Acções</th>
              </tr>
            </thead>
            <tbody>
              {loadingHosts && !hosts.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                    A carregar domínios e subdomínios...
                  </td>
                </tr>
              )}
              {!loadingHosts && !hosts.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhum domínio encontrado.</td>
                </tr>
              )}
              {hosts.map((row) => {
                const secure = isHostSecure(row.hostname)
                const busy = issuing === `issueSSL-${row.hostname}` || issuing?.endsWith(`-${row.hostname}`)
                return (
                  <tr key={row.hostname} className="border-b border-gray-100 dark:border-zinc-800 last:border-0 hover:bg-gray-50/80 dark:hover:bg-zinc-800/50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedHosts.has(row.hostname)}
                        onChange={() => toggleHost(row.hostname)}
                        aria-label={`Seleccionar ${row.hostname}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">{row.hostname}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">{row.type}</td>
                    <td className="px-4 py-3">
                      {secure ? (
                        <button
                          type="button"
                          onClick={() => openViewSsl(row.hostname)}
                          className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs hover:underline"
                        >
                          <Lock className="w-3.5 h-3.5" /> SSL Activo
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 font-semibold text-xs">
                          <LockOpen className="w-3.5 h-3.5" /> Sem SSL
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                        {!secure && (
                          <button
                            type="button"
                            onClick={() => void handleIssueSSL(row.hostname)}
                            disabled={busy}
                            className="text-green-600 hover:underline font-medium disabled:opacity-50"
                          >
                            {busy ? 'A emitir...' : 'Emitir SSL'}
                          </button>
                        )}
                        {secure && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runSslAction('replaceSSL', row.hostname, `Substituir certificado de ${row.hostname}?`)}
                            className="text-gray-600 dark:text-zinc-400 hover:underline font-medium disabled:opacity-50"
                          >
                            Substituir
                          </button>
                        )}
                        {secure && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runSslAction('deleteSSL', row.hostname, `Excluir certificado de ${row.hostname}?`)}
                            className="text-red-600 hover:underline font-medium disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        )}
                        {secure && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runSslAction('cancelSslRenewal', row.hostname, `Cancelar renovação automática de ${row.hostname}?`)}
                            className="text-gray-600 dark:text-zinc-400 hover:underline font-medium disabled:opacity-50"
                          >
                            Cancelar SSL
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function SSLViewSection({
  sites,
  initialHostname,
  setActiveSection,
}: {
  sites: DirectAdminWebsite[]
  initialHostname?: string
  setActiveSection?: (section: string) => void
}) {
  const [hostname, setHostname] = useState(initialHostname || sites[0]?.domain || '')
  const [loading, setLoading] = useState(() => !readSslCertCache(initialHostname || sites[0]?.domain || ''))
  const [cert, setCert] = useState<{
    subject?: string
    issuer?: string
    dates?: string
    serial?: string
    keyType?: string
    dnsNames?: string
    certificate?: string
    privateKey?: string
  } | null>(() => readSslCertCache(initialHostname || sites[0]?.domain || ''))
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<'cert' | 'key' | null>(null)

  useEffect(() => {
    if (initialHostname) setHostname(initialHostname)
  }, [initialHostname])

  const loadCert = async (host: string, background = false) => {
    if (!host) return
    if (!background) setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/da', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getSslCertificate', params: { hostname: host } }),
      })
      const json = await res.json()
      if (json.success && json.data?.success !== false && json.data?.certificate) {
        setCert(json.data)
        writeSslCertCache(host, json.data as CachedSslCert)
      } else if (!background) {
        setCert(null)
        setError(json.data?.error || json.error || 'Certificado não encontrado')
      }
    } catch (e) {
      if (!background) {
        setCert(null)
        setError(e instanceof Error ? e.message : 'Erro ao carregar certificado')
      }
    }
    if (!background) setLoading(false)
  }

  useEffect(() => {
    if (!hostname) return
    const cached = readSslCertCache(hostname)
    if (cached) {
      setCert(cached)
      setLoading(false)
      void loadCert(hostname, true)
      return
    }
    void loadCert(hostname, false)
  }, [hostname])

  const parseDate = (dates?: string, which: 'notBefore' | 'notAfter' = 'notAfter') => {
    if (!dates) return '—'
    const match = dates.match(new RegExp(`${which}=([^\\n]+)`, 'i'))
    if (!match) return '—'
    try {
      return new Date(match[1].trim()).toLocaleString('pt-PT')
    } catch {
      return match[1].trim()
    }
  }

  const expiresIn = (dates?: string) => {
    const match = dates?.match(/notAfter=([^\n]+)/i)
    if (!match) return '—'
    try {
      const end = new Date(match[1].trim())
      const diff = end.getTime() - Date.now()
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
      if (days < 0) return 'expirado'
      const months = Math.floor(days / 30)
      return months > 0 ? `em ${months} ${months === 1 ? 'mês' : 'meses'} (${parseDate(dates, 'notAfter')})` : `em ${days} dias (${parseDate(dates, 'notAfter')})`
    } catch {
      return parseDate(dates, 'notAfter')
    }
  }

  const copyText = async (text: string, kind: 'cert' | 'key') => {
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), 2000)
  }

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900 rounded shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div className="w-full max-w-xs">
            <label className="text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase block mb-1.5">Website</label>
            <select
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-zinc-600 rounded text-sm bg-white dark:bg-zinc-800"
            >
              {sites.map((s) => (
                <option key={s.domain} value={s.domain}>{s.domain}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection?.('cp-ssl')}
            className="px-4 py-2.5 border border-gray-300 dark:border-zinc-600 rounded text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            ← Emitir SSL
          </button>
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-6 pb-4 border-b border-gray-200 dark:border-zinc-700">
          Ver certificado
        </h2>

        {loading && (
          <div className="py-12 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin inline mr-2" />
            A carregar certificado...
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>
        )}

        {!loading && cert && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-8 text-sm">
              <div><span className="text-gray-500 dark:text-zinc-400 block text-xs uppercase mb-1">Subject</span><span className="font-mono text-gray-900 dark:text-zinc-100">{cert.subject || '—'}</span></div>
              <div><span className="text-gray-500 dark:text-zinc-400 block text-xs uppercase mb-1">Issuer</span><span className="font-mono text-gray-900 dark:text-zinc-100">{cert.issuer || '—'}</span></div>
              <div><span className="text-gray-500 dark:text-zinc-400 block text-xs uppercase mb-1">Emitido em</span><span className="text-gray-900 dark:text-zinc-100">{parseDate(cert.dates, 'notBefore')}</span></div>
              <div><span className="text-gray-500 dark:text-zinc-400 block text-xs uppercase mb-1">Expira</span><span className="text-gray-900 dark:text-zinc-100">{expiresIn(cert.dates)}</span></div>
              <div><span className="text-gray-500 dark:text-zinc-400 block text-xs uppercase mb-1">Domínios e IPs</span><span className="font-mono text-gray-900 dark:text-zinc-100">{cert.dnsNames || hostname}</span></div>
              <div><span className="text-gray-500 dark:text-zinc-400 block text-xs uppercase mb-1">Tipo de chave</span><span className="text-gray-900 dark:text-zinc-100">{cert.keyType || '—'}</span></div>
              <div className="md:col-span-2"><span className="text-gray-500 dark:text-zinc-400 block text-xs uppercase mb-1">Número de série</span><span className="font-mono text-gray-900 dark:text-zinc-100 break-all">{cert.serial || '—'}</span></div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2">Certificado</h3>
              <textarea
                readOnly
                value={cert.certificate || ''}
                className="w-full h-48 font-mono text-xs p-4 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded resize-none text-gray-800 dark:text-zinc-300"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => cert.certificate && downloadText(cert.certificate, `${hostname}.crt`)} className="px-3 py-1.5 border border-gray-300 dark:border-zinc-600 rounded text-xs font-medium">Download</button>
                <button type="button" onClick={() => cert.certificate && void copyText(cert.certificate, 'cert')} className="px-3 py-1.5 border border-gray-300 dark:border-zinc-600 rounded text-xs font-medium inline-flex items-center gap-1">
                  {copied === 'cert' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2">Private key</h3>
              <textarea
                readOnly
                value={cert.privateKey || ''}
                className="w-full h-36 font-mono text-xs p-4 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded resize-none text-gray-800 dark:text-zinc-300"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => cert.privateKey && downloadText(cert.privateKey, `${hostname}.key`)} className="px-3 py-1.5 border border-gray-300 dark:border-zinc-600 rounded text-xs font-medium">Download</button>
                <button type="button" onClick={() => cert.privateKey && void copyText(cert.privateKey, 'key')} className="px-3 py-1.5 border border-gray-300 dark:border-zinc-600 rounded text-xs font-medium inline-flex items-center gap-1">
                  {copied === 'key' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// API CONFIGURATION SECTION
// ============================================================
export function APIConfigSection() {
  const [token, setToken] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [serverStatus, setServerStatus] = useState<any>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    const t = await directAdminAPI.generateAPIToken()
    setToken(t)
    setGenerating(false)
  }

  const handleCopy = () => {
    if (token) { navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  const loadStatus = async () => {
    setLoadingStatus(true)
    try {
      const s = await directAdminAPI.getServerStatus()
      setServerStatus(s)
    } catch {
      setServerStatus(null)
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => { loadStatus() }, [])

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Token */}
        <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><Key className="w-5 h-5 text-gray-600" /></div>
            <h3 className="font-bold text-gray-900">Token de API</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Gere um token para aceder à API do DirectAdmin externamente.</p>
          <button onClick={handleGenerate} disabled={generating}
            className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 mb-4">
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />} Gerar Token
          </button>
          {token && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-gray-700 break-all">{token}</code>
              <button onClick={handleCopy} className="text-gray-500 hover:text-gray-700 shrink-0">
                {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">Endpoint Base</h4>
            <code className="text-sm font-mono bg-gray-50 px-3 py-2 rounded block text-gray-700">{getHestiaUrl()}/api/</code>
          </div>
        </div>

        {/* Server Status */}
        <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center"><Server className="w-5 h-5 text-green-600" /></div>
              <h3 className="font-bold text-gray-900">Estado do Servidor</h3>
            </div>
            <button onClick={loadStatus} disabled={loadingStatus} className="text-gray-500 hover:text-gray-700">
              <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {loadingStatus ? <div className="py-8 text-center"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div> : serverStatus ? (
            <div className="space-y-3">
              {Object.entries(serverStatus).filter(([k]) => !['status', 'error_message', 'source'].includes(k)).slice(0, 8).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-bold text-gray-900">{String(val)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Não foi possível obter o estado do servidor.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// LIST SUBDOMAINS SECTION
// ============================================================
export function ListSubdomainsSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [subdomains, setSubdomains] = useState<DirectAdminSubdomain[]>([])
  const [loading, setLoading] = useState(false)

  const loadSubs = async (domain: string) => {
    if (!domain) return
    setLoading(true)
    const data = await directAdminAPI.listSubdomains(domain)
    setSubdomains(data)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadSubs(e.target.value) }}
            className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
            <option value="">Select a domain...</option>
            {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {loading ? <div className="py-12 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div> : subdomains.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-bold text-gray-500 uppercase border-b"><th className="px-4 py-3">Subdomain</th><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Path</th></tr></thead>
            <tbody>{subdomains.map((s, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.subdomain}</td>
                <td className="px-4 py-3 text-gray-600">{s.domain}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.path}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : selectedDomain ? <p className="text-sm text-gray-400 text-center py-8">No subdomains found.</p> : null}
      </div>
    </div>
  )
}

// ============================================================
// MODIFY WEBSITE SECTION
// ============================================================
export function ModifyWebsiteSection({ sites, packages }: { sites: DirectAdminWebsite[]; packages: DirectAdminPackage[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [packageName, setPackageName] = useState('')
  const [phpVersion, setPhpVersion] = useState('PHP 8.1')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const handleModify = async () => {
    if (!selectedDomain) return
    setSaving(true); setMsg('')
    try {
      const ok = await directAdminAPI.modifyWebsite({ domain: selectedDomain, packageName, phpVersion })
      if (isDaCommandOk(ok)) {
        setMsg('Website modified successfully!')
      } else {
        setMsg('Error modifying website.')
      }
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); const s = sites.find(x => x.domain === e.target.value); if (s && s.package) setPackageName(s.package) }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm"><option value="">Select...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Package</label>
            <select value={packageName} onChange={(e) => setPackageName(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              {packages.map(p => <option key={p.packageName} value={p.packageName}>{p.packageName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">PHP Version</label>
            <select value={phpVersion} onChange={(e) => setPhpVersion(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option>PHP 7.4</option><option>PHP 8.0</option><option>PHP 8.1</option><option>PHP 8.2</option><option>PHP 8.3</option>
            </select>
          </div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleModify} disabled={saving || !selectedDomain} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />} Modify Website
        </button>
      </div>
    </div>
  )
}

// ============================================================
// SUSPEND/UNSUSPEND WEBSITE SECTION
// ============================================================
export function SuspendWebsiteSection({ sites, onRefresh }: { sites: DirectAdminWebsite[]; onRefresh: () => void }) {
  const [loading, setLoading] = useState('')
  const [msg, setMsg] = useState('')

  const parseState = (state: any) => {
    // DirectAdmin: 0 = Active, 1 = Suspended
    if (state === 0 || state === '0' || state === 'Active') return 'Active'
    if (state === 1 || state === '1' || state === 'Suspended') return 'Suspended'
    return state || 'Active'
  }

  const handleToggle = async (domain: string, currentState: string) => {
    setLoading(domain); setMsg('')
    const action = currentState === 'Active' ? 'suspend' : 'unsuspend'
    try {
      const ok = action === 'suspend' ? await directAdminAPI.suspendWebsite(domain) : await directAdminAPI.unsuspendWebsite(domain)
      if (isDaCommandOk(ok)) {
        await syncWebsiteToSupabase({ domain, status: action === 'suspend' ? 'Suspended' : 'Active' })
        onRefresh()
        setMsg(`${domain} ${action === 'suspend' ? 'suspenso' : 'activado'} com sucesso!`)
      } else {
        setMsg(`Erro: não foi possível ${action} ${domain}.`)
      }
    } catch (e: any) {
      setMsg('Erro: ' + e.message)
    }
    setLoading('')
  }

  return (
    <div className="space-y-6">
      {msg && <div className={`px-4 py-2.5 rounded text-sm font-medium ${msg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs font-bold text-gray-500 uppercase border-b bg-gray-50"><th className="px-4 py-3">Domínio</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">SSL</th><th className="px-4 py-3 w-40">Acções</th></tr></thead>
          <tbody>{sites.map((s, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3 font-bold">{s.domain}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold
                  ${parseState(s.state) === 'Active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'}`}>
                  {parseState(s.state) === 'Active' ? '● Activo' : '● Suspenso'}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">{s.owner}</td>
              <td className="px-4 py-3">
                {(s as any).ssl === 'Enabled' || (s as any).ssl === true ? (
                  <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                    <Lock className="w-3 h-3" /> SSL
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-400 text-xs">
                    <LockOpen className="w-3 h-3" /> No SSL
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <button onClick={() => handleToggle(s.domain, parseState(s.state))}
                  disabled={loading === s.domain}
                  className={`px-4 py-2 rounded text-xs font-bold  transition-colors disabled:opacity-50
                    ${parseState(s.state) === 'Active'
                      ? 'bg-orange-50 border border-orange-300 text-orange-600 hover:bg-orange-50 border border-orange-300 text-orange-600'
                      : 'bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 hover:text-green-700'}`}>
                  {parseState(s.state) === 'Active' ? '⏸ Suspender' : '▶ Activar'}
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// DELETE WEBSITE SECTION
// ============================================================
export function DeleteWebsiteSection({ sites, onRefresh }: { sites: DirectAdminWebsite[]; onRefresh: () => void }) {
  const [deleting, setDeleting] = useState('')
  const [msg, setMsg] = useState('')

  const handleDelete = async (domain: string) => {
    if (!confirm(`Are you sure you want to DELETE ${domain}? This action is IRREVERSIBLE!`)) return
    if (!confirm(`FINAL CONFIRMATION: Delete ${domain} and ALL its data?`)) return
    setDeleting(domain); setMsg('')
    try {
      const ok = await directAdminAPI.deleteWebsite(domain)
      if (isDaCommandOk(ok)) {
        await removeWebsiteFromSupabase(domain)
        onRefresh()
        setMsg(`${domain} deleted successfully.`)
      } else {
        setMsg(`Error deleting ${domain}.`)
      }
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    }
    setDeleting('')
  }

  return (
    <div className="space-y-6">
      {msg && <div className={`px-4 py-2.5 rounded text-sm font-medium ${msg.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs font-bold text-gray-500 uppercase border-b bg-gray-50"><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3 w-32">Action</th></tr></thead>
          <tbody>{sites.map((s, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3 font-bold">{s.domain}</td>
              <td className="px-4 py-3 text-gray-600">{s.package}</td>
              <td className="px-4 py-3 text-gray-600">{s.owner}</td>
              <td className="px-4 py-3">
                <button onClick={() => handleDelete(s.domain)} disabled={deleting === s.domain} className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1">
                  {deleting === s.domain ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Delete
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// WORDPRESS PLUGINS SECTION
// ============================================================
export function WPPluginsSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [plugins, setPlugins] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState('')
  const [msg, setMsg] = useState('')

  const loadPlugins = async (domain: string) => {
    if (!domain) return
    setLoading(true)
    const data = await directAdminAPI.listWPPlugins(domain)
    setPlugins(data)
    setLoading(false)
  }

  const handleToggle = async (pluginName: string, activate: boolean) => {
    setToggling(pluginName); setMsg('')
    const ok = await directAdminAPI.toggleWPPlugin({ domain: selectedDomain, plugin: pluginName, activate })
    setMsg(ok ? `Plugin ${activate ? 'activated' : 'deactivated'}!` : 'Error toggling plugin.')
    setToggling('')
    if (ok) loadPlugins(selectedDomain)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadPlugins(e.target.value) }}
            className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded text-sm"><option value="">Select...</option>
            {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('!') && !msg.includes('Error') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        {loading ? <div className="py-12 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div> : plugins.length > 0 ? (
          <div className="space-y-2">{plugins.map((p, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Plug className="w-5 h-5 text-gray-400" />
                <div><p className="font-bold text-sm">{p.name || p.pluginName}</p><p className="text-xs text-gray-500">{p.version || ''}</p></div>
              </div>
              <button onClick={() => handleToggle(p.name || p.pluginName, !p.active)} disabled={toggling === (p.name || p.pluginName)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${p.active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                {toggling === (p.name || p.pluginName) ? <RefreshCw className="w-3 h-3 animate-spin" /> : p.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}</div>
        ) : selectedDomain ? <p className="text-sm text-gray-400 text-center py-8">No plugins found or unable to fetch. Ensure WordPress is installed on this domain.</p> : null}
      </div>
    </div>
  )
}

// ============================================================
// WORDPRESS RESTORE BACKUPS SECTION
// ============================================================
export function WPRestoreBackupSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [backups, setBackups] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState('')
  const [msg, setMsg] = useState('')

  const loadBackups = async (domain: string) => {
    if (!domain) return
    setLoading(true)
    const data = await directAdminAPI.listWPBackups(domain)
    setBackups(data)
    setLoading(false)
  }

  const handleRestore = async (backupFile: string) => {
    if (!confirm(`Restore backup ${backupFile}?`)) return
    setRestoring(backupFile); setMsg('')
    const ok = await directAdminAPI.restoreWPBackup({ domain: selectedDomain, backup: backupFile })
    setMsg(ok ? 'Backup restored successfully!' : 'Error restoring backup.')
    setRestoring('')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadBackups(e.target.value) }}
            className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded text-sm"><option value="">Select...</option>
            {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        {loading ? <div className="py-12 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div> : backups.length > 0 ? (
          <div className="space-y-2">{backups.map((b, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50">
              <div className="flex items-center gap-3"><Download className="w-5 h-5 text-gray-400" /><span className="font-mono text-sm">{b}</span></div>
              <button onClick={() => handleRestore(b)} disabled={restoring === b} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1">
                {restoring === b ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Restore
              </button>
            </div>
          ))}</div>
        ) : selectedDomain ? <p className="text-sm text-gray-400 text-center py-8">No backups found for this domain.</p> : null}
      </div>
    </div>
  )
}

// ============================================================
// WORDPRESS REMOTE BACKUP SECTION
// ============================================================
export function WPRemoteBackupSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [destination, setDestination] = useState('')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')

  const handleCreate = async () => {
    if (!selectedDomain) return
    setCreating(true); setMsg('')
    const ok = await directAdminAPI.createRemoteBackup({ domain: selectedDomain, destination })
    setMsg(ok ? 'Remote backup initiated!' : 'Error creating remote backup.')
    setCreating(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm"><option value="">Select...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Destination (optional)</label>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="s3://bucket or sftp://..." className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" />
          </div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('initiated') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleCreate} disabled={creating || !selectedDomain} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Create Remote Backup
        </button>
      </div>
    </div>
  )
}

// ============================================================
// DNS NAMESERVER SECTION
// ============================================================
export function DNSNameserverSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [ns1, setNs1] = useState('ns1.')
  const [ns1IP, setNs1IP] = useState('')
  const [ns2, setNs2] = useState('ns2.')
  const [ns2IP, setNs2IP] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const handleCreate = async () => {
    if (!selectedDomain || !ns1 || !ns1IP || !ns2 || !ns2IP) return
    setSaving(true); setMsg('')
    const ok = await directAdminAPI.createNameserver({ domain: selectedDomain, ns1, ns1IP, ns2, ns2IP })
    setMsg(ok ? 'Nameservers created!' : 'Error creating nameservers.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-3">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); setNs1(`ns1.${e.target.value}`); setNs2(`ns2.${e.target.value}`) }}
              className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded text-sm"><option value="">Select...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">NS1</label><input value={ns1} onChange={(e) => setNs1(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm font-mono" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">NS1 IP</label><input value={ns1IP} onChange={(e) => setNs1IP(e.target.value)} placeholder={getServerHost()} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm font-mono" /></div>
          <div></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">NS2</label><input value={ns2} onChange={(e) => setNs2(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm font-mono" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">NS2 IP</label><input value={ns2IP} onChange={(e) => setNs2IP(e.target.value)} placeholder={getServerHost()} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm font-mono" /></div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('created') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleCreate} disabled={saving || !selectedDomain} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />} Create Nameservers
        </button>
      </div>
    </div>
  )
}

export function NameserverManagementSection({
  sites,
  initialDomain,
}: {
  sites: DirectAdminWebsite[]
  initialDomain?: string
}) {
  const [mode, setMode] = useState<'default' | 'custom'>('default')
  const [selectedDomain, setSelectedDomain] = useState(initialDomain || '')
  const [ns1, setNs1] = useState<string>(VISUALDESIGN_DEFAULT_NS.ns1)
  const [ns2, setNs2] = useState<string>(VISUALDESIGN_DEFAULT_NS.ns2)
  const [ns1IP, setNs1IP] = useState('')
  const [ns2IP, setNs2IP] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (initialDomain) {
      setSelectedDomain(initialDomain)
    }
  }, [initialDomain])

  useEffect(() => {
    if (mode === 'default') {
      setNs1(VISUALDESIGN_DEFAULT_NS.ns1)
      setNs2(VISUALDESIGN_DEFAULT_NS.ns2)
    } else if (selectedDomain) {
      setNs1(`ns1.${selectedDomain}`)
      setNs2(`ns2.${selectedDomain}`)
    }
  }, [mode, selectedDomain])

  const handleSaveDefault = async () => {
    setSaving(true)
    setMsg('')
    const ok = await directAdminAPI.configDefaultNameservers({
      ns1: VISUALDESIGN_DEFAULT_NS.ns1,
      ns2: VISUALDESIGN_DEFAULT_NS.ns2,
    })
    setMsg(ok ? 'Nameservers predefinidos Visual Design activados.' : 'Erro ao configurar nameservers.')
    setSaving(false)
  }

  const handleCreateCustom = async () => {
    if (!selectedDomain || !ns1 || !ns1IP || !ns2 || !ns2IP) return
    setSaving(true)
    setMsg('')
    const ok = await directAdminAPI.createNameserver({ domain: selectedDomain, ns1, ns1IP, ns2, ns2IP })
    setMsg(ok ? 'Nameservers personalizados criados.' : 'Erro ao criar nameservers.')
    setSaving(false)
  }

  return (
    <div className="w-full space-y-4">
      <div className="rounded border border-gray-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="mb-4 text-sm text-gray-600 dark:text-zinc-400">
          Escolha os nameservers predefinidos ou configure nameservers personalizados por domínio.
        </p>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded border p-4 transition-colors hover:border-gray-300 dark:hover:border-zinc-600 ${mode === 'default'
                ? 'border-red-300 dark:border-red-800'
                : 'border-gray-200 dark:border-zinc-700'
              }`}
          >
            <input
              type="radio"
              name="ns-mode"
              checked={mode === 'default'}
              onChange={() => setMode('default')}
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">DNS predefinido Visual Design</p>
              <p className="mt-1 font-mono text-xs text-gray-600 dark:text-zinc-400">
                {VISUALDESIGN_DEFAULT_NS.ns1}
                <br />
                {VISUALDESIGN_DEFAULT_NS.ns2}
              </p>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded border p-4 transition-colors hover:border-gray-300 dark:hover:border-zinc-600 ${mode === 'custom'
                ? 'border-red-300 dark:border-red-800'
                : 'border-gray-200 dark:border-zinc-700'
              }`}
          >
            <input
              type="radio"
              name="ns-mode"
              checked={mode === 'custom'}
              onChange={() => setMode('custom')}
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Nameservers personalizados</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-zinc-400">
                Criar child nameservers (glue records) para um domínio específico.
              </p>
            </div>
          </label>
        </div>

        {mode === 'custom' && (
          <div className="mb-6 space-y-4 border-t border-gray-100 pt-4 dark:border-zinc-800">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">Domínio</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className={`${panelField} w-full max-w-md`}
              >
                <option value="">Seleccione...</option>
                {sites.map((s) => (
                  <option key={s.domain} value={s.domain}>
                    {s.domain}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">NS1</label>
                <input value={ns1} onChange={(e) => setNs1(e.target.value)} className={`${panelField} w-full font-mono`} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">NS1 IP</label>
                <input
                  value={ns1IP}
                  onChange={(e) => setNs1IP(e.target.value)}
                  placeholder={getServerHost()}
                  className={`${panelField} w-full font-mono`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">NS2</label>
                <input value={ns2} onChange={(e) => setNs2(e.target.value)} className={`${panelField} w-full font-mono`} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">NS2 IP</label>
                <input
                  value={ns2IP}
                  onChange={(e) => setNs2IP(e.target.value)}
                  placeholder={getServerHost()}
                  className={`${panelField} w-full font-mono`}
                />
              </div>
            </div>
          </div>
        )}

        {msg && (
          <div
            className={`mb-4 rounded border px-4 py-2.5 text-sm ${msg.includes('Erro')
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400'
                : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
          >
            {msg}
          </div>
        )}

        <button
          type="button"
          onClick={() => (mode === 'default' ? void handleSaveDefault() : void handleCreateCustom())}
          disabled={saving || (mode === 'custom' && (!selectedDomain || !ns1IP || !ns2IP))}
          className={panelBtnPrimary}
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
          {mode === 'default' ? 'Activar DNS Visual Design' : 'Criar nameservers'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// DNS DEFAULT NAMESERVERS SECTION
// ============================================================
export function DNSDefaultNSSection() {
  const [ns1, setNs1] = useState('')
  const [ns2, setNs2] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const handleSave = async () => {
    if (!ns1 || !ns2) return
    setSaving(true); setMsg('')
    const ok = await directAdminAPI.configDefaultNameservers({ ns1, ns2 })
    setMsg(ok ? 'Default nameservers configured!' : 'Error configuring nameservers.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nameserver 1</label><input value={ns1} onChange={(e) => setNs1(e.target.value)} placeholder="ns1.yourdomain.com" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm font-mono" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nameserver 2</label><input value={ns2} onChange={(e) => setNs2(e.target.value)} placeholder="ns2.yourdomain.com" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm font-mono" /></div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('configured') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleSave} disabled={saving || !ns1 || !ns2} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />} Save Configuration
        </button>
      </div>
    </div>
  )
}

// ============================================================
// DNS ZONE CREATE/DELETE SECTIONS
// ============================================================
export function DNSCreateZoneSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [domain, setDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const handleCreate = async () => {
    if (!domain) return
    setSaving(true); setMsg('')
    const ok = await directAdminAPI.createDNSZone(domain)
    setMsg(ok ? `DNS zone created for ${domain}!` : 'Error creating DNS zone.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="flex gap-3 items-end mb-6">
          <div className="flex-1 max-w-sm">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <button onClick={handleCreate} disabled={saving || !domain} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />} Create Zone
          </button>
        </div>
        {msg && <div className={`px-4 py-2.5 rounded text-sm font-medium ${msg.includes('created') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      </div>
    </div>
  )
}

export function DNSDeleteZoneSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [domain, setDomain] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  const handleDelete = async () => {
    if (!domain || !confirm(`Delete DNS zone for ${domain}?`)) return
    setDeleting(true); setMsg('')
    const ok = await directAdminAPI.deleteDNSZone(domain)
    setMsg(ok ? `DNS zone deleted for ${domain}!` : 'Error deleting DNS zone.')
    setDeleting(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="flex gap-3 items-end mb-6">
          <div className="flex-1 max-w-sm">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <button onClick={handleDelete} disabled={deleting || !domain} className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
            {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Zone
          </button>
        </div>
        {msg && <div className={`px-4 py-2.5 rounded text-sm font-medium ${msg.includes('deleted') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      </div>
    </div>
  )
}

// ============================================================
// CLOUDFLARE SECTION
// ============================================================
export function CloudFlareSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [email, setEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const handleSave = async () => {
    if (!selectedDomain || !email || !apiKey) return
    setSaving(true); setMsg('')
    const ok = await directAdminAPI.configCloudFlare({ domain: selectedDomain, email, apiKey })
    setMsg(ok ? 'CloudFlare configured!' : 'Error configuring CloudFlare.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">CloudFlare Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@email.com" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">API Key</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" /></div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('configured') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleSave} disabled={saving || !selectedDomain || !email || !apiKey} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />} Configure CloudFlare
        </button>
      </div>
    </div>
  )
}

// ============================================================
// DNS RESET SECTION
// ============================================================
export function DNSResetSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [domain, setDomain] = useState('')
  const [resetting, setResetting] = useState(false)
  const [msg, setMsg] = useState('')

  const handleReset = async () => {
    if (!domain || !confirm(`Reset ALL DNS configurations for ${domain}? This cannot be undone!`)) return
    setResetting(true); setMsg('')
    const ok = await directAdminAPI.resetDNSConfigurations(domain)
    setMsg(ok ? `DNS configurations reset for ${domain}!` : 'Error resetting DNS.')
    setResetting(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="flex gap-3 items-end mb-6">
          <div className="flex-1 max-w-sm">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <button onClick={handleReset} disabled={resetting || !domain} className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
            {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reset DNS
          </button>
        </div>
        {msg && <div className={`px-4 py-2.5 rounded text-sm font-medium ${msg.includes('reset') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      </div>
    </div>
  )
}

// ============================================================
// EMAIL DELETE SECTION
// ============================================================
export function EmailDeleteSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [emails, setEmails] = useState<DirectAdminEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState('')
  const [msg, setMsg] = useState('')

  const loadEmails = async (domain: string) => { if (!domain) return; setLoading(true); const data = await directAdminAPI.listEmails(domain); setEmails(data); setLoading(false) }

  const handleDelete = async (email: string) => {
    if (!confirm(`Delete ${email}?`)) return
    setDeleting(email); setMsg('')
    const ok = await directAdminAPI.deleteEmail({ domain: selectedDomain, email })
    setMsg(ok ? `${email} deleted!` : 'Error deleting email.')
    setDeleting('')
    if (ok) loadEmails(selectedDomain)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="mb-6"><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadEmails(e.target.value) }} className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded text-sm">
            <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('deleted') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        {loading ? <div className="py-8 text-center"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div> : emails.length > 0 ? (
          <div className="space-y-2">{emails.map((em, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50">
              <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-red-500" /><span className="font-bold text-sm">{em.email}</span></div>
              <button onClick={() => handleDelete(em.email)} disabled={deleting === em.email} className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1">
                {deleting === em.email ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Delete
              </button>
            </div>
          ))}</div>
        ) : selectedDomain ? <p className="text-sm text-gray-400 text-center py-8">No emails found.</p> : null}
      </div>
    </div>
  )
}

// ============================================================
// EMAIL LIMITS SECTION
// ============================================================
export function EmailLimitsSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [emails, setEmails] = useState<DirectAdminEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [editingEmail, setEditingEmail] = useState('')
  const [limit, setLimit] = useState('500')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadEmails = async (domain: string) => { if (!domain) return; setLoading(true); const data = await directAdminAPI.listEmails(domain); setEmails(data); setLoading(false) }

  const handleSave = async (email: string) => {
    setSaving(true); setMsg('')
    const ok = await directAdminAPI.setEmailLimits({ domain: selectedDomain, email, limit: parseInt(limit) })
    setMsg(ok ? 'Limit updated!' : 'Error updating limit.')
    setSaving(false); setEditingEmail('')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="mb-6"><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadEmails(e.target.value) }} className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded text-sm">
            <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('updated') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        {loading ? <div className="py-8 text-center"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div> : emails.length > 0 ? (
          <div className="space-y-2">{emails.map((em, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50">
              <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-gray-400" /><span className="font-bold text-sm">{em.email}</span></div>
              {editingEmail === em.email ? (
                <div className="flex items-center gap-2">
                  <input value={limit} onChange={(e) => setLimit(e.target.value)} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" placeholder="500" />
                  <button onClick={() => handleSave(em.email)} disabled={saving} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-3 py-1 rounded text-xs font-bold">Save</button>
                </div>
              ) : (
                <button onClick={() => { setEditingEmail(em.email); setLimit('500') }} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded font-medium">Set Limit</button>
              )}
            </div>
          ))}</div>
        ) : selectedDomain ? <p className="text-sm text-gray-400 text-center py-8">No emails found.</p> : null}
      </div>
    </div>
  )
}

// ============================================================
// EMAIL FORWARDING SECTION
// ============================================================
export function EmailForwardingSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [emails, setEmails] = useState<DirectAdminEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState('')
  const [forwards, setForwards] = useState<string[]>([])
  const [forwardTo, setForwardTo] = useState('')
  const [msg, setMsg] = useState('')

  const loadEmails = async (domain: string) => { if (!domain) return; setLoading(true); const data = await directAdminAPI.listEmails(domain); setEmails(data); setLoading(false) }

  const loadForwards = async (email: string) => {
    setSelectedEmail(email)
    const fwds = await directAdminAPI.getEmailForwarding({ email })
    setForwards(fwds)
  }

  const handleAdd = async () => {
    if (!selectedEmail || !forwardTo) return
    const ok = await directAdminAPI.addEmailForwarding({ email: selectedEmail, forward: forwardTo })
    if (ok) { setForwardTo(''); loadForwards(selectedEmail) }
    else setMsg('Error adding forwarding.')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="mb-6"><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadEmails(e.target.value); setSelectedEmail('') }} className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded text-sm">
            <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {msg && <div className="mb-4 px-4 py-2.5 rounded text-sm font-medium bg-red-50 text-red-700 border border-red-200">{msg}</div>}
        {loading ? <div className="py-8 text-center"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div> : emails.length > 0 ? (
          <div className="space-y-2">{emails.map((em, i) => (
            <div key={i} className="border border-gray-200 rounded p-3 hover:bg-gray-50">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => loadForwards(em.email)}>
                <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-gray-400" /><span className="font-bold text-sm">{em.email}</span></div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
              {selectedEmail === em.email && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex gap-2 mb-2">
                    <input value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} placeholder="forward@email.com" className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm" />
                    <button onClick={handleAdd} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-4 py-2 rounded text-sm font-bold">Add</button>
                  </div>
                  {forwards.length > 0 && <div className="flex flex-wrap gap-1">{forwards.map((f, fi) => <span key={fi} className="bg-gray-100 px-2 py-1 rounded text-xs">{f}</span>)}</div>}
                </div>
              )}
            </div>
          ))}</div>
        ) : selectedDomain ? <p className="text-sm text-gray-400 text-center py-8">No emails found.</p> : null}
      </div>
    </div>
  )
}

// ============================================================
// CATCH-ALL EMAIL SECTION
// ============================================================
export function CatchAllEmailSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [catchAll, setCatchAll] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadCatchAll = async (domain: string) => { if (!domain) return; setLoading(true); const ca = await directAdminAPI.getCatchAllEmail(domain); setCatchAll(ca || ''); setLoading(false) }

  const handleSave = async () => {
    if (!selectedDomain) return
    setSaving(true); setMsg('')
    const ok = await directAdminAPI.setCatchAllEmail({ domain: selectedDomain, email: catchAll })
    setMsg(ok ? 'Catch-all configured!' : 'Error configuring catch-all.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadCatchAll(e.target.value) }} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Catch-All Email</label>
            {loading ? <div className="py-2"><RefreshCw className="w-4 h-4 animate-spin text-gray-400" /></div> :
              <input value={catchAll} onChange={(e) => setCatchAll(e.target.value)} placeholder="admin@domain.com" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" />}
          </div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('configured') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleSave} disabled={saving || !selectedDomain} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Catch-All'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// PATTERN FORWARDING SECTION
// ============================================================
export function PatternForwardingSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [patterns, setPatterns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pattern, setPattern] = useState('')
  const [destination, setDestination] = useState('')
  const [msg, setMsg] = useState('')

  const loadPatterns = async (domain: string) => { if (!domain) return; setLoading(true); const data = await directAdminAPI.getPatternForwarding(domain); setPatterns(data); setLoading(false) }

  const handleAdd = async () => {
    if (!selectedDomain || !pattern || !destination) return
    const ok = await directAdminAPI.addPatternForwarding({ domain: selectedDomain, pattern, destination })
    if (ok) { setPattern(''); setDestination(''); loadPatterns(selectedDomain) }
    else setMsg('Error adding pattern.')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadPatterns(e.target.value) }} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Pattern</label><input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="sales-*" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Destination</label><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="team@email.com" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" /></div>
        </div>
        {msg && <div className="mb-4 px-4 py-2.5 rounded text-sm font-medium bg-red-50 text-red-700 border border-red-200">{msg}</div>}
        <button onClick={handleAdd} disabled={!selectedDomain || !pattern || !destination} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 mb-4">Add Pattern</button>
        {loading ? <div className="py-4 text-center"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div> : patterns.length > 0 && (
          <div className="space-y-2">{patterns.map((p, i) => <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm"><span className="font-mono">{p.pattern || p.source}</span><ArrowRight className="w-4 h-4 text-gray-400" /><span>{p.destination || p.target}</span></div>)}</div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// PLUS-ADDRESSING SECTION
// ============================================================
export function PlusAddressingSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [msg, setMsg] = useState('')

  const loadStatus = async (domain: string) => { if (!domain) return; setLoading(true); const s = await directAdminAPI.getPlusAddressing(domain); setEnabled(s); setLoading(false) }

  const handleToggle = async () => {
    if (!selectedDomain) return
    setToggling(true); setMsg('')
    const ok = await directAdminAPI.togglePlusAddressing({ domain: selectedDomain, enable: !enabled })
    if (ok) setEnabled(!enabled)
    else setMsg('Error toggling plus-addressing.')
    setToggling(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="flex gap-4 items-end mb-6">
          <div className="flex-1 max-w-sm"><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadStatus(e.target.value) }} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          {selectedDomain && !loading && (
            <button onClick={handleToggle} disabled={toggling} className={`px-4 py-2.5 rounded text-sm font-bold transition-all ${enabled ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
              {toggling ? <RefreshCw className="w-4 h-4 animate-spin" /> : enabled ? 'Disable' : 'Enable'}
            </button>
          )}
        </div>
        {loading && <div className="py-4"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div>}
        {msg && <div className="px-4 py-2.5 rounded text-sm font-medium bg-red-50 text-red-700 border border-red-200">{msg}</div>}
        {selectedDomain && !loading && <p className="text-sm text-gray-600">Plus-addressing is currently <span className={`font-bold ${enabled ? 'text-green-600' : 'text-red-600'}`}>{enabled ? 'enabled' : 'disabled'}</span> for {selectedDomain}.</p>}
      </div>
    </div>
  )
}

// ============================================================
// EMAIL CHANGE PASSWORD SECTION
// ============================================================
export function EmailChangePasswordSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [emails, setEmails] = useState<DirectAdminEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState('')
  const [newPass, setNewPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadEmails = async (domain: string) => {
    if (!domain) return;
    setLoading(true);
    try {
      const data = await directAdminAPI.listEmails(domain);
      setEmails(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao carregar emails:', err);
      setEmails([]);
    }
    setLoading(false);
  }

  const handleChange = async () => {
    if (!selectedEmail || !newPass) return
    setSaving(true); setMsg('')
    const ok = await directAdminAPI.changeEmailPassword({ email: selectedEmail, password: newPass })
    setMsg(ok ? 'Password changed!' : 'Error changing password.')
    setSaving(false); setNewPass('')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadEmails(e.target.value); setSelectedEmail('') }} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Email Account</label>
            {loading ? <div className="py-2"><RefreshCw className="w-4 h-4 animate-spin text-gray-400" /></div> :
              <select value={selectedEmail} onChange={(e) => setSelectedEmail(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
                <option value="">Select...</option>{emails.map(em => <option key={em.email} value={em.email}>{em.email}</option>)}
              </select>}
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">New Password</label><input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="••••••" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" /></div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('changed') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleChange} disabled={saving || !selectedEmail || !newPass} className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />} Change Password
        </button>
      </div>
    </div>
  )
}

// ============================================================
// DKIM MANAGER SECTION
// ============================================================
export function DKIMManagerSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [dkim, setDkim] = useState<{ enabled: boolean; record: string; selector?: string; publicKey?: string; privateKey?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [msg, setMsg] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const loadDKIM = async (domain: string, autoGenerate = false) => {
    if (!domain) return;
    setLoading(true);
    if (!autoGenerate) setMsg('');
    try {
      console.log(`[DKIM] Buscando DKIM para ${domain}...`);
      // Buscar dados do DKIM via API
      const result = await directAdminAPI.getDKIMStatus(domain);
      console.log('[DKIM] Resultado bruto:', result);
      // A API retorna no formato { output: 'conteúdo do arquivo' }
      const dkimContent = result?.record || result?.publicKey || result?.output || '';
      console.log('[DKIM] dkimContent:', dkimContent?.substring(0, 100));
      const hasDKIM = dkimContent && dkimContent.includes('v=DKIM1');
      console.log('[DKIM] hasDKIM:', hasDKIM);

      // Verificar se temos dados válidos
      if (hasDKIM) {
        console.log('[DKIM] DKIM encontrado! Atualizando estado...');
        // DKIM já existe - mostrar chaves
        setDkim({
          enabled: true,
          record: dkimContent,
          selector: 'default',
          publicKey: dkimContent,
          privateKey: ''
        });
      } else if (autoGenerate) {
        console.log('[DKIM] DKIM não encontrado, gerando novo...');
        // Auto-gerar apenas quando chamado explicitamente
        setMsg('Gerando chaves DKIM...');
        const generated = await directAdminAPI.enableDKIM(domain);
        console.log('DKIM Generate result:', generated);

        if (generated?.success !== false) {
          // Aguardar mais tempo para o DirectAdmin gerar as chaves
          await new Promise(r => setTimeout(r, 3000));

          // Tentar obter as chaves novamente
          const updated = await directAdminAPI.getDKIMStatus(domain);
          console.log('DKIM Updated after generate:', updated);

          // A API retorna no formato { output: 'conteúdo' }
          const updatedContent = updated?.record || updated?.publicKey || updated?.output || '';
          const hasUpdatedDKIM = updatedContent && updatedContent.includes('v=DKIM1');

          if (hasUpdatedDKIM) {
            setDkim({
              enabled: true,
              record: updatedContent,
              selector: 'default',
              publicKey: updatedContent,
              privateKey: ''
            });
            setMsg('Chaves DKIM geradas! Configure no seu DNS e depois teste.');
          } else {
            setMsg('Chaves geradas mas ainda não disponíveis. Clique em Gerar novamente ou aguarde.');
          }
        } else {
          setMsg('Não foi possível gerar chaves. Tente novamente.');
        }
      } else {
        // Não auto-gerar ao selecionar - deixar usuário clicar no botão
        setDkim(null);
      }
    } catch (err: any) {
      console.error('Erro ao carregar DKIM:', err);
      if (!autoGenerate) {
        setMsg('Erro ao comunicar com o servidor. Clique em "Gerar Chaves DKIM".');
      }
      setDkim(null);
    }
    setLoading(false);
  }

  const handleGenerate = async () => {
    if (!selectedDomain) return
    setEnabling(true);
    await loadDKIM(selectedDomain, true); // autoGenerate = true
    setEnabling(false);
  }

  const handleTest = async () => {
    if (!selectedDomain) return
    setMsg('A verificar configuração DKIM...');
    try {
      // Abrir ferramenta externa de verificação
      window.open(`https://mxtoolbox.com/dkim.aspx?domain=${selectedDomain}`, '_blank');
      setMsg('Verificação aberta no MXToolbox. Verifique se o DKIM está válido.');
    } catch (err) {
      setMsg('Erro ao abrir ferramenta de teste.');
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Extrair dados do record DKIM do arquivo default.txt
  const getDKIMData = () => {
    if (!dkim?.record) return null

    const record = dkim.record
    const selector = dkim.selector || 'default'
    const name = `${selector}._domainkey.${selectedDomain}`

    // Parsear o conteúdo do arquivo default.txt
    // Formato: default._domainkey IN TXT ( "v=DKIM1; h=sha256; k=rsa; " "p=..." )
    let value = ''

    if (record.includes('v=DKIM1')) {
      // Extrair tudo entre aspas e concatenar
      const matches = record.match(/"([^"]+)"/g)
      if (matches) {
        value = matches.map(m => m.replace(/"/g, '')).join('')
      } else {
        // Fallback: usar o record diretamente
        value = record
      }
    } else {
      value = dkim.publicKey || record
    }

    const privateKey = dkim.privateKey || ''
    return { name, value, selector, privateKey }
  }

  const dkimData = getDKIMData()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center">
          <Shield className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">DKIM Manager</h1>
          <p className="text-xs text-gray-600">Gerar e gerir chaves DKIM para autenticação de email</p>
        </div>
      </div>

      {/* Seletor de Domínio */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <label className="text-xs font-bold text-gray-600 uppercase block mb-2">Selecionar Website</label>
        <select
          value={selectedDomain}
          onChange={(e) => { setSelectedDomain(e.target.value); loadDKIM(e.target.value, false) }}
          className="w-full max-w-md px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-red-500"
        >
          <option value="">Selecione um domínio...</option>
          {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
        </select>
      </div>

      {loading && selectedDomain && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm text-gray-500 mt-3">A carregar chaves DKIM...</p>
        </div>
      )}

      {msg && (
        <div className={`px-4 py-3 rounded text-sm font-medium flex items-center gap-2 ${msg.includes('sucesso') || msg.includes('geradas') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.includes('sucesso') || msg.includes('geradas') ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg}
        </div>
      )}

      {/* Chaves DKIM - Layout tipo DirectAdmin */}
      {dkimData && selectedDomain && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          {/* Header com status e botões */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${dkim?.enabled ? 'bg-green-500' : 'bg-amber-500'}`} />
              <h2 className="text-lg font-bold text-gray-900">Chaves DKIM - {selectedDomain}</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={enabling}
                className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-4 py-2 rounded text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {enabling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {dkim?.enabled ? 'Regenerar Chaves' : 'Gerar Chaves'}
              </button>
              {dkim?.enabled && (
                <button
                  onClick={handleTest}
                  className="bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded text-sm font-bold transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Testar DKIM
                </button>
              )}
            </div>
          </div>

          {/* Grid com Private e Public Key */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Private Key */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-gray-800">PRIVATE KEY</h3>
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Mantenha segura</span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <textarea
                  readOnly
                  value={dkimData.privateKey || '-----BEGIN PRIVATE KEY-----\n[Chave privada gerada pelo servidor]\n-----END PRIVATE KEY-----'}
                  className="w-full h-48 bg-white border border-gray-200 rounded p-3 text-xs font-mono text-gray-600 resize-none focus:outline-none"
                />
              </div>
            </div>

            {/* Public Key */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-800">PUBLIC KEY</h3>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Adicione ao DNS</span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <textarea
                  readOnly
                  value={dkimData.value}
                  className="w-full h-48 bg-white border border-gray-200 rounded p-3 text-xs font-mono text-gray-600 resize-none focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Instruções de configuração DNS */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Configuração DNS - Registro TXT
            </h4>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-blue-600 uppercase font-bold block mb-1">Nome / Host</span>
                <div className="flex items-center gap-2">
                  <code className="bg-white border border-blue-200 rounded px-2 py-1 text-xs font-mono flex-1 break-all">
                    {dkimData.name}
                  </code>
                  <button
                    onClick={() => copyToClipboard(dkimData.name, 'name')}
                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                    title="Copiar"
                  >
                    {copiedField === 'name' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-xs text-blue-600 uppercase font-bold block mb-1">Tipo</span>
                <code className="bg-white border border-blue-200 rounded px-2 py-1 text-xs font-mono">TXT</code>
              </div>
              <div>
                <span className="text-xs text-blue-600 uppercase font-bold block mb-1">TTL</span>
                <code className="bg-white border border-blue-200 rounded px-2 py-1 text-xs font-mono">14400</code>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-blue-600 uppercase font-bold block mb-1">Valor / Conteúdo (copie tudo)</span>
              <div className="flex items-start gap-2">
                <code className="bg-white border border-blue-200 rounded px-3 py-2 text-xs font-mono flex-1 break-all max-h-32 overflow-y-auto">
                  {dkimData.value}
                </code>
                <button
                  onClick={() => copyToClipboard(dkimData.value, 'value')}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                  title="Copiar valor"
                >
                  {copiedField === 'value' ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Info adicional */}
          <div className="mt-4 flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
            <p className="text-xs text-yellow-800">
              <strong>Importante:</strong> A propagação DNS pode levar até 48h.
              Verifique em <a href="https://mxtoolbox.com/dkim.aspx" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">MXToolbox DKIM</a>
            </p>
          </div>
        </div>
      )}

      {/* Estado sem chaves geradas ainda */}
      {selectedDomain && !loading && !dkimData?.value && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
          <Key className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <p className="text-gray-500 mb-4">Nenhuma chave DKIM gerada para {selectedDomain}</p>
          <button
            onClick={handleGenerate}
            disabled={enabling}
            className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 px-6 py-3 rounded text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {enabling ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
            Gerar Chaves DKIM
          </button>
        </div>
      )}

      {/* Estado sem domínio selecionado */}
      {!selectedDomain && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <p className="text-gray-500">Selecione um domínio para ver as chaves DKIM</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// GIT DEPLOY SECTION
// ============================================================
export function GitDeploySection() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [result, setResult] = useState<any>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Carrega do cache local primeiro (instantâneo)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('git-deploy-cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        // Só usa cache se tiver menos de 5 minutos
        if (Date.now() - (parsed._cachedAt || 0) < 5 * 60 * 1000) {
          setData(parsed)
          setLoading(false) // Mostra dados imediatamente
        }
      }
    } catch { /* ignora erro de cache */ }
  }, [])

  const loadStatus = async (useCache = true) => {
    // Cancela request anterior
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    if (!useCache) setLoading(true)

    try {
      const res = await fetch('/api/git-deploy', {
        signal: abortRef.current.signal,
        // Timeout via AbortController em 8 segundos
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const newData = await res.json()

      // Guarda no cache
      try {
        localStorage.setItem('git-deploy-cache', JSON.stringify({ ...newData, _cachedAt: Date.now() }))
      } catch { /* ignora erro de storage */ }

      setData(newData)
    } catch (e: any) {
      // Se já temos dados do cache, não mostra erro
      if (!data && e.name !== 'AbortError') {
        console.error('Git deploy load error:', e)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus(true) // Tenta usar cache primeiro

    // Auto-refresh a cada 60s (silencioso, sem loading)
    const interval = setInterval(() => loadStatus(true), 60000)
    return () => {
      clearInterval(interval)
      abortRef.current?.abort()
    }
  }, [])

  const handleDeploy = async () => {
    const isLocal = data?.isLocal
    if (isLocal && !commitMsg.trim()) return
    setDeploying(true); setResult(null)
    try {
      const res = await fetch('/api/git-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLocal
          ? { action: 'git-push', message: commitMsg.trim() }
          : { action: 'deploy-hook' }
        )
      })
      const r = await res.json()
      setResult(r)
      if (r.success) { setCommitMsg(''); loadStatus() }
    } catch (e: any) { setResult({ success: false, error: e.message }) }
    setDeploying(false)
  }

  const handleDeployAll = async () => {
    const isLocal = data?.isLocal
    if (isLocal && !commitMsg.trim()) return
    setDeploying(true); setResult(null)
    try {
      const res = await fetch('/api/git-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deploy-all',
          message: isLocal ? commitMsg.trim() : 'Deploy simultâneo admin + site'
        })
      })
      const r = await res.json()
      setResult(r)
      if (r.success) { setCommitMsg(''); loadStatus() }
    } catch (e: any) { setResult({ success: false, error: e.message }) }
    setDeploying(false)
  }

  const isLocal: boolean = data?.isLocal ?? false
  const localGit = data?.localGit
  const repo = data?.repo
  const commits: any[] = data?.commits || []

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            {loading ? <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" /> : repo ? (
              <>
                <a href={repo.url} target="_blank" rel="noopener noreferrer"
                  className="font-bold text-gray-900 hover:text-blue-600 flex items-center gap-1 text-sm">
                  {repo.fullName} <ExternalLink className="w-3 h-3" />
                </a>
                <p className="text-xs text-gray-400">
                  branch: <span className="font-mono font-bold text-gray-700">{repo.branch}</span> · {repo.lastPush ? new Date(repo.lastPush).toLocaleString('pt-PT') : ''}
                  {data?.hasGithubToken && <span className="text-green-600 ml-1">· Token configurado</span>}
                </p>
              </>
            ) : (
              <div className="text-sm text-amber-600">
                <p className="font-medium flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#FFFFFF" d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub sem acesso
                </p>
                <p className="text-xs text-amber-500">Commits públicos visíveis (limite: 60 req/hora) · Adicione GITHUB_TOKEN no .env.local</p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => loadStatus()}
              className="flex items-center gap-2 rounded bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition-all hover:bg-gray-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${isLocal ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              {isLocal ? '⚡ Local Dev' : '☁ Produção'}
            </span>
          </div>
        </div>

        {/* Local git status */}
        {isLocal && localGit && (
          <div className={`rounded p-3 border text-sm ${localGit.hasChanges ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <p className="font-bold text-xs uppercase text-gray-500 mb-1.5">Estado Git Local · branch <span className="font-mono text-gray-700">{localGit.branch}</span></p>
            {localGit.hasChanges ? (
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {localGit.changedFiles.map((f: string, i: number) => (
                  <p key={i} className="font-mono text-xs text-amber-800">{f}</p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-green-700 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Working tree limpo — sem alterações pendentes</p>
            )}
          </div>
        )}

        {/* Action */}
        {isLocal ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Mensagem do Commit</label>
              <input
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !deploying && handleDeploy()}
                placeholder="ex: feat: melhoria no painel de clientes"
                className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
            </div>
            <div className="flex gap-3 justify-start">
              <button onClick={handleDeploy} disabled={deploying || !commitMsg.trim()}
                className="bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 py-2 px-6 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
                {deploying ? <><RefreshCw className="w-4 h-4 animate-spin" /> Push...</> : <><Upload className="w-4 h-4" /> Git Push</>}
              </button>
              <button onClick={handleDeployAll} disabled={deploying || !commitMsg.trim()}
                className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 py-2 px-6 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
                {deploying ? <><RefreshCw className="w-4 h-4 animate-spin" /> Deploy...</> : <><Rocket className="w-4 h-4" /> Deploy Simultâneo</>}
              </button>
            </div>
            <p className="text-xs text-gray-500 text-left">
              <strong>Deploy Simultâneo:</strong> GitHub + Site Online ao mesmo tempo
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3 justify-start">
              <button onClick={handleDeploy} disabled={deploying}
                className="bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 py-2 px-6 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
                {deploying ? <><RefreshCw className="w-4 h-4 animate-spin" /> Deploy...</> : <><Upload className="w-4 h-4" /> Vercel Deploy</>}
              </button>
              <button onClick={handleDeployAll} disabled={deploying}
                className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 py-2 px-6 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
                {deploying ? <><RefreshCw className="w-4 h-4 animate-spin" /> Deploy...</> : <><Rocket className="w-4 h-4" /> Deploy Simultâneo</>}
              </button>
            </div>
            <p className="text-xs text-gray-500 text-left">
              <strong>Deploy Simultâneo:</strong> Atualiza GitHub + Site Online
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-2">
              {result.success ? <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
              <div className="space-y-1 flex-1">
                <p className={`text-sm font-bold ${result.success ? 'text-green-700' : 'text-red-700'}`}>{result.message || result.error}</p>
                {result.steps?.map((s: string, i: number) => <p key={i} className="text-xs text-gray-600 font-mono">✓ {s}</p>)}
                {result.vercelDashboard && (
                  <a href={result.vercelDashboard} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline flex items-center gap-1">
                    Ver deployments no Vercel <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {result.setup?.map((s: string, i: number) => <p key={i} className="text-xs text-red-700 font-mono">{s}</p>)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent commits */}
      <div className="bg-white rounded border border-indigo-100 shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Commits Recentes</h3>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : commits.length > 0 ? (
          <div className="space-y-1">
            {commits.map((c, i) => (
              <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 group transition-colors">
                <code className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mt-0.5 shrink-0">{c.sha}</code>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate group-hover:text-blue-600">{c.message}</p>
                  <p className="text-xs text-gray-400">{c.author} · {c.date ? new Date(c.date).toLocaleString('pt-PT') : ''}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 shrink-0 mt-1" />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">Sem commits. O repositório é público — não precisas de GITHUB_TOKEN para ver commits.</p>
        )}
      </div>
    </div>
  )
}

export function PackagesSection({
  packages,
  onRefresh,
  isActive = true,
  panelScope = 'admin',
}: {
  packages: any[]
  onRefresh: () => void
  isActive?: boolean
  panelScope?: 'admin' | 'reseller'
}) {
  const [livePackages, setLivePackages] = useState<any[]>(() => readPackagesCache(panelScope) || packages)
  const [loadingLive, setLoadingLive] = useState(false)
  const [packageForm, setPackageForm] = useState<ResellerPackageFormState>(() => createDefaultResellerPackageForm())
  const [savingPackage, setSavingPackage] = useState(false)
  const [mostrarAdicionarConta, setMostrarAdicionarConta] = useState(false)
  const [modalAdicionarPasso, setModalAdicionarPasso] = useState<'escolher' | 'webmail' | 'google' | 'hotmail'>('escolher')
  const [editingPackageName, setEditingPackageName] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [showPackageForm, setShowPackageForm] = useState(false)
  const { setChrome } = useAdminSectionChrome()

  const closePackageForm = () => {
    setShowPackageForm(false)
    setEditingPackageName(null)
    setPackageForm(createDefaultResellerPackageForm())
  }

  const loadLivePackages = async (opts?: { background?: boolean; sync?: boolean }) => {
    if (!opts?.background) setLoadingLive(true)
    try {
      if (opts?.sync) {
        await fetch('/api/server-exec', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fullSync' }),
        })
      }
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listPackages' }),
      })
      const data = await parseJsonResponse<{ success?: boolean; data?: any[] }>(res)
      if (data.success && Array.isArray(data.data)) {
        setLivePackages(data.data)
        if (data.data.length) writePackagesCache(data.data, panelScope)
      }
    } catch {
      /* mantém lista actual */
    } finally {
      if (!opts?.background) setLoadingLive(false)
    }
  }

  useEffect(() => {
    if (!msg) return
    const timer = window.setTimeout(() => setMsg(''), 5000)
    return () => window.clearTimeout(timer)
  }, [msg])

  useEffect(() => {
    if (!isActive) return
    setChrome(null)
    clearPackagesCache(panelScope)
    void loadLivePackages({ sync: true })
    return () => setChrome(null)
  }, [isActive, setChrome])

  const displayPackages = useMemo(() => {
    const byName = new Map<string, any>()
    for (const p of packages) {
      const key = String(p.packageName || p.name || '').toLowerCase()
      if (key) byName.set(key, p)
    }
    for (const p of livePackages) {
      const key = String(p.packageName || p.name || '').toLowerCase()
      if (key) byName.set(key, p)
    }
    return [...byName.values()].sort((a: any, b: any) =>
      String(a.packageName || a.name || '').localeCompare(String(b.packageName || b.name || '')),
    )
  }, [packages, livePackages])
  const formatPackageMetric = (value: unknown, defaultUnit?: string) => {
    const raw = String(value ?? '').trim()
    if (!raw || raw === '-' || raw.toLowerCase() === 'unlimited') return raw || '-'
    // Se já vem com unidade do servidor (ex: 1G, 500M), não acrescentar MB.
    if (/[a-z]/i.test(raw)) return raw
    const asNumber = Number(raw)
    if (Number.isFinite(asNumber) && defaultUnit === 'MB' && asNumber >= 1024 && asNumber % 1024 === 0) {
      return `${asNumber / 1024}G`
    }
    return defaultUnit ? `${raw} ${defaultUnit}` : raw
  }

  const packageRowFromForm = (form: ResellerPackageFormState, packageName: string) => ({
    packageName,
    diskSpace: form.limits.quota.unlimited ? '-' : (form.limits.quota.value || '0'),
    bandwidth: form.limits.bandwidth.unlimited ? '-' : (form.limits.bandwidth.value || '0'),
    emailAccounts: form.limits.nemails.unlimited ? '-' : (form.limits.nemails.value || '0'),
    dataBases: form.limits.mysql.unlimited ? '-' : (form.limits.mysql.value || '0'),
    ftpAccounts: form.limits.ftp.unlimited ? '-' : (form.limits.ftp.value || '0'),
    allowedDomains: form.limits.vdomains.unlimited ? '-' : (form.limits.vdomains.value || '0'),
  })

  const normalizeFormForEditor = (form: ResellerPackageFormState, fullName: string) =>
    normalizePackageFormForEditor(form, fullName)

  const upsertLivePackage = (nextPkg: any) => {
    setLivePackages((prev) => {
      const current = prev.length > 0 ? prev : packages
      const byName = new Map(current.map((p: any) => [String(p.packageName || p.name || '').toLowerCase(), p]))
      byName.set(String(nextPkg.packageName || '').toLowerCase(), nextPkg)
      const next = Array.from(byName.values()).sort((a: any, b: any) =>
        String(a.packageName || a.name || '').localeCompare(String(b.packageName || b.name || '')),
      )
      writePackagesCache(next as any[], panelScope)
      return next
    })
  }

  const removeLivePackage = (name: string) => {
    setLivePackages((prev) => {
      const current = prev.length > 0 ? prev : packages
      const next = current.filter(
        (p: any) => String(p.packageName || p.name || '').toLowerCase() !== name.toLowerCase(),
      )
      writePackagesCache(next as any[], panelScope)
      return next
    })
  }

  const handleSavePackage = async () => {
    if (!packageForm.packageName.trim() || savingPackage) return
    const isEdit = Boolean(editingPackageName)
    const baseName = packageForm.packageName.trim()
    const composedName = composePackageName(baseName, packageForm.ownerDomain || '')
    const name = isEdit ? String(editingPackageName || composedName).trim() : composedName
    if (!name) {
      setMsg('Erro: define nome e domínio do pacote.')
      return
    }
    const formSnapshot = { ...packageForm }
    const editingSnapshot = editingPackageName
    const previousPackages = [...displayPackages]
    const optimisticRow = packageRowFromForm(packageForm, name)
    upsertLivePackage(optimisticRow)
    closePackageForm()
    setMsg(isEdit ? 'Pacote actualizado.' : 'Pacote criado.')
    setSavingPackage(true)
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEdit ? 'editPackage' : 'createPackage',
          params: {
            packageName: name,
            hostingPackageForm: { ...packageForm, packageName: baseName },
          },
        }),
      })
      const data = await parseJsonResponse<{
        success?: boolean
        serverSynced?: boolean
        error?: string
        data?: { error?: string }
        warning?: string
      }>(res)
      const synced = data.success && data.serverSynced !== false
      if (!synced) {
        setLivePackages(previousPackages as any[])
        writePackagesCache(previousPackages as any[], panelScope)
        setPackageForm(formSnapshot)
        setEditingPackageName(editingSnapshot)
        setShowPackageForm(true)
        setMsg(
          'Erro: ' +
          (data.error ||
            data.data?.error ||
            (isEdit ? 'Falha ao actualizar pacote' : 'Falha ao criar pacote')),
        )
      } else if (data.warning) {
        setMsg(`Aviso: ${data.warning}`)
      }
      void onRefresh()
      void loadLivePackages({ background: true })
    } catch (e: any) {
      setLivePackages(previousPackages as any[])
      writePackagesCache(previousPackages as any[], panelScope)
      setPackageForm(formSnapshot)
      setEditingPackageName(editingSnapshot)
      setShowPackageForm(true)
      setMsg('Erro: ' + e.message)
    } finally {
      setSavingPackage(false)
    }
  }

  const openEditPackage = (pkg: any) => {
    const name = String(pkg.packageName || pkg.name || '').trim()
    if (!name) return
    const initialForm = normalizeFormForEditor(packageListRowToForm(pkg, name), name)
    setPackageForm(initialForm)
    setEditingPackageName(name)
    setShowPackageForm(true)
    setMsg('')
    void (async () => {
      try {
        const res = await fetch('/api/server-exec', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getPackageForm',
            params: { packageName: name, listRow: pkg },
          }),
        })
        const data = await parseJsonResponse<{ success?: boolean; data?: ResellerPackageFormState }>(res)
        if (data.success && data.data && typeof data.data === 'object') {
          setPackageForm(normalizeFormForEditor(data.data as ResellerPackageFormState, name))
        }
      } catch {
        /* mantém formulário da listagem */
      }
    })()
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Apagar pacote "${name}"?`)) return
    const previousPackages = [...displayPackages]
    removeLivePackage(name)
    setMsg('Pacote apagado.')
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deletePackage', params: { packageName: name } }),
      })
      const data = await parseJsonResponse<{ success?: boolean; error?: string }>(res)
      if (!data.success) {
        setLivePackages(previousPackages as any[])
        writePackagesCache(previousPackages as any[], panelScope)
        setMsg('Erro: ' + (data.error || 'Falha ao apagar pacote'))
      }
      void onRefresh()
      void loadLivePackages({ background: true })
    } catch (e: any) {
      setLivePackages(previousPackages as any[])
      writePackagesCache(previousPackages as any[], panelScope)
      setMsg('Erro: ' + e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!showPackageForm ? (
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            ({displayPackages.length}){' '}
            {displayPackages.length === 1 ? 'pacote registado' : 'pacotes registados'}
            {loadingLive ? ' · a actualizar…' : ''}
          </p>
        ) : (
          <span className="hidden sm:block" aria-hidden />
        )}
        <div className="flex shrink-0 items-center justify-end gap-2 sm:ml-auto">
          {!showPackageForm ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingPackageName(null)
                  setPackageForm(createDefaultResellerPackageForm())
                  setShowPackageForm(true)
                }}
                className={`${panelBtnPrimary} whitespace-nowrap`}
              >
                <PlusCircle className="h-4 w-4" />
                Criar pacote
              </button>
              <button
                type="button"
                onClick={() => void loadLivePackages({ sync: true })}
                disabled={loadingLive}
                title="Actualizar"
                className={panelBtnSecondary}
              >
                <RefreshCw className={`h-4 w-4 ${loadingLive ? 'animate-spin' : ''}`} />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {msg && (
        <p className={`rounded px-4 py-2 text-sm ${msg.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </p>
      )}

      {showPackageForm ? (
        <HostingPackageFormInline
          key={editingPackageName ?? 'new'}
          form={packageForm}
          onChange={setPackageForm}
          onCancel={closePackageForm}
          onSubmit={() => void handleSavePackage()}
          busy={savingPackage}
          mode={editingPackageName ? 'edit' : 'create'}
        />
      ) : (
        <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {displayPackages && displayPackages.length > 0 ? (
            <div>
              <div className="grid grid-cols-12 border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-bold uppercase text-gray-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <div className="col-span-3">Pacote</div>
                <div className="col-span-7">Configurações</div>
                <div className="col-span-2 text-right">Acções</div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {displayPackages.map((pkg: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                    <div className="col-span-12 min-w-0 self-center sm:col-span-3">
                      {(() => {
                        const name = String(pkg.packageName || pkg.name || '-')
                        const split = splitCompositePackageName(name)
                        return (
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">
                            {split.packageName || name || '-'}
                          </p>
                        )
                      })()}
                    </div>
                    <div className="col-span-12 self-center sm:col-span-7">
                      <p className="text-xs text-gray-600 dark:text-zinc-400">
                        Disco {formatPackageMetric(pkg.diskSpace ?? pkg.disk ?? '-', 'MB')} · Banda {formatPackageMetric(pkg.bandwidth ?? '-', 'MB')} · Emails {pkg.emailAccounts ?? pkg.emails ?? '-'} · BDs {pkg.dataBases ?? pkg.databases ?? '-'} · FTPs {pkg.ftpAccounts ?? pkg.ftp ?? '-'} · Sites {pkg.allowedDomains ?? pkg.vdomains ?? '-'}
                      </p>
                    </div>
                    <div className="col-span-12 flex shrink-0 items-center justify-end gap-2 sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => openEditPackage(pkg)}
                        className={`${panelBtnSecondary} !h-[34px] px-3 py-1.5`}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(pkg.packageName || pkg.name)}
                        className={`${panelBtnSecondary} !h-[34px] px-3 py-1.5 text-red-600 hover:text-red-800`}
                      >
                        Eliminar pacote
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Nenhum pacote encontrado ou erro ao carregar do DirectAdmin.</p>
              <button
                onClick={onRefresh}
                className="bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Sincronizar com DirectAdmin
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

const FM_EDITABLE_EXT = new Set([
  'txt', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'php', 'json', 'xml', 'md', 'sql',
  'yaml', 'yml', 'ini', 'conf', 'log', 'svg', 'sh', 'env', 'htaccess', 'twig', 'vue',
])

const fmToolbarBtn =
  'inline-flex items-center gap-1.5 rounded border border-gray-300 bg-transparent px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed dark:border-zinc-600'

const fmToolbarBtnActive =
  'text-gray-700 hover:text-red-600 dark:text-zinc-200 dark:hover:text-red-400'

const fmToolbarBtnMuted =
  'text-gray-300 dark:text-zinc-600'

function fmToolBtnClass(active: boolean, busy = false) {
  return cn(fmToolbarBtn, 'shrink-0', active && !busy ? fmToolbarBtnActive : fmToolbarBtnMuted)
}

const fmToolbarBtnGreen =
  'inline-flex items-center gap-1.5 rounded border border-green-300/60 dark:border-green-800/60 bg-transparent px-2.5 py-1.5 text-xs font-medium text-green-600 dark:text-green-500 transition-colors hover:text-green-700 dark:hover:text-green-400 disabled:opacity-40'

function formatFmBytes(value: number | string | undefined): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function isFmEditableName(name: string): boolean {
  if (name === '.htaccess') return true
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : ''
  return FM_EDITABLE_EXT.has(ext)
}

const FileManagerCodeEditor = dynamic(
  () => import('@/app/dashboard/FileManagerCodeEditor').then((m) => m.FileManagerCodeEditor),
  {
    ssr: false,
    loading: () => (
      <div className={`${panelField} flex min-h-[65vh] items-center justify-center text-sm text-gray-400`}>
        A carregar editor…
      </div>
    ),
  },
)

export function FileManagerSection({ domain, sites, isActive = false }: {
  domain: string,
  sites: DirectAdminWebsite[]
  isActive?: boolean
}) {
  const [path, setPath] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState('')
  const [siteRoot, setSiteRoot] = useState('')
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [uploadProgress, setUploadProgress] = useState<{ name: string, current: number, total: number, progress: number, processing?: boolean } | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [editing, setEditing] = useState<{ path: string; name: string; content: string; saving: boolean } | null>(null)
  const [fmDialog, setFmDialog] = useState<
    | { type: 'transfer'; mode: 'copy' | 'move'; sources: string[] }
    | { type: 'create'; mode: 'file' | 'folder' }
    | null
  >(null)
  const [fmDialogInput, setFmDialogInput] = useState('')
  const [fmDialogBusy, setFmDialogBusy] = useState(false)
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<DOMRect | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [toolbarStuck, setToolbarStuck] = useState(false)
  const toolbarSentinelRef = useRef<HTMLDivElement>(null)
  const { setChrome } = useAdminSectionChrome()

  const getOwner = (targetDomain: string) =>
    sites.find(s => s.domain === targetDomain)?.owner || 'admin'

  const resolveRoot = (targetDomain: string) => {
    if (!targetDomain) return ''
    const owner = getOwner(targetDomain)
    return `/home/${owner}/domains/${targetDomain}/public_html`
  }

  useEffect(() => {
    const d = domain || (sites.find(s => !s.domain.includes('contaboserver'))?.domain) || ''
    if (!d) return

    let cancelled = false
    setSelectedDomain(d)
    const root = resolveRoot(d)
    if (!cancelled && root) {
      setSiteRoot(root)
      setPath(root)
    }

    return () => { cancelled = true }
  }, [domain, sites])

  useEffect(() => {
    if (path) void loadFiles(path)
  }, [path])

  const loadFiles = async (currentPath: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'listDirectory',
          params: { path: currentPath },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Não foi possível listar ficheiros.')
        setFiles([])
        return
      }
      setFiles(Array.isArray(data.data?.files) ? data.data.files : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar ficheiros.')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  const navigateTo = (folder: string) => {
    const root = siteRoot || `/home/${getOwner(selectedDomain)}/domains/${selectedDomain}/public_html`
    if (folder === '..') {
      if (path === root) return
      const parts = path.split('/').filter(Boolean)
      parts.pop()
      const nextPath = `/${parts.join('/')}`
      setPath(nextPath.startsWith(root) ? nextPath : root)
    } else {
      const next = `${path.replace(/\/$/, '')}/${folder}`
      setPath(next)
    }
    setSelectedFiles([])
    setMoreMenuAnchor(null)
  }

  const joinPath = (name: string) => `${path.replace(/\/$/, '')}/${name}`

  const selectedEntries = () =>
    files.filter((f: { name: string }) => selectedFiles.includes(f.name))

  const selectedFullPaths = () => selectedFiles.map((name) => joinPath(name))

  const execFileAction = async (action: string, params: Record<string, unknown>) => {
    const res = await fetch('/api/server-exec', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Operação falhou')
    }
    return data
  }

  const flashAction = (text: string) => {
    setActionMsg(text)
    setTimeout(() => setActionMsg(''), 3500)
  }

  const refreshList = () => {
    setSelectedFiles([])
    setMoreMenuAnchor(null)
    void loadFiles(path)
  }

  const handleEdit = async (name?: string) => {
    const target = name || selectedFiles.find((n) => {
      const entry = files.find((f: { name: string; isDir?: boolean }) => f.name === n)
      return entry && !entry.isDir && isFmEditableName(n)
    })
    if (!target) {
      alert('Seleccione um ficheiro de texto para editar.')
      return
    }
    const filePath = joinPath(target)
    setActionBusy(true)
    try {
      const data = await execFileAction('readFileContent', { path: filePath })
      const b64 = data.data?.content as string
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const content = new TextDecoder('utf-8').decode(bytes)
      setEditing({ path: filePath, name: target, content, saving: false })
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Não foi possível abrir o ficheiro')
    } finally {
      setActionBusy(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    setEditing((prev) => prev ? { ...prev, saving: true } : null)
    try {
      const encoded = new TextEncoder().encode(editing.content)
      let binary = ''
      encoded.forEach((b) => { binary += String.fromCharCode(b) })
      const contentBase64 = btoa(binary)
      await execFileAction('writeFileContent', { path: editing.path, contentBase64 })
      flashAction('Ficheiro guardado.')
      setEditing(null)
      refreshList()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao guardar')
      setEditing((prev) => prev ? { ...prev, saving: false } : null)
    }
  }

  const handleCopy = () => {
    if (!selectedFiles.length) return
    setFmDialog({ type: 'transfer', mode: 'copy', sources: selectedFullPaths() })
    setFmDialogInput(path)
    setMoreMenuAnchor(null)
  }

  const handleMove = () => {
    if (!selectedFiles.length) return
    setFmDialog({ type: 'transfer', mode: 'move', sources: selectedFullPaths() })
    setFmDialogInput(path)
    setMoreMenuAnchor(null)
  }

  const confirmFmDialog = async () => {
    if (!fmDialog) return
    const input = fmDialogInput.trim()
    if (!input) return

    setFmDialogBusy(true)
    try {
      if (fmDialog.type === 'transfer') {
        const action = fmDialog.mode === 'copy' ? 'copyPaths' : 'movePaths'
        await execFileAction(action, { sources: fmDialog.sources, destDir: input })
        flashAction(fmDialog.mode === 'copy' ? 'Cópia concluída.' : 'Movimento concluído.')
        setFmDialog(null)
        refreshList()
        return
      }

      const name = input
      if (fmDialog.mode === 'folder') {
        await execFileAction('createFolder', { path: joinPath(name) })
        flashAction('Pasta criada.')
        setFmDialog(null)
        refreshList()
        return
      }

      if (files.some((f: { name: string }) => f.name === name)) {
        alert(`O ficheiro "${name}" já existe na pasta actual.`)
        return
      }
      await execFileAction('writeFileContent', { path: joinPath(name), contentBase64: '' })
      flashAction('Ficheiro criado.')
      setFmDialog(null)
      await loadFiles(path)
      if (isFmEditableName(name)) {
        setEditing({ path: joinPath(name), name, content: '', saving: false })
      }
    } catch (e: unknown) {
      const fallback =
        fmDialog.type === 'create'
          ? fmDialog.mode === 'folder'
            ? 'Não foi possível criar a pasta'
            : 'Não foi possível criar o ficheiro'
          : 'Operação falhou'
      alert(e instanceof Error ? e.message : fallback)
    } finally {
      setFmDialogBusy(false)
      setMoreMenuAnchor(null)
    }
  }

  const openCreateFolderDialog = () => {
    setFmDialog({ type: 'create', mode: 'folder' })
    setFmDialogInput('')
  }

  const openCreateFileDialog = () => {
    setFmDialog({ type: 'create', mode: 'file' })
    setFmDialogInput('')
  }

  const handleDuplicate = async () => {
    if (selectedFiles.length !== 1) {
      alert('Seleccione apenas um item para duplicar.')
      return
    }
    setActionBusy(true)
    try {
      await execFileAction('duplicatePath', { path: joinPath(selectedFiles[0]) })
      flashAction('Duplicado com sucesso.')
      refreshList()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Não foi possível duplicar')
    } finally {
      setActionBusy(false)
    }
  }

  const handleDownload = async () => {
    const targets = selectedEntries().filter((f: { isDir?: boolean }) => !f.isDir)
    if (!targets.length) {
      alert('Seleccione ficheiros para transferir.')
      return
    }
    setActionBusy(true)
    try {
      for (const f of targets) {
        const data = await execFileAction('downloadFile', { path: joinPath(f.name) })
        const b64 = data.data?.content as string
        const filename = (data.data?.filename as string) || f.name
        const mime = (data.data?.mime as string) || 'application/octet-stream'
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
      flashAction('Download iniciado.')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Download falhou')
    } finally {
      setActionBusy(false)
    }
  }

  const handleCompress = async () => {
    if (!selectedFiles.length) return
    const archivePath = `${path.replace(/\/$/, '')}/arquivo-${Date.now()}.zip`
    setActionBusy(true)
    try {
      await execFileAction('compressPaths', { sources: selectedFullPaths(), archivePath })
      flashAction('Arquivo criado na pasta actual.')
      refreshList()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Não foi possível compactar')
    } finally {
      setActionBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedFiles.length) return
    if (!confirm(`Eliminar ${selectedFiles.length} item(ns)? Esta acção é irreversível.`)) return
    setActionBusy(true)
    try {
      await execFileAction('deletePaths', { paths: selectedFullPaths() })
      flashAction('Eliminado.')
      refreshList()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Não foi possível eliminar')
    } finally {
      setActionBusy(false)
      setMoreMenuAnchor(null)
    }
  }

  const handleRename = async () => {
    if (selectedFiles.length !== 1) {
      alert('Seleccione um único item para renomear.')
      return
    }
    const current = selectedFiles[0]
    const newName = prompt('Novo nome:', current)
    if (!newName || newName === current) return
    setActionBusy(true)
    try {
      await execFileAction('renamePath', { path: joinPath(current), newName })
      flashAction('Renomeado.')
      refreshList()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Não foi possível renomear')
    } finally {
      setActionBusy(false)
      setMoreMenuAnchor(null)
    }
  }

  const handleExtract = async () => {
    if (selectedFiles.length !== 1) {
      alert('Seleccione um arquivo (.zip, .tar.gz, .tgz, .tar).')
      return
    }
    const name = selectedFiles[0].toLowerCase()
    if (!name.endsWith('.zip') && !name.endsWith('.tar.gz') && !name.endsWith('.tgz') && !name.endsWith('.tar')) {
      alert('Formato não suportado para descompactar.')
      return
    }
    setActionBusy(true)
    try {
      await execFileAction('extractArchive', { path: joinPath(selectedFiles[0]), destDir: path })
      flashAction('Arquivo descompactado.')
      refreshList()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Descompactação falhou')
    } finally {
      setActionBusy(false)
      setMoreMenuAnchor(null)
    }
  }

  const handleSetPermissions = async () => {
    if (!selectedFiles.length) {
      alert('Seleccione pelo menos um ficheiro ou pasta.')
      return
    }
    const entry = selectedEntries()[0] as { permissions?: string } | undefined
    const suggested = entry?.permissions || '644'
    const mode = prompt('Permissões (ex.: 644, 755):', suggested)
    if (!mode?.trim()) return
    if (!/^[0-7]{3,4}$/.test(mode.trim())) {
      alert('Formato inválido. Use 3 ou 4 dígitos octais (ex.: 644).')
      return
    }
    setActionBusy(true)
    try {
      await execFileAction('setPathPermissions', { paths: selectedFullPaths(), mode: mode.trim() })
      flashAction('Permissões actualizadas.')
      refreshList()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Não foi possível alterar permissões')
    } finally {
      setActionBusy(false)
      setMoreMenuAnchor(null)
    }
  }

  const handleDomainChange = (next: string) => {
    setSelectedDomain(next)
    const root = resolveRoot(next)
    setSiteRoot(root)
    setPath(root)
    setSelectedFiles([])
    setMoreMenuAnchor(null)
  }

  const siteDomainKey = useMemo(() => sites.map((s) => s.domain).join(','), [sites])

  useEffect(() => {
    if (!isActive) return
    setChrome({
      toolbar: (
        <select
          value={selectedDomain}
          onChange={(e) => handleDomainChange(e.target.value)}
          className={`${panelField} w-44 min-w-[10rem] max-w-xs`}
        >
          <option value="" disabled>Seleccione o domínio…</option>
          {sites.map((s) => (
            <option key={s.domain} value={s.domain}>{s.domain}</option>
          ))}
        </select>
      ),
    })
    return () => setChrome(null)
  }, [isActive, selectedDomain, siteDomainKey, setChrome])

  useEffect(() => {
    const sentinel = toolbarSentinelRef.current
    if (!sentinel) return
    const scrollRoot = sentinel.closest('main')
    const observer = new IntersectionObserver(
      ([entry]) => setToolbarStuck(!entry.isIntersecting),
      { root: scrollRoot, threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [isActive])

  const canEditSelection = selectedFiles.length === 1 && selectedEntries().every(
    (f: { isDir?: boolean; name: string }) => !f.isDir && isFmEditableName(f.name),
  )
  const hasFileSelection = selectedFiles.length > 0
  const hasSingleSelection = selectedFiles.length === 1

  const pathParts = path.split('/').filter(Boolean)

  if (editing) {
    return (
      <div className="flex min-h-[calc(100dvh-8.5rem)] w-full flex-col gap-3 sm:min-h-[calc(100dvh-7.5rem)]">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-transparent px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className={panelBtnSecondary}
          >
            ← Voltar à lista
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">{editing.name}</span>
          <button
            type="button"
            onClick={() => void handleSaveEdit()}
            disabled={editing.saving}
            className={fmToolbarBtnGreen}
          >
            {editing.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <FileManagerCodeEditor
            fileName={editing.name}
            value={editing.content}
            onChange={(value) => setEditing((prev) => (prev ? { ...prev, content: value } : null))}
            fillHeight
          />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-3 -mt-4 lg:-mt-5">
      {actionMsg ? (
        <div className="rounded-lg border border-green-300/50 bg-transparent px-4 py-2 text-sm text-green-600 dark:border-green-800/50 dark:text-green-500">
          {actionMsg}
        </div>
      ) : null}

      <div ref={toolbarSentinelRef} className="h-px w-full shrink-0" aria-hidden />

      <div
        className={cn(
          'sticky top-0 z-30 -mx-4 w-[calc(100%+2rem)] px-4 py-2 lg:-mx-5 lg:w-[calc(100%+2.5rem)] lg:px-5 transition-all duration-200',
          toolbarStuck
            ? 'bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 shadow-sm'
            : 'bg-transparent border-b border-transparent',
        )}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            <button type="button" disabled={!canEditSelection || actionBusy} onClick={() => void handleEdit()} className={fmToolBtnClass(canEditSelection, actionBusy)}><Edit className="w-4 h-4" /> Editar</button>
            <button type="button" disabled={!hasFileSelection || actionBusy} onClick={handleCopy} className={fmToolBtnClass(hasFileSelection, actionBusy)}><Copy className="w-4 h-4" /> Copiar</button>
            <button type="button" disabled={!hasSingleSelection || actionBusy} onClick={() => void handleDuplicate()} className={fmToolBtnClass(hasSingleSelection, actionBusy)}><Layers className="w-4 h-4" /> Duplicar</button>
            <button type="button" disabled={!hasFileSelection || actionBusy} onClick={handleMove} className={fmToolBtnClass(hasFileSelection, actionBusy)}><ArrowRightLeft className="w-4 h-4" /> Mover</button>
            <button type="button" disabled={!hasFileSelection || actionBusy} onClick={() => void handleDownload()} className={fmToolBtnClass(hasFileSelection, actionBusy)}><Download className="w-4 h-4" /> Transferir</button>
            <button type="button" disabled={!hasFileSelection || actionBusy} onClick={() => void handleCompress()} className={fmToolBtnClass(hasFileSelection, actionBusy)}><Archive className="w-4 h-4" /> Compactar</button>
            <div className="relative shrink-0">
              <button
                type="button"
                disabled={!hasFileSelection || actionBusy}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  if (moreMenuAnchor) setMoreMenuAnchor(null)
                  else setMoreMenuAnchor(rect)
                }}
                className={fmToolBtnClass(hasFileSelection, actionBusy)}
              >
                <MoreVertical className="w-4 h-4" /> Mais
              </button>
            </div>
          </div>

          {selectedDomain ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => openCreateFolderDialog()}
                className={cn(fmToolbarBtn, fmToolbarBtnActive)}
              >
                <FolderPlus className="w-4 h-4" /> Nova pasta
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => openCreateFileDialog()}
                className={cn(fmToolbarBtn, fmToolbarBtnActive)}
              >
                <FilePlus className="w-4 h-4" /> Novo ficheiro
              </button>
              <label
                className={`flex items-center gap-2 px-2 text-sm font-semibold transition-colors ${loading ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400'}`}
                title="Upload"
              >
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={loading}
                  onChange={async (e) => {
                    const selectedFiles = Array.from(e.target.files || []);
                    if (!selectedFiles.length) return;

                    e.target.value = '';
                    const originalError = error;

                    try {
                      let successCount = 0;
                      let failCount = 0;

                      for (let i = 0; i < selectedFiles.length; i++) {
                        const file = selectedFiles[i];

                        if (files.some(f => f.name === file.name)) {
                          alert(`O ficheiro "${file.name}" já existe na pasta atual. Elimine-o ou mude-lhe o nome antes de fazer upload.`);
                          continue;
                        }

                        const destPath = `${path.endsWith('/') ? path : path + '/'}${file.name}`;

                        setUploadProgress({ name: file.name, current: i + 1, total: selectedFiles.length, progress: 0, processing: false });

                        await new Promise<void>((resolve) => {
                          const xhr = new XMLHttpRequest();
                          xhr.upload.addEventListener('progress', (ev) => {
                            if (ev.lengthComputable) {
                              const pct = Math.round((ev.loaded / ev.total) * 100);
                              setUploadProgress(prev => prev ? { ...prev, progress: pct, processing: pct === 100 } : null);
                            }
                          });

                          xhr.onload = () => {
                            if (xhr.status === 200) {
                              try {
                                const data = JSON.parse(xhr.responseText);
                                if (data.success) successCount++;
                                else { console.error(data.error); failCount++; }
                              } catch {
                                failCount++;
                              }
                            } else {
                              failCount++;
                            }
                            resolve();
                          };

                          xhr.onerror = () => { failCount++; resolve(); };
                          xhr.open('POST', '/api/upload-native');
                          xhr.setRequestHeader('x-file-path', encodeURIComponent(destPath));
                          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
                          xhr.send(file);
                        });
                      }

                      setUploadProgress(null);
                      loadFiles(path);

                      if (failCount > 0) {
                        alert(`Upload concluído: ${successCount} sucesso(s), ${failCount} falha(s).`);
                      }
                    } catch (err: any) {
                      setError(err.message || 'Erro ao processar uploads');
                      setTimeout(() => setError(originalError), 5000);
                    }
                    e.target.value = '';
                  }}
                />
                <UploadCloud className="w-4 h-4" />
                Upload
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-[38px] w-full items-center gap-2 overflow-x-auto whitespace-nowrap text-sm">
        <button onClick={() => setPath(siteRoot || path)} className="flex items-center gap-1 font-semibold text-zinc-600 transition-colors hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-500">
          <FolderOpen className="w-4 h-4" />
          {selectedDomain || 'home'}
        </button>
        {pathParts.map((part, i) => (
          <span key={i} className="flex items-center gap-2 text-gray-400">
            <span className="opacity-50">/</span>
            <button
              onClick={() => setPath('/' + pathParts.slice(0, i + 1).join('/'))}
              className="font-medium text-gray-700 transition-colors hover:text-red-500 dark:text-zinc-300 dark:hover:text-red-500">
              {part}
            </button>
          </span>
        ))}
      </div>

      {/* Tabela de ficheiros */}
      <div className={panelCard}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-gray-200 bg-gray-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                <th className="w-10 px-3 py-1.5">
                  <input type="checkbox" checked={selectedFiles.length === files.length && files.length > 0} onChange={(e) => {
                    if (e.target.checked) setSelectedFiles(files.map((f: any) => f.name));
                    else setSelectedFiles([]);
                  }} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                </th>
                <th className="px-3 py-1.5">Nome do Ficheiro</th>
                <th className="px-3 py-1.5">Tamanho</th>
                <th className="px-3 py-1.5 hidden md:table-cell">Permissões</th>
                <th className="px-3 py-1.5 hidden sm:table-cell">Modificado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {path !== siteRoot && !loading && files.length > 0 && (
                <tr className="cursor-pointer bg-gray-50/80 transition-colors hover:bg-gray-100/80 group dark:bg-zinc-800/30 dark:hover:bg-zinc-800/50" onClick={() => navigateTo('..')}>
                  <td className="w-10 px-3 py-1"></td>
                  <td className="px-3 py-1" colSpan={4}>
                    <div className="flex items-center gap-3">
                      <div className="p-1 text-gray-400 group-hover:text-red-500 transition-colors">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                      <span className="text-gray-600 dark:text-zinc-300 font-medium group-hover:text-red-500 transition-colors">.. (Subir de Nível)</span>
                    </div>
                  </td>
                </tr>
              )}

              {uploadProgress ? (
                <tr><td colSpan={5} className="px-6 py-12">
                  <div className="w-full space-y-4">
                    <div className="flex justify-between items-end mb-1">
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                          {uploadProgress.processing ? (
                            <>
                              <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
                              A processar no servidor... ({uploadProgress.current} de {uploadProgress.total})
                            </>
                          ) : (
                            <>
                              <UploadCloud className="w-4 h-4 text-green-500 animate-pulse" />
                              A fazer upload... ({uploadProgress.current} de {uploadProgress.total})
                            </>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-lg mt-1">{uploadProgress.name}</div>
                      </div>
                      <span className="text-sm font-bold text-green-600 dark:text-green-500">{uploadProgress.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-green-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress.progress}%` }}></div>
                    </div>
                  </div>
                </td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-red-500 font-medium">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  {error}
                </td></tr>
              ) : loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-red-500 mb-3" />
                  <span className="font-medium text-sm text-gray-500 dark:text-zinc-400">A carregar directório...</span>
                </td></tr>
              ) : files.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-zinc-700" />
                  <span className="font-medium text-gray-500 dark:text-zinc-400">Pasta vazia</span>
                </td></tr>
              ) : files.map((f, i) => {
                const ext = f.name.split('.').pop()?.toLowerCase() || '';
                let Icon = FileText;
                let iconColor = "text-gray-400 dark:text-zinc-600";
                if (f.isDir) {
                  Icon = FolderOpen;
                  iconColor = "text-zinc-500 dark:text-zinc-400 group-hover:text-red-500";
                } else if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
                  Icon = FileArchive;
                  iconColor = "text-yellow-600 dark:text-yellow-500";
                } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
                  Icon = ImageIcon;
                  iconColor = "text-blue-500 dark:text-blue-400";
                } else if (['js', 'ts', 'jsx', 'tsx', 'php', 'html', 'css'].includes(ext)) {
                  Icon = FileCode;
                  iconColor = "text-purple-500 dark:text-purple-400";
                } else if (ext === 'json') {
                  Icon = FileJson;
                  iconColor = "text-emerald-500 dark:text-emerald-400";
                } else if (['mp4', 'webm', 'avi', 'mkv'].includes(ext)) {
                  Icon = PlaySquare;
                  iconColor = "text-rose-500 dark:text-rose-400";
                } else if (['sh', 'bash'].includes(ext)) {
                  Icon = Terminal;
                  iconColor = "text-gray-700 dark:text-gray-300";
                } else if (ext === 'pdf') {
                  Icon = FileText;
                  iconColor = "text-red-500 dark:text-red-400";
                }

                const isSelected = selectedFiles.includes(f.name);
                const stripeBg = i % 2 === 0
                  ? 'bg-white dark:bg-zinc-900'
                  : 'bg-gray-50/80 dark:bg-zinc-800/30';

                return (
                  <tr key={i} className={`transition-colors group hover:bg-gray-100/80 dark:hover:bg-zinc-800/50 ${stripeBg} ${isSelected ? 'ring-1 ring-inset ring-red-300/60 dark:ring-red-900/50' : ''}`}>
                    <td className="px-3 py-1">
                      <input type="checkbox" checked={isSelected} onChange={(e) => {
                        if (e.target.checked) setSelectedFiles([...selectedFiles, f.name]);
                        else setSelectedFiles(selectedFiles.filter(name => name !== f.name));
                      }} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                    </td>
                    <td className="px-3 py-1">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg bg-transparent ${iconColor}`}>
                          <Icon className="w-5 h-5" />
                        </div>

                        {f.isDir ? (
                          <button onClick={() => navigateTo(f.name)}
                            className="text-gray-900 dark:text-zinc-100 hover:text-red-500 dark:hover:text-red-500 font-semibold transition-colors">
                            {f.name}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (isFmEditableName(f.name)) void handleEdit(f.name)
                            }}
                            className={`text-gray-700 dark:text-zinc-300 font-medium transition-colors ${isFmEditableName(f.name) ? 'hover:text-red-500 dark:hover:text-red-400' : ''}`}
                          >
                            {f.name}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="w-24 px-3 py-1 text-xs font-medium text-gray-600 dark:text-zinc-300">
                      {f.isDir ? '—' : formatFmBytes(f.size)}
                    </td>
                    <td className="hidden px-3 py-1 font-mono text-xs text-gray-500 dark:text-zinc-400 md:table-cell">{f.permissions}</td>
                    <td className="hidden px-3 py-1 text-xs text-gray-500 dark:text-zinc-400 sm:table-cell">
                      {f.date}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {moreMenuAnchor ? (
        <FileManagerMoreMenu
          anchorRect={moreMenuAnchor}
          onClose={() => setMoreMenuAnchor(null)}
          onAction={(action) => {
            if (action === 'rename') void handleRename()
            else if (action === 'permissions') void handleSetPermissions()
            else if (action === 'extract') void handleExtract()
            else if (action === 'delete') void handleDelete()
          }}
        />
      ) : null}

      {fmDialog ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !fmDialogBusy && setFmDialog(null)} />
          <div className={`${panelCard} relative w-full max-w-lg space-y-4 p-6`}>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {fmDialog.type === 'transfer'
                ? fmDialog.mode === 'copy'
                  ? 'Copiar para pasta'
                  : 'Mover para pasta'
                : fmDialog.mode === 'folder'
                  ? 'Nova pasta'
                  : 'Novo ficheiro'}
            </h3>
            {fmDialog.type === 'transfer' ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {fmDialog.sources.length} item(ns) seleccionado(s)
              </p>
            ) : (
              <p className="break-all text-xs text-zinc-500 dark:text-zinc-400">
                Directório: <span className="font-mono text-zinc-700 dark:text-zinc-300">{path}</span>
              </p>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">
                {fmDialog.type === 'transfer'
                  ? 'Pasta de destino'
                  : fmDialog.mode === 'folder'
                    ? 'Nome da pasta'
                    : 'Nome do ficheiro'}
              </label>
              <input
                value={fmDialogInput}
                onChange={(e) => setFmDialogInput(e.target.value)}
                placeholder={fmDialog.type === 'create' && fmDialog.mode === 'file' ? 'exemplo.php' : ''}
                className={`${panelField} w-full dark:bg-zinc-900`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !fmDialogBusy) void confirmFmDialog()
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={fmDialogBusy} onClick={() => setFmDialog(null)} className={panelBtnSecondary}>Cancelar</button>
              <button type="button" disabled={fmDialogBusy || !fmDialogInput.trim()} onClick={() => void confirmFmDialog()} className={fmToolbarBtnGreen}>
                {fmDialogBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ============================================================
// BACKUP MANAGER SECTION
// ============================================================
export function BackupManagerSection({
  sites,
  initialDomain,
  isActive = true,
}: {
  sites: DirectAdminWebsite[]
  initialDomain?: string
  isActive?: boolean
}) {
  const [activeTab, setActiveTab] = useState<'full' | 'files' | 'databases' | 'emails' | 'ftp'>('full')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [backups, setBackups] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  const tabs = [
    { id: 'full', label: 'Conta Completa', icon: '🗂️' },
    { id: 'files', label: 'Ficheiros', icon: '📁' },
    { id: 'databases', label: 'Bases de Dados', icon: '🗄️' },
    { id: 'emails', label: 'Email Accounts', icon: '✉️' },
    { id: 'ftp', label: 'FTP Accounts', icon: '📡' },
  ]

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  const loadBackups = async (domain: string) => {
    if (!domain) return
    setLoading(true)
    const res = await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execCommand',
        params: { command: `ls -lht /home/${domain}/backup/*.tar.gz 2>/dev/null || echo "NO_BACKUPS"` }
      })
    })
    const data = await res.json()
    const output = data.data?.output || ''

    if (output.includes('NO_BACKUPS') || output.includes('No such file') || !output.trim()) {
      setBackups([])
      setLoading(false)
      return
    }

    const lines = output.split('\n').filter((l: string) =>
      l.trim() && l.includes('.tar.gz')
    )

    setBackups(lines.map((line: string) => {
      const parts = line.trim().split(/\s+/)
      const filename = parts[parts.length - 1].split('/').pop() || ''
      return {
        size: parts[4] || 'N/A',
        date: `${parts[5] || ''} ${parts[6] || ''} ${parts[7] || ''}`,
        filename,
        path: `/home/${domain}/backup/${filename}`
      }
    }).filter((b: any) => b.filename && b.filename.includes('.tar.gz')))

    setLoading(false)
  }

  useEffect(() => {
    if (selectedDomain) loadBackups(selectedDomain)
  }, []) // Disparar ao montar

  useEffect(() => {
    if (selectedDomain) loadBackups(selectedDomain)
  }, [selectedDomain]) // Disparar quando selectedDomain muda

  useEffect(() => {
    if (!isActive) return
    if (initialDomain) {
      setSelectedDomain(initialDomain)
    } else if (sites.length > 0) {
      setSelectedDomain((prev) => prev || sites[0].domain)
    }
  }, [isActive, initialDomain, sites.length, sites[0]?.domain])

  const { setChrome } = useAdminSectionChrome()

  const handleCreate = async () => {
    if (!selectedDomain) return
    setCreating(true)
    const commands: Record<string, string> = {
      full: `mkdir -p /home/backup/full && directadmin createBackup --domainName ${selectedDomain} --backupPath /home/backup/full 2>&1`,
      files: `mkdir -p /home/backup/files && tar -czf /home/backup/files/${selectedDomain}_files_$(date +%Y%m%d_%H%M%S).tar.gz /home/${selectedDomain}/public_html/ 2>&1 && echo "SUCCESS"`,
      databases: `mkdir -p /home/backup/databases && mysqldump --all-databases 2>/dev/null | gzip > /home/backup/databases/${selectedDomain}_db_$(date +%Y%m%d_%H%M%S).sql.gz && echo "SUCCESS"`,
      emails: `mkdir -p /home/backup/emails && tar -czf /home/backup/emails/${selectedDomain}_emails_$(date +%Y%m%d_%H%M%S).tar.gz /home/vmail/${selectedDomain}/ 2>&1 && echo "SUCCESS"`,
      ftp: `mkdir -p /home/backup/ftp && tar -czf /home/backup/ftp/${selectedDomain}_ftp_$(date +%Y%m%d_%H%M%S).tar.gz /home/${selectedDomain}/ 2>&1 && echo "SUCCESS"`,
    }
    const res = await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'execCommand', params: { command: commands[activeTab] } })
    })
    const data = await res.json()
    const output = data.data?.output || ''
    if (output.includes('SUCCESS') || !output.toLowerCase().includes('error')) {
      showMsg(`Backup criado com sucesso!`)
      await loadBackups(selectedDomain)
    } else {
      showMsg('Erro: ' + output, 'error')
    }
    setCreating(false)
  }

  const siteDomainKey = useMemo(() => sites.map((s) => s.domain).join(','), [sites])

  useEffect(() => {
    if (!isActive) return
    setChrome({
      toolbar: (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm w-44"
          >
            <option value="">Seleccionar domínio...</option>
            {sites.map((s) => (
              <option key={s.domain} value={s.domain}>
                {s.domain}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadBackups(selectedDomain)}
            disabled={!selectedDomain || loading}
            className="flex items-center gap-2 rounded bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            title="Actualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!selectedDomain || creating}
            className="flex items-center gap-2 rounded border border-green-300 bg-green-50 px-4 py-2 text-sm font-bold text-green-600 hover:bg-green-100 disabled:opacity-50"
          >
            {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? 'A criar...' : 'Criar Backup'}
          </button>
        </div>
      ),
    })
    return () => setChrome(null)
  }, [isActive, selectedDomain, siteDomainKey, loading, creating, setChrome])

  const handleRestore = async (filename: string, path: string) => {
    if (!confirm(`Restaurar "${filename}"?\n\nISTO VAI SUBSTITUIR OS DADOS ACTUAIS!`)) return
    setLoading(true)
    const res = await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'restoreBackup',
        params: { domain: selectedDomain, filename: filename, tab: activeTab }
      })
    })
    const data = await res.json()
    const output = data.data?.output || ''
    if (data.success) showMsg('Restaurado com sucesso!')
    else {
      showMsg('Erro: ' + output);
      setMsgType('error');
    }
    setLoading(false)
  }

  const handleDownload = async (path: string, filename: string) => {
    setLoading(true)
    const res = await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execCommand',
        params: { command: `base64 ${path} 2>&1` }
      })
    })
    const data = await res.json()
    const content = data.data?.output || ''
    if (content && !content.toLowerCase().includes('error')) {
      try {
        const blob = new Blob(
          [Uint8Array.from(atob(content.trim()), c => c.charCodeAt(0))],
          { type: 'application/gzip' }
        )
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename; a.click()
        showMsg('Download iniciado!')
      } catch { showMsg('Erro no download', 'error' as any) }
    } else {
      showMsg('Erro: ' + content, 'error' as any)
    }
    setLoading(false)
  }

  return (
    <div className="w-full space-y-4">
      {/* Mensagem */}
      {msg && (
        <div className={`px-4 py-2.5 rounded text-sm font-medium border ${msgType === 'success'
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-red-50 text-red-700 border-red-200'
          }`}>{msg}</div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id
                ? 'border-red-600 text-red-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tabela de backups */}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold text-gray-500 uppercase border-b bg-gray-50">
              <th className="px-4 py-3">Ficheiro</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Tamanho</th>
              <th className="px-4 py-3">Acções</th>
            </tr>
          </thead>
          <tbody>
            {!selectedDomain ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                Selecciona um domínio para ver os backups
              </td></tr>
            ) : loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
              </td></tr>
            ) : backups.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center">
                <div className="space-y-2">
                  <Archive className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-gray-500 font-medium">Nenhum backup encontrado para {selectedDomain}</p>
                  <p className="text-gray-400 text-xs">Clica em "Criar Backup" para criar o primeiro backup deste site.</p>
                </div>
              </td></tr>
            ) : backups.map((b, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.filename}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{b.date}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{b.size}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleRestore(b.filename, b.path)}
                      className="bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors">
                      <RefreshCw className="w-3 h-3" /> Restaurar
                    </button>
                    <button onClick={() => handleDownload(b.path, b.filename)}
                      className="bg-gray-700 hover:bg-gray-800  px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors">
                      ↓ Download
                    </button>
                    <button onClick={async () => {
                      if (!confirm(`Eliminar "${b.filename}"? Irreversível!`)) return
                      setLoading(true)
                      await fetch('/api/server-exec', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'execCommand',
                          params: { command: `rm -f ${b.path} 2>&1 && echo "DELETED"` }
                        })
                      })
                      await loadBackups(selectedDomain)
                      showMsg('Backup eliminado!')
                      setLoading(false)
                    }}
                      className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors">
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// WordPress Install Section
export function WordPressInstallSection({ sites, onRefresh }: { sites: DirectAdminWebsite[], onRefresh?: () => void | Promise<void> }) {
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showDBPassword, setShowDBPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    protocol: 'https' as 'http' | 'https',
    domain: '',
    directory: '',
    version: '6.7.1',
    siteName: '',
    siteDescription: '',
    enableMultisite: false,
    disableWPCron: false,
    adminUsername: '',
    adminPassword: '',
    adminEmail: '',
    databaseName: '',
    databaseUser: '',
    databasePassword: '',
    plugins: {
      woocommerce: false,
      yoast: false,
      wordfence: false,
      litespeed: false
    }
  })

  const selectedSiteData = sites.find(s => s.domain === form.domain)
  const isWPInstalled = selectedSiteData?.hasWordPress || selectedSiteData?.siteType === 'wordpress'

  const wordpressVersions = ['6.7.1', '6.6.2', '6.5.5', '6.4.3']

  const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
    if (!password) return 'weak'

    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++

    if (strength <= 2) return 'weak'
    if (strength <= 4) return 'medium'
    return 'strong'
  }

  const handlePasswordChange = (password: string) => {
    setForm({ ...form, adminPassword: password })
    setPasswordStrength(getPasswordStrength(password))
  }

  const generateDBCredentials = () => {
    if (!form.domain) return

    const domainClean = form.domain.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const dbName = `${domainClean}_wp`
    const dbUser = `${domainClean}_wpuser`
    const dbPassword = Math.random().toString(36).slice(-12)

    setForm({
      ...form,
      databaseName: dbName,
      databaseUser: dbUser,
      databasePassword: dbPassword
    })
  }

  useEffect(() => {
    generateDBCredentials()
  }, [form.domain])

  const getFinalURL = () => {
    const url = `${form.protocol}://${form.domain}`
    return form.directory ? `${url}/${form.directory}` : url
  }

  const handleInstall = async () => {
    if (!form.domain || !form.adminUsername || !form.adminPassword || !form.adminEmail) {
      setMessage('Preencha domínio, utilizador admin, password e email.')
      setSuccess(false)
      return
    }
    if (!form.databaseName || !form.databaseUser || !form.databasePassword) {
      setMessage('Credenciais da base de dados em falta.')
      setSuccess(false)
      return
    }

    setInstalling(true)
    setSuccess(false)
    setMessage('')

    try {
      const res = await fetch('/api/admin/wp-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: form.domain,
          directory: form.directory,
          protocol: form.protocol,
          siteName: form.siteName || form.domain,
          adminUsername: form.adminUsername,
          adminPassword: form.adminPassword,
          adminEmail: form.adminEmail,
          databaseName: form.databaseName,
          databaseUser: form.databaseUser,
          databasePassword: form.databasePassword,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
        setMessage('WordPress instalado com sucesso!')
        if (onRefresh) await onRefresh()
      } else {
        setMessage(data.error || 'Falha na instalação.')
      }
    } catch (e: unknown) {
      setMessage('Erro: ' + (e instanceof Error ? e.message : 'desconhecido'))
    }
    setInstalling(false)
  }

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak': return 'text-red-500'
      case 'medium': return 'text-yellow-500'
      case 'strong': return 'text-green-500'
    }
  }

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 'weak': return 'Fraca'
      case 'medium': return 'Média'
      case 'strong': return 'Forte'
    }
  }

  return (
    <div className="space-y-6 w-full">


      {isWPInstalled && !success && (
        <div className="p-4 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm">Aviso: WordPress detectado!</p>
            <p className="text-xs">O domínio <strong>{form.domain}</strong> já parece ter uma instalação do WordPress. Reinstalar poderá apagar os dados existentes.</p>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-4 rounded ${success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {success ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            <span>{message}</span>
          </div>
          {!success && (
            <div className="mt-3">
              <a href={getDirectAdminWordPressUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                <ExternalLink className="w-4 h-4" />
                Abrir WordPress Manager
              </a>
            </div>
          )}
          {success && (
            <div className="mt-3 flex flex-wrap gap-3">
              <a href={`${getFinalURL()}/wp-admin`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                <ExternalLink className="w-4 h-4" />
                WP Admin
              </a>
              <a href={getFinalURL()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-700 transition-colors shadow-sm">
                <Globe className="w-4 h-4" />
                Ver Site
              </a>
              <button
                onClick={() => window.location.href = '/revendedor?section=cp-wp-list'}
                className="inline-flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
              >
                <Check className="w-4 h-4" />
                Ver na Lista WordPress
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuração do Software */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-blue-500 px-6 py-4 bg-blue-50/50">
            <h2 className="text-lg font-semibold text-gray-900">Configuração do Software</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Protocolo e Domínio na mesma linha */}
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Protocolo</label>
                <select
                  value={form.protocol}
                  onChange={(e) => setForm({ ...form, protocol: e.target.value as 'http' | 'https' })}
                  className="px-3 py-2.5 border border-gray-300 rounded-md text-sm w-auto min-w-[100px]"
                >
                  <option value="http">http://</option>
                  <option value="https">https://</option>
                </select>
              </div>

              <div className="flex-1 min-w-0">
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Domínio</label>
                <select
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Selecione um domínio</option>
                  {sites.map((site) => (
                    <option key={site.domain} value={site.domain}>
                      {site.domain}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Diretório</label>
              <input
                type="text"
                value={form.directory}
                onChange={(e) => setForm({ ...form, directory: e.target.value })}
                placeholder="wp (vazio para raiz)"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Versão WordPress</label>
              <select
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm"
              >
                {wordpressVersions.map((version) => (
                  <option key={version} value={version}>
                    WordPress {version}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs font-bold text-gray-600 uppercase mb-1">URL Final</div>
              <div className="text-sm font-mono text-blue-600">{getFinalURL()}</div>
            </div>
          </div>
        </div>

        {/* Configurações do Site */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-blue-500 px-6 py-4 bg-blue-50/50">
            <h2 className="text-lg font-semibold text-gray-900">Configurações do Site</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Nome do Site</label>
              <input
                type="text"
                value={form.siteName}
                onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                placeholder="Meu Site WordPress"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Descrição do Site</label>
              <textarea
                value={form.siteDescription}
                onChange={(e) => setForm({ ...form, siteDescription: e.target.value })}
                placeholder="Um site WordPress incrível"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enableMultisite}
                  onChange={(e) => setForm({ ...form, enableMultisite: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Ativar Multisite (WPMU)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.disableWPCron}
                  onChange={(e) => setForm({ ...form, disableWPCron: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Desativar WordPress Cron</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Nome de Utilizador</label>
              <input
                type="text"
                value={form.adminUsername}
                onChange={(e) => setForm({ ...form, adminUsername: e.target.value })}
                placeholder="admin"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.adminPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="Senha forte"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-md text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.adminPassword && (
                <div className={`mt-1 text-xs ${getPasswordStrengthColor()}`}>
                  Força da senha: {getPasswordStrengthText()}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Email</label>
              <input
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                placeholder="admin@exemplo.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        {/* Base de Dados */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-blue-500 px-6 py-4 bg-blue-50/50">
            <h2 className="text-lg font-semibold text-gray-900">Base de Dados</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Nome da Base de Dados</label>
              <input
                type="text"
                value={form.databaseName}
                onChange={(e) => setForm({ ...form, databaseName: e.target.value })}
                placeholder="digital_wp"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Utilizador BD</label>
              <input
                type="text"
                value={form.databaseUser}
                onChange={(e) => setForm({ ...form, databaseUser: e.target.value })}
                placeholder="digital_wpuser"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Senha BD</label>
              <div className="relative">
                <input
                  type={showDBPassword ? 'text' : 'password'}
                  value={form.databasePassword}
                  onChange={(e) => setForm({ ...form, databasePassword: e.target.value })}
                  placeholder="Senha do banco de dados"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-md text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowDBPassword(!showDBPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showDBPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-700">
                <strong>Nota:</strong> A base de dados e o utilizador serão criados automaticamente no servidor
              </p>
            </div>
          </div>
        </div>

        {/* Plugins Opcionais */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-blue-500 px-6 py-4 bg-blue-50/50">
            <h2 className="text-lg font-semibold text-gray-900">Plugins Opcionais</h2>
          </div>
          <div className="p-6 space-y-4">
            <label className="flex items-center gap-4 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.plugins.woocommerce}
                onChange={(e) => setForm({ ...form, plugins: { ...form.plugins, woocommerce: e.target.checked } })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded flex-shrink-0"
              />
              <div className="w-12 h-12 bg-[#96588a] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-800">WooCommerce</span>
                <p className="text-xs text-gray-500 mt-0.5">Loja online completa com produtos, pagamentos e envios</p>
              </div>
            </label>

            <label className="flex items-center gap-4 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.plugins.yoast}
                onChange={(e) => setForm({ ...form, plugins: { ...form.plugins, yoast: e.target.checked } })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded flex-shrink-0"
              />
              <div className="w-12 h-12 bg-[#a4286a] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-800">Yoast SEO</span>
                <p className="text-xs text-gray-500 mt-0.5">Otimização para motores de busca e análise de conteúdo</p>
              </div>
            </label>

            <label className="flex items-center gap-4 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.plugins.wordfence}
                onChange={(e) => setForm({ ...form, plugins: { ...form.plugins, wordfence: e.target.checked } })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded flex-shrink-0"
              />
              <div className="w-12 h-12 bg-[#2b2b2b] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#9b59b6]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-800">Wordfence Security</span>
                <p className="text-xs text-gray-500 mt-0.5">Firewall e proteção contra malware e ataques</p>
              </div>
            </label>

            <label className="flex items-center gap-4 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.plugins.litespeed}
                onChange={(e) => setForm({ ...form, plugins: { ...form.plugins, litespeed: e.target.checked } })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded flex-shrink-0"
              />
              <div className="w-12 h-12 bg-[#00a8e6] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2v8h8c0-4.42-3.58-8-8-8zM12 22c5.52 0 10-4.48 10-10h-8c0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4V2C6.48 2 2 6.48 2 12s4.48 10 10 10zm1-9h8.94c-.14 2.23-1.09 4.26-2.58 5.71L13 13z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-800">LiteSpeed Cache</span>
                <p className="text-xs text-gray-500 mt-0.5">Cache de página e otimização de performance</p>
              </div>
            </label>

            {/* Botão Instalar dentro do card de plugins */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleInstall}
                disabled={installing || !form.domain || !form.siteName || !form.adminUsername || !form.adminPassword || !form.adminEmail}
                className={`w-full px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${isWPInstalled
                    ? 'bg-amber-50 border border-amber-600 text-amber-600 hover:bg-amber-100'
                    : 'bg-transparent border border-green-600 text-green-600 hover:bg-green-50'
                  } disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300`}
              >
                {installing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Instalando WordPress...
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" />
                    {isWPInstalled ? 'Reinstalar WordPress' : 'Instalar WordPress'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// WordPress Backup Section
export function WPBackupSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [loading, setLoading] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedSite, setSelectedSite] = useState('')
  const [includeDirectory, setIncludeDirectory] = useState(true)
  const [includeDatabase, setIncludeDatabase] = useState(true)
  const [backupNote, setBackupNote] = useState('')
  const [backupLocation, setBackupLocation] = useState('Padrão')
  const [wpInfo, setWpInfo] = useState<any>(null)
  const [backups, setBackups] = useState<any[]>([])

  const backupLocations = ['Padrão', 'Google Drive', 'Dropbox', 'FTP Remoto']

  useEffect(() => {
    if (selectedSite) {
      loadWPInfo()
      loadBackups()
    }
  }, [selectedSite])

  const loadWPInfo = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/panel-wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getWPInfo',
          domain: selectedSite
        })
      })

      const data = await response.json()
      if (data.success) {
        setWpInfo(data.info)
      }
    } catch (error) {
      console.error('Erro ao carregar informações WordPress:', error)
    }
    setLoading(false)
  }

  const loadBackups = async () => {
    try {
      const response = await fetch('/api/panel-wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getWPBackups',
          domain: selectedSite
        })
      })

      const data = await response.json()
      if (data.success) {
        setBackups(data.backups || [])
      }
    } catch (error) {
      console.error('Erro ao carregar backups:', error)
    }
  }

  const handleBackup = async () => {
    setBackingUp(true)
    setMessage('')

    try {
      const response = await fetch('/api/panel-wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backupWordPress',
          domain: selectedSite,
          includeDirectory,
          includeDatabase,
          backupNote,
          backupLocation
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage('Backup criado com sucesso!')
        loadBackups()
      } else {
        setMessage(`Erro: ${data.error || 'Falha no backup'}`)
      }
    } catch (error) {
      setMessage('Erro de conexão com o servidor')
    }

    setBackingUp(false)
  }

  const handleDeleteBackup = async (backupId: string) => {
    try {
      const response = await fetch('/api/panel-wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteWPBackup',
          domain: selectedSite,
          backupId
        })
      })

      const data = await response.json()
      if (data.success) {
        loadBackups()
      }
    } catch (error) {
      console.error('Erro ao eliminar backup:', error)
    }
  }

  return (
    <div className="space-y-6 w-full">


      {message && (
        <div className={`p-4 rounded ${message.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {message.includes('sucesso') ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            <span>{message}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuração de Backup */}
        <div className="bg-white rounded shadow-sm border border-gray-200">
          <div className="border-b border-blue-500 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Configurar Backup</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Selecionar Website</label>
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm"
              >
                <option value="">Selecione um website</option>
                {sites.map((site) => (
                  <option key={site.domain} value={site.domain}>
                    {site.domain}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDirectory}
                  onChange={(e) => setIncludeDirectory(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <div>
                  <span className="text-sm text-gray-700">Diretório de backup</span>
                  <p className="text-xs text-gray-500">Se marcar esta opção, toda a pasta será incluída no backup</p>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDatabase}
                  onChange={(e) => setIncludeDatabase(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <div>
                  <span className="text-sm text-gray-700">Backup do banco de dados</span>
                  <p className="text-xs text-gray-500">Se marcado, o banco de dados também será incluído no backup</p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Nota do backup</label>
              <textarea
                value={backupNote}
                onChange={(e) => setBackupNote(e.target.value)}
                placeholder="Descrição deste backup..."
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Local backup</label>
              <select
                value={backupLocation}
                onChange={(e) => setBackupLocation(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm"
              >
                {backupLocations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleBackup}
              disabled={backingUp || !selectedSite}
              className="w-full bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 hover:text-blue-700 disabled:bg-gray-400  px-6 py-3 rounded font-medium transition-colors flex items-center justify-center gap-2"
            >
              {backingUp ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Fazendo Backup...
                </>
              ) : (
                <>
                  <Archive className="w-5 h-5" />
                  Backup da Instalação
                </>
              )}
            </button>
          </div>
        </div>

        {/* Informações WordPress */}
        {wpInfo && (
          <div className="bg-white rounded shadow-sm border border-gray-200">
            <div className="border-b border-blue-500 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Informações</h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Software:</span>
                <span className="text-sm font-medium">{wpInfo.software}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Versão:</span>
                <span className="text-sm font-medium">{wpInfo.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Caminho:</span>
                <span className="text-sm font-medium">{wpInfo.path}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">URL:</span>
                <span className="text-sm font-medium">{wpInfo.url}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Nome BD:</span>
                <span className="text-sm font-medium">{wpInfo.databaseName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Utilizador BD:</span>
                <span className="text-sm font-medium">{wpInfo.databaseUser}</span>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Backups */}
        {backups.length > 0 && (
          <div className="bg-white rounded shadow-sm border border-gray-200 lg:col-span-2">
            <div className="border-b border-blue-500 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Backups Disponíveis</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {backups.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium text-sm">{backup.filename}</div>
                      <div className="text-xs text-gray-500">{backup.date} - {backup.size}</div>
                      {backup.note && <div className="text-xs text-gray-600 mt-1">{backup.note}</div>}
                    </div>
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(backup.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Domain Manager Section
function domainHostingStateLabel(row: CachedDomainRow): 'Activo' | 'Desactivo' {
  const raw = row.state ?? row.status ?? 'Active'
  if (raw === '0' || raw === 'Active' || raw === 'active') return 'Activo'
  if (raw === '1' || raw === 'Suspended' || raw === 'suspended') return 'Desactivo'
  const lower = String(raw).toLowerCase()
  if (lower.includes('suspend') || lower.includes('inactiv') || lower.includes('desactiv')) return 'Desactivo'
  return 'Activo'
}

function domainExpirationPlaceholder(domain: string): string {
  const hash = domain.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const days = (hash % 180) + 30
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

function siteHasSsl(site?: DirectAdminWebsite): boolean {
  if (!site) return false
  return (
    site.sslStatus === 'Secure' ||
    site.ssl === true ||
    (site as { ssl?: string | boolean }).ssl === 'Enabled'
  )
}

const domainCardBtn =
  'rounded border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400'

function sitesToDomainRows(list: DirectAdminWebsite[]): CachedDomainRow[] {
  return list
    .filter(
      (s) =>
        s.domain &&
        !s.domain.includes('contaboserver') &&
        !s.domain.includes('localhost') &&
        !s.domain.toLowerCase().startsWith('mail'),
    )
    .map((s) => ({
      domain: s.domain,
      adminEmail: s.adminEmail,
      package: s.package,
      state: s.state || s.status,
      status: s.status,
      owner: s.owner,
    }))
}

export function DomainManagerSection({
  sites,
  packages = [],
  onCreateEmail,
  onNavigate,
  onRefresh,
  hubMode = false,
  hubPanel = 'list',
  domainListMode = 'hosting',
  isActive = true,
  onHubAddClose,
  listSearch: listSearchProp,
  onListSearchChange,
  onFilteredCountChange,
}: {
  sites: DirectAdminWebsite[]
  packages?: DirectAdminPackage[]
  onCreateEmail?: (domain: string) => void
  onNavigate?: (section: string, opts?: { domain?: string }) => void
  onRefresh?: () => void | Promise<void>
  hubMode?: boolean
  hubPanel?: 'list' | 'add'
  domainListMode?: 'hosting' | 'registrar'
  isActive?: boolean
  onHubAddClose?: () => void
  listSearch?: string
  onListSearchChange?: (value: string) => void
  onFilteredCountChange?: (count: number) => void
}) {
  const [view, setView] = useState<'list' | 'create' | 'manage'>('list')
  const [selectedDomain, setSelectedDomain] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [listSearchInternal, setListSearchInternal] = useState('')
  const listSearch = hubMode && listSearchProp !== undefined ? listSearchProp : listSearchInternal
  const setListSearch = hubMode && onListSearchChange ? onListSearchChange : setListSearchInternal
  const [openMenuDomain, setOpenMenuDomain] = useState<string | null>(null)
  const domainMenuRef = useRef<HTMLDivElement>(null)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  const sitesSignature = useMemo(
    () =>
      sites
        .map((s) =>
          `${s.domain?.toLowerCase() ?? ''}:${s.state ?? s.status ?? ''}:${s.package ?? ''}:${s.sslStatus ?? ''}:${s.ssl ?? ''}`,
        )
        .filter((line) => line.length > 1)
        .sort()
        .join('|'),
    [sites],
  )

  const siteByDomain = useMemo(() => {
    const map = new Map<string, DirectAdminWebsite>()
    for (const s of sites) map.set(s.domain.toLowerCase(), s)
    return map
  }, [sitesSignature, sites])

  const rowsFromSites = useMemo(() => sitesToDomainRows(sites), [sitesSignature, sites])

  const [registrarListRows, setRegistrarListRows] = useState<CachedDomainRow[]>(() =>
    domainListMode === 'registrar' ? readRegistrarDomainListCache() : [],
  )
  const [registrarListLoading, setRegistrarListLoading] = useState(false)

  useEffect(() => {
    if (domainListMode !== 'registrar' || !isActive || hubPanel !== 'list') return
    let cancelled = false
    const cached = readRegistrarDomainListCache(true)
    if (cached.length > 0) {
      setRegistrarListRows(cached)
    } else {
      setRegistrarListLoading(true)
    }
    void fetch('/api/registrar/account/domains', { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { success?: boolean; domains?: { domain: string; status?: string; expireDate?: string }[] }) => {
        if (cancelled) return
        if (data.success && Array.isArray(data.domains)) {
          const rows = data.domains.map((d) => ({
            domain: d.domain,
            state: d.status || 'Active',
            status: d.status,
            expireDate: d.expireDate,
          }))
          setRegistrarListRows(rows)
          writeRegistrarDomainListCache(rows)
        } else if (cached.length === 0) {
          setRegistrarListRows([])
        }
      })
      .catch(() => {
        if (!cancelled && cached.length === 0) setRegistrarListRows([])
      })
      .finally(() => {
        if (!cancelled) setRegistrarListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [domainListMode, isActive, hubPanel])

  const mergedRegistrarRows = useMemo(
    () =>
      registrarListRows.map((row) => {
        const site = siteByDomain.get(row.domain.toLowerCase())
        if (!site) return row
        return {
          ...row,
          package: site.package || row.package,
          owner: site.owner || row.owner,
          adminEmail: site.adminEmail || row.adminEmail,
          state: site.state || site.status || row.state,
          status: site.status || row.status,
        }
      }),
    [registrarListRows, siteByDomain],
  )

  const domainList = useMemo(() => {
    if (domainListMode === 'registrar') return mergedRegistrarRows
    if (rowsFromSites.length > 0) return rowsFromSites
    return readDomainListCache()
  }, [domainListMode, mergedRegistrarRows, rowsFromSites])

  const filteredDomains = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    if (!q) return domainList
    return domainList.filter((d) => d.domain.toLowerCase().includes(q))
  }, [domainList, listSearch])

  useEffect(() => {
    if (domainListMode === 'registrar') return
    if (rowsFromSites.length > 0) writeDomainListCache(rowsFromSites)
  }, [domainListMode, rowsFromSites])

  const [registrarLoading, setRegistrarLoading] = useState(false)
  const [transferLocked, setTransferLocked] = useState<boolean | null>(null)
  const [authCode, setAuthCode] = useState('')
  const [authCodeExpires, setAuthCodeExpires] = useState('')
  const [autoRenew, setAutoRenew] = useState<boolean | null>(null)
  const [registrarExpire, setRegistrarExpire] = useState('')

  // Formulário criar domínio - atualizado para igual ao DirectAdmin
  const [domainType, setDomainType] = useState<'addon' | 'subdomain' | 'parked'>('addon')
  const [newDomain, setNewDomain] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [docRoot, setDocRoot] = useState('')
  const [selectedPHP, setSelectedPHP] = useState('PHP 8.2')

  // Modal de criação de email
  const [emailModal, setEmailModal] = useState<{ show: boolean, domain: string }>({ show: false, domain: '' })
  const [emailForm, setEmailForm] = useState({ user: '', password: '', confirmPassword: '', quota_mb: 500 })
  const [creatingEmail, setCreatingEmail] = useState(false)
  const [showEmailPass, setShowEmailPass] = useState(false)

  // Modal de criação de domínio
  const [domainModal, setDomainModal] = useState(false)

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  const panelBtnRow = domainCardBtn

  useEffect(() => {
    if (!hubMode || !isActive || view !== 'list' || hubPanel !== 'list') return
    onFilteredCountChange?.(filteredDomains.length)
  }, [hubMode, hubPanel, isActive, view, filteredDomains.length, onFilteredCountChange])

  useEffect(() => {
    if (!openMenuDomain) return
    const handleClickOutside = (e: MouseEvent) => {
      if (domainMenuRef.current && !domainMenuRef.current.contains(e.target as Node)) {
        setOpenMenuDomain(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuDomain])

  const handleRenewDomain = async (domain: string) => {
    setOpenMenuDomain(null)
    try {
      const res = await fetch('/api/renewals?type=domain', { credentials: 'include' })
      const data = await res.json()
      if (res.ok && data.success) {
        const renewal = (data.domains || []).find(
          (r: { domain_name?: string }) => r.domain_name?.toLowerCase() === domain.toLowerCase(),
        )
        if (renewal?.id) {
          window.location.href = `/pagamento/renovacao/${renewal.id}`
          return
        }
      }
    } catch {
      /* fallback abaixo */
    }
    onNavigate?.('faturas')
    showMsg('Renovação não encontrada para este domínio. Verifique em Faturas.', 'error')
  }

  useEffect(() => {
    if (newDomain) setDocRoot(newDomain)
  }, [newDomain])

  const loadRegistrarInfo = async (domain: string) => {
    setRegistrarLoading(true)
    setAuthCode('')
    setAuthCodeExpires('')
    try {
      const res = await fetch(`/api/registrar/domain/manage?domain=${encodeURIComponent(domain)}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setTransferLocked(typeof data.isLocked === 'boolean' ? data.isLocked : null)
        setAutoRenew(typeof data.autoRenew === 'boolean' ? data.autoRenew : null)
        setRegistrarExpire(data.expireDate || '')
      }
    } catch {
      /* registo pode ser só hospedagem */
    } finally {
      setRegistrarLoading(false)
    }
  }

  useEffect(() => {
    if (view === 'manage' && selectedDomain?.domain) {
      void loadRegistrarInfo(selectedDomain.domain)
    }
  }, [view, selectedDomain?.domain])

  const handleUnlockTransfer = async () => {
    if (!selectedDomain?.domain) return
    setRegistrarLoading(true)
    try {
      const res = await fetch('/api/registrar/domain/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain: selectedDomain.domain, action: 'unlock' }),
      })
      const data = await res.json()
      if (data.success) {
        setTransferLocked(false)
        showMsg(data.message || 'Domínio desbloqueado para transferência.')
      } else {
        showMsg(data.error || 'Erro ao desbloquear', 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    } finally {
      setRegistrarLoading(false)
    }
  }

  const handleFetchAuthCode = async () => {
    if (!selectedDomain?.domain) return
    setRegistrarLoading(true)
    try {
      const res = await fetch('/api/registrar/domain/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain: selectedDomain.domain, action: 'auth-code' }),
      })
      const data = await res.json()
      if (data.success && data.authCode) {
        setAuthCode(data.authCode)
        setAuthCodeExpires(data.expires || '')
        showMsg(data.message || 'Código obtido.')
      } else {
        showMsg(data.error || 'Erro ao obter código', 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    } finally {
      setRegistrarLoading(false)
    }
  }

  const handleToggleAutoRenew = async () => {
    if (!selectedDomain?.domain || autoRenew === null) return
    const next = !autoRenew
    setRegistrarLoading(true)
    try {
      const res = await fetch('/api/registrar/domain/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain: selectedDomain.domain, action: 'autorenew', isEnabled: next }),
      })
      const data = await res.json()
      if (data.success) {
        setAutoRenew(next)
        showMsg(data.message || (next ? 'Renovação automática activada.' : 'Renovação automática desactivada.'))
      } else {
        showMsg(data.error || 'Erro ao actualizar renovação automática', 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    } finally {
      setRegistrarLoading(false)
    }
  }

  const openManage = (d: CachedDomainRow) => {
    setSelectedDomain(d)
    setView('manage')
  }

  const handleSuspendDomain = async (d: CachedDomainRow) => {
    setOpenMenuDomain(null)
    const isActive = domainHostingStateLabel(d) === 'Activo'
    const verb = isActive ? 'suspender' : 'activar'
    if (!confirm(`Deseja ${verb} o domínio "${d.domain}"?`)) return
    setLoading(true)
    try {
      const ok = isActive
        ? await directAdminAPI.suspendWebsite(d.domain)
        : await directAdminAPI.unsuspendWebsite(d.domain)
      if (ok) {
        await syncWebsiteToSupabase({ domain: d.domain, status: isActive ? 'Suspended' : 'Active' })
        showMsg(`Domínio ${isActive ? 'suspenso' : 'activado'} com sucesso.`)
        await onRefresh?.()
      } else {
        showMsg(`Erro ao ${verb} o domínio.`, 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : `Erro ao ${verb} o domínio.`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newDomain || !adminEmail) return
    setLoading(true)
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createWebsite',
          params: {
            domain: newDomain,
            email: adminEmail,
            php: selectedPHP,
          }
        })
      })
      const data = await res.json()
      const output = data.data?.output || ''
      if (data.success || output.includes('success') || output.includes('created') || output.toLowerCase().includes('ok')) {
        showMsg(`Domínio "${newDomain}" criado com sucesso!`)
        setNewDomain(''); setAdminEmail(''); setDocRoot('')
        setView('list')
        await onRefresh?.()
      } else {
        showMsg('Erro: ' + (data.error || output || 'Falha ao criar domínio'), 'error')
      }
    } catch (e: any) {
      showMsg('Erro de conexão: ' + e.message, 'error')
    }
    setLoading(false)
  }

  // Função para criar email a partir do modal
  const handleCreateEmail = async () => {
    if (!emailForm.user || !emailForm.password) {
      showMsg('Preencha todos os campos obrigatórios', 'error')
      return
    }
    if (emailForm.password !== emailForm.confirmPassword) {
      showMsg('As senhas não coincidem', 'error')
      return
    }
    setCreatingEmail(true)
    try {
      const res = await fetch('/api/email-contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: emailModal.domain,
          userName: emailForm.user,
          password: emailForm.password,
          quota: emailForm.quota_mb || 500
        })
      })
      const data = await res.json()
      if (data.success) {
        setEmailModal({ show: false, domain: '' })
        setEmailForm({ user: '', password: '', confirmPassword: '', quota_mb: 500 })
        showMsg(`Email ${emailForm.user}@${emailModal.domain} criado com sucesso!`)
        // Navegar para lista de emails após sucesso
        if (onCreateEmail) onCreateEmail(emailModal.domain)
      } else {
        showMsg('Erro: ' + (data.error || 'Falha ao criar email'), 'error')
      }
    } catch (e: any) {
      showMsg('Erro: ' + e.message, 'error')
    }
    setCreatingEmail(false)
  }

  const handleRemove = async (domain: string) => {
    if (!confirm(`Eliminar "${domain}"? Esta acção é irreversível!`)) return
    setLoading(true)
    const res = await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteWebsite', params: { domain } }),
    })
    const data = await res.json()
    if (data.success) {
      showMsg(`Domínio "${domain}" eliminado!`)
    } else {
      showMsg('Erro: ' + (data.error || data.data?.error || 'Falha ao eliminar'), 'error')
    }
    await onRefresh?.()
    setView('list')
    setLoading(false)
  }

  // VISTA: LISTA DE DOMÍNIOS
  const domainCardMenuItem =
    'block w-full px-3 py-2 text-left text-xs text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400'

  const renderDomainCardActions = (d: CachedDomainRow) => (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" className={`${domainCardBtn} font-bold`} onClick={() => openManage(d)}>
        Gerir website
      </button>
      <div
        ref={openMenuDomain === d.domain ? domainMenuRef : undefined}
        className="relative"
      >
        <button
          type="button"
          className={domainCardBtn}
          onClick={() => setOpenMenuDomain((prev) => (prev === d.domain ? null : d.domain))}
          aria-expanded={openMenuDomain === d.domain}
          aria-haspopup="menu"
          aria-label="Mais opções"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {openMenuDomain === d.domain && (
          <div className="absolute right-0 top-1/2 z-50 min-w-[11rem] -translate-y-1/2 rounded border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <button type="button" className={domainCardMenuItem} onClick={() => { setOpenMenuDomain(null); onNavigate?.('cp-dns-nameserver', { domain: d.domain }) }}>
              Nameservers
            </button>
            <button type="button" className={domainCardMenuItem} onClick={() => { setOpenMenuDomain(null); setEmailModal({ show: true, domain: d.domain }) }}>
              Criar e-mail
            </button>
            <button type="button" className={domainCardMenuItem} onClick={() => { setOpenMenuDomain(null); onNavigate?.('dns-central', { domain: d.domain }) }}>
              Editar Zona de DNS
            </button>
            <button type="button" className={domainCardMenuItem} onClick={() => void handleRenewDomain(d.domain)}>
              Renovar domínio
            </button>
            <button type="button" className={domainCardMenuItem} onClick={() => openManage(d)}>
              Redireccionamento
            </button>
            <button type="button" className={domainCardMenuItem} onClick={() => void handleSuspendDomain(d)}>
              {domainHostingStateLabel(d) === 'Activo' ? 'Suspender domínio' : 'Activar domínio'}
            </button>
            <button
              type="button"
              className={domainCardMenuItem}
              onClick={() => {
                setOpenMenuDomain(null)
                window.open(`https://${d.domain}`, '_blank', 'noopener,noreferrer')
              }}
            >
              Visitar site
            </button>
          </div>
        )}
      </div>
    </div>
  )

  if (hubMode && hubPanel === 'add') {
    return (
      <div className="w-full">
        <DomainCreateModal
          show
          sites={sites}
          onClose={() => onHubAddClose?.()}
          onSuccess={() => {
            onHubAddClose?.()
            void onRefresh?.()
          }}
          packages={packages}
        />
      </div>
    )
  }

  if (view === 'list') return (
    <div className="w-full space-y-5">
      {!hubMode ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-[140px] flex-wrap items-center gap-3">
            <div className="relative w-full max-w-[14rem]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Pesquisar domínios..."
                className="w-full rounded border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 dark:border-zinc-700 dark:bg-white dark:text-zinc-900"
              />
            </div>
            <span className="text-sm text-gray-500 dark:text-zinc-400">{filteredDomains.length} domínio(s)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setDomainModal(true)} className={panelBtnSecondary}>
              <Plus className="h-4 w-4" /> Adicionar domínio
            </button>
            <button type="button" onClick={() => void onRefresh?.()} disabled={loading} className={panelBtnSecondary}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Actualizar
            </button>
          </div>
        </div>
      ) : null}

      {msg && (
        <div className={`rounded border px-4 py-2.5 text-sm font-medium ${msgType === 'success'
            ? 'border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400'
          }`}>{msg}</div>
      )}

      {((domainListMode === 'registrar' ? registrarListLoading : loading) && filteredDomains.length === 0) ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400 dark:text-zinc-500" />
        </div>
      ) : filteredDomains.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center text-gray-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
          {domainListMode === 'registrar' ? 'Nenhum domínio registado encontrado' : 'Nenhum domínio encontrado'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDomains.map((d) => {
            const site = siteByDomain.get(d.domain.toLowerCase())
            const isActive = domainHostingStateLabel(d) === 'Activo'
            const domainParts = d.domain.split('.')
            const tld = domainParts.length > 1 ? `.${domainParts.slice(1).join('.')}` : ''
            const baseName = domainParts[0]
            const hasSsl = siteHasSsl(site)

            return (
              <article
                key={d.domain}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 md:items-center md:gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                    <Globe className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-start gap-2">
                      <span className="text-base font-bold text-gray-900 dark:text-zinc-100">{baseName}</span>
                      {tld && <span className="text-sm font-medium text-gray-400 dark:text-zinc-500">{tld}</span>}
                      {hasSsl ? (
                        <span className="flex items-center gap-1 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-400">
                          <Lock className="h-3 w-3" /> SSL
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                          Sem SSL
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-start gap-2 text-xs">
                      <span className={`font-medium ${isActive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        ● {isActive ? 'Activo' : 'Desactivo'}
                      </span>
                      <span className="text-gray-300 dark:text-zinc-600">·</span>
                      <span className="text-gray-400 dark:text-zinc-500">
                        Exp: {d.expireDate || domainExpirationPlaceholder(d.domain)}
                      </span>
                      {d.package && (
                        <>
                          <span className="text-gray-300 dark:text-zinc-600">·</span>
                          <span className="text-gray-400 dark:text-zinc-500">{d.package}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {renderDomainCardActions(d)}
              </article>
            )
          })}
        </div>
      )}

      {/* Modal de Criação de Email */}
      <EmailCreateModal
        show={emailModal.show}
        domain={emailModal.domain}
        onClose={() => setEmailModal({ show: false, domain: '' })}
        onSuccess={() => {
          setEmailModal({ show: false, domain: '' })
          // Permanece na página atual - não redireciona
        }}
      />

      {/* Modal de Criação de Domínio */}
      <DomainCreateModal
        show={domainModal}
        sites={sites}
        onClose={() => setDomainModal(false)}
        onSuccess={() => {
          setDomainModal(false)
          void onRefresh?.()
        }}
        packages={packages}
      />
    </div>
  )

  // VISTA: CRIAR DOMÍNIO (mantida para compatibilidade)
  if (view === 'create') return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')}
          className="text-blue-600 hover:underline text-sm font-medium">
          ← List Domains
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-sm text-gray-600">Criar um Novo Domínio</span>
      </div>

      <h1 className="text-xl font-bold text-gray-900">Domínios</h1>
      <p className="text-sm text-gray-500">Use this interface to manage your domains.</p>

      {msg && (
        <div className={`px-4 py-2.5 rounded text-sm font-medium border ${msgType === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>{msg}</div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Criar um Novo Domínio</h2>
        </div>
        <div className="px-6 py-6 space-y-6">

          {/* Domain Type */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Domain Type
            </label>
            <select
              value={domainType}
              onChange={e => setDomainType(e.target.value as any)}
              className="w-full px-4 py-3 border border-zinc-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
            >
              <option value="addon">Addon Domain</option>
              <option value="subdomain">Subdomain</option>
              <option value="parked">Parked Domain</option>
            </select>
          </div>

          {/* Domain Name */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Domain Name
            </label>
            <input
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              placeholder="subdomain.example.com or newdomain.com"
              className="w-full px-4 py-3 border border-zinc-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
            />
          </div>

          {/* Admin Email */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Admin Email
            </label>
            <input
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              placeholder="admin@exemplo.com"
              className="w-full px-4 py-3 border border-zinc-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
            />
          </div>

          {/* Document Root Path */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Document Root Path
            </label>
            <div className="flex items-center border border-zinc-300 rounded overflow-hidden bg-white">
              <span className="bg-zinc-100 px-4 py-3 text-sm text-zinc-600 border-r border-zinc-300 font-mono whitespace-nowrap">
                /home/{newDomain || 'domain'}/
              </span>
              <input
                value={docRoot || (newDomain ? `public_html/${newDomain}` : 'public_html/subdomain')}
                onChange={e => setDocRoot(e.target.value)}
                placeholder="public_html/subdomain"
                className="flex-1 px-4 py-3 text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Select PHP Version */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Select PHP Version
            </label>
            <select
              value={selectedPHP}
              onChange={e => setSelectedPHP(e.target.value)}
              className="w-full px-4 py-3 border border-zinc-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
            >
              <option>PHP 7.4</option>
              <option>PHP 8.0</option>
              <option>PHP 8.1</option>
              <option>PHP 8.2</option>
              <option>PHP 8.3</option>
            </select>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-between pt-4">
            <button onClick={handleCreate} disabled={!newDomain || !adminEmail || loading}
              className="border border-red-300 bg-red-600/10 text-red-600 hover:bg-red-600/15 px-6 py-3 rounded text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar domínio
            </button>
            <button onClick={() => setView('list')}
              className="text-zinc-500 hover:text-zinc-700 text-sm font-medium">
              ← Voltar para Lista
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // VISTA: GERIR DOMÍNIO
  if (view === 'manage' && selectedDomain) return (
    <div className="w-full space-y-4">
      <button
        type="button"
        onClick={() => setView('list')}
        className="text-sm text-gray-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
      >
        ← Voltar à lista
      </button>

      {msg && (
        <div className={`rounded border px-4 py-2.5 text-sm font-medium ${msgType === 'success'
            ? 'border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400'
          }`}>{msg}</div>
      )}

      <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded border border-gray-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-zinc-100">
              {selectedDomain.domain}
            </h2>
            <p className="mb-4 text-xs text-gray-500 dark:text-zinc-500">
              Gestão de registo e transferência
              {registrarExpire ? ` · Expira ${registrarExpire}` : ''}
            </p>

            <div className="space-y-4">
              <div className="rounded border border-gray-100 p-4 dark:border-zinc-800">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Bloqueio de transferência</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">
                      {transferLocked === null
                        ? 'Estado indisponível (domínio pode ser só de hospedagem)'
                        : transferLocked
                          ? 'Bloqueado — desbloqueie antes de transferir'
                          : 'Desbloqueado — pronto para transferência'}
                    </p>
                  </div>
                  {transferLocked !== false && (
                    <button
                      type="button"
                      onClick={() => void handleUnlockTransfer()}
                      disabled={registrarLoading}
                      className={panelBtnPrimary}
                    >
                      {registrarLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
                      Desbloquear
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded border border-gray-100 p-4 dark:border-zinc-800">
                <p className="mb-2 text-sm font-medium text-gray-900 dark:text-zinc-100">Código de transferência (EPP)</p>
                <p className="mb-3 text-xs text-gray-500 dark:text-zinc-500">
                  Obtenha o código sem sair desta página e use-o no novo registador.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleFetchAuthCode()}
                    disabled={registrarLoading}
                    className={panelBtnPrimary}
                  >
                    {registrarLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                    Obter código
                  </button>
                  {authCode && (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(authCode)
                        showMsg('Código copiado.')
                      }}
                      className={panelBtnSecondary}
                    >
                      <Copy className="h-4 w-4" /> Copiar
                    </button>
                  )}
                </div>
                {authCode && (
                  <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {authCode}
                    {authCodeExpires && (
                      <p className="mt-1 font-sans text-xs text-gray-500 dark:text-zinc-500">
                        Expira: {new Date(authCodeExpires).toLocaleString('pt-PT')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div id="domain-redirect" className="rounded border border-gray-100 p-4 dark:border-zinc-800">
                <p className="mb-2 text-sm font-medium text-gray-900 dark:text-zinc-100">Redireccionamento</p>
                <p className="text-xs text-gray-500 dark:text-zinc-500">
                  Actualmente sem redireccionamento. Para configurar, use o painel de ficheiros ou contacte o suporte.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="mb-3 text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">Zona perigosa</p>
            <button
              type="button"
              onClick={() => handleRemove(selectedDomain.domain)}
              className={`${panelBtnSecondary} border-red-300 text-red-600 hover:text-red-600 dark:border-red-800 dark:text-red-400`}
            >
              <Trash2 className="h-4 w-4" /> Eliminar domínio de hospedagem
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
              <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">Acções</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              <button
                type="button"
                onClick={() => onNavigate?.('dns-central', { domain: selectedDomain.domain })}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
              >
                Editar Zona de DNS
                <Globe className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('cp-dns-nameserver', { domain: selectedDomain.domain })}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
              >
                Alterar nameservers
                <Server className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('cadastrar-renovacao', { domain: selectedDomain.domain })}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
              >
                Renovar manualmente
                <Calendar className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => void handleToggleAutoRenew()}
                disabled={registrarLoading || autoRenew === null}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-red-400"
              >
                <span>
                  Renovação automática
                  {autoRenew !== null && (
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-zinc-500">
                      {autoRenew ? 'Activa' : 'Inactiva'}
                    </span>
                  )}
                </span>
                <RefreshCw className={`h-4 w-4 shrink-0 ${registrarLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setEmailModal({ show: true, domain: selectedDomain.domain })}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
              >
                Criar e-mail
                <Mail className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => window.open(`https://${selectedDomain.domain}`, '_blank', 'noopener,noreferrer')}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
              >
                Abrir site
                <ExternalLink className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500 dark:text-zinc-500">Document root</span>
              <span className="font-mono text-xs text-gray-700 dark:text-zinc-300">/public_html/{selectedDomain.domain}</span>
            </div>
            <div className="mt-2 flex justify-between gap-2">
              <span className="text-gray-500 dark:text-zinc-500">Pacote</span>
              <span className="text-gray-700 dark:text-zinc-300">{selectedDomain.package || '—'}</span>
            </div>
            <div className="mt-2 flex justify-between gap-2">
              <span className="text-gray-500 dark:text-zinc-500">Estado</span>
              <span className="text-gray-700 dark:text-zinc-300">{selectedDomain.state || selectedDomain.status || 'Active'}</span>
            </div>
          </div>
        </div>
      </div>

      <EmailCreateModal
        show={emailModal.show}
        domain={emailModal.domain}
        onClose={() => setEmailModal({ show: false, domain: '' })}
        onSuccess={() => setEmailModal({ show: false, domain: '' })}
      />
    </div>
  )

  return null
}

// Modal de Criação de Email (componente reutilizável)
function EmailCreateModal({ show, domain, onClose, onSuccess }: { show: boolean, domain: string, onClose: () => void, onSuccess: () => void }) {
  const [form, setForm] = useState({ user: '', password: '', confirmPassword: '', quota_mb: 500 })
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const handleSubmit = async () => {
    if (!form.user || !form.password) {
      setError('Preencha todos os campos obrigatórios')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/email-contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: domain,
          userName: form.user,
          password: form.password,
          quota: form.quota_mb || 500
        })
      })
      const data = await res.json()
      if (data.success) {
        onSuccess()
      } else {
        setError(data.error || 'Falha ao criar email')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-lg w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 border border-indigo-300 text-indigo-600 rounded flex items-center justify-center ">
              <Mail className="w-5 h-5 " />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 block">Novo E-mail</h2>
              <span className="text-[11px] text-gray-500 font-mono">No domínio: {domain}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Username</label>
            <div className="flex items-center gap-2">
              <input
                value={form.user}
                onChange={e => setForm({ ...form, user: e.target.value })}
                placeholder="admin"
                className="flex-1 bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
              <span className="text-gray-400 text-sm">@{domain}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all pr-12"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirmar Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Confirmar Senha"
                  className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all pr-12"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quota (MB)</label>
            <select
              value={form.quota_mb}
              onChange={e => setForm({ ...form, quota_mb: parseInt(e.target.value) })}
              className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            >
              <option value="250">250 MB</option>
              <option value="500">500 MB</option>
              <option value="1000">1 GB</option>
              <option value="2000">2 GB</option>
              <option value="5000">5 GB</option>
              <option value="0">Ilimitado</option>
            </select>
          </div>

          <button
            onClick={() => {
              const pass = generatePassword()
              setForm({ ...form, password: pass, confirmPassword: pass })
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Gerar senha automática
          </button>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-indigo-50 border border-indigo-300 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700  rounded text-xs font-bold  transition-all flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Criar E-mail
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal de Criação de Domínio / Subdomínio (componente reutilizável)
function DomainCreateModal({
  show,
  onClose,
  onSuccess,
  packages,
  sites = [],
}: {
  show: boolean
  onClose: () => void
  onSuccess: () => void
  packages?: DirectAdminPackage[]
  sites?: DirectAdminWebsite[]
}) {
  const [domainType, setDomainType] = useState<'addon' | 'subdomain' | 'parked'>('addon')
  const [newDomain, setNewDomain] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [docRoot, setDocRoot] = useState('')
  const [selectedPHP, setSelectedPHP] = useState('PHP 8.2')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (newDomain && !docRoot) {
      setDocRoot(`public_html/${newDomain}`)
    }
  }, [newDomain, docRoot])

  const handleSubmit = async () => {
    if (!newDomain || !adminEmail) {
      setError('Preencha todos os campos obrigatórios')
      return
    }
    setLoading(true)
    setError('')
    try {
      console.log('[DomainCreateModal] Enviando requisição:', { domain: newDomain, email: adminEmail, php: selectedPHP })

      // Timeout de 30 segundos
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createWebsite',
          params: {
            domain: newDomain,
            email: adminEmail,
            php: selectedPHP,
          }
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText || 'Erro no servidor'}`)
      }

      const data = await res.json()
      console.log('[DomainCreateModal] Resposta:', data)

      const output = data.data?.output || ''

      // Verificar sucesso: data.success do backend OU parse do JSON no output
      let isSuccess = data.success === true

      // Tentar fazer parse do JSON no output para verificar "success": 1
      if (!isSuccess && output) {
        try {
          // Procurar por JSON no output (ex: {"success": 1, ...})
          const jsonMatch = output.match(/\{[\s\S]*"success"\s*:\s*(\d+)[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (parsed.success === 1 || parsed.success === true) {
              isSuccess = true
            }
          }
        } catch (e) {
          // Ignora erro de parse
        }
      }

      // Fallback: verificar strings de sucesso no output
      if (!isSuccess) {
        isSuccess = output.includes('website has been created') ||
          output.includes('successfully') ||
          (output.includes('success') && !output.includes('success": 0'))
      }

      console.log('[DomainCreateModal] isSuccess:', isSuccess)

      if (isSuccess) {
        onSuccess()
      } else {
        // Tentar extrair mensagem de erro do JSON
        let errorMsg = data.error || data.data?.error

        if (!errorMsg && output) {
          try {
            const jsonMatch = output.match(/\{[\s\S]*"errorMessage"\s*:\s*"([^"]+)"[\s\S]*\}/)
            if (jsonMatch) {
              errorMsg = jsonMatch[1]
            }
          } catch (e) {
            // Ignora
          }
        }

        if (!errorMsg) errorMsg = output || data.message || 'Falha ao criar domínio'

        console.error('[DomainCreateModal] Erro:', errorMsg)
        setError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg))
      }
    } catch (e: any) {
      console.error('[DomainCreateModal] Exceção:', e)
      if (e.name === 'AbortError') {
        setError('Timeout: O servidor demorou muito para responder. Tente novamente.')
      } else {
        setError(e.message || 'Erro de conexão com o servidor')
      }
    }
    setLoading(false)
  }

  const resetForm = () => {
    setDomainType('addon')
    setNewDomain('')
    setAdminEmail('')
    setDocRoot('')
    setSelectedPHP('PHP 8.2')
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative bg-zinc-50/95 border border-zinc-200 rounded-lg w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-200 bg-white/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 border border-red-200 text-red-600 rounded flex items-center justify-center ">
              <Globe className="w-5 h-5 " />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 block dark:text-zinc-100">
                Detalhes do domínio
              </h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Criar novo domínio no servidor
              </span>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 transition-colors text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-8 space-y-6 relative">
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
                <span className="text-sm text-zinc-600 font-medium dark:text-zinc-300">
                  A criar domínio…
                </span>
                <span className="text-xs text-zinc-400">Isso pode levar alguns segundos</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 text-sm text-red-700 break-words">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Erro ao criar domínio</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Domain Type */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 dark:text-zinc-400">
              Tipo de domínio
            </label>
            <select
              value={domainType}
              onChange={e => setDomainType(e.target.value as 'addon' | 'subdomain' | 'parked')}
              className={cn(panelField, 'w-full dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100')}
            >
              <option value="addon">Domínio adicional</option>
              <option value="subdomain">Subdomínio</option>
              <option value="parked">Domínio estacionado</option>
            </select>
          </div>

          {/* Domain Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 dark:text-zinc-400">
              Nome do domínio
            </label>
            <input
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              placeholder="subdominio.exemplo.com ou novodominio.com"
              className={cn(panelField, 'w-full dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100')}
            />
          </div>

          {/* Admin Email */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 dark:text-zinc-400">
              Email do administrador
            </label>
            <input
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              placeholder="admin@exemplo.com"
              className={cn(panelField, 'w-full dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100')}
            />
          </div>

          {/* Document Root Path */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 dark:text-zinc-400">
              Caminho da raiz do documento
            </label>
            <div className="flex items-center overflow-hidden rounded border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <span className="whitespace-nowrap border-r border-zinc-300 bg-zinc-100 px-4 py-3 font-mono text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                /home/{newDomain || 'dominio'}/
              </span>
              <input
                value={docRoot}
                onChange={e => setDocRoot(e.target.value)}
                placeholder="public_html/subdominio"
                className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Select PHP Version */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 dark:text-zinc-400">
              Versão PHP
            </label>
            <select
              value={selectedPHP}
              onChange={e => setSelectedPHP(e.target.value)}
              className={cn(panelField, 'w-full dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100')}
            >
              <option>PHP 7.4</option>
              <option>PHP 8.0</option>
              <option>PHP 8.1</option>
              <option>PHP 8.2</option>
              <option>PHP 8.3</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-white/80 px-8 py-6 dark:border-zinc-800 dark:bg-zinc-900/80">
          <button type="button" onClick={handleClose} disabled={loading} className={panelBtnSecondary}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !newDomain || !adminEmail}
            className={panelBtnPrimary}
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar domínio
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// DEPLOY SECTION
// ============================================================
export function DeploySection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [deploying, setDeploying] = useState(false)
  const [log, setLog] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [gitLog, setGitLog] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('example.com')

  const loadGitLog = async () => {
    const res = await fetch('/api/git-deploy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getGitLog', params: { domain: selectedDomain } })
    })
    const data = await res.json()
    setGitLog(data.data?.output || '')
  }

  useEffect(() => { loadGitLog() }, [selectedDomain])

  const handleDeploy = async () => {
    if (!confirm(`Fazer deploy de "${selectedDomain}"?\n\nIsto vai actualizar o site online com o código mais recente do GitHub.`)) return
    setDeploying(true)
    setStatus('idle')
    setLog('A iniciar deploy...\n')

    const res = await fetch('/api/git-deploy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deploySite', params: { domain: selectedDomain } })
    })
    const data = await res.json()
    const output = data.data?.output || ''
    setLog(output)
    setStatus(data.data?.success ? 'success' : 'error')
    if (data.data?.success) await loadGitLog()
    setDeploying(false)
  }

  const activeSites = Array.isArray(sites) ? sites.filter(s =>
    s.isActive && !s.domain.includes('contaboserver')
  ) : []

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Deploy / GitHub</h1>
        <p className="text-xs text-gray-400 mt-0.5">Actualizar site online com o código mais recente do GitHub</p>
      </div>

      {/* Selector + Botão Deploy */}
      <div className="flex items-center gap-3">
        <select value={selectedDomain}
          onChange={e => setSelectedDomain(e.target.value)}
          className="flex-1 px-3 py-2.5 border border-gray-300 rounded text-sm">
          {activeSites.map(s => (
            <option key={s.domain} value={s.domain}>{s.domain}</option>
          ))}
        </select>
        <button onClick={handleDeploy} disabled={deploying}
          className="bg-indigo-50 border border-indigo-300 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700  px-6 py-2.5 rounded text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors">
          {deploying
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> A fazer deploy...</>
            : <><Upload className="w-4 h-4" /> Deploy</>
          }
        </button>
      </div>

      {/* Status */}
      {status !== 'idle' && (
        <div className={`px-4 py-2.5 rounded text-sm font-medium border ${status === 'success'
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-red-50 text-red-700 border-red-200'
          }`}>
          {status === 'success' ? '✅ Deploy concluído com sucesso!' : '❌ Erro no deploy — ver log abaixo'}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Git Log */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700">Últimos Commits</h2>
            <button onClick={loadGitLog}
              className="text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {gitLog ? (
              <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">{gitLog}</pre>
            ) : (
              <p className="text-xs text-gray-400">Nenhum commit encontrado</p>
            )}
          </div>
        </div>

        {/* Deploy Log */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Log do Deploy</h2>
          </div>
          <div className="p-4 min-h-32">
            {log ? (
              <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">{log}</pre>
            ) : (
              <p className="text-xs text-gray-400">Clica em Deploy para iniciar</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// EMAIL IMPORT SECTION
// ============================================================
export function EmailImportSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [gmailUser, setGmailUser] = useState('')
  const [gmailAppPassword, setGmailAppPassword] = useState('')
  const [destinationEmail, setDestinationEmail] = useState('')
  const [destinationPassword, setDestinationPassword] = useState('')
  const [importing, setImporting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [progress, setProgress] = useState({ total: 0, copied: 0, currentFolder: '', errors: [] })
  const [showInstructions, setShowInstructions] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Extrair emails dos sites para dropdown
  const availableEmails = sites
    .filter(site => site.domain === 'example.com')
    .flatMap(site => {
      // Simular emails existentes - em produção viria da API
      return [
        'info@example.com',
        'suport@example.com',
        'admin@example.com',
        'contato@example.com'
      ]
    })

  const handleImport = async () => {
    if (!gmailUser || !gmailAppPassword || !destinationEmail || !destinationPassword) {
      alert('Por favor, preencha todos os campos.')
      return
    }

    setImporting(true)
    setProgress({ total: 0, copied: 0, currentFolder: '', errors: [] })

    try {
      const response = await fetch('/api/email-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmailUser,
          gmailAppPassword,
          destinationEmail,
          destinationPassword
        })
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)
        setProgress({
          total: data.total,
          copied: data.copied,
          currentFolder: data.currentFolder,
          errors: data.errors || []
        })
      } else {
        alert(`Erro: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Erro de conexão: ${error?.message || error}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">

        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {showInstructions ? 'Ocultar' : 'Mostrar'} Instruções
        </button>
      </div>

      {showInstructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-4">Como gerar App Password do Gmail</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Acesse <a href="https://myaccount.google.com/apppasswords" target="_blank" className="underline">myaccount.google.com/apppasswords</a></li>
            <li>Faça login com sua conta Google</li>
            <li>Clique em "Select app" → "Other" e digite "Digital Services Import"</li>
            <li>Clique em "Generate" para criar a senha</li>
            <li>Copie a senha de 16 caracteres gerada</li>
            <li>Use essa senha no campo "App Password do Gmail"</li>
          </ol>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Gmail */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-2">Origem (Gmail)</h3>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Email Gmail</label>
              <input
                type="email"
                value={gmailUser}
                onChange={(e) => setGmailUser(e.target.value)}
                placeholder="seuemail@gmail.com"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">App Password Gmail</label>
              <div className="relative">
                <input
                  type={showInstructions ? 'text' : 'password'}
                  value={gmailAppPassword}
                  onChange={(e) => setGmailAppPassword(e.target.value)}
                  placeholder="Senha de 16 caracteres"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Coluna Direita - Destino */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-2">Destino (Digital Services)</h3>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Email Destino</label>
              <select
                value={destinationEmail}
                onChange={(e) => setDestinationEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              >
                <option value="">Selecione um email...</option>
                {availableEmails.map(email => (
                  <option key={email} value={email}>{email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Password Destino</label>
              <input
                type="password"
                value={destinationPassword}
                onChange={(e) => setDestinationPassword(e.target.value)}
                placeholder="Password do email Digital Services"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={handleImport}
            disabled={importing || !gmailUser || !gmailAppPassword || !destinationEmail || !destinationPassword}
            className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 disabled:bg-gray-300  px-8 py-3 rounded font-bold transition-all flex items-center gap-2"
          >
            {importing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Iniciar Importação
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progresso e Resultados */}
      {importing && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-4">Progresso da Importação</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Pasta atual:</span>
              <span className="font-medium">{progress.currentFolder || 'Preparando...'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Mensagens copiadas:</span>
              <span className="font-medium">{progress.copied} / {progress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-50 border border-red-300 text-red-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.copied / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {result && !importing && (
        <div className={`border rounded-lg p-6 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
          <h3 className={`font-bold mb-4 ${result.success ? 'text-green-900' : 'text-red-900'
            }`}>
            {result.success ? '✅ Importação Concluída!' : '❌ Erro na Importação'}
          </h3>
          <div className="space-y-2 text-sm">
            <p><strong>Total de mensagens:</strong> {result.total}</p>
            <p><strong>Mensagens copiadas:</strong> {result.copied}</p>
            <p><strong>Taxa de sucesso:</strong> {result.total > 0 ? Math.round((result.copied / result.total) * 100) : 0}%</p>
            {result.message && <p className="text-gray-700">{result.message}</p>}

            {result.errors && result.errors.length > 0 && (
              <div className="mt-4 p-3 bg-white border border-red-100 rounded shadow-inner">
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="flex items-center gap-2 font-bold text-red-700 mb-2 hover:underline w-full text-left"
                >
                  {showErrors ? '▼' : '▶'} Erros encontrados ({result.errors.length}):
                </button>
                {showErrors && (
                  <ul className="list-disc list-inside space-y-1 text-xs text-red-600 max-h-40 overflow-y-auto mt-2 custom-scrollbar">
                    {result.errors.map((error: any, index: number) => (
                      <li key={index} className="border-b border-red-50 last:border-0 py-1">{error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// SMTP / BREVO CONFIG SECTION
// ============================================================
type BrevoEmailStatus = {
  configured?: boolean
  brevoTransactional?: boolean
  brevoApi?: boolean
  brevoSmtp?: boolean
  message?: string
  config?: {
    host?: string
    port?: number
    user?: string | null
    fromAutomatic?: { email?: string; name?: string }
    fromMarketing?: string
    notifyEmail?: string
    supportEmail?: string
    serverEmail?: string
  }
  receive?: {
    mx?: Array<{ priority: number; host: string }>
    spf?: string
    webhookUrl?: string
    mailboxes?: string
  }
  marketing?: {
    from?: string
    route?: string
  }
}

export function SMTPConfigSection() {
  const [status, setStatus] = useState<BrevoEmailStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [domain, setDomain] = useState('oshercollective.com')
  const [applyLoading, setApplyLoading] = useState<'one' | 'all' | null>(null)
  const [applyResult, setApplyResult] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)

  const loadStatus = async () => {
    setStatusLoading(true)
    try {
      const response = await fetch('/api/check-smtp-config')
      const data = await response.json()
      setStatus(data)
    } catch {
      setStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const applyBrevoMx = async (all = false) => {
    setApplyLoading(all ? 'all' : 'one')
    setApplyError(null)
    setApplyResult(null)
    try {
      const response = await fetch('/api/email-dns-brevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(all ? { all: true } : { domain: domain.trim() }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setApplyError(data.error || data.output || 'Falha ao aplicar DNS Brevo')
      } else {
        setApplyResult(data.output || `MX Brevo aplicado${all ? ' em todos os domínios' : ` em ${domain}`}`)
      }
    } catch (err: unknown) {
      setApplyError(err instanceof Error ? err.message : 'Erro de rede')
    } finally {
      setApplyLoading(null)
    }
  }

  const sendOk = Boolean(status?.brevoTransactional)
  const receiveMx = status?.receive?.mx || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <Mail className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Envio e Recepção</h1>
            <p className="text-xs text-gray-600 dark:text-zinc-400">
              Envio transaccional · Caixas no servidor · Recepção via MX e webhook
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadStatus}
          disabled={statusLoading}
          className={`${panelBtnSecondary} text-xs`}
        >
          <RefreshCw className={cn('h-4 w-4', statusLoading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {statusLoading && !status ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          A carregar estado...
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-3 flex items-center gap-2">
                {sendOk ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
                <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Envio</h2>
              </div>
              <p className="mb-4 text-sm text-gray-600 dark:text-zinc-400">{status?.message}</p>
              <dl className="space-y-2 text-sm text-gray-700 dark:text-zinc-300">
                <div><dt className="inline font-medium">Relay SMTP: </dt><dd className="inline">{status?.config?.host}:{status?.config?.port}</dd></div>
                <div><dt className="inline font-medium">API de envio: </dt><dd className="inline">{status?.brevoApi ? 'activa' : 'em falta'}</dd></div>
                <div><dt className="inline font-medium">Transacções: </dt><dd className="inline">{status?.config?.fromAutomatic?.email || '—'}</dd></div>
                <div><dt className="inline font-medium">Mailmarketing: </dt><dd className="inline">{status?.marketing?.from || status?.config?.fromMarketing || '—'}</dd></div>
              </dl>
              <p className="mt-4 text-xs text-gray-500 dark:text-zinc-500">
                Campanhas: secção <strong>Mailmarketing</strong> no menu lateral.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Recepção</h2>
              </div>
              <p className="mb-4 text-sm text-gray-600 dark:text-zinc-400">
                E-mail externo chega via MX do serviço de envio → webhook injecta na caixa no servidor ({status?.receive?.mailboxes}).
              </p>
              <dl className="space-y-2 text-sm text-gray-700 dark:text-zinc-300">
                {receiveMx.map((mx) => (
                  <div key={mx.host}>
                    <dt className="inline font-medium">MX {mx.priority}: </dt>
                    <dd className="inline font-mono text-xs">{mx.host}</dd>
                  </div>
                ))}
                <div><dt className="inline font-medium">SPF: </dt><dd className="inline break-all font-mono text-xs">{status?.receive?.spf}</dd></div>
                <div><dt className="inline font-medium">Webhook: </dt><dd className="inline break-all font-mono text-xs">{status?.receive?.webhookUrl}</dd></div>
              </dl>
              <p className="mt-4 text-xs text-gray-500 dark:text-zinc-500">
                Leitura: secção <strong>Webmail</strong> ou cliente IMAP.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-zinc-100">Aplicar DNS de recepção (MX)</h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-zinc-400">
              Actualiza as zonas DNS no servidor ({getServerHost()}) para receber e-mail externo.
            </p>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="dominio.com"
                className={`${panelField} flex-1`}
              />
              <button
                type="button"
                onClick={() => applyBrevoMx(false)}
                disabled={applyLoading !== null || !domain.trim()}
                className={panelBtnPrimary}
              >
                {applyLoading === 'one' ? 'A aplicar...' : 'Aplicar neste domínio'}
              </button>
              <button
                type="button"
                onClick={() => applyBrevoMx(true)}
                disabled={applyLoading !== null}
                className={panelBtnSecondary}
              >
                {applyLoading === 'all' ? 'A aplicar...' : 'Aplicar em todos'}
              </button>
            </div>

            {applyResult && (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-green-200 bg-green-50 p-3 font-mono text-xs text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
                {applyResult}
              </pre>
            )}
            {applyError && (
              <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{applyError}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// WATCHDOG SECTION - Email Services Monitor
// ============================================================
export function WatchdogSection() {
  const [status, setStatus] = useState({
    opendkim: 'unknown',
    postfix: 'unknown',
    watchdogInstalled: false,
    loading: true
  });
  const [logs, setLogs] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const checkStatus = async () => {
    setStatus(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/watchdog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkStatus' })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({
          ...data.services,
          loading: false
        });
      }
    } catch (err) {
      setStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const installWatchdog = async () => {
    setActionLoading('install');
    try {
      const res = await fetch('/api/watchdog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'installWatchdog' })
      });
      const data = await res.json();
      setMessage(data.message || (data.success ? 'Watchdog instalado!' : 'Erro ao instalar'));
      checkStatus();
    } catch (err: any) {
      setMessage('Erro: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const restartServices = async () => {
    setActionLoading('restart');
    try {
      const res = await fetch('/api/watchdog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restartServices' })
      });
      const data = await res.json();
      setMessage(data.success ? 'Serviços reiniciados!' : 'Erro ao reiniciar');
      checkStatus();
    } catch (err: any) {
      setMessage('Erro: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getLogs = async () => {
    setActionLoading('logs');
    try {
      const res = await fetch('/api/watchdog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getLogs' })
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setShowLogs(true);
      }
    } catch (err: any) {
      setMessage('Erro ao obter logs: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const removeWatchdog = async () => {
    if (!confirm('Tem certeza que deseja remover o watchdog?')) return;
    setActionLoading('remove');
    try {
      const res = await fetch('/api/watchdog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeWatchdog' })
      });
      const data = await res.json();
      setMessage(data.message || 'Watchdog removido');
      checkStatus();
    } catch (err: any) {
      setMessage('Erro: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const getStatusColor = (s: string) => {
    if (s === 'active') return 'bg-green-100 text-green-700 border-green-200';
    if (s === 'inactive' || s === 'unknown') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-600" />
          Monitor de Serviços de Email
        </h2>
        <button
          onClick={checkStatus}
          disabled={status.loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${status.loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* OpenDKIM */}
        <div className={`p-4 rounded-lg border ${getStatusColor(status.opendkim)}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${status.opendkim === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <h3 className="font-semibold">OpenDKIM</h3>
          </div>
          <p className="text-sm opacity-90">
            {status.opendkim === 'active' ? '✅ Em execução' :
              status.opendkim === 'inactive' ? '❌ Parado' : '⏳ Verificando...'}
          </p>
          <p className="text-xs mt-2 opacity-75">Assinatura DKIM para emails</p>
        </div>

        {/* Postfix */}
        <div className={`p-4 rounded-lg border ${getStatusColor(status.postfix)}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${status.postfix === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <h3 className="font-semibold">Postfix</h3>
          </div>
          <p className="text-sm opacity-90">
            {status.postfix === 'active' ? '✅ Em execução' :
              status.postfix === 'inactive' ? '❌ Parado' : '⏳ Verificando...'}
          </p>
          <p className="text-xs mt-2 opacity-75">Servidor SMTP</p>
        </div>

        {/* Watchdog */}
        <div className={`p-4 rounded-lg border ${status.watchdogInstalled ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
          <div className="flex items-center gap-3 mb-2">
            <Clock className={`w-5 h-5 ${status.watchdogInstalled ? 'text-blue-600' : 'text-gray-400'}`} />
            <h3 className="font-semibold">Watchdog</h3>
          </div>
          <p className="text-sm opacity-90">
            {status.watchdogInstalled ? '✅ Instalado (a cada 2 min)' : '❌ Não instalado'}
          </p>
          <p className="text-xs mt-2 opacity-75">Auto-reinício de serviços</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded ${message.includes('Erro') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {message}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={restartServices}
          disabled={actionLoading === 'restart'}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 disabled:bg-red-400  rounded font-medium transition-colors"
        >
          {actionLoading === 'restart' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Reiniciar Serviços
        </button>

        {!status.watchdogInstalled ? (
          <button
            onClick={installWatchdog}
            disabled={actionLoading === 'install'}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 hover:text-blue-700 disabled:bg-blue-400  rounded font-medium transition-colors"
          >
            {actionLoading === 'install' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            Instalar Watchdog
          </button>
        ) : (
          <button
            onClick={removeWatchdog}
            disabled={actionLoading === 'remove'}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400  rounded font-medium transition-colors"
          >
            {actionLoading === 'remove' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            Remover Watchdog
          </button>
        )}

        <button
          onClick={getLogs}
          disabled={actionLoading === 'logs'}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors"
        >
          {actionLoading === 'logs' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          Ver Logs
        </button>
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="bg-gray-900 rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className=" font-medium">Logs do Watchdog</h4>
            <button
              onClick={() => setShowLogs(false)}
              className="text-gray-400 hover:"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <pre className="text-green-400 text-xs font-mono overflow-auto max-h-80 whitespace-pre-wrap">
            {logs || 'Sem logs disponíveis'}
          </pre>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h4 className="font-semibold text-blue-800 mb-2">ℹ️ Sobre o Watchdog</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Verifica a cada <strong>2 minutos</strong> se OpenDKIM e Postfix estão rodando</li>
          <li>Reinicia automaticamente qualquer serviço que estiver parado</li>
          <li>Registra todas as ações em <code>/var/log/watchdog.log</code></li>
          <li>Essencial para garantir entrega de emails 24/7</li>
        </ul>
      </div>
    </div>
  );
}

// --- Audit and Sync Section ---
export function AuditSyncSection({ onRefresh }: { onRefresh: () => void }) {
  const [syncing, setSyncing] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [counts, setCounts] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setLogs(['A iniciar sincronização...'])
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fullSync' })
      })
      const data = await res.json()
      if (data.success) {
        setLogs(data.data.logs)
        setCounts(data.data.counts)
        onRefresh()
      } else {
        setError(data.error || 'Erro na sincronização')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
        >
          {syncing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
          {syncing ? 'A Sincronizar...' : 'Executar Auditoria Completa'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3">
            <Globe className="w-6 h-6" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{counts?.sites ?? '--'}</div>
          <div className="text-sm text-gray-500">Websites</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 mb-3">
            <Users className="w-6 h-6" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{counts?.users ?? '--'}</div>
          <div className="text-sm text-gray-500">Utilizadores</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-3">
            <Package className="w-6 h-6" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{counts?.packages ?? '--'}</div>
          <div className="text-sm text-gray-500">Pacotes</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-3">
            <Zap className="w-6 h-6" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{counts?.activated ?? '--'}</div>
          <div className="text-sm text-gray-500">Reactivados</div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
        <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <span className="text-xs font-mono text-gray-400 ml-2">audit_terminal.log</span>
          </div>
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Live Auditor</div>
        </div>
        <div className="p-6 font-mono text-sm space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 text-left">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-gray-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
              <span className={log.includes('ERRO') ? 'text-red-400' : log.includes('⚠️') ? 'text-amber-400' : 'text-green-400'}>
                {log}
              </span>
            </div>
          ))}
          {syncing && (
            <div className="flex items-center gap-2 text-blue-400 animate-pulse">
              <span>&gt;</span>
              <span>A processar comandos no servidor...</span>
            </div>
          )}
          {!syncing && logs.length === 0 && (
            <div className="text-gray-500 italic">Aguardando início da auditoria...</div>
          )}
        </div>
      </div>
    </div>
  )
}
