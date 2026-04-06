'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { cyberPanelAPI } from '@/lib/cyberpanel-api'
import type {
  CyberPanelWebsite, CyberPanelSubdomain, CyberPanelUser, CyberPanelDatabase,
  CyberPanelFTPAccount, CyberPanelEmail, CyberPanelPHPConfig, CyberPanelPackage
} from '@/lib/cyberpanel-api'
import { syncUserToSupabase, removeUserFromSupabase, getUsersFromSupabase, syncWebsiteToSupabase, removeWebsiteFromSupabase, markWPInstalledInSupabase, syncPackageToSupabase, removePackageFromSupabase } from '@/lib/supabase-sync'
import { supabase } from '@/lib/supabase'
import { cpGetUsers, cpSaveUser, cpRemoveUser, cpSaveSubdomain, cpRemoveSubdomain, cpGetSubdomains, cpSaveDatabase, cpRemoveDatabase, cpGetDatabases, cpSaveFTP, cpRemoveFTP, cpGetFTP, cpSaveEmail, cpRemoveEmail, cpGetEmails } from '@/lib/cp-local-store'
import { EmailWebmailSection } from '@/components/dashboard/EmailWebmailSection'
import {
  RefreshCw, Globe, PlusCircle, Plus, Package, Trash2, Database, Users, Mail, Lock, LockOpen, Shield,
  Server, HardDrive, Key, Settings, Code, AlertCircle, CheckCircle, Eye, EyeOff,
  ExternalLink, Copy, FolderOpen, Layers, Play, Pause, Edit, Edit2, Cloud, RotateCcw,
  Upload, Download, Power, Plug, FileText, ArrowRight, Rocket, Archive, Check, X
} from 'lucide-react'

// ============================================================
// SHARED UTILITIES & SKELETONS
// ============================================================
const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-gray-200 rounded-md", className)} />
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

const BulkActionBar = ({ count, onAction, onClear, label = "itens selecionados" }: { count: number, onAction: (action: string) => void, onClear: () => void, label?: string }) => {
  if (count === 0) return null
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-white/10 ring-1 ring-black">
        <div className="flex items-center gap-3 pr-6 border-r border-white/10">
          <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-bold">{count}</div>
          <span className="text-sm font-medium">{count} {label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onAction('delete')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-xs font-bold">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
          <button onClick={() => onAction('suspend')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors text-xs font-bold">
            <Pause className="w-3.5 h-3.5" /> Suspender
          </button>
          <button onClick={onClear} className="ml-2 text-xs text-gray-500 hover:text-white transition-colors">Cancelar</button>
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
      <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onCancel} />
      <div className="relative bg-white border border-gray-200 rounded-md w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-300">
        <div className="px-8 py-10 text-center space-y-4">
          <div className={cn(
            "w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-300",
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
            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { onConfirm(); onCancel(); }} 
            className={cn(
              "px-4 py-2 text-xs font-bold text-white rounded transition-all active:scale-95",
              isDanger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
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
export function SubdomainsSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [subdomains, setSubdomains] = useState<CyberPanelSubdomain[]>([])
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
      const data = await cyberPanelAPI.listSubdomains(domain)
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
    const ok = await cyberPanelAPI.createSubdomain(selectedDomain, newSub.trim())
    cpSaveSubdomain(selectedDomain, newSub.trim())
    void (async () => { try { await supabase.from('cyberpanel_subdomains').upsert({ domain: selectedDomain, subdomain: `${newSub.trim()}.${selectedDomain}` }, { onConflict: 'domain,subdomain' }) } catch { } })()
    setMsg(ok ? 'Subdomínio criado com sucesso!' : 'Guardado localmente. Verifica no CyberPanel.')
    setNewSub('')
    loadSubs(selectedDomain)
    setCreating(false)
  }

  const handleDelete = async (sub: string) => {
    if (!confirm(`Eliminar subdomínio ${sub}?`)) return
    await cyberPanelAPI.deleteSubdomain(selectedDomain, sub)
    cpRemoveSubdomain(sub)
    void (async () => { try { await supabase.from('cyberpanel_subdomains').delete().eq('subdomain', sub) } catch { } })()
    loadSubs(selectedDomain)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subdomínios</h1>
          <p className="text-gray-500 mt-1">Crie e gira subdomínios para os seus websites.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadSubs(e.target.value) }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
              <option value="">Seleccione um domínio...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Novo Subdomínio</label>
            <div className="flex gap-2">
              <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="blog"
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              <button onClick={handleCreate} disabled={creating || !selectedDomain || !newSub.trim()}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                Criar
              </button>
            </div>
          </div>
        </div>

        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

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

export function WebsitePreviewSection({ sites }: { sites: CyberPanelWebsite[] }) {
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Website Preview</h1>
          <p className="text-gray-500 mt-1">Visualize screenshots dos seus websites.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
          <RefreshCw size={14} />
          Último check: {lastUpdate ? lastUpdate.toLocaleTimeString('pt-PT') : 'N/A'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Website
            </label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-gray-50 transition-all"
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
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 transition-all text-sm font-bold shadow-sm"
            >
              <RefreshCw size={16} className={screenshotLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>

          {selectedDomain && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Ações Rápidas
              </label>
              <a
                href={`https://${selectedDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100"
              >
                <span>Visitar Site</span>
                <ExternalLink size={14} className="text-gray-400" />
              </a>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">
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
                  className="px-6 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-bold text-sm shadow-sm"
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
                    className="w-full rounded-lg border border-gray-300 shadow-xl bg-white"
                    onError={() => setScreenshotError('Não foi possível processar a imagem do servidor thum.io')}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none rounded-lg" />
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

export function DNSZoneEditorSection({ sites, initialDomain }: { sites: CyberPanelWebsite[]; initialDomain?: string }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [records, setRecords] = useState<DNSRecordRow[]>([])
  const [loading, setLoading] = useState(false)
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

  const typeColors: Record<string, string> = {
    A: 'bg-blue-100 text-blue-800',
    CNAME: 'bg-green-100 text-green-800',
    MX: 'bg-orange-100 text-orange-800',
    TXT: 'bg-purple-100 text-purple-800',
    SRV: 'bg-pink-100 text-pink-800',
    NS: 'bg-gray-100 text-gray-800',
  }

  const fetchRecords = async (domain: string) => {
    setLoading(true)
    setRecords([])
    setMsg('')
    setEditingRecordId(null)
    setEditForm(null)
    setSelectedIds([])
    try {
      const res = await fetch(`/api/cyberpanel-dns?domain=${encodeURIComponent(domain)}`)
      const data = await res.json()
      if (data.success) {
        const list = Array.isArray(data.records) ? data.records : []
        setRecords(
          list.map((r: any) => ({
            id: String(r.id),
            name: String(r.name || ''),
            type: String(r.type || '').toUpperCase(),
            content: String(r.content || ''),
            ttl: Number(r.ttl) || 0,
          })),
        )
        setPage(1)
      } else {
        setMsg('Erro ao carregar registos: ' + (data.error || data.message || ''))
      }
    } catch (e: any) {
      setMsg('Erro de ligação: ' + (e?.message || 'desconhecido'))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (sites.length > 0 && !selectedDomain && !initialDomain) {
      setSelectedDomain(sites[0].domain)
    }
  }, [sites, selectedDomain, initialDomain])

  useEffect(() => {
    if (initialDomain && !selectedDomain) {
      setSelectedDomain(initialDomain)
      fetchRecords(initialDomain)
    }
  }, [initialDomain, selectedDomain])

  useEffect(() => {
    if (selectedDomain) {
      void fetchRecords(selectedDomain)
    }
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

      const res = await fetch('/api/cyberpanel-dns', {
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
      const res = await fetch('/api/cyberpanel-dns', {
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
          fetch('/api/cyberpanel-dns', {
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
      await fetch('/api/cyberpanel-dns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainName: selectedDomain, id: editingRecordId }),
      })

      const ttlNumber = parseInt(editForm.ttl || '14400', 10) || 14400
      const value =
        editForm.type === 'MX' && editForm.priority
          ? `${editForm.priority} ${editForm.value}`
          : editForm.value

      const res = await fetch('/api/cyberpanel-dns', {
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
      {/* LINHA 1: Título + selector de domínio */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">DNS Zone Editor</h1>
          {selectedDomain ? (
            <p className="text-gray-500 mt-1">
              Zone records for <span className="font-semibold">&quot;{selectedDomain}&quot;</span>
            </p>
          ) : (
            <p className="text-gray-500 mt-1">Selecione um domínio para gerir os registos DNS.</p>
          )}
        </div>
        <div className="w-full md:w-72">
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domínio</label>
          <select
            value={selectedDomain}
            onChange={e => handleDomainChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
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

      {/* LINHA 2: Nameservers do domínio como tags cinzentas */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="uppercase font-semibold text-gray-500 mr-1">Nameservers:</span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-mono">
          ns1.contabo.net
        </span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-mono">
          ns2.contabo.net
        </span>
      </div>

      {/* LINHA 3: Filtros por tipo + pesquisa + paginação */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => handleFilterChange(f)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border ${filter === f ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Filter by name"
              className="w-full sm:w-64 px-3 py-2.5 border border-gray-300 rounded-lg text-sm pl-3"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
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

      {/* LINHA 4: Botões de acção */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              disabled={selectedIds.length === 0 || loading}
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 disabled:opacity-50"
            >
              Acções
              <span className="text-gray-400 text-[10px]">▼</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={loading || !selectedDomain}
            className="inline-flex items-center px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50"
          >
            Save All Records
          </button>
        </div>
        <div className="flex md:justify-end">
          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            disabled={!selectedDomain}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50"
          >
            + Add Record
          </button>
        </div>
      </div>

      {/* FORMULÁRIO ADICIONAR — aparece quando showAddForm=true */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nome</label>
              <input
                type="text"
                value={newRecord.name}
                onChange={e => setNewRecord({ ...newRecord, name: e.target.value })}
                placeholder={`sub.${selectedDomain || 'example.com'}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">TTL</label>
              <input
                type="number"
                value={newRecord.ttl}
                onChange={e => setNewRecord({ ...newRecord, ttl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
              className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading || !selectedDomain}
              onClick={handleCreateRecord}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* TABELA DE REGISTOS */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : !selectedDomain ? (
          <div className="py-12 text-center text-gray-400 text-sm">Selecione um domínio para ver os registos.</div>
        ) : pageRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Nenhum registo encontrado para este filtro.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-500 uppercase border-b bg-gray-50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={e => handleToggleSelectAllVisible(e.target.checked, pageRecords)}
                  />
                </th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3 w-24">TTL</th>
                <th className="px-4 py-3 w-24">Tipo</th>
                <th className="px-4 py-3">Registo</th>
                <th className="px-4 py-3 w-40">Acções</th>
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
                    <tr className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(record.id)}
                          onChange={e => handleToggleSelectOne(record.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-gray-900 break-all">{record.name}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-600">{record.ttl || 0}</td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${typeColors[record.type] || 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {record.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700 break-all">{displayContent}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditRecord(record)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(record)}
                            className="text-red-600 hover:text-red-800 text-xs font-bold"
                          >
                            Remover
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
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">TTL</label>
                                <input
                                  type="number"
                                  value={editForm.ttl}
                                  onChange={e => setEditForm({ ...(editForm || newRecord), ttl: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEditRecord}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={handleSaveEditRecord}
                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50"
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
        )}
      </div>

      {msg && (
        <div
          className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.toLowerCase().includes('erro')
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
export function DatabasesSection({ sites, initialDomain }: { sites: CyberPanelWebsite[]; initialDomain?: string }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [databases, setDatabases] = useState<CyberPanelDatabase[]>([])
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
      const data = await cyberPanelAPI.listDatabases(domain)
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
    const ok = await cyberPanelAPI.createDatabase({ domain: selectedDomain, dbName, dbUser, dbPassword: dbPass })
    cpSaveDatabase(selectedDomain, dbName, dbUser)
    void (async () => { try { await supabase.from('cyberpanel_databases').upsert({ domain: selectedDomain, db_name: dbName, db_user: dbUser }, { onConflict: 'domain,db_name' }) } catch { } })()
    const createdPass = dbPass
    setLastCreated({ dbName, dbUser, dbPass: createdPass })
    setMsg(ok ? 'Base de dados criada!' : 'Guardada localmente. Verifica no CyberPanel.')
    setDbName(''); setDbUser(''); setDbPass('')
    loadDBs(selectedDomain)
    setCreating(false)
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Eliminar base de dados ${name}?`)) return
    await cyberPanelAPI.deleteDatabase({ dbName: name })
    cpRemoveDatabase(selectedDomain, name)
    void (async () => { try { await supabase.from('cyberpanel_databases').delete().eq('domain', selectedDomain).eq('db_name', name) } catch { } })()
    loadDBs(selectedDomain)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Bases de Dados</h1><p className="text-gray-500 mt-1">Crie e gira bases de dados MySQL para os seus websites.</p></div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadDBs(e.target.value) }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
              <option value="">Seleccione...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nome da BD</label>
            <input value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="minha_bd" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Utilizador BD</label>
            <input value={dbUser} onChange={(e) => setDbUser(e.target.value)} placeholder="db_user" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Senha BD</label>
            <input type="password" value={dbPass} onChange={(e) => setDbPass(e.target.value)} placeholder="••••••" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
        </div>
        <button onClick={handleCreate} disabled={creating || !selectedDomain || !dbName || !dbUser || !dbPass}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} Criar Base de Dados
        </button>

        {msg && <div className={`mt-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('criada') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

        {lastCreated && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <p className="font-bold text-blue-800 mb-2">Credenciais da Base de Dados Criada:</p>
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div><span className="text-blue-600 font-bold">BD:</span> {lastCreated.dbName}</div>
              <div><span className="text-blue-600 font-bold">User:</span> {lastCreated.dbUser}</div>
              <div><span className="text-blue-600 font-bold">Pass:</span> {lastCreated.dbPass}</div>
            </div>
            <div className="mt-2 flex gap-2">
              <a href="https://109.199.104.22:8090/dataBases/phpMyAdmin" target="_blank" rel="noopener noreferrer" className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded font-bold">Abrir phpMyAdmin</a>
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
                    <a href="https://109.199.104.22:8090/dataBases/phpMyAdmin" target="_blank" rel="noopener noreferrer" className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded font-medium">phpMyAdmin</a>
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
export function FTPSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [accounts, setAccounts] = useState<CyberPanelFTPAccount[]>([])
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
      const data = await cyberPanelAPI.listFTPAccounts(domain)
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
    const ok = await cyberPanelAPI.createFTPAccount({ domain: selectedDomain, username: ftpUser, password: ftpPass, path: ftpPath })
    cpSaveFTP(selectedDomain, ftpUser, ftpPath)
    void (async () => { try { await supabase.from('cyberpanel_ftp').upsert({ domain: selectedDomain, username: ftpUser, path: ftpPath }, { onConflict: 'domain,username' }) } catch { } })()
    setMsg(ok ? 'Conta FTP criada!' : 'Guardada localmente. Verifica no CyberPanel.')
    setFtpUser(''); setFtpPass(''); setFtpPath('/')
    loadFTP(selectedDomain)
    setCreating(false)
  }

  const handleDelete = async (user: string) => {
    if (!confirm(`Eliminar conta FTP ${user}?`)) return
    await cyberPanelAPI.deleteFTPAccount({ username: user })
    cpRemoveFTP(selectedDomain, user)
    void (async () => { try { await supabase.from('cyberpanel_ftp').delete().eq('domain', selectedDomain).eq('username', user) } catch { } })()
    loadFTP(selectedDomain)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Contas FTP</h1><p className="text-gray-500 mt-1">Gira contas FTP para transferência de ficheiros.</p></div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadFTP(e.target.value) }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
              <option value="">Seleccione...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Utilizador FTP</label>
            <input value={ftpUser} onChange={(e) => setFtpUser(e.target.value)} placeholder="ftp_user" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Senha</label>
            <input type="password" value={ftpPass} onChange={(e) => setFtpPass(e.target.value)} placeholder="••••••" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Caminho</label>
            <input value={ftpPath} onChange={(e) => setFtpPath(e.target.value)} placeholder="/" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
          </div>
        </div>
        <button onClick={handleCreate} disabled={creating || !selectedDomain || !ftpUser || !ftpPass}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />} Criar Conta FTP
        </button>

        {msg && <div className={`mt-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('criada') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

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
export function EmailManagementSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('visualdesigne.com')
  const [emails, setEmails] = useState<CyberPanelEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  
  // Modal Único para Criação/Edição de E-mail
  const [emailModal, setEmailModal] = useState<{ show: boolean, mode: 'create' | 'edit', data: any }>({
    show: false,
    mode: 'create',
    data: { user: '', password: '', confirmPassword: '', quota: '500', activo: true, cliente_id: '' }
  })
  const [showEmailPass, setShowEmailPass] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [confirm, setConfirm] = useState<{ show: boolean, title: string, message: string, onConfirm: () => void, isDanger?: boolean }>({ 
    show: false, title: '', message: '', onConfirm: () => {} 
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

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const loadEmails = async (domain: string) => {
    if (!domain) return
    const ls = cpGetEmails(domain)
    if (ls.length > 0) setEmails(ls.map((e: any) => ({ email: e.email || `${e.user}@${domain}`, user: e.user, domain, quota: e.quota || '500', usage: e.usage || '0', activo: true })))
    else setLoading(true)

    try {
      // 1. Carregar do CyberPanel
      let cpEmails: any[] = []
      const cpRes = await fetch(`/api/cyberpanel-email?domain=${encodeURIComponent(domain)}`)
      const cpData = await cpRes.json()
      
      if (cpData.success && cpData.emails) {
        cpEmails = cpData.emails
      } else {
        const fallback = await cyberPanelAPI.listEmails(domain).catch(() => [])
        cpEmails = fallback.length > 0 ? fallback : cpGetEmails(domain)
      }

      // 2. Carregar metadados do Supabase
      const { data: sbData } = await supabase.from('email_contas').select('*')

      // 3. Cruzar dados
      const merged = cpEmails.map((cpE: any) => {
        const emailStr = cpE.email || `${cpE.user}@${domain}`
        const sbE = sbData?.find((s: any) => s.email === emailStr)
        return {
          email: emailStr,
          user: cpE.user || emailStr.split('@')[0],
          domain: domain,
          quota: cpE.quota || (sbE?.quota) || '500',
          usage: cpE.usage || '0',
          activo: sbE ? sbE.activo : true,
          cliente_id: sbE ? sbE.cliente_id : null
        }
      })

      setEmails(merged)
      merged.forEach(e => cpSaveEmail(domain, e.user, { quota: e.quota }))
      
    } catch (err) {
      console.error('Erro na sincronização:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (selectedDomain) loadEmails(selectedDomain)
  }, [selectedDomain])

  const handleCreateEmail = async (data: any) => {
    if (data.password !== data.confirmPassword) {
      setMsg('As senhas não coincidem!'); setMsgType('error')
      return
    }
    if (!selectedDomain || !data.user || !data.password) {
      setMsg('Preencha os campos obrigatórios.'); setMsgType('error')
      return
    }
    setCreating(true); setMsg('')
    try {
      const res = await fetch('/api/cyberpanel-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainName: selectedDomain, userName: data.user, password: data.password, quota: parseInt(data.quota) })
      })
      const resData = await res.json()
      if (resData.success) {
        setMsg('E-mail criado com sucesso!'); setMsgType('success')
        cpSaveEmail(selectedDomain, data.user, { quota: data.quota })
        // Guardar metadados no Supabase
        await supabase.from('email_contas').upsert({
          email: `${data.user}@${selectedDomain}`,
          activo: data.activo,
          cliente_id: data.cliente_id || null,
          quota: data.quota
        }, { onConflict: 'email' })
        
        setEmailModal({ ...emailModal, show: false })
        loadEmails(selectedDomain)
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
      // 1. Password no CyberPanel
      if (data.password) {
        await cyberPanelAPI.changeEmailPassword({ email: data.email, password: data.password })
      }
      // 2. Metadados no Supabase
      const { error } = await supabase.from('email_contas').upsert({
        email: data.email, 
        activo: data.activo,
        cliente_id: data.cliente_id || null,
        quota: data.quota
      }, { onConflict: 'email' })

      if (error) throw error
      setMsg('Configurações guardadas.'); setMsgType('success')
      setEmailModal({ ...emailModal, show: false })
      loadEmails(selectedDomain)
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
          const res = await fetch('/api/cyberpanel-email', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          })
          const data = await res.json()
          if (data.success) {
            await supabase.from('email_contas').delete().eq('email', email)
            await supabase.from('cyberpanel_emails').delete().eq('email_user', email.split('@')[0])
            setMsg('Conta eliminada com sucesso.')
            setMsgType('success')
            loadEmails(selectedDomain)
          } else {
            setMsg('Erro: ' + (data.details || 'Falha no servidor.'))
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
              const res = await fetch('/api/cyberpanel-email', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
              })
              const data = await res.json()
              if (data.success) {
                await supabase.from('email_contas').delete().eq('email', email)
                await supabase.from('cyberpanel_emails').delete().eq('email_user', email.split('@')[0])
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
            await fetch('/api/cyberpanel-email', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, action: 'suspend' })
            })
            await supabase.from('email_contas').upsert({ email, activo: false }, { onConflict: 'email' })
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
      // 1. Alertar CyberPanel se houver nova password
      if (formData.password) {
        await cyberPanelAPI.changeEmailPassword({ email: formData.email, password: formData.password })
      }
      
      // 2. Atualizar Suspensão no CyberPanel (simulado via PATCH o seu API implementado há pouco)
      await fetch('/api/cyberpanel-email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, action: formData.activo ? 'unsuspend' : 'suspend' })
      })

      // 3. Atualizar Supabase (Mestre da verdade para Proprietário e Estado)
      const { error } = await supabase.from('email_contas').upsert({
        email: formData.email,
        cliente_id: formData.cliente_id,
        activo: formData.activo,
        nome_conta: formData.email.split('@')[0],
        ...(formData.password ? { password_smtp: Buffer.from(formData.password).toString('base64') } : {})
      }, { onConflict: 'email' })

      if (error) throw error

      setMsg('Conta atualizada com sucesso.')
      setMsgType('success')
      setShowEditModal(false)
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
    const ok = await cyberPanelAPI.changeEmailPassword({ email, password: newPass })
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

  return (
    <div className="text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gestão de E-mail</h1>
            <p className="text-xs text-gray-600">Cria, elimina e configura contas de e-mail corporativo</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
          <span className="text-gray-900 font-semibold">∞</span> Disponíveis
          <span className="mx-2 text-gray-400">|</span>
          <span className="text-gray-900 font-semibold">{emails.length}</span> Usadas
        </div>
      </div>

      {/* Domain selector + Search + Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={selectedDomain}
          onChange={e => setSelectedDomain(e.target.value)}
          className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-red-500"
        >
          <option value="">Seleccionar domínio...</option>
          {sites.length > 0
            ? sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)
            : <option value="visualdesigne.com">visualdesigne.com</option>
          }
        </select>
        <div className="flex-1">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar contas..."
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadEmails(selectedDomain)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-all font-bold"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button
            onClick={() => setEmailModal({
              show: true,
              mode: 'create',
              data: { user: '', password: '', quota: '500', activo: true, cliente_id: '' }
            })}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
          >
            <Plus className="w-4 h-4" /> Criar E-mail
          </button>
          <button
            onClick={() => { setMostrarAdicionarConta(true); setModalAdicionarPasso('escolher') }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-all"
          >
            <Plus className="w-4 h-4" /> Conta Externa
          </button>
        </div>
      </div>

      {/* Mensagem de feedback */}
      {msg && (
        <div className={`flex items-center gap-2 text-xs px-4 py-3 rounded-lg mb-4 border font-medium ${msgType === 'success'
          ? 'text-green-700 bg-green-50 border-green-200'
          : 'text-red-700 bg-red-50 border-red-200'
          }`}>
          <span>{msgType === 'success' ? '✓' : '⚠'}</span> {msg}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[40px_1fr_120px_180px_auto] gap-4 px-4 py-3 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/50">
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
            {selectedDomain ? 'Nenhuma conta encontrada.' : 'Seleccione um domínio.'}
          </div>
        )}

        {/* Rows */}
        {!loading && filtered.map(email => {
          const pct = getStoragePct(email.usage || '0', String(email.quota || '500'))
          const color = getStorageColor(pct)
          const emailStr = email.email || ''

          return (
            <div key={emailStr} className={`grid grid-cols-[40px_1fr_120px_180px_auto] gap-4 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-all ${selected.includes(emailStr) ? 'bg-red-50/30' : ''}`}>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selected.includes(emailStr)}
                  onChange={() => toggleSelect(emailStr)}
                  className="w-4 h-4 accent-red-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-200">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{emailStr}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">Quota: {email.quota}MB</p>
                </div>
              </div>

              <div className="flex items-center">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${email.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {email.activo ? 'Ativo' : 'Suspenso'}
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

              <div className="flex items-center justify-end gap-1">
                <a
                  href={`https://visualdesigne.com/webmail/?user=${encodeURIComponent(emailStr)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                  title="Webmail"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setEmailModal({
                    show: true,
                    mode: 'edit',
                    data: { ...email, password: '' }
                  })}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title="Gerir"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(emailStr)}
                  disabled={deleting === emailStr}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  {deleting === emailStr ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de E-mail (Unified) */}
      {emailModal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEmailModal({ ...emailModal, show: false })} />
          <div className="relative bg-white border border-gray-200 rounded-xl w-full max-w-[80%] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-500/20"><Mail className="w-5 h-5 text-white" /></div>
                <div><h2 className="text-sm font-bold text-gray-900 block">{emailModal.mode === 'create' ? 'Novo E-mail' : 'Editar E-mail'}</h2><span className="text-[11px] text-gray-500 font-mono">{emailModal.mode === 'create' ? `No domínio: ${selectedDomain}` : `Gerir: ${emailModal.data.email}`}</span></div>
              </div>
              <button onClick={() => setEmailModal({ ...emailModal, show: false })} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-5">
              {emailModal.mode === 'create' && (
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Utilizador @{selectedDomain}</label><input value={emailModal.data.user} onChange={e => setEmailModal({...emailModal, data: {...emailModal.data, user: e.target.value}})} placeholder="ex: info" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" /></div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Senha</label><div className="relative"><input type={showEmailPass ? 'text' : 'password'} value={emailModal.data.password} onChange={e => setEmailModal({...emailModal, data: {...emailModal.data, password: e.target.value}})} placeholder={emailModal.mode === 'edit' ? 'Manter atual' : '••••••••'} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all pr-12" /><button type="button" onClick={() => setShowEmailPass(!showEmailPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showEmailPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirmar Senha</label><div className="relative"><input type={showEmailPass ? 'text' : 'password'} value={emailModal.data.confirmPassword || ''} onChange={e => setEmailModal({...emailModal, data: {...emailModal.data, confirmPassword: e.target.value}})} placeholder="Confirmar Senha" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all pr-12" /></div></div>
              </div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quota (MB)</label><input type="number" value={emailModal.data.quota} onChange={e => setEmailModal({...emailModal, data: {...emailModal.data, quota: e.target.value}})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Proprietário</label><select value={emailModal.data.cliente_id || ''} onChange={e => setEmailModal({...emailModal, data: {...emailModal.data, cliente_id: e.target.value}})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"><option value="">Sem proprietário</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.email})</option>)}</select></div>
              {emailModal.mode === 'edit' && (
                <div className="mt-4 flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${emailModal.data.activo ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}><Power className="w-5 h-5" /></div><div><p className="text-xs font-bold text-gray-900">Estado da Conta</p><p className="text-[10px] text-gray-500">{emailModal.data.activo ? 'Ativa' : 'Suspensa'}</p></div></div>
                  <button onClick={() => setEmailModal({...emailModal, data: {...emailModal.data, activo: !emailModal.data.activo}})} className={`relative w-12 h-6 rounded-full transition-colors ${emailModal.data.activo ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${emailModal.data.activo ? 'translate-x-6' : ''}`} /></button>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button onClick={() => setEmailModal({ ...emailModal, show: false })} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700">Cancelar</button>
              <button onClick={() => { if (emailModal.mode === 'create') handleCreateEmail(emailModal.data); else handleUpdateEmail(emailModal.data) }} disabled={loading || creating} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-2">{(loading || creating) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {emailModal.mode === 'create' ? 'Criar E-mail' : 'Guardar Alterações'}</button>
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
// CYBERPANEL USERS SECTION
// ============================================================
export function CPUsersSection() {
  const [users, setUsers] = useState<CyberPanelUser[]>([])
  const [loading, setLoading] = useState(false)
  const [acls, setAcls] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [userModal, setUserModal] = useState<{ show: boolean, mode: 'create' | 'edit', data: any }>({
    show: false,
    mode: 'create',
    data: { firstName: '', lastName: '', email: '', userName: '', password: '', confirmPassword: '', websitesLimit: 10, emailsLimit: 100, acl: 'user' }
  })
  const [showUserPass, setShowUserPass] = useState(false)
  const [confirm, setConfirm] = useState<{ show: boolean, title: string, message: string, onConfirm: () => void, isDanger?: boolean }>({ 
    show: false, title: '', message: '', onConfirm: () => {} 
  })

  const loadUsers = async () => {
    const lsUsers = cpGetUsers()
    if (lsUsers.length > 0) setUsers(lsUsers)
    else setLoading(true)

    try {
      console.log('[loadUsers] Starting fetch...')
      const [u, a, sbUsers] = await Promise.all([
        cyberPanelAPI.listUsers().catch((e: any) => { console.error('[loadUsers] listUsers FAILED:', e.message); return [] as CyberPanelUser[] }),
        cyberPanelAPI.listACLs().catch((e: any) => { console.error('[loadUsers] listACLs FAILED:', e.message); return ['user', 'reseller'] }),
        getUsersFromSupabase().catch((e: any) => { console.error('[loadUsers] getUsersFromSupabase FAILED:', e.message); return [] })
      ])
      
      console.log('[loadUsers] CyberPanel users:', u.length, 'Supabase users:', sbUsers.length)
      console.log('[loadUsers] CyberPanel raw:', JSON.stringify(u).substring(0, 500))
      
      setAcls(Array.isArray(a) ? a.map((x: any) => typeof x === 'string' ? x : x.name || x.ACLName || x.id) : ['user', 'reseller'])
      
      if (u.length > 0 || sbUsers.length > 0) {
        const merged: any[] = u.map(user => {
          const sb = sbUsers.find((s: any) => s.username === user.userName)
          const userType = (user.type !== undefined && user.type !== null) ? String(user.type) : null
          return {
            ...user,
            existsOnServer: true,
            firstName: user.firstName || sb?.first_name || '',
            lastName: user.lastName || sb?.last_name || '',
            email: user.email || sb?.email || '',
            acl: userType || sb?.acl || 'user',
            websitesLimit: sb?.websites_limit || 0,
            emailsLimit: sb?.emails_limit || 0,
            securityLevel: sb?.security_level || 'HIGH',
            state: user.state || sb?.status || 'Active'
          }
        })

        // Add accounts missing from CyberPanel but present in Supabase
        sbUsers.forEach((sb: any) => {
          if (!merged.find(m => m.userName === sb.username)) {
            merged.push({
              userName: sb.username,
              existsOnServer: false,
              firstName: sb.first_name || '',
              lastName: sb.last_name || '',
              email: sb.email || '',
              acl: sb.acl || 'user',
              websitesLimit: sb.websites_limit || 0,
              emailsLimit: sb.emails_limit || 0,
              securityLevel: sb.security_level || 'HIGH',
              state: sb.status || 'Active'
            })
          }
        })
        
        console.log('[loadUsers] Final merged users:', merged.length, merged.map(m => m.userName))
        setUsers(merged)
        merged.forEach((user: any) => cpSaveUser(user.userName, user))
      } else {
        console.warn('[loadUsers] No users from CyberPanel or Supabase! Showing cached data.')
      }
    } catch (e: any) { console.error('[loadUsers] EXCEPTION:', e.message) }
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async (data: any) => {
    if (data.password !== data.confirmPassword) {
      setMsg('As senhas não coincidem!'); return
    }
    setCreating(true); setMsg('')
    try {
      console.log('[handleCreate] Sending to API:', JSON.stringify(data).substring(0, 300))
      const res = await cyberPanelAPI.createUser(data)
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
        setMsg('✅ Utilizador criado com sucesso no CyberPanel!')
        setUserModal({ ...userModal, show: false })
      } else {
        const errorDetail = res?.error || res?.output || 'Erro desconhecido'
        setMsg(`❌ Falhou no CyberPanel: ${errorDetail.substring(0, 200)}`)
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
      console.log('[handleRetrySync] Syncing user:', u.userName, JSON.stringify(u).substring(0, 300))
      const res = await cyberPanelAPI.createUser(u)
      console.log('[handleRetrySync] Response:', JSON.stringify(res).substring(0, 500))
      if (res?.success === true) {
        setMsg(`✅ Utilizador ${u.userName} sincronizado com sucesso no CyberPanel!`)
        loadUsers()
      } else {
        const errorDetail = res?.error || res?.output || 'Erro desconhecido'
        setMsg(`❌ Erro de Sincronização: ${errorDetail.substring(0, 300)}`)
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
      message: `Tens a certeza que desejas eliminar o utilizador ${userName}? Esta ação removerá permanentemente o utilizador do CyberPanel e da base de dados.`,
      isDanger: true,
      onConfirm: async () => {
        setLoading(true)
        try {
          await cyberPanelAPI.deleteUser({ userName })
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
            await cyberPanelAPI.deleteUser({ userName: user })
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
          // CyberPanel suspend logic if available via API, or just update state
          for (const user of selected) {
            // Note: cyberPanelAPI.modifyUser can handle suspension if implemented
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
        await cyberPanelAPI.execCommand(`cyberpanel changeUserPassword --userName ${data.userName} --password '${data.password}'`)
      }
      const currentState = (users.find(u => u.userName === data.userName) as any)?.state || 'Active'
      if (data.state !== currentState) {
        await cyberPanelAPI.execCommand(`cyberpanel ${data.state === 'Suspended' ? 'suspendUser' : 'unsuspendUser'} --userName ${data.userName}`)
      }
      
      // Sync profile changes to CyberPanel original server
      await cyberPanelAPI.modifyUser(data)
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-gray-900">Utilizadores CyberPanel</h1><p className="text-gray-500 mt-1 text-sm font-medium">Gira acessos e permissões do servidor.</p></div>
        <div className="flex gap-2">
          <button onClick={loadUsers} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
          <button 
            onClick={() => setUserModal({ show: true, mode: 'create', data: { firstName: '', lastName: '', email: '', userName: '', password: '', confirmPassword: '', websitesLimit: 0, acl: 'user', securityLevel: 'HIGH' } })} 
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> Novo Utilizador
          </button>
        </div>
      </div>

      {msg && <div className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${msg.includes('sucesso') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg}</div>}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        {loading && <TableSkeleton columns={5} rows={8} />}
        {!loading && users.length === 0 ? (
          <div className="py-12 text-center text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-50" /><p className="text-sm">Nenhum utilizador encontrado.</p></div>
        ) : !loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-500 uppercase border-b bg-gray-50">
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
                <th className="px-4 py-2.5">ACL</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Acções</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected.includes(u.userName) ? 'bg-red-50/30' : ''}`}>
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
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 text-[9px] font-bold border border-orange-100 uppercase tracking-tighter" title="Esta conta existe apenas localmente e falhou ao sincronizar com o CyberPanel.">
                          <AlertCircle className="w-2.5 h-2.5" /> Off-Sync
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{u.email || 'N/A'}</td>
                  <td className="px-4 py-2.5">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-tight">{(u as any).acl || 'User'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-tight ${(u as any).state === 'Suspended' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {(u as any).state || 'Active'}
                      {!u.existsOnServer && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleRetrySync(u)} 
                            className="text-[9px] text-blue-600 hover:underline font-bold uppercase transition-all"
                            title="Tentar criar esta conta no CyberPanel agora"
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
                         className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                         title="Gerir Utilizador"
                       >
                         <Edit2 className="w-4 h-4" />
                       </button>
                       {u.userName !== 'admin' && (
                         <button onClick={() => handleDelete(u.userName)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Apagar"><Trash2 className="w-4 h-4" /></button>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Utilizador (Unified) */}
      {userModal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUserModal({ ...userModal, show: false })} />
          <div className="relative bg-white border border-gray-200 rounded-xl w-full max-w-[80%] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-500/20"><Users className="w-5 h-5 text-white" /></div>
                <div><h2 className="text-sm font-bold text-gray-900 block">{userModal.mode === 'create' ? 'Novo Utilizador' : 'Editar Utilizador'}</h2><span className="text-[11px] text-gray-500 font-mono">{userModal.mode === 'create' ? 'Configurar acesso ao servidor' : `Gerir: ${userModal.data.userName}`}</span></div>
              </div>
              <button onClick={() => setUserModal({ ...userModal, show: false })} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nome</label><input value={userModal.data.firstName || ''} onChange={e => setUserModal({...userModal, data: {...userModal.data, firstName: e.target.value}})} placeholder="João" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Apelido</label><input value={userModal.data.lastName || ''} onChange={e => setUserModal({...userModal, data: {...userModal.data, lastName: e.target.value}})} placeholder="Silva" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">E-mail</label><input value={userModal.data.email || ''} onChange={e => setUserModal({...userModal, data: {...userModal.data, email: e.target.value}})} placeholder="exemplo@email.com" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" /></div>
                <div className="space-y-1.5 col-span-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Access Control List (ACL)</label><select value={userModal.data.acl || 'user'} onChange={e => setUserModal({...userModal, data: {...userModal.data, acl: e.target.value}})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all">{(typeof acls !== 'undefined' && Array.isArray(acls) ? acls : ['user', 'reseller', 'admin']).map(a => <option key={a} value={a}>{a}</option>)}</select><p className="text-[9px] text-gray-500 mt-1 italic leading-tight">Selecione a permissão para este utilizador</p></div>
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Websites Limit</label><input type="number" value={userModal.data.websitesLimit ?? 0} onChange={e => setUserModal({...userModal, data: {...userModal.data, websitesLimit: parseInt(e.target.value) || 0}})} placeholder="0 = Unlimited" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" /><p className="text-[9px] text-gray-500 mt-1 italic leading-tight">Número máximo de websites que este utilizador pode criar. 0 = Ilimitado</p></div>
                <div className="space-y-1.5 lg:col-span-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-red-600">Username</label>
                  <input 
                    value={userModal.data.userName || ''} 
                    disabled={userModal.mode === 'edit'} 
                    onChange={e => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
                      setUserModal({...userModal, data: {...userModal.data, userName: val}})
                    }} 
                    placeholder="ex: provisual" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all disabled:opacity-50" 
                  />
                  <p className="text-[9px] text-gray-500 mt-1 italic leading-tight">Escolha um username único para login (apenas letras e números)</p>
                </div>
                <div className="space-y-1.5 lg:col-span-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type={showUserPass ? 'text' : 'password'} 
                        value={userModal.data.password || ''} 
                        onChange={e => setUserModal({...userModal, data: {...userModal.data, password: e.target.value}})} 
                        placeholder={userModal.mode === 'edit' ? 'Alterar password...' : '••••••••'} 
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all pr-10" 
                      />
                      <button type="button" onClick={() => setShowUserPass(!showUserPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showUserPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button type="button" onClick={() => { 
                      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'; 
                      let p = ''; 
                      for (let i = 0; i < 16; i++) p += chars.charAt(Math.floor(Math.random() * chars.length)); 
                      setUserModal({...userModal, data: {...userModal.data, password: p, confirmPassword: p}}) 
                    }} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Gerar
                    </button>
                  </div>
                  {userModal.mode === 'edit' && <p className="text-[9px] text-gray-400 mt-1 italic">Vazio = Manter a password atual (o CyberPanel não permite ler a password antiga).</p>}
                </div>
                <div className="space-y-1.5 lg:col-span-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirmar Password</label><div className="relative"><input type={showUserPass ? 'text' : 'password'} value={userModal.data.confirmPassword || ''} onChange={e => setUserModal({...userModal, data: {...userModal.data, confirmPassword: e.target.value}})} placeholder="Confirmar Password" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all pr-10" /></div></div>
                <div className="space-y-1.5 col-span-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Security Level</label><select value={userModal.data.securityLevel || 'HIGH'} onChange={e => setUserModal({...userModal, data: {...userModal.data, securityLevel: e.target.value}})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"><option value="HIGH">HIGH</option><option value="LOW">LOW</option></select><p className="text-[9px] text-gray-500 mt-1 italic leading-tight">Escolha o nível de segurança para esta conta</p></div>
              </div>
              {userModal.mode === 'edit' && (
                <div className="mt-6 flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${userModal.data.state !== 'Suspended' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}><Power className="w-5 h-5" /></div><div><p className="text-xs font-bold text-gray-900">Estado da Conta</p><p className="text-[10px] text-gray-500">{userModal.data.state !== 'Suspended' ? 'Ativo - Acesso total' : 'Suspenso - Acesso bloqueado'}</p></div></div>
                  <button onClick={() => setUserModal({...userModal, data: {...userModal.data, state: userModal.data.state === 'Suspended' ? 'Active' : 'Suspended'}})} className={`relative w-12 h-6 rounded-full transition-colors ${userModal.data.state !== 'Suspended' ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${userModal.data.state !== 'Suspended' ? 'translate-x-6' : ''}`} /></button>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              {msg && <div className={`mb-3 px-4 py-2.5 rounded-lg text-sm font-medium border ${msg.includes('✅') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg}</div>}
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setUserModal({ ...userModal, show: false })} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700">Cancelar</button>
                <button onClick={() => { if (userModal.mode === 'create') handleCreate(userModal.data); else handleUpdate(userModal.data) }} disabled={loading || creating} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-2">{(loading || creating) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {userModal.mode === 'create' ? 'Criar Utilizador' : 'Guardar Alterações'}</button>
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

  const loadACLs = async () => { setLoading(true); const a = await cyberPanelAPI.listACLs(); setAcls(a); setLoading(false) }
  useEffect(() => { loadACLs() }, [])

  const handleCreate = async () => {
    if (!form.name) return
    setCreating(true); setMsg('')
    const ok = await cyberPanelAPI.createACL(form)
    if (ok) { setMsg('ACL criada!'); setShowForm(false); setForm({ ...form, name: '' }); loadACLs() }
    else setMsg('Erro ao criar ACL.')
    setCreating(false)
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Eliminar ACL ${name}?`)) return
    const ok = await cyberPanelAPI.deleteACL(name)
    if (ok) loadACLs()
    else setMsg('Erro ao eliminar.')
  }

  const toggleField = (field: string) => setForm({ ...form, [field]: !(form as any)[field] })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-gray-900">Centro de Revenda</h1><p className="text-gray-500 mt-1">Gira ACLs (Access Control Lists) e permissões de revendedores.</p></div>
        <button onClick={() => setShowForm(!showForm)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Nova ACL</button>
      </div>

      {msg && <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('criada') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">Criar Nova ACL</h3>
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nome da ACL</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm" placeholder="reseller_basic" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {[
              { key: 'createWebsite', label: 'Criar Website' }, { key: 'deleteWebsite', label: 'Eliminar Website' },
              { key: 'suspendWebsite', label: 'Suspender Website' }, { key: 'createPackage', label: 'Criar Pacote' },
              { key: 'deletePackage', label: 'Eliminar Pacote' }, { key: 'createEmail', label: 'Criar E-mail' },
              { key: 'deleteEmail', label: 'Eliminar E-mail' }, { key: 'createDNS', label: 'Gerir DNS' },
              { key: 'createDatabase', label: 'Criar BD' }, { key: 'createFTP', label: 'Criar FTP' },
            ].map(p => (
              <label key={p.key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                <input type="checkbox" checked={(form as any)[p.key]} onChange={() => toggleField(p.key)} className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500" />
                <span className="text-sm text-gray-700">{p.label}</span>
              </label>
            ))}
          </div>
          <button onClick={handleCreate} disabled={creating || !form.name} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50">
            {creating ? 'Criando...' : 'Criar ACL'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? <div className="py-12 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div> : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(Array.isArray(acls) ? acls : []).map((acl, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
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
export function PHPConfigSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [config, setConfig] = useState<CyberPanelPHPConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [phpVersion, setPhpVersion] = useState('PHP 8.1')

  const loadConfig = async (domain: string) => {
    if (!domain) return
    setLoading(true); setMsg('')
    const data = await cyberPanelAPI.getPHPConfig(domain)
    setConfig(data || { phpVersion: 'PHP 8.1', maxExecutionTime: '30', memoryLimit: '256M', uploadMaxFilesize: '50M', postMaxSize: '50M', maxInputVars: '1000', maxInputTime: '60' })
    if (data?.phpVersion) setPhpVersion(data.phpVersion)
    setLoading(false)
  }

  const handleSave = async () => {
    if (!selectedDomain || !config) return
    setSaving(true); setMsg('')
    const ok = await cyberPanelAPI.savePHPConfig({ domain: selectedDomain, config })
    if (ok) setMsg('Configurações PHP guardadas!')
    else setMsg('Erro ao guardar configurações.')
    setSaving(false)
  }

  const handleChangePHP = async () => {
    if (!selectedDomain) return
    setSaving(true); setMsg('')
    const ok = await cyberPanelAPI.changePHPVersion({ domain: selectedDomain, phpVersion })
    if (ok) setMsg(`Versão PHP alterada para ${phpVersion}!`)
    else setMsg('Erro ao alterar versão PHP.')
    setSaving(false)
  }

  const updateConfig = (key: string, value: string) => {
    if (config) setConfig({ ...config, [key]: value })
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Configurações PHP</h1><p className="text-gray-500 mt-1">Configure a versão PHP e parâmetros de execução por website.</p></div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadConfig(e.target.value) }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
              <option value="">Seleccione...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Versão PHP</label>
            <div className="flex gap-2">
              <select value={phpVersion} onChange={(e) => setPhpVersion(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option>PHP 7.4</option><option>PHP 8.0</option><option>PHP 8.1</option><option>PHP 8.2</option><option>PHP 8.3</option>
              </select>
              <button onClick={handleChangePHP} disabled={saving || !selectedDomain} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50">Alterar</button>
            </div>
          </div>
        </div>

        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('!') && !msg.includes('Erro') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

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
                    placeholder={f.placeholder} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                </div>
              ))}
            </div>
            <button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />} Guardar Configurações PHP
            </button>
          </>
        )}
      </div>

      {/* PHP Extensions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Extensões PHP</h3>
            <p className="text-xs text-gray-500 mt-0.5">Extensões recomendadas para WordPress e aplicações web</p>
          </div>
          <a href="https://109.199.104.22:8090/php/phpExtensions" target="_blank" rel="noopener noreferrer"
            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5" /> Gerir no CyberPanel
          </a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
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
            <div key={ext.name} className={`flex flex-col gap-1 p-3 rounded-xl border ${ext.wp ? 'border-indigo-100 bg-indigo-50/50' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <code className="text-xs font-bold text-gray-800">{ext.name}</code>
                {ext.wp && <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-1 rounded">WP</span>}
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">{ext.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          As extensões marcadas <span className="font-bold text-indigo-600">WP</span> são necessárias para WordPress.
          Para instalar, clica em "Gerir no CyberPanel" → selecciona a versão PHP → activa a extensão.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// SECURITY & FIREWALL SECTION
// ============================================================
export function SecuritySection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [firewallOn, setFirewallOn] = useState(false)
  const [loading, setLoading] = useState(true)
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
        const [fw, ips] = await Promise.all([cyberPanelAPI.getFirewallStatus(), cyberPanelAPI.getBlockedIPs()])
        setFirewallOn(fw)
        // Garantir que blockedIPs é sempre um array
        const result = ips || []
        const blockedArray = Array.isArray(result) ? result :
          typeof result === 'string' ? result.split('\n').filter((ip: string) => ip.trim()) : []
        setBlockedIPs(blockedArray)
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
    const ok = await cyberPanelAPI.toggleFirewall(!firewallOn)
    if (ok) setFirewallOn(!firewallOn)
    else setMsg('Erro ao alterar firewall.')
    setToggling(false)
  }

  const handleBlockIP = async () => {
    if (!newIP.trim()) return
    const ok = await cyberPanelAPI.blockIP(newIP.trim())
    if (ok) { setBlockedIPs([...blockedIPs, newIP.trim()]); setNewIP('') }
    else setMsg('Erro ao bloquear IP.')
  }

  const handleUnblockIP = async (ip: string) => {
    const ok = await cyberPanelAPI.unblockIP(ip)
    if (ok) setBlockedIPs(blockedIPs.filter(i => i !== ip))
    else setMsg('Erro ao desbloquear IP.')
  }

  const loadModSec = async (domain: string) => {
    if (!domain) return
    setModsecLoading(true)
    const status = await cyberPanelAPI.getModSecurityStatus()
    setModsecOn(status)
    setModsecLoading(false)
  }

  const handleToggleModSec = async () => {
    if (!selectedDomain) return
    setModsecLoading(true)
    const ok = await cyberPanelAPI.toggleModSecurity({ enable: !modsecOn })
    if (ok) setModsecOn(!modsecOn)
    else setMsg('Erro ao alterar ModSecurity.')
    setModsecLoading(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Segurança & Firewall</h1><p className="text-gray-500 mt-1">Gira firewall, ModSecurity e IPs bloqueados.</p></div>

      {msg && <div className="px-4 py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">{msg}</div>}

      {loading ? <div className="py-12 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Firewall */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${firewallOn ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                {toggling ? <RefreshCw className="w-4 h-4 animate-spin" /> : firewallOn ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>

          {/* ModSecurity */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">ModSecurity (WAF)</h3>
            <div className="flex gap-3 items-end mb-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
                <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadModSec(e.target.value) }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">Seleccione...</option>
                  {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
                </select>
              </div>
              {selectedDomain && (
                <button onClick={handleToggleModSec} disabled={modsecLoading}
                  className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${modsecOn ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                  {modsecLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : modsecOn ? 'Desativar' : 'Ativar'}
                </button>
              )}
            </div>
            {selectedDomain && <p className="text-xs text-gray-500">ModSecurity: <span className={`font-bold ${modsecOn ? 'text-green-600' : 'text-red-600'}`}>{modsecOn ? 'Ativo' : 'Inativo'}</span></p>}
          </div>

          {/* Blocked IPs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <h3 className="font-bold text-gray-900 mb-4">IPs Bloqueados</h3>
            <div className="flex gap-2 mb-4">
              <input value={newIP} onChange={(e) => setNewIP(e.target.value)} placeholder="192.168.1.100" className="flex-1 max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono" />
              <button onClick={handleBlockIP} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2"><Lock className="w-4 h-4" /> Bloquear</button>
            </div>
            {blockedIPs.length === 0 ? <p className="text-sm text-gray-400">Nenhum IP bloqueado.</p> : (
              <div className="flex flex-wrap gap-2">
                {blockedIPs.map((ip, i) => (
                  <div key={i} className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
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
// SSL CERTIFICATES SECTION
// ============================================================
export function SSLSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [msg, setMsg] = useState('')

  const handleCreate = async (newDomain: string) => {
    const res = await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createWebsite',
        params: {
          domainName: newDomain,
          email: 'admin@visualdesigne.com',
          packageName: 'Default',
          php: 'PHP 8.2'
        }
      })
    })
  }

  const handleIssueSSL = async () => {
    if (!selectedDomain) return
    setIssuing(true); setMsg('')

    try {
      // Primeiro verificar se o domínio resolve para o IP correcto
      const checkRes = await fetch('/api/server-exec', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execCommand',
          params: { command: `dig +short ${selectedDomain} 2>&1` }
        })
      })
      const checkData = await checkRes.json()
      const resolvedIP = (checkData.data?.output || '').trim()
      const serverIP = '109.199.104.22'

      if (!resolvedIP) {
        setMsg(`⚠️ DNS não propagou ainda!\n\nO domínio "${selectedDomain}" não está a resolver para nenhum IP.\n\nAguarda a propagação DNS (pode demorar até 24h) e tenta novamente.`)
        setIssuing(false)
        return
      }

      if (!resolvedIP.includes(serverIP)) {
        setMsg(`⚠️ DNS ainda não propagou!\n\nO domínio "${selectedDomain}" está a resolver para:\n${resolvedIP}\n\nMas devia resolver para:\n${serverIP}\n\nAguarda a propagação DNS e tenta novamente.`)
        setIssuing(false)
        return
      }

      // DNS está correcto — emitir SSL
      const sslRes = await fetch('/api/server-exec', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execCommand',
          params: { command: `cyberpanel issueSSL --domainName ${selectedDomain} 2>&1` }
        })
      })
      const sslData = await sslRes.json()
      const output = sslData.data?.output || ''

      if (output.toLowerCase().includes('success') || output.toLowerCase().includes('issued')) {
        setMsg(`✅ SSL emitido com sucesso para ${selectedDomain}!`)
      } else {
        setMsg(`⚠️ Erro ao emitir SSL:\n\n${output}`)
      }

    } catch (e: any) {
      setMsg('Erro: ' + e.message)
    }
    setIssuing(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Certificados SSL</h1><p className="text-gray-500 mt-1">Emita certificados SSL Let&apos;s Encrypt para os seus websites.</p></div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex-1 min-w-[250px]">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
              <option value="">Seleccione um domínio...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <button onClick={handleIssueSSL} disabled={issuing || !selectedDomain}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
            {issuing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Emitir SSL
          </button>
        </div>

        {msg && <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

        <div className="mt-6">
          <h3 className="font-bold text-gray-900 mb-3">Estado SSL dos Websites</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sites.map(s => (
              <div key={s.domain} className={`flex items-center gap-3 p-4 border rounded-lg
                ${s.ssl ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                {s.ssl
                  ? <Lock className="w-5 h-5 text-green-500" />
                  : <LockOpen className="w-5 h-5 text-red-400" />
                }
                <div>
                  <p className="text-sm font-bold text-gray-900">{s.domain}</p>
                  <p className={`text-xs font-medium ${s.ssl ? 'text-green-600' : 'text-red-500'}`}>
                    {s.ssl ? 'SSL Activo' : 'Sem SSL'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
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
    const t = await cyberPanelAPI.generateAPIToken()
    setToken(t)
    setGenerating(false)
  }

  const handleCopy = () => {
    if (token) { navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  const loadStatus = async () => {
    setLoadingStatus(true)
    const s = await cyberPanelAPI.getServerStatus()
    setServerStatus(s)
    setLoadingStatus(false)
  }

  useEffect(() => { loadStatus() }, [])

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Configurações API</h1><p className="text-gray-500 mt-1">Gira tokens de acesso à API e veja o estado do servidor.</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Token */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><Key className="w-5 h-5 text-gray-600" /></div>
            <h3 className="font-bold text-gray-900">Token de API</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Gere um token para aceder à API do CyberPanel externamente.</p>
          <button onClick={handleGenerate} disabled={generating}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 mb-4">
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />} Gerar Token
          </button>
          {token && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-gray-700 break-all">{token}</code>
              <button onClick={handleCopy} className="text-gray-500 hover:text-gray-700 shrink-0">
                {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">Endpoint Base</h4>
            <code className="text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg block text-gray-700">https://109.199.104.22:8090/api/</code>
          </div>
        </div>

        {/* Server Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
              {Object.entries(serverStatus).filter(([k]) => !['status', 'error_message'].includes(k)).slice(0, 8).map(([key, val]) => (
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
export function ListSubdomainsSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [subdomains, setSubdomains] = useState<CyberPanelSubdomain[]>([])
  const [loading, setLoading] = useState(false)

  const loadSubs = async (domain: string) => {
    if (!domain) return
    setLoading(true)
    const data = await cyberPanelAPI.listSubdomains(domain)
    setSubdomains(data)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">List Sub/Addon Domains</h1><p className="text-gray-500 mt-1">View all subdomains and addon domains for a website.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadSubs(e.target.value) }}
            className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
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
export function ModifyWebsiteSection({ sites, packages }: { sites: CyberPanelWebsite[]; packages: CyberPanelPackage[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [packageName, setPackageName] = useState('')
  const [phpVersion, setPhpVersion] = useState('PHP 8.1')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const handleModify = async () => {
    if (!selectedDomain) return
    setSaving(true); setMsg('')
    const ok = await cyberPanelAPI.modifyWebsite({ domain: selectedDomain, packageName, phpVersion })
    setMsg(ok ? 'Website modified successfully!' : 'Error modifying website.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Modify Website</h1><p className="text-gray-500 mt-1">Change package and PHP version for a website.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); const s = sites.find(x => x.domain === e.target.value); if (s && s.package) setPackageName(s.package) }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"><option value="">Select...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Package</label>
            <select value={packageName} onChange={(e) => setPackageName(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              {packages.map(p => <option key={p.packageName} value={p.packageName}>{p.packageName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">PHP Version</label>
            <select value={phpVersion} onChange={(e) => setPhpVersion(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option>PHP 7.4</option><option>PHP 8.0</option><option>PHP 8.1</option><option>PHP 8.2</option><option>PHP 8.3</option>
            </select>
          </div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleModify} disabled={saving || !selectedDomain} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />} Modify Website
        </button>
      </div>
    </div>
  )
}

// ============================================================
// SUSPEND/UNSUSPEND WEBSITE SECTION
// ============================================================
export function SuspendWebsiteSection({ sites, onRefresh }: { sites: CyberPanelWebsite[]; onRefresh: () => void }) {
  const [loading, setLoading] = useState('')
  const [msg, setMsg] = useState('')

  const parseState = (state: any) => {
    if (state === 1 || state === '1' || state === 'Active') return 'Active'
    if (state === 0 || state === '0' || state === 'Suspended') return 'Suspended'
    return state || 'Active'
  }

  const handleToggle = async (domain: string, currentState: string) => {
    setLoading(domain); setMsg('')
    const action = currentState === 'Active' ? 'suspend' : 'unsuspend'
    const ok = action === 'suspend' ? await cyberPanelAPI.suspendWebsite(domain) : await cyberPanelAPI.unsuspendWebsite(domain)
    if (ok) {
      await syncWebsiteToSupabase({ domain, status: action === 'suspend' ? 'Suspended' : 'Active' })
      onRefresh()
    }
    setMsg(ok ? `${domain} ${action === 'suspend' ? 'suspenso' : 'activado'} com sucesso!` : `Erro: não foi possível ${action} ${domain}.`)
    setLoading('')
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Suspender / Activar Websites</h1><p className="text-gray-500 mt-1">Suspende ou reactiva websites.</p></div>
      {msg && <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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
                  className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50
                    ${parseState(s.state) === 'Active'
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-green-600 hover:bg-green-700'}`}>
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
export function DeleteWebsiteSection({ sites, onRefresh }: { sites: CyberPanelWebsite[]; onRefresh: () => void }) {
  const [deleting, setDeleting] = useState('')
  const [msg, setMsg] = useState('')

  const handleDelete = async (domain: string) => {
    if (!confirm(`Are you sure you want to DELETE ${domain}? This action is IRREVERSIBLE!`)) return
    if (!confirm(`FINAL CONFIRMATION: Delete ${domain} and ALL its data?`)) return
    setDeleting(domain); setMsg('')
    const ok = await cyberPanelAPI.deleteWebsite(domain)
    if (ok) {
      await removeWebsiteFromSupabase(domain)
      onRefresh()
    }
    setMsg(ok ? `${domain} deleted successfully.` : `Error deleting ${domain}.`)
    setDeleting('')
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Delete Website</h1><p className="text-gray-500 mt-1 text-red-600 font-medium">Warning: Deleting a website is permanent and cannot be undone.</p></div>
      {msg && <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs font-bold text-gray-500 uppercase border-b bg-gray-50"><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3 w-32">Action</th></tr></thead>
          <tbody>{sites.map((s, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3 font-bold">{s.domain}</td>
              <td className="px-4 py-3 text-gray-600">{s.package}</td>
              <td className="px-4 py-3 text-gray-600">{s.owner}</td>
              <td className="px-4 py-3">
                <button onClick={() => handleDelete(s.domain)} disabled={deleting === s.domain} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1">
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
// WORDPRESS LIST SECTION
// ============================================================
export function WPListSection({ sites, setFileManagerDomain, setActiveSection }: {
  sites: CyberPanelWebsite[],
  setFileManagerDomain?: (domain: string) => void,
  setActiveSection?: (section: string) => void
}) {
  const [wpSites, setWpSites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [installingLS, setInstallingLS] = useState<string | null>(null)
  const [lsMsg, setLsMsg] = useState<{ domain: string; ok: boolean; text: string } | null>(null)

  useEffect(() => { (async () => { setLoading(true); const data = await cyberPanelAPI.listWordPress(''); setWpSites(data); setLoading(false) })() }, [])

  const handleInstallLiteSpeed = async (domain: string) => {
    setInstallingLS(domain); setLsMsg(null)
    const ok = await cyberPanelAPI.installWPPlugin({ domain, plugin: 'litespeed-cache' })
    setLsMsg({ domain, ok, text: ok ? 'LiteSpeed Cache instalado!' : 'Erro ao instalar LiteSpeed Cache.' })
    setInstallingLS(null)
  }

  const allSites = wpSites.length > 0
    ? wpSites.map((wp: any) => ({ domain: wp.domain || wp.domainName, version: wp.version || null, owner: wp.owner || '' }))
    : sites.map(s => ({ domain: s.domain, version: null, owner: s.owner }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Painel WP Admin</h1>
        <p className="text-gray-500 mt-1">Acesso directo ao painel de administração WordPress de cada site.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allSites.map((s, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate text-sm">{s.domain}</p>
                  <p className="text-xs text-gray-400">{s.owner || 'admin'}{s.version ? ` · WP ${s.version}` : ''}</p>
                </div>
              </div>
              <div className="space-y-2">
                <a
                  href={`https://${s.domain}/wp-admin`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir WP Admin
                </a>
                <button
                  onClick={() => {
                    if (setFileManagerDomain) setFileManagerDomain(s.domain)
                    setTimeout(() => { if (setActiveSection) setActiveSection('file-manager') }, 50)
                  }}
                  className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold py-2 px-4 rounded-lg border border-amber-200 transition-all flex items-center justify-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5" /> Ficheiros WordPress
                </button>
                <button
                  onClick={() => handleInstallLiteSpeed(s.domain)}
                  disabled={installingLS === s.domain}
                  className="w-full bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold py-2 px-4 rounded-lg border border-green-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {installingLS === s.domain
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> A instalar...</>
                    : <><Layers className="w-3.5 h-3.5" /> Instalar LiteSpeed Cache</>}
                </button>
                {lsMsg && lsMsg.domain === s.domain && (
                  <p className={`text-[10px] font-bold text-center py-1 rounded ${lsMsg.ok ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>{lsMsg.text}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && allSites.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum site encontrado.</p>
          <p className="text-sm mt-1">Instala um WordPress primeiro na secção "Instalar WordPress".</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// WORDPRESS PLUGINS SECTION
// ============================================================
export function WPPluginsSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [plugins, setPlugins] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState('')
  const [msg, setMsg] = useState('')

  const loadPlugins = async (domain: string) => {
    if (!domain) return
    setLoading(true)
    const data = await cyberPanelAPI.listWPPlugins(domain)
    setPlugins(data)
    setLoading(false)
  }

  const handleToggle = async (pluginName: string, activate: boolean) => {
    setToggling(pluginName); setMsg('')
    const ok = await cyberPanelAPI.toggleWPPlugin({ domain: selectedDomain, plugin: pluginName, activate })
    setMsg(ok ? `Plugin ${activate ? 'activated' : 'deactivated'}!` : 'Error toggling plugin.')
    setToggling('')
    if (ok) loadPlugins(selectedDomain)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Configure Plugins</h1><p className="text-gray-500 mt-1">Manage WordPress plugins for your websites.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadPlugins(e.target.value) }}
            className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm"><option value="">Select...</option>
            {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('!') && !msg.includes('Error') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        {loading ? <div className="py-12 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div> : plugins.length > 0 ? (
          <div className="space-y-2">{plugins.map((p, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Plug className="w-5 h-5 text-gray-400" />
                <div><p className="font-bold text-sm">{p.name || p.pluginName}</p><p className="text-xs text-gray-500">{p.version || ''}</p></div>
              </div>
              <button onClick={() => handleToggle(p.name || p.pluginName, !p.active)} disabled={toggling === (p.name || p.pluginName)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${p.active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
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
export function WPRestoreBackupSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [backups, setBackups] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState('')
  const [msg, setMsg] = useState('')

  const loadBackups = async (domain: string) => {
    if (!domain) return
    setLoading(true)
    const data = await cyberPanelAPI.listWPBackups(domain)
    setBackups(data)
    setLoading(false)
  }

  const handleRestore = async (backupFile: string) => {
    if (!confirm(`Restore backup ${backupFile}?`)) return
    setRestoring(backupFile); setMsg('')
    const ok = await cyberPanelAPI.restoreWPBackup({ domain: selectedDomain, backup: backupFile })
    setMsg(ok ? 'Backup restored successfully!' : 'Error restoring backup.')
    setRestoring('')
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Restore Backups</h1><p className="text-gray-500 mt-1">Restore WordPress from a previous backup.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadBackups(e.target.value) }}
            className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm"><option value="">Select...</option>
            {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        {loading ? <div className="py-12 text-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div> : backups.length > 0 ? (
          <div className="space-y-2">{backups.map((b, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-3"><Download className="w-5 h-5 text-gray-400" /><span className="font-mono text-sm">{b}</span></div>
              <button onClick={() => handleRestore(b)} disabled={restoring === b} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1">
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
export function WPRemoteBackupSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [destination, setDestination] = useState('')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')

  const handleCreate = async () => {
    if (!selectedDomain) return
    setCreating(true); setMsg('')
    const ok = await cyberPanelAPI.createRemoteBackup({ domain: selectedDomain, destination })
    setMsg(ok ? 'Remote backup initiated!' : 'Error creating remote backup.')
    setCreating(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Remote Backup</h1><p className="text-gray-500 mt-1">Create a remote backup of your WordPress site.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Website</label>
            <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"><option value="">Select...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Destination (optional)</label>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="s3://bucket or sftp://..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('initiated') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleCreate} disabled={creating || !selectedDomain} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Create Remote Backup
        </button>
      </div>
    </div>
  )
}

// ============================================================
// DNS NAMESERVER SECTION
// ============================================================
export function DNSNameserverSection({ sites }: { sites: CyberPanelWebsite[] }) {
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
    const ok = await cyberPanelAPI.createNameserver({ domain: selectedDomain, ns1, ns1IP, ns2, ns2IP })
    setMsg(ok ? 'Nameservers created!' : 'Error creating nameservers.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Create Nameserver</h1><p className="text-gray-500 mt-1">Create child nameservers for your domain.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-3">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); setNs1(`ns1.${e.target.value}`); setNs2(`ns2.${e.target.value}`) }}
              className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm"><option value="">Select...</option>
              {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">NS1</label><input value={ns1} onChange={(e) => setNs1(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">NS1 IP</label><input value={ns1IP} onChange={(e) => setNs1IP(e.target.value)} placeholder="109.199.104.22" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono" /></div>
          <div></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">NS2</label><input value={ns2} onChange={(e) => setNs2(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">NS2 IP</label><input value={ns2IP} onChange={(e) => setNs2IP(e.target.value)} placeholder="109.199.104.22" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono" /></div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('created') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleCreate} disabled={saving || !selectedDomain} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />} Create Nameservers
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
    const ok = await cyberPanelAPI.configDefaultNameservers({ ns1, ns2 })
    setMsg(ok ? 'Default nameservers configured!' : 'Error configuring nameservers.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Config Default Nameservers</h1><p className="text-gray-500 mt-1">Set the default nameservers for new websites.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nameserver 1</label><input value={ns1} onChange={(e) => setNs1(e.target.value)} placeholder="ns1.yourdomain.com" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nameserver 2</label><input value={ns2} onChange={(e) => setNs2(e.target.value)} placeholder="ns2.yourdomain.com" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono" /></div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('configured') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleSave} disabled={saving || !ns1 || !ns2} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />} Save Configuration
        </button>
      </div>
    </div>
  )
}

// ============================================================
// DNS ZONE CREATE/DELETE SECTIONS
// ============================================================
export function DNSCreateZoneSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [domain, setDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const handleCreate = async () => {
    if (!domain) return
    setSaving(true); setMsg('')
    const ok = await cyberPanelAPI.createDNSZone(domain)
    setMsg(ok ? `DNS zone created for ${domain}!` : 'Error creating DNS zone.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Create DNS Zone</h1><p className="text-gray-500 mt-1">Create a new DNS zone for a domain.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex gap-3 items-end mb-6">
          <div className="flex-1 max-w-sm">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <button onClick={handleCreate} disabled={saving || !domain} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />} Create Zone
          </button>
        </div>
        {msg && <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('created') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      </div>
    </div>
  )
}

export function DNSDeleteZoneSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [domain, setDomain] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  const handleDelete = async () => {
    if (!domain || !confirm(`Delete DNS zone for ${domain}?`)) return
    setDeleting(true); setMsg('')
    const ok = await cyberPanelAPI.deleteDNSZone(domain)
    setMsg(ok ? `DNS zone deleted for ${domain}!` : 'Error deleting DNS zone.')
    setDeleting(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Delete Zone</h1><p className="text-gray-500 mt-1">Delete a DNS zone for a domain.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex gap-3 items-end mb-6">
          <div className="flex-1 max-w-sm">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <button onClick={handleDelete} disabled={deleting || !domain} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
            {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Zone
          </button>
        </div>
        {msg && <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('deleted') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      </div>
    </div>
  )
}

// ============================================================
// CLOUDFLARE SECTION
// ============================================================
export function CloudFlareSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [email, setEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const handleSave = async () => {
    if (!selectedDomain || !email || !apiKey) return
    setSaving(true); setMsg('')
    const ok = await cyberPanelAPI.configCloudFlare({ domain: selectedDomain, email, apiKey })
    setMsg(ok ? 'CloudFlare configured!' : 'Error configuring CloudFlare.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">CloudFlare</h1><p className="text-gray-500 mt-1">Configure CloudFlare integration for your domain.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">CloudFlare Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@email.com" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">API Key</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('configured') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleSave} disabled={saving || !selectedDomain || !email || !apiKey} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />} Configure CloudFlare
        </button>
      </div>
    </div>
  )
}

// ============================================================
// DNS RESET SECTION
// ============================================================
export function DNSResetSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [domain, setDomain] = useState('')
  const [resetting, setResetting] = useState(false)
  const [msg, setMsg] = useState('')

  const handleReset = async () => {
    if (!domain || !confirm(`Reset ALL DNS configurations for ${domain}? This cannot be undone!`)) return
    setResetting(true); setMsg('')
    const ok = await cyberPanelAPI.resetDNSConfigurations(domain)
    setMsg(ok ? `DNS configurations reset for ${domain}!` : 'Error resetting DNS.')
    setResetting(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Reset DNS Configurations</h1><p className="text-gray-500 mt-1 text-red-600 font-medium">Warning: This will reset all DNS records to default.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex gap-3 items-end mb-6">
          <div className="flex-1 max-w-sm">
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <button onClick={handleReset} disabled={resetting || !domain} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
            {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reset DNS
          </button>
        </div>
        {msg && <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('reset') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      </div>
    </div>
  )
}

// ============================================================
// EMAIL DELETE SECTION
// ============================================================
export function EmailDeleteSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [emails, setEmails] = useState<CyberPanelEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState('')
  const [msg, setMsg] = useState('')

  const loadEmails = async (domain: string) => { if (!domain) return; setLoading(true); const data = await cyberPanelAPI.listEmails(domain); setEmails(data); setLoading(false) }

  const handleDelete = async (email: string) => {
    if (!confirm(`Delete ${email}?`)) return
    setDeleting(email); setMsg('')
    const ok = await cyberPanelAPI.deleteEmail({ domain: selectedDomain, email })
    setMsg(ok ? `${email} deleted!` : 'Error deleting email.')
    setDeleting('')
    if (ok) loadEmails(selectedDomain)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Delete Email</h1><p className="text-gray-500 mt-1">Delete email accounts from a domain.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6"><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadEmails(e.target.value) }} className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
            <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('deleted') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        {loading ? <div className="py-8 text-center"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div> : emails.length > 0 ? (
          <div className="space-y-2">{emails.map((em, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-red-500" /><span className="font-bold text-sm">{em.email}</span></div>
              <button onClick={() => handleDelete(em.email)} disabled={deleting === em.email} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1">
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
export function EmailLimitsSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [emails, setEmails] = useState<CyberPanelEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [editingEmail, setEditingEmail] = useState('')
  const [limit, setLimit] = useState('500')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadEmails = async (domain: string) => { if (!domain) return; setLoading(true); const data = await cyberPanelAPI.listEmails(domain); setEmails(data); setLoading(false) }

  const handleSave = async (email: string) => {
    setSaving(true); setMsg('')
    const ok = await cyberPanelAPI.setEmailLimits({ domain: selectedDomain, email, limit: parseInt(limit) })
    setMsg(ok ? 'Limit updated!' : 'Error updating limit.')
    setSaving(false); setEditingEmail('')
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Email Limits</h1><p className="text-gray-500 mt-1">Set sending limits for email accounts.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6"><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadEmails(e.target.value) }} className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
            <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('updated') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        {loading ? <div className="py-8 text-center"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div> : emails.length > 0 ? (
          <div className="space-y-2">{emails.map((em, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-gray-400" /><span className="font-bold text-sm">{em.email}</span></div>
              {editingEmail === em.email ? (
                <div className="flex items-center gap-2">
                  <input value={limit} onChange={(e) => setLimit(e.target.value)} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" placeholder="500" />
                  <button onClick={() => handleSave(em.email)} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-bold">Save</button>
                </div>
              ) : (
                <button onClick={() => { setEditingEmail(em.email); setLimit('500') }} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md font-medium">Set Limit</button>
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
export function EmailForwardingSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [emails, setEmails] = useState<CyberPanelEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState('')
  const [forwards, setForwards] = useState<string[]>([])
  const [forwardTo, setForwardTo] = useState('')
  const [msg, setMsg] = useState('')

  const loadEmails = async (domain: string) => { if (!domain) return; setLoading(true); const data = await cyberPanelAPI.listEmails(domain); setEmails(data); setLoading(false) }

  const loadForwards = async (email: string) => {
    setSelectedEmail(email)
    const fwds = await cyberPanelAPI.getEmailForwarding({ email })
    setForwards(fwds)
  }

  const handleAdd = async () => {
    if (!selectedEmail || !forwardTo) return
    const ok = await cyberPanelAPI.addEmailForwarding({ email: selectedEmail, forward: forwardTo })
    if (ok) { setForwardTo(''); loadForwards(selectedEmail) }
    else setMsg('Error adding forwarding.')
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Email Forwarding</h1><p className="text-gray-500 mt-1">Configure email forwarding rules.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6"><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
          <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadEmails(e.target.value); setSelectedEmail('') }} className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
            <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
        </div>
        {msg && <div className="mb-4 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">{msg}</div>}
        {loading ? <div className="py-8 text-center"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div> : emails.length > 0 ? (
          <div className="space-y-2">{emails.map((em, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => loadForwards(em.email)}>
                <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-gray-400" /><span className="font-bold text-sm">{em.email}</span></div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
              {selectedEmail === em.email && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex gap-2 mb-2">
                    <input value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} placeholder="forward@email.com" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    <button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold">Add</button>
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
export function CatchAllEmailSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [catchAll, setCatchAll] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadCatchAll = async (domain: string) => { if (!domain) return; setLoading(true); const ca = await cyberPanelAPI.getCatchAllEmail(domain); setCatchAll(ca || ''); setLoading(false) }

  const handleSave = async () => {
    if (!selectedDomain) return
    setSaving(true); setMsg('')
    const ok = await cyberPanelAPI.setCatchAllEmail({ domain: selectedDomain, email: catchAll })
    setMsg(ok ? 'Catch-all configured!' : 'Error configuring catch-all.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Catch-All Email</h1><p className="text-gray-500 mt-1">Configure a catch-all email address that receives all unmatched emails.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadCatchAll(e.target.value) }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Catch-All Email</label>
            {loading ? <div className="py-2"><RefreshCw className="w-4 h-4 animate-spin text-gray-400" /></div> :
              <input value={catchAll} onChange={(e) => setCatchAll(e.target.value)} placeholder="admin@domain.com" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />}
          </div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('configured') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleSave} disabled={saving || !selectedDomain} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Catch-All'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// PATTERN FORWARDING SECTION
// ============================================================
export function PatternForwardingSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [patterns, setPatterns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pattern, setPattern] = useState('')
  const [destination, setDestination] = useState('')
  const [msg, setMsg] = useState('')

  const loadPatterns = async (domain: string) => { if (!domain) return; setLoading(true); const data = await cyberPanelAPI.getPatternForwarding(domain); setPatterns(data); setLoading(false) }

  const handleAdd = async () => {
    if (!selectedDomain || !pattern || !destination) return
    const ok = await cyberPanelAPI.addPatternForwarding({ domain: selectedDomain, pattern, destination })
    if (ok) { setPattern(''); setDestination(''); loadPatterns(selectedDomain) }
    else setMsg('Error adding pattern.')
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Pattern Forwarding</h1><p className="text-gray-500 mt-1">Forward emails matching a pattern to a destination.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadPatterns(e.target.value) }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Pattern</label><input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="sales-*" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Destination</label><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="team@email.com" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
        </div>
        {msg && <div className="mb-4 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">{msg}</div>}
        <button onClick={handleAdd} disabled={!selectedDomain || !pattern || !destination} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 mb-4">Add Pattern</button>
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
export function PlusAddressingSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [msg, setMsg] = useState('')

  const loadStatus = async (domain: string) => { if (!domain) return; setLoading(true); const s = await cyberPanelAPI.getPlusAddressing(domain); setEnabled(s); setLoading(false) }

  const handleToggle = async () => {
    if (!selectedDomain) return
    setToggling(true); setMsg('')
    const ok = await cyberPanelAPI.togglePlusAddressing({ domain: selectedDomain, enable: !enabled })
    if (ok) setEnabled(!enabled)
    else setMsg('Error toggling plus-addressing.')
    setToggling(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Plus-Addressing</h1><p className="text-gray-500 mt-1">Enable plus-addressing (user+tag@domain.com) for email accounts.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex gap-4 items-end mb-6">
          <div className="flex-1 max-w-sm"><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadStatus(e.target.value) }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          {selectedDomain && !loading && (
            <button onClick={handleToggle} disabled={toggling} className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${enabled ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
              {toggling ? <RefreshCw className="w-4 h-4 animate-spin" /> : enabled ? 'Disable' : 'Enable'}
            </button>
          )}
        </div>
        {loading && <div className="py-4"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div>}
        {msg && <div className="px-4 py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">{msg}</div>}
        {selectedDomain && !loading && <p className="text-sm text-gray-600">Plus-addressing is currently <span className={`font-bold ${enabled ? 'text-green-600' : 'text-red-600'}`}>{enabled ? 'enabled' : 'disabled'}</span> for {selectedDomain}.</p>}
      </div>
    </div>
  )
}

// ============================================================
// EMAIL CHANGE PASSWORD SECTION
// ============================================================
export function EmailChangePasswordSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [emails, setEmails] = useState<CyberPanelEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState('')
  const [newPass, setNewPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadEmails = async (domain: string) => { if (!domain) return; setLoading(true); const data = await cyberPanelAPI.listEmails(domain); setEmails(data); setLoading(false) }

  const handleChange = async () => {
    if (!selectedEmail || !newPass) return
    setSaving(true); setMsg('')
    const ok = await cyberPanelAPI.changeEmailPassword({ email: selectedEmail, password: newPass })
    setMsg(ok ? 'Password changed!' : 'Error changing password.')
    setSaving(false); setNewPass('')
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Change Password</h1><p className="text-gray-500 mt-1">Change the password for an email account.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadEmails(e.target.value); setSelectedEmail('') }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Email Account</label>
            {loading ? <div className="py-2"><RefreshCw className="w-4 h-4 animate-spin text-gray-400" /></div> :
              <select value={selectedEmail} onChange={(e) => setSelectedEmail(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Select...</option>{emails.map(em => <option key={em.email} value={em.email}>{em.email}</option>)}
              </select>}
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">New Password</label><input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="••••••" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('changed') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleChange} disabled={saving || !selectedEmail || !newPass} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />} Change Password
        </button>
      </div>
    </div>
  )
}

// ============================================================
// DKIM MANAGER SECTION
// ============================================================
export function DKIMManagerSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [dkim, setDkim] = useState<{ enabled: boolean; record: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [msg, setMsg] = useState('')

  const loadDKIM = async (domain: string) => { if (!domain) return; setLoading(true); const data = await cyberPanelAPI.getDKIMStatus(domain); setDkim(data); setLoading(false) }

  const handleEnable = async () => {
    if (!selectedDomain) return
    setEnabling(true); setMsg('')
    const ok = await cyberPanelAPI.enableDKIM(selectedDomain)
    setMsg(ok ? 'DKIM enabled!' : 'Error enabling DKIM.')
    setEnabling(false)
    if (ok) loadDKIM(selectedDomain)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">DKIM Manager</h1><p className="text-gray-500 mt-1">Manage DKIM (DomainKeys Identified Mail) for email authentication.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex gap-4 items-end mb-6">
          <div className="flex-1 max-w-sm"><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domain</label>
            <select value={selectedDomain} onChange={(e) => { setSelectedDomain(e.target.value); loadDKIM(e.target.value) }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select...</option>{sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
            </select>
          </div>
          {selectedDomain && !loading && (
            <button onClick={handleEnable} disabled={enabling} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
              {enabling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} {dkim?.enabled ? 'Regenerate DKIM' : 'Enable DKIM'}
            </button>
          )}
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('enabled') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        {loading ? <div className="py-8 text-center"><RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div> : dkim && (
          <div>
            <p className="text-sm mb-2">Status: <span className={`font-bold ${dkim.enabled ? 'text-green-600' : 'text-red-600'}`}>{dkim.enabled ? 'Enabled' : 'Disabled'}</span></p>
            {dkim.record && <div className="bg-gray-50 border border-gray-200 rounded-lg p-3"><p className="text-xs font-bold text-gray-600 uppercase mb-1">DKIM Record</p><code className="text-xs font-mono text-gray-700 break-all">{dkim.record}</code></div>}
          </div>
        )}
      </div>
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

  const loadStatus = async () => {
    setLoading(true)
    try { setData(await (await fetch('/api/git-deploy')).json()) }
    catch { setData(null) }
    setLoading(false)
  }

  useEffect(() => { loadStatus() }, [])

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deploy / GitHub</h1>
          <p className="text-gray-500 mt-1">
            {isLocal ? 'Modo local — commit + push → Vercel faz deploy automático.' : 'Modo produção — Vercel Deploy Hook.'}
          </p>
        </div>
        <button onClick={loadStatus} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {/* Repo info */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
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
                <p className="text-xs text-gray-400">branch: <span className="font-mono font-bold text-gray-700">{repo.branch}</span> · {repo.lastPush ? new Date(repo.lastPush).toLocaleString('pt-PT') : ''}</p>
              </>
            ) : <p className="text-sm text-amber-600">GitHub sem token — commits não visíveis (repositório público OK)</p>}
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 ${isLocal ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
            {isLocal ? '⚡ Local Dev' : '☁ Produção'}
          </span>
        </div>

        {/* Local git status */}
        {isLocal && localGit && (
          <div className={`rounded-lg p-3 border text-sm ${localGit.hasChanges ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleDeploy} disabled={deploying || !commitMsg.trim()}
                className="bg-black hover:bg-green-700 text-white py-2 px-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
                {deploying ? <><RefreshCw className="w-4 h-4 animate-spin" /> Git Push...</> : <><Upload className="w-4 h-4" /> Git Push</>}
              </button>
              <button onClick={handleDeployAll} disabled={deploying || !commitMsg.trim()}
                className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
                {deploying ? <><RefreshCw className="w-4 h-4 animate-spin" /> Deploy All...</> : <><Rocket className="w-4 h-4" /> Deploy Simultâneo</>}
              </button>
            </div>
            <p className="text-xs text-gray-500 text-left">
              <strong>Deploy Simultâneo:</strong> GitHub + Site Online ao mesmo tempo
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={handleDeploy} disabled={deploying}
              className="w-full bg-black hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
              {deploying ? <><RefreshCw className="w-4 h-4 animate-spin" /> A iniciar deploy...</> : <><Upload className="w-4 h-4" /> Trigger Vercel Deploy</>}
            </button>
            <button onClick={handleDeployAll} disabled={deploying}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
              {deploying ? <><RefreshCw className="w-4 h-4 animate-spin" /> Deploy All...</> : <><Rocket className="w-4 h-4" /> Deploy Simultâneo</>}
            </button>
            <p className="text-xs text-gray-500 text-left">
              <strong>Deploy Simultâneo:</strong> Atualiza GitHub + Site Online
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-xl border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
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
      <div className="bg-white rounded-lg border border-indigo-100 shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Commits Recentes</h3>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : commits.length > 0 ? (
          <div className="space-y-1">
            {commits.map((c, i) => (
              <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 group transition-colors">
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

export function PackagesSection({ packages, onRefresh }: { packages: any[], onRefresh: () => void }) {
  const [form, setForm] = useState({ 
    packageName: '', 
    diskSpace: '1000', 
    bandwidth: '1000', 
    emailAccounts: '10', 
    dataBases: '5',
    ftpAccounts: '5',
    allowedDomains: '1'
  })
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [mostrarAdicionarConta, setMostrarAdicionarConta] = useState(false)
  const [modalAdicionarPasso, setModalAdicionarPasso] = useState<'escolher' | 'webmail' | 'google' | 'hotmail'>('escolher')
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ 
    diskSpace: '', 
    bandwidth: '', 
    emailAccounts: '', 
    dataBases: '',
    ftpAccounts: '',
    allowedDomains: ''
  })
  const [msg, setMsg] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleCreate = async () => {
    if (!form.packageName) return
    setCreating(true); setMsg('')
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createPackage', params: form })
      })
      const data = await res.json()
      if (data.success) {
        setMsg('Pacote criado com sucesso!')
        setForm({ packageName: '', diskSpace: '1000', bandwidth: '1000', emailAccounts: '10', dataBases: '5', ftpAccounts: '5', allowedDomains: '1' })
        onRefresh()
      } else {
        setMsg('Erro: ' + (data.error || 'Falha ao criar pacote'))
      }
    } catch (e: any) {
      setMsg('Erro: ' + e.message)
    }
    setCreating(false)
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Apagar pacote "${name}"?`)) return
    setDeleting(name); setMsg('')
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deletePackage', params: { packageName: name } })
      })
      const data = await res.json()
      if (data.success) {
        setMsg('Pacote apagado com sucesso!')
        onRefresh()
      } else {
        setMsg('Erro: ' + (data.error || 'Falha ao apagar pacote'))
      }
    } catch (e: any) {
      setMsg('Erro: ' + e.message)
    }
    setDeleting(null)
  }

  const handleEdit = async (pkg: any) => {
    if (editing === pkg.packageName) {
      // Save edit
      setEditing(null); setMsg('')
      try {
        const res = await fetch('/api/server-exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'editPackage',
            params: {
              packageName: pkg.packageName,
              diskSpace: editForm.diskSpace || pkg.diskSpace,
              bandwidth: editForm.bandwidth || pkg.bandwidth,
              emailAccounts: editForm.emailAccounts || pkg.emailAccounts,
              dataBases: editForm.dataBases || pkg.dataBases,
              ftpAccounts: editForm.ftpAccounts || pkg.ftpAccounts,
              allowedDomains: editForm.allowedDomains || pkg.allowedDomains
            }
          })
        })
        const data = await res.json()
        if (data.success) {
          setMsg('Pacote atualizado com sucesso!')
          onRefresh()
        } else {
          setMsg('Erro: ' + (data.error || 'Falha ao atualizar pacote'))
        }
      } catch (e: any) {
        setMsg('Erro: ' + e.message)
      }
    } else {
      // Start edit
      setEditing(pkg.packageName)
      setEditForm({
        diskSpace: pkg.diskSpace?.toString() || '',
        bandwidth: pkg.bandwidth?.toString() || '',
        emailAccounts: pkg.emailAccounts?.toString() || '',
        dataBases: pkg.dataBases?.toString() || '',
        ftpAccounts: pkg.ftpAccounts?.toString() || '',
        allowedDomains: pkg.allowedDomains?.toString() || ''
      })
    }
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Pacotes</h1><p className="text-gray-500 mt-1">Crie e gerencie pacotes de hospedagem.</p></div>

      {/* Criar Pacote - Botão no topo */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showCreateForm ? 'Cancelar' : 'Criar Novo Pacote'}
          </button>
        </div>

        {showCreateForm && (
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Detalhes do Pacote</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nome do Pacote</label><input value={form.packageName} onChange={e => setForm({ ...form, packageName: e.target.value })} placeholder="Basic" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Espaço em Disco (MB)</label><input type="number" value={form.diskSpace} onChange={e => setForm({ ...form, diskSpace: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Banda Largura (MB)</label><input type="number" value={form.bandwidth} onChange={e => setForm({ ...form, bandwidth: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Contas de Email</label><input type="number" value={form.emailAccounts} onChange={e => setForm({ ...form, emailAccounts: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Bases de Dados</label><input type="number" value={form.dataBases} onChange={e => setForm({ ...form, dataBases: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Contas FTP</label><input type="number" value={form.ftpAccounts} onChange={e => setForm({ ...form, ftpAccounts: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Máximo de Domínios</label><input type="number" value={form.allowedDomains} onChange={e => setForm({ ...form, allowedDomains: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
            </div>
            <button onClick={handleCreate} disabled={creating || !form.packageName.trim()} className="bg-green-600 hover:bg-green-700 text-white py-2.5 px-6 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />} Criar Pacote
            </button>
          </div>
        )}
      </div>

      {/* Lista de Pacotes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Pacotes Existentes</h2>
        {packages && packages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200"><th className="text-left py-3 px-2 font-semibold text-gray-700">Nome</th><th className="text-left py-3 px-2 font-semibold text-gray-700">Disco</th><th className="text-left py-3 px-2 font-semibold text-gray-700">Banda</th><th className="text-left py-3 px-2 font-semibold text-gray-700">Emails</th><th className="text-left py-3 px-2 font-semibold text-gray-700">BDs</th><th className="text-left py-3 px-2 font-semibold text-gray-700">FTPs</th><th className="text-left py-3 px-2 font-semibold text-gray-700">Domínios</th><th className="text-left py-3 px-2 font-semibold text-gray-700">Ações</th></tr></thead>
              <tbody>
                {packages.map((pkg: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium">{pkg.packageName || pkg.name || '-'}</td>
                    <td className="py-3 px-2">
                      {editing === pkg.packageName ? (
                        <input
                          type="number"
                          value={editForm.diskSpace}
                          onChange={e => setEditForm({ ...editForm, diskSpace: e.target.value })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        (pkg.diskSpace || pkg.disk || '-') + ' MB'
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {editing === pkg.packageName ? (
                        <input
                          type="number"
                          value={editForm.bandwidth}
                          onChange={e => setEditForm({ ...editForm, bandwidth: e.target.value })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        (pkg.bandwidth || '-') + ' MB'
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {editing === pkg.packageName ? (
                        <input
                          type="number"
                          value={editForm.emailAccounts}
                          onChange={e => setEditForm({ ...editForm, emailAccounts: e.target.value })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        (pkg.emailAccounts || pkg.emails || '-')
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {editing === pkg.packageName ? (
                        <input
                          type="number"
                          value={editForm.dataBases}
                          onChange={e => setEditForm({ ...editForm, dataBases: e.target.value })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        (pkg.dataBases || pkg.databases || '-')
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {editing === pkg.packageName ? (
                        <input
                          type="number"
                          value={editForm.ftpAccounts}
                          onChange={e => setEditForm({ ...editForm, ftpAccounts: e.target.value })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        (pkg.ftpAccounts || '-')
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {editing === pkg.packageName ? (
                        <input
                          type="number"
                          value={editForm.allowedDomains}
                          onChange={e => setEditForm({ ...editForm, allowedDomains: e.target.value })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        (pkg.allowedDomains || '-')
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => handleEdit(pkg)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-bold mr-2"
                      >
                        {editing === pkg.packageName ? 'Salvar' : 'Editar'}
                      </button>
                      {editing === pkg.packageName && (
                        <button
                          onClick={() => setEditing(null)}
                          className="text-gray-600 hover:text-gray-800 text-xs font-bold mr-2"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(pkg.packageName || pkg.name)}
                        disabled={deleting === pkg.packageName}
                        className="text-red-600 hover:text-red-800 text-xs font-bold disabled:opacity-50"
                      >
                        {deleting === pkg.packageName ? 'A apagar...' : 'Apagar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Nenhum pacote encontrado.</p>
        )}
      </div>

      {msg && <div className={`p-4 rounded-lg border ${msg.includes('sucesso') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>{msg}</div>}
    </div>
  )
}

export function FileManagerSection({ domain, sites }: {
  domain: string,
  sites: CyberPanelWebsite[]
}) {
  const [path, setPath] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState('')

  // Sempre que o domain prop muda, actualiza domain e path
  useEffect(() => {
    const d = domain || (sites.find(s => !s.domain.includes('contaboserver'))?.domain) || ''
    if (d) {
      setSelectedDomain(d)
      setPath(`/home/${d}/public_html`)
    }
  }, [domain])

  // Carregar ficheiros sempre que path muda
  useEffect(() => {
    if (path) loadFiles(path)
  }, [path])

  const loadFiles = async (currentPath: string) => {
    setLoading(true)
    const res = await fetch('/api/server-exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execCommand',
        params: { command: `ls -la "${currentPath}" 2>&1` }
      })
    })
    const data = await res.json()
    const lines = (data.data?.output || '').split('\n').filter((l: string) =>
      l && !l.startsWith('total') && l.trim()
    )
    const parsed = lines.map((line: string) => {
      const parts = line.trim().split(/\s+/)
      return {
        permissions: parts[0],
        size: parts[4],
        date: `${parts[5]} ${parts[6]} ${parts[7]}`,
        name: parts.slice(8).join(' '),
        isDir: parts[0]?.startsWith('d'),
        isLink: parts[0]?.startsWith('l'),
      }
    }).filter((f: any) => f.name && f.name !== '.' && f.name !== '..')
    setFiles(parsed)
    setLoading(false)
  }

  const navigateTo = (folder: string) => {
    if (folder === '..') {
      const parts = path.split('/')
      parts.pop()
      setPath(parts.join('/') || '/')
    } else {
      setPath(`${path}/${folder}`)
    }
  }

  // Breadcrumb do path
  const pathParts = path.split('/').filter(Boolean)

  return (
    <div className="w-full space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestor de Ficheiros</h1>
          <p className="text-xs text-gray-400 mt-0.5">Explorar directório do site</p>
        </div>
        {/* Selector de domínio */}
        <select value={selectedDomain}
          onChange={e => { setSelectedDomain(e.target.value); setPath(`/home/${e.target.value}/public_html`) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
        </select>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm bg-white border border-gray-200 rounded-lg px-4 py-2">
        <button onClick={() => setPath(`/home/${selectedDomain}/public_html`)}
          className="text-blue-500 hover:text-blue-700 font-medium">home</button>
        {pathParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-gray-400">/</span>
            <button
              onClick={() => setPath('/' + pathParts.slice(0, i + 1).join('/'))}
              className="text-blue-500 hover:text-blue-700">
              {part}
            </button>
          </span>
        ))}
        <button onClick={() => loadFiles(path)} className="ml-auto text-gray-400 hover:text-gray-600">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabela de ficheiros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold text-gray-500 uppercase border-b bg-gray-50">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Permissões</th>
              <th className="px-4 py-3">Tamanho</th>
              <th className="px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {/* Botão voltar */}
            <tr className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
              onClick={() => navigateTo('..')}>
              <td className="px-4 py-2.5 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-yellow-500" />
                <span className="text-blue-600 font-medium">..</span>
              </td>
              <td colSpan={3} className="px-4 py-2.5 text-gray-400 text-xs">Pasta anterior</td>
            </tr>

            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
              </td></tr>
            ) : files.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                Pasta vazia
              </td></tr>
            ) : files.map((f, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {f.isDir
                      ? <FolderOpen className="w-4 h-4 text-yellow-500 shrink-0" />
                      : <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                    {f.isDir ? (
                      <button onClick={() => navigateTo(f.name)}
                        className="text-blue-600 hover:underline font-medium">
                        {f.name}
                      </button>
                    ) : (
                      <span className="text-gray-700">{f.name}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{f.permissions}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{f.size}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{f.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// BACKUP MANAGER SECTION
// ============================================================
export function BackupManagerSection({ sites }: { sites: CyberPanelWebsite[] }) {
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
    if (sites.length > 0 && !selectedDomain) {
      setSelectedDomain(sites[0].domain)
    }
  }, [sites])

  const handleCreate = async () => {
    if (!selectedDomain) return
    setCreating(true)
    const commands: Record<string, string> = {
      full: `mkdir -p /home/backup/full && cyberpanel createBackup --domainName ${selectedDomain} --backupPath /home/backup/full 2>&1`,
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Restore & Download</h1>
          <p className="text-xs text-gray-400 mt-0.5">Gere backups de sites, ficheiros, bases de dados e emails</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedDomain}
            onChange={e => setSelectedDomain(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-52">
            <option value="">Seleccionar domínio...</option>
            {sites.map(s => <option key={s.domain} value={s.domain}>{s.domain}</option>)}
          </select>
          <button onClick={() => loadBackups(selectedDomain)}
            disabled={!selectedDomain || loading}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={handleCreate} disabled={!selectedDomain || creating}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors">
            {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? 'A criar...' : 'Criar Backup'}
          </button>
        </div>
      </div>

      {/* Mensagem */}
      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${msgType === 'success'
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-red-50 text-red-700 border-red-200'
          }`}>{msg}</div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                      <RefreshCw className="w-3 h-3" /> Restaurar
                    </button>
                    <button onClick={() => handleDownload(b.path, b.filename)}
                      className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
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
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
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
export function WordPressInstallSection({ sites }: { sites: CyberPanelWebsite[] }) {
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
    databasePassword: ''
  })

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
    setInstalling(true)
    setMessage('')

    try {
      const response = await fetch('/api/cyberpanel-wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'installWordPress',
          ...form
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setMessage('WordPress instalado com sucesso!')
      } else {
        setMessage(`Erro: ${data.error || 'Falha na instalação'}`)
      }
    } catch (error) {
      setMessage('Erro de conexão com o servidor')
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Instalar WordPress</h1>
        <p className="text-gray-500 mt-1">Instale o WordPress em qualquer domínio com configuração avançada</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {success ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            <span>{message}</span>
          </div>
          {success && (
            <div className="mt-3 flex gap-3">
              <a href={`${getFinalURL()}/wp-admin`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                <ExternalLink className="w-4 h-4" />
                WP Admin
              </a>
              <a href={getFinalURL()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
                <Globe className="w-4 h-4" />
                Ver Site
              </a>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuração do Software */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-blue-500 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Configuração do Software</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Protocolo</label>
              <select
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value as 'http' | 'https' })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="http">http://</option>
                <option value="https">https://</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Domínio</label>
              <select
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Selecione um domínio</option>
                {sites.map((site) => (
                  <option key={site.domain} value={site.domain}>
                    {site.domain}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Diretório</label>
              <input
                type="text"
                value={form.directory}
                onChange={(e) => setForm({ ...form, directory: e.target.value })}
                placeholder="wp (vazio para raiz)"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Versão WordPress</label>
              <select
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              >
                {wordpressVersions.map((version) => (
                  <option key={version} value={version}>
                    WordPress {version}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs font-bold text-gray-600 uppercase mb-1">URL Final</div>
              <div className="text-sm font-mono text-blue-600">{getFinalURL()}</div>
            </div>
          </div>
        </div>

        {/* Configurações do Site */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-blue-500 px-6 py-4">
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Descrição do Site</label>
              <textarea
                value={form.siteDescription}
                onChange={(e) => setForm({ ...form, siteDescription: e.target.value })}
                placeholder="Um site WordPress incrível"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
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
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm"
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Base de Dados */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-blue-500 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Base de Dados</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Nome da Base de Dados</label>
              <input
                type="text"
                value={form.databaseName}
                onChange={(e) => setForm({ ...form, databaseName: e.target.value })}
                placeholder="visualdesign_wp"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Utilizador BD</label>
              <input
                type="text"
                value={form.databaseUser}
                onChange={(e) => setForm({ ...form, databaseUser: e.target.value })}
                placeholder="visualdesign_wpuser"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
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
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm"
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

            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Nota:</strong> A base de dados e o utilizador serão criados automaticamente no servidor
              </p>
            </div>
          </div>
        </div>

        {/* Botão Instalar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <button
            onClick={handleInstall}
            disabled={installing || !form.domain || !form.siteName || !form.adminUsername || !form.adminPassword || !form.adminEmail}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {installing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Instalando WordPress...
              </>
            ) : (
              <>
                <Database className="w-5 h-5" />
                Instalar WordPress
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// WordPress Backup Section
export function WPBackupSection({ sites }: { sites: CyberPanelWebsite[] }) {
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
      const response = await fetch('/api/cyberpanel-wp', {
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
      const response = await fetch('/api/cyberpanel-wp', {
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
      const response = await fetch('/api/cyberpanel-wp', {
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
      const response = await fetch('/api/cyberpanel-wp', {
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Backup WordPress</h1>
        <p className="text-gray-500 mt-1">Crie e gerencie backups de instalações WordPress</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {message.includes('sucesso') ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            <span>{message}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuração de Backup */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-blue-500 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Configurar Backup</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Selecionar Website</label>
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Local backup</label>
              <select
                value={backupLocation}
                onChange={(e) => setBackupLocation(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 lg:col-span-2">
            <div className="border-b border-blue-500 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Backups Disponíveis</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {backups.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
export function DomainManagerSection({ sites, packages = [] }: { sites: CyberPanelWebsite[], packages?: CyberPanelPackage[] }) {
  const [view, setView] = useState<'list' | 'create' | 'manage'>('list')
  const [domains, setDomains] = useState<any[]>([])
  const [selectedDomain, setSelectedDomain] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  // Formulário criar domínio
  const [newDomain, setNewDomain] = useState('')
  const [docRoot, setDocRoot] = useState('')
  const [shareRoot, setShareRoot] = useState(false)
  const [allowedDomains, setAllowedDomains] = useState(0)
  const [ftpAccounts, setFtpAccounts] = useState(0)
  const [selectedPackage, setSelectedPackage] = useState('Default')
  const [selectedPHP, setSelectedPHP] = useState('PHP 8.2')

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }
  const loadDomains = async () => {
    setLoading(true);
    console.log('[loadDomains] Início carregamento...');
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listWebsites', params: {} })
      });
      const json = await res.json();
      console.log('[loadDomains] Resposta API:', json);

      if (json.success && json.data?.sites) {
        const sitesArray = json.data.sites;
        
        // Filtro básico
        const filtered = sitesArray.filter((s: any) =>
          s.domain && 
          !s.domain.includes('contaboserver') &&
          !s.domain.includes('localhost')
        );
        
        setDomains(filtered);
        console.log('[loadDomains] Domínios definidos:', filtered.length);

        // Sincronizar em background para não bloquear a UI
        void (async () => {
          for (const site of sitesArray) {
            try {
              await syncWebsiteToSupabase({
                domain: site.domain,
                adminEmail: site.adminEmail,
                package: site.package,
                status: site.state || 'Active',
              });
            } catch (err) {
              console.warn('[sync] Erro ao sincronizar:', site.domain, err);
            }
          }
        })();
      } else {
        console.warn('[loadDomains] Resposta inválida ou vazia');
        setDomains([]);
      }
    } catch (e: any) {
      console.error('[loadDomains] Erro fatal:', e);
      setMsg('Erro ao carregar domínios: ' + e.message);
      setMsgType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDomains() }, [])

  useEffect(() => {
    if (newDomain) setDocRoot(newDomain)
  }, [newDomain])

  const handleCreate = async () => {
    if (!newDomain) return
    setLoading(true)
    const res = await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createWebsite',
        params: { 
          domain: newDomain, 
          email: 'admin@visualdesigne.com', 
          php: selectedPHP,
          packageName: selectedPackage
        }
      })
    })
    const data = await res.json()
    const output = data.data?.output || ''
    if (output.includes('success') || output.includes('created')) {
      showMsg(`Domínio "${newDomain}" criado com sucesso!`)
      setNewDomain(''); setDocRoot(''); setShareRoot(false)
      setView('list')
      await loadDomains()
    } else {
      showMsg('Erro: ' + output, 'error')
    }
    setLoading(false)
  }

  const handleRemove = async (domain: string) => {
    if (!confirm(`Eliminar "${domain}"? Esta acção é irreversível!`)) return
    setLoading(true)
    await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execCommand',
        params: { command: `cyberpanel deleteWebsite --domainName ${domain} 2>&1` }
      })
    })
    showMsg(`Domínio "${domain}" eliminado!`)
    await loadDomains()
    setView('list')
    setLoading(false)
  }

  // VISTA: LISTA DE DOMÍNIOS
  if (view === 'list') return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Domínios</h1>
          <p className="text-xs text-gray-400 mt-0.5">Lista de domínios registados no servidor</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadDomains} disabled={loading}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Sincronizar
          </button>
          <button onClick={() => setView('create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Adicionar Domínio
          </button>
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${msgType === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>{msg}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold text-gray-500 uppercase border-b bg-gray-50">
              <th className="px-4 py-3">Domínio</th>
              <th className="px-4 py-3">Document Root</th>
              <th className="px-4 py-3">Redirect</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acções</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
              </td></tr>
            ) : domains.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                Nenhum domínio encontrado
              </td></tr>
            ) : domains.map((d, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-blue-600">{d.domain}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">/public_html/{d.domain}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">Not Redirected</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                    Domínio
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setSelectedDomain(d); setView('manage') }}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                      Gerenciar
                    </button>
                    <button onClick={() => {
                      // Navegar para criar email com domínio pré-seleccionado
                    }}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                      Criar Email
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

  // VISTA: CRIAR DOMÍNIO
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
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${msgType === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>{msg}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Criar um Novo Domínio</h2>
        </div>
        <div className="px-6 py-6 space-y-6">

          {/* Domain */}
          <div>
            <label className="block font-bold text-gray-800 mb-1">
              Domain <span className="text-blue-500 cursor-help">?</span>
            </label>
            <p className="text-sm text-gray-500 mb-2">Enter the domain that you would like to create:</p>
            <input value={newDomain} onChange={e => setNewDomain(e.target.value)}
              placeholder="exemplo.com"
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg text-sm bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {/* Package and PHP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-800 mb-1 text-sm">
                Select Package
              </label>
              <select value={selectedPackage} onChange={e => setSelectedPackage(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="Default">Default</option>
                {packages.map((p: any) => (
                  <option key={p.packageName} value={p.packageName}>{p.packageName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-gray-800 mb-1 text-sm">
                Select PHP
              </label>
              <select value={selectedPHP} onChange={e => setSelectedPHP(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option>PHP 7.4</option>
                <option>PHP 8.0</option>
                <option>PHP 8.1</option>
                <option>PHP 8.2</option>
                <option>PHP 8.3</option>
              </select>
            </div>
          </div>

          {/* Share document root */}
          <div className="flex items-start gap-3">
            <input type="checkbox" checked={shareRoot} onChange={e => setShareRoot(e.target.checked)}
              className="mt-1 w-4 h-4 border-2 border-gray-400 rounded" />
            <div>
              <p className="font-bold text-gray-800 text-sm">
                Share document root (/home/visualdesign/public_html) with "visualdesigne.com".
                <span className="text-blue-500 cursor-help ml-1">?</span>
              </p>
              <p className="text-sm text-gray-500">
                If the document root is shared then the created domain will serve the same content as "visualdesigne.com".{' '}
                <strong>This setting is permanent.</strong>
              </p>
            </div>
          </div>

          {/* Document Root */}
          <div>
            <label className="block font-bold text-gray-800 mb-1">
              Document Root (File System Location) <span className="text-blue-500 cursor-help">?</span>
            </label>
            <p className="text-sm text-gray-500 mb-2">Specify the directory where you want the files for this domain to exist.</p>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <span className="bg-gray-100 px-3 py-2.5 text-sm text-gray-600 border-r border-gray-300">🏠 /public_html/</span>
              <input value={docRoot} onChange={e => setDocRoot(e.target.value)}
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none" />
            </div>
          </div>

          {/* Subdomain */}
          <div>
            <label className="block font-bold text-gray-800 mb-1">
              Subdomain <span className="text-blue-500 cursor-help">?</span>
            </label>
            <p className="text-sm text-gray-500 mb-2">An addon domain requires a subdomain in order to use a separate document root.</p>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <input value={newDomain}
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-gray-50" readOnly />
              <span className="bg-gray-100 px-3 py-2.5 text-sm text-gray-600 border-l border-gray-300">.visualdesigne.com</span>
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={!newDomain || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                Submitar
              </button>
              <button onClick={() => { setNewDomain(''); setDocRoot(''); setShareRoot(false) }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors">
                Submit And Create Another
              </button>
            </div>
            <button onClick={() => setView('list')}
              className="text-blue-600 hover:underline text-sm">
              ← Return To Domains
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // VISTA: GERIR DOMÍNIO
  if (view === 'manage' && selectedDomain) return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')}
          className="text-blue-600 hover:underline text-sm font-medium">
          ← List Domains
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-sm text-gray-600">Manage the Domain</span>
      </div>

      <h1 className="text-xl font-bold text-gray-900">
        Manage the "{selectedDomain.domain}" Domain
      </h1>

      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${msgType === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>{msg}</div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Update Domain */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-bold text-gray-700 uppercase text-xs tracking-wide">Update The Domain</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block font-bold text-gray-800 mb-1 text-sm">
                  New Document Root <span className="text-blue-500">?</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Update the directory where you want the files for this domain to exist.</p>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <span className="bg-gray-100 px-3 py-2.5 text-sm text-gray-600 border-r border-gray-300">🏠 /public_html/</span>
                  <input defaultValue={selectedDomain.name}
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                  Update
                </button>
                <button onClick={() => setView('list')}
                  className="text-blue-600 hover:underline text-sm">
                  ← Return To Domains
                </button>
              </div>
            </div>
          </div>

          {/* Remove Domain */}
          <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-red-100 bg-red-50">
              <h2 className="font-bold text-red-700 uppercase text-xs tracking-wide">Remove The Domain</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700 mb-4">
                <strong>Warning:</strong> If you remove the <strong>"{selectedDomain.domain}"</strong> domain, it will permanently delete the domain from your account. You cannot undo this action.
              </p>
              <button onClick={() => handleRemove(selectedDomain.domain)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                <Trash2 className="w-4 h-4" /> Remove Domain
              </button>
            </div>
          </div>
        </div>

        {/* Domain Information */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-bold text-gray-700 uppercase text-xs tracking-wide">Domain Information</h2>
            </div>
            <div className="px-4 py-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Domain:</span>
                <span className="font-medium text-gray-800">{selectedDomain.domain}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Redirects To:</span>
                <span className="text-gray-600">Not Redirected</span>
              </div>
              <div>
                <span className="text-gray-500">Document Root:</span>
                <p className="text-blue-600 text-xs mt-1">🏠 /public_html/{selectedDomain.domain}</p>
              </div>
            </div>
          </div>

          {/* Additional Resources */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-700 text-sm">Additional Resources</h2>
            </div>
            <div className="divide-y divide-gray-50">
              <button className="w-full text-left px-4 py-3 text-blue-600 hover:bg-gray-50 text-sm transition-colors">
                Create An Email Address ↗
              </button>
              <button className="w-full text-left px-4 py-3 text-blue-600 hover:bg-gray-50 text-sm transition-colors">
                Modify The Redirects ↗
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return null
}

// ============================================================
// DEPLOY SECTION
// ============================================================
export function DeploySection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [deploying, setDeploying] = useState(false)
  const [log, setLog] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [gitLog, setGitLog] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('visualdesigne.com')

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
          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
          {activeSites.map(s => (
            <option key={s.domain} value={s.domain}>{s.domain}</option>
          ))}
        </select>
        <button onClick={handleDeploy} disabled={deploying}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors">
          {deploying
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> A fazer deploy...</>
            : <><Upload className="w-4 h-4" /> Deploy</>
          }
        </button>
      </div>

      {/* Status */}
      {status !== 'idle' && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${status === 'success'
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-red-50 text-red-700 border-red-200'
          }`}>
          {status === 'success' ? '✅ Deploy concluído com sucesso!' : '❌ Erro no deploy — ver log abaixo'}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Git Log */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
export function EmailImportSection({ sites }: { sites: CyberPanelWebsite[] }) {
  const [gmailUser, setGmailUser] = useState('')
  const [gmailAppPassword, setGmailAppPassword] = useState('')
  const [destinationEmail, setDestinationEmail] = useState('')
  const [destinationPassword, setDestinationPassword] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ total: 0, copied: 0, currentFolder: '', errors: [] })
  const [showInstructions, setShowInstructions] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Extrair emails dos sites para dropdown
  const availableEmails = sites
    .filter(site => site.domain === 'visualdesigne.com')
    .flatMap(site => {
      // Simular emails existentes - em produção viria da API
      return [
        'info@visualdesigne.com',
        'suport@visualdesigne.com',
        'admin@visualdesigne.com',
        'contato@visualdesigne.com'
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Importar Emails</h1>
          <p className="text-gray-500 mt-1">Importe emails do Gmail para sua conta VisualDesign.</p>
        </div>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {showInstructions ? 'Ocultar' : 'Mostrar'} Instruções
        </button>
      </div>

      {showInstructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 mb-4">Como gerar App Password do Gmail</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Acesse <a href="https://myaccount.google.com/apppasswords" target="_blank" className="underline">myaccount.google.com/apppasswords</a></li>
            <li>Faça login com sua conta Google</li>
            <li>Clique em "Select app" → "Other" e digite "VisualDesign Import"</li>
            <li>Clique em "Generate" para criar a senha</li>
            <li>Copie a senha de 16 caracteres gerada</li>
            <li>Use essa senha no campo "App Password do Gmail"</li>
          </ol>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
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
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
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
            <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-2">Destino (VisualDesign)</h3>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Email Destino</label>
              <select
                value={destinationEmail}
                onChange={(e) => setDestinationEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
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
                placeholder="Password do email VisualDesign"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={handleImport}
            disabled={importing || !gmailUser || !gmailAppPassword || !destinationEmail || !destinationPassword}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-8 py-3 rounded-lg font-bold transition-all flex items-center gap-2"
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
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
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
                className="bg-red-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.copied / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {result && !importing && (
        <div className={`border rounded-xl p-6 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
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
              <div className="mt-4">
                <p className="font-bold text-red-700 mb-2">Erros encontrados:</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-red-600">
                  {result.errors.slice(0, 5).map((error: any, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                  {result.errors.length > 5 && <li>...e mais {result.errors.length - 5} erros</li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
