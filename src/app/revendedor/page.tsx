'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

import {
  LogOut, RefreshCw, ChevronRight, Globe, Lock, Edit, Plus, Search, LockOpen, ExternalLink, Server, Archive, Database, Power, Trash2, Home, Users, Mail, Layout, Shield, Settings, Download, Send, Code, FolderOpen, Upload, X, Zap, Cloud, RotateCcw, FileCode, ArrowLeft, CheckCircle, HardDrive, FileText, AlertCircle, ChevronDown, Globe2, Plug, Layers, List, ChevronLeft, Bell, PauseCircle, Palette, Calendar
} from 'lucide-react'
import { ResellerSidebar } from '@/components/revendedor/ResellerSidebar'
import { ResellerDashboard } from '@/components/revendedor/ResellerDashboard'
import { CpanelDashboard } from '../admin/CpanelDashboard'
import { EmailWebmailSection } from '@/components/dashboard/EmailWebmailSection'
import { WebmailSection } from '@/components/dashboard/WebmailSection'
import {
  SubdomainsSection, DatabasesSection, FTPSection, EmailManagementSection,
  CPUsersSection, SSLSection, SecuritySection, PHPConfigSection,
  APIConfigSection, GitDeploySection, WPListSection, WPPluginsSection,
  ResellerSection, ModifyWebsiteSection, SuspendWebsiteSection,
  DeleteWebsiteSection, DNSNameserverSection, DNSDefaultNSSection,
  DNSCreateZoneSection, DNSDeleteZoneSection, CloudFlareSection,
  DNSResetSection, EmailDeleteSection, EmailLimitsSection,
  EmailForwardingSection, CatchAllEmailSection, PatternForwardingSection,
  PlusAddressingSection, EmailChangePasswordSection, DKIMManagerSection,
  WPRestoreBackupSection, WPRemoteBackupSection, ListSubdomainsSection,
  WebsitePreviewSection, EmailImportSection,
  PackagesSection, DNSZoneEditorSection, FileManagerSection, BackupManagerSection,
  WordPressInstallSection, WPBackupSection, DomainManagerSection, DeploySection,
  SMTPConfigSection
} from '../admin/CyberPanelSections'
import { EmailDiagnosticoSection } from '../admin/EmailDiagnosticoSection'
import { NotificationsSection } from '../admin/NotificationsSection'
import { RenewalsSection } from '../admin/RenewalsSection'
import { TemplatesSection } from '../admin/TemplatesSection'
import { DNSCentralSection } from '../admin/DNSCentralSection'
import { PanelPermissionsConfig } from '../admin/PanelPermissionsConfig'
import { ResellerSettingsSection } from '@/components/revendedor/ResellerSettingsSection'
import { ResellerProfileSection } from '@/components/revendedor/ResellerProfileSection'
import { cyberPanelAPI } from '@/lib/cyberpanel-api'
import { supabase as createClientInstance } from '@/lib/supabase'
import type { CyberPanelWebsite, CyberPanelUser, CyberPanelPackage } from '@/lib/cyberpanel-api'
import { syncWebsiteToSupabase, syncUserToSupabase, syncPackageToSupabase } from '@/lib/supabase-sync'
import { cn } from '@/lib/utils'
import { MailMarketingSection } from '@/components/dashboard/MailMarketingSection'

// Helper global para parse de state
const parseState = (state: any): string => {
  if (state === 1 || state === '1' || state === 'Active') return 'Active'
  if (state === 0 || state === '0' || state === 'Suspended') return 'Suspended'
  return state || 'Active'
}

// Secções que precisam de criar websites
function CreateWebsiteSection({ packages, onRefresh }: { packages: CyberPanelPackage[], onRefresh: () => void }) {
  const { t } = useI18n()
  const [form, setForm] = useState({ domain: '', email: '', username: 'admin', packageName: 'Default', php: '8.2' })
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  const handleCreate = async () => {
    if (!form.domain || !form.email) return
    setCreating(true); setMsg(''); setMsgType('')
    try {
      const ok = await cyberPanelAPI.createWebsite(form)
      setMsg('Website criado com sucesso!')
      setMsgType('success')
      onRefresh()
    } catch (e: any) {
      setMsg('Erro: ' + e.message)
      setMsgType('error')
    }
    setCreating(false)
  }

  return (
    <div className="space-y-6 w-full">
      <div><h1 className="text-3xl font-bold text-gray-900">{t('admin.sites.new')}</h1><p className="text-gray-500 mt-1">{t('admin.sites.newDesc')}</p></div>
      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{t('admin.sites.domain')}</label><input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="exemplo.com" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{t('admin.email.title')}</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@exemplo.com" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">{t('admin.sites.package')}</label>
            <select value={form.packageName} onChange={e => setForm({ ...form, packageName: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option value="Default">Default</option>
              {packages.map(p => <option key={p.packageName} value={p.packageName}>{p.packageName}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">PHP Version</label>
            <select value={form.php} onChange={e => setForm({ ...form, php: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
              <option>7.4</option><option>8.0</option><option>8.1</option><option>8.2</option><option>8.3</option>
            </select>
          </div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded text-sm font-medium ${msg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleCreate} disabled={creating || !form.domain || !form.email} className="bg-black hover:bg-red-600  px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />} {creating ? t('admin.sites.newDesc').split(' ')[0] + '...' : t('admin.sites.new')}
        </button>
      </div>
    </div>
  )
}

// Simple domain list section - shows only domain names (card layout, same as admin)
function ListDomainsSection({ sites, onRefresh, setActiveSection }: {
  sites: CyberPanelWebsite[],
  onRefresh: () => void,
  setActiveSection: (section: string) => void
}) {
  const [search, setSearch] = useState('')

  const filteredSites = search
    ? sites.filter(s => s.domain.toLowerCase().includes(search.toLowerCase()))
    : sites

  const getExpirationDate = (domain: string) => {
    const hash = domain.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const days = (hash % 180) + 30
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toISOString().split('T')[0]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Lista de Domínios</h2>
        <button onClick={onRefresh} className="text-gray-400 hover:text-blue-600 transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar domínios..."
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm w-64" />
        </div>
        <span className="text-sm text-gray-500">{filteredSites.length} domínio(s)</span>
      </div>

      {/* Domain Cards */}
      <div className="space-y-4">
        {filteredSites.map((site) => {
          const domainParts = site.domain.split('.')
          const tld = domainParts.length > 1 ? '.' + domainParts.slice(1).join('.') : ''
          const baseName = domainParts[0]

          return (
            <div key={site.domain} className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100 shrink-0">
                  <Globe className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-gray-900">{baseName}</span>
                    {tld && <span className="font-medium text-sm text-gray-400">{tld}</span>}
                    {(site.sslStatus === 'Secure' || (site as any).ssl === 'Enabled' || (site as any).ssl === true) ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-[10px] font-bold text-green-700">
                        <Lock className="w-3 h-3" /> SSL
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-[10px] font-medium text-gray-400">
                        No SSL
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-medium ${parseState(site.state) === 'Active' ? 'text-green-600' : 'text-red-500'}`}>
                      ● {parseState(site.state) === 'Active' ? 'Ativo' : 'Suspenso'}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-400">Exp: {getExpirationDate(site.domain)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSection('cp-dns-nameserver')}
                  className="px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded transition-colors"
                >
                  Nameservers
                </button>
                <button
                  onClick={() => {
                    // @ts-ignore
                    window.__selectedManageDomain = site.domain;
                    setActiveSection('manage-website');
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                >
                  Gerir
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// WordPress sites list section - shows only WordPress sites with expandable cards
function ListWordPressSection({ sites, onRefresh, setActiveSection, setFileManagerDomain, setSelectedDNSDomain }: {
  sites: CyberPanelWebsite[],
  onRefresh: () => void,
  setActiveSection: (section: string) => void,
  setFileManagerDomain?: (domain: string) => void,
  setSelectedDNSDomain?: (domain: string) => void
}) {
  const [expandedSite, setExpandedSite] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 4
  const [siteDiskInfo, setSiteDiskInfo] = useState<Record<string, string>>({})

  useEffect(() => {
    if (expandedSite && !siteDiskInfo[expandedSite]) {
      const fetchUsage = async () => {
        try {
          const res = await fetch('/api/server-exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'siteDiskUsage', params: { domain: expandedSite } })
          })
          const data = await res.json()
          if (data.success) {
            setSiteDiskInfo(prev => ({ ...prev, [expandedSite]: data.data.usage }))
          }
        } catch (e) { console.error(e) }
      }
      fetchUsage()
    }
  }, [expandedSite])

  // Filter only WordPress sites
  const wordPressSites = sites.filter(s => s.siteType === 'wordpress')
  const filtered = wordPressSites.filter(s =>
    s.domain.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSites = filtered.slice(startIndex, startIndex + itemsPerPage)

  // Expandir automaticamente o primeiro site ao carregar
  useEffect(() => {
    if (paginatedSites.length > 0 && !expandedSite) {
      setExpandedSite(paginatedSites[0].domain)
    }
  }, [paginatedSites, expandedSite])

  const handleDelete = async (domain: string) => {
    if (!confirm(`⚠️ Apagar "${domain}"?\n\nEsta acção é IRREVERSÍVEL!`)) return
    setLoading(domain)
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteWebsite', params: { domain } })
      })
      const data = await res.json()
      if (data.success) {
        await onRefresh()
      } else {
        alert('Erro ao apagar: ' + (data.data?.output || data.error || 'Erro desconhecido'))
      }
    } catch (e: any) {
      alert('Erro de ligação: ' + e.message)
    }
    setLoading(null)
  }

  const handleSuspend = async (domain: string, state: string) => {
    setLoading(domain)
    const action = state === 'Active' ? 'suspendWebsite' : 'unsuspendWebsite'
    await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params: { domain } })
    })
    await onRefresh()
    setLoading(null)
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-900">Sites WordPress ({filtered.length})</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">WordPress Only</span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar sites WordPress..."
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm w-52" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded border border-gray-200">
          <p className="text-gray-500">Nenhum site WordPress encontrado</p>
        </div>
      ) : (
        <>
          {/* Lista de sites como cards expansíveis */}
          <div className="space-y-2">
            {paginatedSites.map((s, i) => (
              <div key={i} className={`bg-white rounded border ${expandedSite === s.domain ? 'border-blue-200 shadow-md' : 'border-gray-200 shadow-sm'} overflow-hidden transition-all`}>

                {/* Linha do site com botões explícitos */}
                <div className="flex items-center justify-between px-4 py-4">

                  {/* Info do site */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedSite(expandedSite === s.domain ? null : s.domain)}
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                      title="Expandir/Colapsar"
                    >
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedSite === s.domain ? 'rotate-90' : ''}`} />
                    </button>
                    <Globe className="w-4 h-4 text-blue-500" />
                    <a href={`https://${s.domain}`} target="_blank"
                      className="text-blue-600 hover:underline font-bold text-sm">
                      {s.domain}
                    </a>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${parseState(s.state) === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {parseState(s.state) || 'Active'}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">WordPress</span>
                    {s.ssl ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                        <Lock className="w-3.5 h-3.5" /> SSL Activo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 text-xs font-bold">
                        <LockOpen className="w-3.5 h-3.5" /> Sem SSL
                      </span>
                    )}
                  </div>

                  {/* Botões */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        // @ts-ignore
                        window.__selectedManageDomain = s.domain;
                        setActiveSection('manage-website');
                      }}
                      className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 px-4 py-1.5 rounded text-xs font-bold transition-all">
                      Gerir
                    </button>
                    <a href={`https://${s.domain}/wp-admin`} target="_blank" rel="noopener noreferrer"
                      className="bg-indigo-50 border border-indigo-300 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> WP Admin
                    </a>
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {expandedSite === s.domain && (
                  <div className="border-t border-gray-100 p-4 space-y-4">

                    {/* Grid de 7 cards: 1 screenshot + 6 info cards */}
                    <div className="grid grid-cols-4 gap-3">

                      {/* COLUNA 1 — Screenshot */}
                      <div className="bg-gray-100 rounded overflow-hidden border border-gray-200 h-36 relative">
                        <img
                          src={`/api/server-exec?action=getScreenshot&domain=${s.domain}`}
                          alt={s.domain}
                          className="w-full h-full object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-site.png'
                          }}
                        />
                      </div>

                      {/* COLUNA 2 — State + Disk Usage */}
                      <div className="flex flex-col gap-3">
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">State</p>
                          <p className="text-sm font-bold text-gray-900">{parseState(s.state) || 'Active'}</p>
                        </div>
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Disk Usage</p>
                          <p className="text-sm font-bold text-gray-900">{siteDiskInfo[s.domain] || '...'}</p>
                        </div>
                      </div>

                      {/* COLUNA 3 — IP + Package */}
                      <div className="flex flex-col gap-3">
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">IP Address</p>
                          <p className="text-sm font-bold text-gray-900">{(s as any).ip || '109.199.104.22'}</p>
                        </div>
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Package</p>
                          <p className="text-sm font-bold text-gray-900">{(s as any).package || 'Default'}</p>
                        </div>
                      </div>

                      {/* COLUNA 4 — PHP + Owner */}
                      <div className="flex flex-col gap-3">
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">PHP Version</p>
                          <p className="text-sm font-bold text-gray-900">{(s as any).phpVersion || 'PHP 8.2'}</p>
                        </div>
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Owner</p>
                          <p className="text-sm font-bold text-gray-900">{(s as any).owner || 'admin'}</p>
                        </div>
                      </div>

                    </div>

                    {/* Botões de acção */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded text-xs font-bold transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Visitar Site
                      </a>
                      <button
                        onClick={async () => {
                          setLoading(s.domain)
                          try {
                            const res = await fetch('/api/server-exec', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'issueSSL', params: { domain: s.domain } })
                            })
                            const data = await res.json()
                            alert(data.success ? '✅ SSL emitido com sucesso!' : '❌ Erro: ' + (data.data?.output || data.error))
                          } catch (e: any) {
                            alert('Erro: ' + e.message)
                          }
                          setLoading(null)
                        }}
                        disabled={loading === s.domain}
                        className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-300 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded text-xs font-bold transition-colors disabled:opacity-50">
                        {loading === s.domain ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                        Issue SSL
                      </button>
                      <button
                        onClick={() => {
                          if (setFileManagerDomain) setFileManagerDomain(s.domain);
                          setTimeout(() => { if (setSelectedDNSDomain) setSelectedDNSDomain(s.domain) }, 50);
                          setActiveSection('file-manager');
                        }}
                        className="flex items-center gap-1.5 bg-purple-50 border border-purple-300 text-purple-600 hover:bg-purple-100 px-4 py-2 rounded text-xs font-bold transition-colors">
                        <FolderOpen className="w-3.5 h-3.5" /> Ficheiros
                      </button>
                      <button
                        onClick={() => {
                          if (setSelectedDNSDomain) setSelectedDNSDomain(s.domain);
                          setActiveSection('domains-dns');
                        }}
                        className="flex items-center gap-1.5 bg-fuchsia-50 border border-fuchsia-300 text-fuchsia-600 hover:bg-fuchsia-100 px-4 py-2 rounded text-xs font-bold transition-colors">
                        <Globe2 className="w-3.5 h-3.5" /> Editar DNS
                      </button>
                      <button
                        onClick={() => setActiveSection('backup-manager')}
                        className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded text-xs font-bold transition-colors">
                        <Archive className="w-3.5 h-3.5" /> Backup
                      </button>
                      <button
                        onClick={() => setActiveSection('databases')}
                        className="flex items-center gap-1.5 bg-cyan-50 border border-cyan-300 text-cyan-600 hover:bg-cyan-100 px-4 py-2 rounded text-xs font-bold transition-colors">
                        <Database className="w-3.5 h-3.5" /> Base de Dados
                      </button>
                      <button
                        onClick={() => handleSuspend(s.domain, parseState(s.state) || 'Active')}
                        disabled={loading === s.domain}
                        className="flex items-center gap-1.5 bg-orange-50 border border-orange-300 text-orange-600 hover:bg-orange-100 px-4 py-2 rounded text-xs font-bold transition-colors disabled:opacity-50">
                        {loading === s.domain ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
                        {parseState(s.state) === 'Active' ? 'Suspender' : 'Reactivar'}
                      </button>
                      <button
                        onClick={() => handleDelete(s.domain)}
                        disabled={loading === s.domain}
                        className="flex items-center gap-1.5 bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 px-4 py-2 rounded text-xs font-bold transition-colors disabled:opacity-50">
                        {loading === s.domain ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Apagar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded text-xs font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded text-xs font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ListWebsitesSection({ sites, onRefresh, packages, setActiveSection, setFileManagerDomain, setSelectedDNSDomain, loadCyberPanelData, syncing, handleSync }: {
  sites: CyberPanelWebsite[],
  onRefresh: () => void,
  packages: CyberPanelPackage[],
  setActiveSection: (section: string) => void,
  setFileManagerDomain: (domain: string) => void,
  setSelectedDNSDomain: (domain: string) => void,
  loadCyberPanelData: () => void,
  syncing: boolean,
  handleSync: () => void
}) {
  const [expandedSite, setExpandedSite] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<{ domain: string, field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 4
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ domain: '', email: '', username: 'admin', packageName: 'Default', php: 'PHP 8.2' })
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')
  const [siteDiskInfo, setSiteDiskInfo] = useState<Record<string, string>>({})

  useEffect(() => {
    if (expandedSite && !siteDiskInfo[expandedSite]) {
      const fetchUsage = async () => {
        try {
          const res = await fetch('/api/server-exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'siteDiskUsage', params: { domain: expandedSite } })
          })
          const data = await res.json()
          if (data.success) {
            setSiteDiskInfo(prev => ({ ...prev, [expandedSite]: data.data.usage }))
          }
        } catch (e) { console.error(e) }
      }
      fetchUsage()
    }
  }, [expandedSite])

  // Filtrar sites activos — tem conteúdo real instalado
  const sitesArray = Array.isArray(sites) ? sites : []
  const filtered = sitesArray.filter(s =>
    s.domain.toLowerCase().includes(search.toLowerCase()) &&
    !s.domain.includes('contaboserver') &&
    !s.domain.toLowerCase().startsWith('mail')
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSites = filtered.slice(startIndex, startIndex + itemsPerPage)

  // Expandir automaticamente o primeiro site ao carregar
  useEffect(() => {
    if (paginatedSites.length > 0 && !expandedSite) {
      setExpandedSite(paginatedSites[0].domain)
    }
  }, [paginatedSites, expandedSite])

  const handleDelete = async (domain: string) => {
    if (!confirm(`⚠️ Apagar "${domain}"?\n\nEsta acção é IRREVERSÍVEL — o site e todos os seus ficheiros serão eliminados do servidor!`)) return
    setLoading(domain)
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteWebsite', params: { domain } })
      })
      const data = await res.json()
      if (data.success) {
        await onRefresh()
      } else {
        alert('Erro ao apagar:\n\n' + (data.data?.output || data.error || 'Erro desconhecido'))
      }
    } catch (e: any) {
      alert('Erro de ligação: ' + e.message)
    }
    setLoading(null)
  }

  const handleSuspend = async (domain: string, state: string) => {
    setLoading(domain)
    const action = state === 'Active' ? 'suspendWebsite' : 'unsuspendWebsite'
    await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params: { domain } })
    })
    await onRefresh()
    setLoading(null)
  }

  const handleSaveField = async (domain: string, field: string, value: string) => {
    setLoading(domain)
    let command = ''

    if (field === 'php') {
      command = `cyberpanel changePHP --domainName ${domain} --phpVersion "${value}" 2>&1`
    } else if (field === 'package') {
      command = `cyberpanel changePackage --domainName ${domain} --packageName "${value}" 2>&1`
    } else {
      // Para outros campos, usa modifyWebsite
      await fetch('/api/server-exec', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'modifyWebsite', params: { domain, [field]: value } })
      })
      setEditingField(null)
      await onRefresh()
      setLoading(null)
      return
    }

    const res = await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'execCommand', params: { command } })
    })
    const data = await res.json()
    if (!data.success) {
      alert('Erro: ' + (data.data?.output || data.error || 'desconhecido'))
    }
    setEditingField(null)
    await onRefresh()
    setLoading(null)
  }

  const EditableField = ({ domain, field, value, label }: { domain: string, field: string, value: string, label: string }) => {
    const isEditing = editingField?.domain === domain && editingField?.field === field
    return (
      <div className="bg-gray-50 rounded p-3 border border-gray-200">
        <p className="text-xs font-bold text-gray-400 uppercase mb-1">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            {field === 'php' ? (
              <select value={editValue} onChange={e => setEditValue(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white flex-1">
                <option>PHP 7.4</option><option>PHP 8.0</option>
                <option>PHP 8.1</option><option>PHP 8.2</option><option>PHP 8.3</option>
              </select>
            ) : field === 'package' ? (
              <select value={editValue} onChange={e => setEditValue(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white flex-1">
                <option>Default</option>
                {packages.map(p => <option key={p.packageName}>{p.packageName}</option>)}
              </select>
            ) : (
              <input value={editValue} onChange={e => setEditValue(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 flex-1" />
            )}
            <button onClick={() => handleSaveField(domain, field, editValue)}
              className="text-xs bg-black  px-2 py-1 rounded font-bold">✓</button>
            <button onClick={() => setEditingField(null)}
              className="text-xs bg-gray-200 px-2 py-1 rounded">✕</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">{value || '-'}</p>
            <button onClick={() => { setEditingField({ domain, field }); setEditValue(value) }}
              className="text-gray-400 hover:text-blue-500 ml-2">
              <Edit className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-900">Websites ({filtered.length})</span>

          <button onClick={() => setShowCreateModal(true)}
            className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 hover:text-green-700 px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5 transition-all">
            <Plus className="w-3 h-3" /> Criar Website
          </button>
          <button onClick={() => {
            const rows = [['Domínio', 'IP', 'Estado', 'Pacote']]
            sites.forEach(s => rows.push([s.domain, '109.199.104.22', s.state || 'Active', (s as any).package || 'Default']))
            const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'websites.csv'; a.click()
          }} className="bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 hover:text-gray-900 px-4 py-2 rounded text-xs font-bold transition-all">
            ↓ Exportar CSV
          </button>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar websites..."
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm w-52" />
        </div>
      </div>

      {msg && <div className="px-4 py-2.5 rounded text-sm bg-green-50 text-green-700 border border-green-200">{msg}</div>}

      {/* Lista de sites como cards expansíveis */}
      <div className="space-y-2">
        {paginatedSites.map((s, i) => (
          <div key={i} className={`bg-white rounded border ${expandedSite === s.domain ? 'border-blue-200 shadow-md' : 'border-gray-200 shadow-sm'} overflow-hidden transition-all`}>

            {/* Linha do site com botões explícitos */}
            <div className="flex items-center justify-between px-4 py-4">

              {/* Info do site */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setExpandedSite(expandedSite === s.domain ? null : s.domain)}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  title="Expandir/Colapsar"
                >
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedSite === s.domain ? 'rotate-90' : ''}`} />
                </button>
                <Globe className="w-4 h-4 text-blue-500" />
                <a href={`https://${s.domain}`} target="_blank"
                  className="text-blue-600 hover:underline font-bold text-sm">
                  {s.domain}
                </a>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${parseState(s.state) === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {parseState(s.state) || 'Active'}
                </span>
                {/* Badge por tipo de site */}
                {s.siteType === 'wordpress' && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">WordPress</span>}
                {s.siteType === 'nextjs' && <span className="px-2 py-0.5 bg-black  rounded-full text-xs font-bold">Next.js</span>}
                {s.siteType === 'html' && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">HTML/PHP</span>}
                {s.ssl ? (
                  <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                    <Lock className="w-3.5 h-3.5" /> SSL Activo
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500 text-xs font-bold">
                    <LockOpen className="w-3.5 h-3.5" /> Sem SSL
                  </span>
                )}
              </div>

              {/* Botões */}
              <div className="flex items-center gap-3">
                {/* Botão GrapesJS Builder */}
                <button
                  onClick={() => window.open(`/revendedor/websites/${s.domain}/builder/grapes`, '_blank')}
                  className="bg-purple-50 border border-purple-300 text-purple-600 hover:bg-purple-100 px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5" /> GrapesJS
                </button>
                
                {/* Botão Craft.js Builder */}
                <button
                  onClick={() => window.open(`/revendedor/websites/${s.domain}/builder/craft`, '_blank')}
                  className="bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Craft.js
                </button>

                {/* Botão Gerir — abre seção de gestão integrada */}
                <button
                  onClick={() => {
                    // @ts-ignore
                    window.__selectedManageDomain = s.domain;
                    setActiveSection('manage-website');
                  }}
                  className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 px-4 py-1.5 rounded text-xs font-bold transition-all">
                  Gerir
                </button>

                {/* Botão Explorar Directório — sem fundo, texto link */}
                <button
                  onClick={() => {
                    setFileManagerDomain(s.domain)
                    setTimeout(() => setActiveSection('file-manager'), 50)
                  }}
                  className="text-gray-600 hover:text-red-600 text-xs font-medium transition-colors underline-offset-2 hover:underline">
                  Explorar directório
                </button>
              </div>
            </div>

            {/* Conteúdo expandido */}
            {expandedSite === s.domain && (
              <div className="border-t border-gray-100 p-4 space-y-4">

                {/* Grid de cards de detalhes editáveis */}
                <div className="grid grid-cols-4 gap-3">

                  {/* COLUNA 1 — Screenshot */}
                  <div className="bg-gray-100 rounded overflow-hidden border border-gray-200 h-36 relative">
                    <img
                      src={`/api/server-exec?action=getScreenshot&domain=${s.domain}`}
                      alt={s.domain}
                      className="w-full h-full object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-site.png'
                      }}
                    />
                  </div>

                  {/* COLUNA 2 — State + Disk Usage */}
                  <div className="flex flex-col gap-3">
                    <EditableField domain={s.domain} field="state" value={parseState(s.state) || 'Active'} label="State" />
                    <div className="bg-gray-50 rounded p-3 border border-gray-200">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Disk Usage</p>
                      <p className="text-sm font-bold text-gray-900">{siteDiskInfo[s.domain] || '...'}</p>
                    </div>
                  </div>

                  {/* COLUNA 3 — IP + Package */}
                  <div className="flex flex-col gap-3">
                    <div className="bg-gray-50 rounded p-3 border border-gray-200">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">IP Address</p>
                      <p className="text-sm font-bold text-gray-900">{(s as any).ip || '109.199.104.22'}</p>
                    </div>
                    <EditableField domain={s.domain} field="package" value={(s as any).package || 'Default'} label="Package" />
                  </div>

                  {/* COLUNA 4 — PHP + Owner */}
                  <div className="flex flex-col gap-3">
                    <EditableField domain={s.domain} field="php" value={(s as any).phpVersion || 'PHP 8.2'} label="PHP Version" />
                    <div className="bg-gray-50 rounded p-3 border border-gray-200">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Owner</p>
                      <p className="text-sm font-bold text-gray-900">{(s as any).owner || 'admin'}</p>
                    </div>
                  </div>

                </div>

                {/* Botões de acção numa linha */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100  px-4 py-2 rounded text-xs font-bold transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Visitar Site
                  </a>
                  <button
                    onClick={async () => {
                      setLoading(s.domain + '-ssl')
                      try {
                        // Primeiro verificar se o domínio resolve para o IP correcto
                        const checkRes = await fetch('/api/server-exec', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'execCommand',
                            params: { command: `dig +short ${s.domain} 2>&1` }
                          })
                        })
                        const checkData = await checkRes.json()
                        const resolvedIP = (checkData.data?.output || '').trim()
                        const serverIP = '109.199.104.22'

                        if (!resolvedIP) {
                          alert(`⚠️ DNS não propagou ainda!\n\nO domínio "${s.domain}" não está a resolver para nenhum IP.\n\nAguarda a propagação DNS (pode demorar até 24h) e tenta novamente.`)
                          setLoading(null)
                          return
                        }

                        if (!resolvedIP.includes(serverIP)) {
                          alert(`⚠️ DNS ainda não propagou!\n\nO domínio "${s.domain}" está a resolver para:\n${resolvedIP}\n\nMas devia resolver para:\n${serverIP}\n\nAguarda a propagação DNS e tenta novamente.`)
                          setLoading(null)
                          return
                        }

                        // DNS está correcto — emitir SSL
                        const sslRes = await fetch('/api/server-exec', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'execCommand',
                            params: { command: `cyberpanel issueSSL --domainName ${s.domain} 2>&1` }
                          })
                        })
                        const sslData = await sslRes.json()
                        const output = sslData.data?.output || ''

                        if (output.toLowerCase().includes('success') || output.toLowerCase().includes('issued')) {
                          alert(`✅ SSL emitido com sucesso para ${s.domain}!`)
                          onRefresh()
                        } else {
                          alert(`⚠️ Erro ao emitir SSL:\n\n${output}`)
                        }

                      } catch (e: any) {
                        alert('Erro: ' + e.message)
                      }
                      setLoading(null)
                    }} disabled={loading === s.domain + '-ssl'}
                    className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-300 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 px-4 py-2 rounded text-xs font-bold transition-colors disabled:opacity-50">
                    <Lock className="w-3.5 h-3.5" /> {loading === s.domain + '-ssl' ? 'A verificar...' : 'Issue SSL'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDNSDomain(s.domain)
                      setActiveSection('domains-dns')
                    }}
                    className="flex items-center gap-1.5 bg-purple-50 border border-purple-300 text-purple-600 hover:bg-purple-100 hover:text-purple-700 px-4 py-2 rounded text-xs font-bold transition-colors">
                    <Server className="w-3.5 h-3.5" /> Editar DNS
                  </button>
                  <button onClick={async () => {
                    setLoading(s.domain + '-backup')
                    try {
                      await fetch('/api/server-exec', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'execCommand',
                          params: { command: `mkdir -p /home/backup/full && cyberpanel createBackup --domainName ${s.domain} --backupPath /home/backup/full 2>&1` }
                        })
                      })
                      alert(`✅ Backup de "${s.domain}" criado com sucesso!\n\nPode ver na página Backups.`)
                    } catch (e: any) {
                      alert('Erro ao criar backup: ' + e.message)
                    }
                    setLoading(null)
                  }}
                    disabled={loading === s.domain + '-backup'}
                    className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-700 px-4 py-2 rounded text-xs font-bold transition-colors disabled:opacity-50">
                    {loading === s.domain + '-backup'
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Archive className="w-3.5 h-3.5" />
                    }
                    {loading === s.domain + '-backup' ? 'A criar...' : 'Backup'}
                  </button>

                  <button
                    onClick={() => {
                      // @ts-ignore
                      window.__selectedDatabaseDomain = s.domain;
                      setActiveSection('cp-databases');
                    }}
                    className="flex items-center gap-1.5 bg-cyan-50 border border-cyan-300 text-cyan-600 hover:bg-cyan-100 hover:text-cyan-700 px-4 py-2 rounded text-xs font-bold transition-colors"
                  >
                    <Database className="w-3.5 h-3.5" /> Base de Dados
                  </button>

                  <button onClick={() => handleSuspend(s.domain, parseState(s.state) || 'Active')}
                    className="flex items-center gap-1.5 bg-orange-50 border border-orange-300 text-orange-600 hover:bg-orange-100 hover:text-orange-700 px-4 py-2 rounded text-xs font-bold transition-colors">
                    <Power className="w-3.5 h-3.5" /> {parseState(s.state) === 'Active' ? 'Suspender' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(s.domain)} disabled={loading === s.domain}
                    className="flex items-center gap-1.5 bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 px-4 py-2 rounded text-xs font-bold transition-colors disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" /> {loading === s.domain ? 'A apagar...' : 'Apagar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded text-xs font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded text-xs font-bold transition-colors ${currentPage === page
                  ? 'bg-red-600 '
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded text-xs font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próximo
          </button>
        </div>
      )}

      {/* Modal de criação de website */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Criar Novo Website</h2>
              <button onClick={() => { setShowCreateModal(false); setCreateMsg('') }}
                className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domínio</label>
                <input value={createForm.domain} onChange={e => setCreateForm({ ...createForm, domain: e.target.value })}
                  placeholder="exemplo.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Email Admin</label>
                <input value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="admin@exemplo.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Pacote</label>
                <select value={createForm.packageName} onChange={e => setCreateForm({ ...createForm, packageName: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
                  <option>Default</option>
                  {packages.map(p => <option key={p.packageName} value={p.packageName}>{p.packageName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Versão PHP</label>
                <select value={createForm.php} onChange={e => setCreateForm({ ...createForm, php: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm">
                  <option>PHP 7.4</option><option>PHP 8.0</option>
                  <option>PHP 8.1</option><option>PHP 8.2</option><option>PHP 8.3</option>
                </select>
              </div>
            </div>
            {createMsg && (
              <div className={`mt-4 px-4 py-2.5 rounded text-sm font-medium ${createMsg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {createMsg}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={async () => {
                if (!createForm.domain || !createForm.email) return
                setCreating(true); setCreateMsg('')
                const res = await fetch('/api/server-exec', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'createWebsite', params: createForm })
                })
                const data = await res.json()
                if (data.success) {
                  setCreateMsg('Website criado com sucesso!')
                  setTimeout(() => { setShowCreateModal(false); setCreateMsg(''); onRefresh() }, 1500)
                } else {
                  setCreateMsg('Erro: ' + (data.data?.output || data.error || 'desconhecido'))
                }
                setCreating(false)
              }} disabled={creating || !createForm.domain || !createForm.email}
                className="flex-1 bg-black hover:bg-red-600  py-2.5 rounded text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? <><RefreshCw className="w-4 h-4 animate-spin" /> A criar...</> : '+ Criar Website'}
              </button>
              <button onClick={() => { setShowCreateModal(false); setCreateMsg('') }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded text-sm font-bold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// CLIENTES SECTION
// ============================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function ClientesSection() {
  const { t } = useI18n()
  const [vista, setVista] = useState<'lista' | 'novo'>('lista')
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState({
    nome: '', email: '', telefone: '', morada: '', website: '', cidade: 'Maputo', pais: 'Moçambique', status: 'active'
  })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const carregarClientes = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?order=created_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setClientes(Array.isArray(data) ? data : [])
    } catch (e) {
      setClientes([])
    }
    setLoading(false)
  }

  useEffect(() => { carregarClientes() }, [])

  const clientesFiltrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  )

  const handleSubmit = async () => {
    setErro('')
    if (!form.nome || !form.email) { setErro(t('admin.clientSection.errorMsg')); return }
    setSalvando(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({ ...form, data_cadastro: new Date().toISOString().split('T')[0] })
      })
      if (res.ok) {
        setSucesso(t('admin.clientSection.successMsg'))
        setForm({ nome: '', email: '', telefone: '', morada: '', website: '', cidade: 'Maputo', pais: 'Moçambique', status: 'active' })
        await carregarClientes()
        setTimeout(() => { setSucesso(''); setVista('lista') }, 1500)
      } else {
        const err = await res.json()
        setErro(err.message || 'Erro ao criar cliente')
      }
    } catch (e: any) {
      setErro(e.message)
    }
    setSalvando(false)
  }

  const inputClass = "w-full bg-white border border-gray-300 rounded px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
  const labelClass = "block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5"

  if (vista === 'novo') return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setVista('lista')} className="text-gray-400 hover: transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold ">{t('admin.clientSection.new')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('admin.clientSection.newDesc')}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded p-6 space-y-4 shadow-sm">
        {erro && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded px-4 py-3 text-sm">{erro}</div>}
        {sucesso && <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded px-4 py-3 text-sm">{sucesso}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>{t('admin.clientSection.name')}</label>
            <input className={inputClass} placeholder={t('admin.clientSection.nameEx')} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.clientSection.email')}</label>
            <input className={inputClass} type="email" placeholder={t('admin.clientSection.emailEx')} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.clientSection.phone')}</label>
            <input className={inputClass} placeholder={t('admin.clientSection.phoneEx')} value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>{t('admin.clientSection.address')}</label>
            <input className={inputClass} placeholder={t('admin.clientSection.addressEx')} value={form.morada} onChange={e => setForm({ ...form, morada: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.clientSection.city')}</label>
            <input className={inputClass} placeholder={t('admin.clientSection.cityEx')} value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.clientSection.website')}</label>
            <input className={inputClass} placeholder={t('admin.clientSection.websiteEx')} value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => setVista('lista')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded transition-colors">
            {t('admin.clientSection.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={salvando} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50  font-medium py-2.5 rounded transition-colors flex items-center justify-center gap-2">
            {salvando ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{t('admin.clientSection.saving')}</> : t('admin.clientSection.create')}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('admin.clientSection.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{clientes.length} {t('admin.clientSection.subtitle')}</p>
        </div>
        <button onClick={() => setVista('novo')} className="bg-blue-600 hover:bg-blue-500  font-medium px-4 py-2 rounded transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t('admin.clientSection.new')}
        </button>
      </div>

      <div className="mb-4">
        <input
          className="w-full bg-white border border-gray-300 rounded px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors shadow-sm"
          placeholder={t('admin.clientSection.search')}
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          {busca ? t('admin.clientSection.notFound') : t('admin.clientSection.empty')}
        </div>
      ) : (
        <div className="grid gap-3">
          {clientesFiltrados.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded px-5 py-4 flex items-center justify-between hover:border-gray-300 hover:shadow-sm transition-all shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-blue-400 font-semibold text-sm flex-shrink-0">
                  {c.nome?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{c.nome}</p>
                  <p className="text-sm text-gray-500">{c.email} {c.telefone ? `· ${c.telefone}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {c.cidade && <span className="text-xs text-gray-600 hidden md:block">{c.cidade}</span>}
                <span className={`text-xs px-2 py-1 rounded-full ${c.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                  {c.status === 'active' ? t('admin.clientSection.active') : t('admin.clientSection.inactive')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// MANAGE WEBSITE SECTION - CyberPanel Management Interface
// ============================================================
function ManageWebsiteSection({
  domain,
  sites,
  setActiveSection,
  setFileManagerDomain,
  setSelectedDNSDomain,
  packages = [],
  onRefresh
}: {
  domain: string
  sites: CyberPanelWebsite[]
  setActiveSection: (section: string) => void
  setFileManagerDomain: (domain: string) => void
  setSelectedDNSDomain: (domain: string) => void
  packages?: CyberPanelPackage[]
  onRefresh?: () => void
}) {
  const [siteData, setSiteData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Persistência no localStorage - chave única por domínio
  const storageKey = `manageWebsiteSections_${domain}`
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : ['apps'] // Apenas primeiro aberto (ordem A-Z: 1-CLICK APPS)
    }
    return ['apps']
  })

  // Modal de criação de domínio
  const [showDomainModal, setShowDomainModal] = useState(false)
  const [domainForm, setDomainForm] = useState({
    domain: '',
    email: '',
    packageName: packages[0]?.packageName || 'Default',
    php: '8.2'
  })
  const [creatingDomain, setCreatingDomain] = useState(false)
  const [domainMsg, setDomainMsg] = useState('')

  // Modal de criação de email (para o domínio específico desta secção)
  const [showDomainEmailModal, setShowDomainEmailModal] = useState(false)
  const [domainEmailForm, setDomainEmailForm] = useState({
    user: '',
    password: '',
    quota: '500'
  })
  const [creatingDomainEmail, setCreatingDomainEmail] = useState(false)
  const [domainEmailMsg, setDomainEmailMsg] = useState('')

  // Salvar estado no localStorage quando mudar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(expandedSections))
    }
  }, [expandedSections, storageKey])

  useEffect(() => {
    const site = sites.find(s => s.domain === domain)
    setSiteData(site || { domain, state: 'Active' })
    setLoading(false)
  }, [domain, sites])

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const isExpanding = !prev.includes(id)
      const newState = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]

      // Se estiver expandindo, manter scroll na posição atual (não auto-scroll)
      if (isExpanding) {
        // Não fazer nada - página mantém-se fixa
      }

      return newState
    })
  }

  // Função para criar email no domínio específico
  const handleCreateDomainEmail = async () => {
    if (!domainEmailForm.user || !domainEmailForm.password) return
    setCreatingDomainEmail(true)
    setDomainEmailMsg('')
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createEmail',
          params: {
            email: `${domainEmailForm.user}@${domain}`,
            password: domainEmailForm.password
          }
        })
      })
      const data = await res.json()
      if (data.success) {
        setDomainEmailMsg('Email criado com sucesso!')
        setDomainEmailForm({ user: '', password: '', quota: '500' })
        setTimeout(() => {
          setShowDomainEmailModal(false)
        }, 1500)
      } else {
        setDomainEmailMsg('Erro: ' + (data.error || 'Falha ao criar email'))
      }
    } catch (e: any) {
      setDomainEmailMsg('Erro: ' + e.message)
    }
    setCreatingDomainEmail(false)
  }

  // Função para criar domínio
  const handleCreateDomain = async () => {
    if (!domainForm.domain || !domainForm.email) return
    setCreatingDomain(true)
    setDomainMsg('')
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createWebsite',
          params: {
            domain: domainForm.domain,
            email: domainForm.email,
            packageName: domainForm.packageName,
            php: domainForm.php
          }
        })
      })
      const data = await res.json()
      if (data.success) {
        setDomainMsg('Domínio criado com sucesso!')
        setDomainForm({ domain: '', email: '', packageName: packages[0]?.packageName || 'Default', php: '8.2' })
        onRefresh?.()
        setTimeout(() => setShowDomainModal(false), 1500)
      } else {
        setDomainMsg('Erro: ' + (data.error || 'Falha ao criar domínio'))
      }
    } catch (e: any) {
      setDomainMsg('Erro: ' + e.message)
    }
    setCreatingDomain(false)
  }

  // ============================================================
  // CUSTOM ICONS (CYBERPANEL STYLE)
  // ============================================================
  const CyberIcon = ({ name, className }: { name: string; className?: string }) => {
    switch (name) {
      case 'email-accounts':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="8" y="16" width="48" height="32" rx="4" fill="#FFD54F" />
            <path d="M8 16L32 36L56 16" stroke="#fff" strokeWidth="2" fill="none" />
          </svg>
        )
      case 'email-forwarding':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="4" y="12" width="36" height="24" rx="2" fill="#E0E0E0" />
            <rect x="24" y="28" width="36" height="24" rx="2" fill="#FFB74D" />
            <path d="M40 22L46 28L40 34" stroke="#4CAF50" strokeWidth="3" fill="none" />
          </svg>
        )
      case 'email-deliverability':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="8" y="16" width="48" height="32" rx="4" fill="#FFD54F" />
            <circle cx="52" cy="44" r="10" fill="#90CAF9" />
            <path d="M48 44L51 47L56 41" stroke="#1565C0" strokeWidth="2" fill="none" />
          </svg>
        )
      case 'file-manager':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <path d="M8 12h16l4 4h28v36H8z" fill="#FFD54F" />
            <circle cx="52" cy="52" r="10" fill="#90CAF9" />
            <path d="M52 48v8M48 52h8" stroke="#1565C0" strokeWidth="2" />
          </svg>
        )
      case 'ftp-accounts':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <path d="M12 12h40v40H12z" fill="#FFB74D" />
            <path d="M32 20v24M24 28l8-8 8 8" stroke="#fff" strokeWidth="4" fill="none" />
          </svg>
        )
      case 'disk-usage':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="12" y="16" width="40" height="32" rx="4" fill="#E0E0E0" />
            <circle cx="52" cy="32" r="12" fill="#4285F4" />
            <path d="M52 32L52 20A12 12 0 0 1 52 44Z" fill="#fff" opacity="0.3" />
          </svg>
        )
      case 'databases':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <ellipse cx="32" cy="16" rx="20" ry="8" fill="#FFB74D" />
            <path d="M12 16v32c0 4.4 9 8 20 8s20-3.6 20-8V16" fill="#FFD54F" />
            <ellipse cx="32" cy="16" rx="20" ry="8" fill="#FFEE58" />
          </svg>
        )
      case 'addon-domains':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <circle cx="32" cy="32" r="24" fill="#4285F4" />
            <path d="M32 8c13 0 24 11 24 24S45 56 32 56 8 45 8 32 19 8 32 8" fill="none" stroke="#fff" strokeWidth="2" opacity="0.5" />
            <circle cx="52" cy="52" r="10" fill="#66BB6A" />
            <path d="M52 48v8M48 52h8" stroke="#fff" strokeWidth="2" />
          </svg>
        )
      case 'dns-zone':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <path d="M32 8l24 40H8z" fill="#90CAF9" />
            <circle cx="32" cy="36" r="8" fill="#4285F4" />
            <circle cx="52" cy="52" r="10" fill="#64B5F6" />
          </svg>
        )
      case 'ssl-tls':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="12" y="24" width="40" height="28" rx="4" fill="#FF7043" />
            <path d="M20 24V16a12 12 0 0 1 24 0v8" stroke="#E0E0E0" strokeWidth="6" fill="none" />
          </svg>
        )
      case 'wordpress':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <circle cx="32" cy="32" r="30" fill="#21759b" />
            <path d="M32 6a26 26 0 1 0 0 52 26 26 0 0 0 0-52zm15 39l-6-17 5-13a22 22 0 0 1 1 30zm-15 2a21 21 0 0 1-13-4l9-25 4 11v18zm-2-33l-5 13-5-13a21 21 0 0 1 10 0zm-14 3a22 22 0 0 1 13-1l-9 25-4-24z" fill="#fff" />
          </svg>
        )
      case 'backups':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="12" y="16" width="40" height="32" rx="4" fill="#BDBDBD" />
            <circle cx="52" cy="48" r="10" fill="#4285F4" />
            <path d="M52 42a6 6 0 1 0 0 12" stroke="#fff" strokeWidth="2" fill="none" />
          </svg>
        )
      case 'git-version':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="12" y="12" width="40" height="40" rx="4" fill="#F05032" />
            <path d="M24 32l8-8 8 8M32 24v16" stroke="#fff" strokeWidth="4" fill="none" />
          </svg>
        )
      case 'mod-security':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="12" y="12" width="40" height="40" rx="4" fill="#FFD54F" />
            <path d="M32 20V44M20 32H44" stroke="#4285F4" strokeWidth="4" />
            <circle cx="52" cy="52" r="10" fill="#90CAF9" />
          </svg>
        )
      case 'ip-blocker':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <circle cx="32" cy="32" r="24" stroke="#F44336" strokeWidth="6" fill="none" />
            <path d="M15 15l34 34" stroke="#F44336" strokeWidth="6" />
            <text x="32" y="38" textAnchor="middle" fill="#F44336" fontSize="12" fontWeight="bold">IP</text>
          </svg>
        )
      case 'cron-jobs':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="12" y="12" width="40" height="40" rx="4" fill="#66BB6A" />
            <circle cx="48" cy="48" r="12" fill="#fff" />
            <path d="M48 40v8h6" stroke="#333" strokeWidth="2" fill="none" />
          </svg>
        )
      case 'metrics':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="8" y="16" width="48" height="32" fill="#fff" stroke="#E0E0E0" strokeWidth="2" />
            <rect x="14" y="32" width="8" height="12" fill="#90CAF9" />
            <rect x="28" y="24" width="8" height="20" fill="#FFB74D" />
            <rect x="42" y="28" width="8" height="16" fill="#66BB6A" />
          </svg>
        )
      case 'mx-entry':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="8" y="16" width="48" height="32" rx="4" fill="#4285F4" />
            <path d="M16 28h32M16 36h32" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          </svg>
        )
      case 'mailing-lists':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <circle cx="32" cy="24" r="12" fill="#FFB74D" />
            <path d="M12 52c0-11 9-20 20-20s20 9 20 20" fill="#FFD54F" />
            <circle cx="48" cy="44" r="8" fill="#90CAF9" />
          </svg>
        )
      case 'phpmyadmin':
        return (
          <svg viewBox="0 0 64 64" className={className}>
            <rect x="8" y="12" width="48" height="40" rx="4" fill="#6C78AF" />
            <path d="M20 24h24M20 32h24M20 40h16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          </svg>
        )
      default:
        return <Globe className={className} />
    }
  }

  const MenuItem = ({
    icon: Icon,
    label,
    description,
    onClick,
    color = 'text-[#2d5a8e]',
    bgColor = 'bg-white',
    badge,
    external = false,
    href
  }: {
    icon: any,
    label: string,
    description?: string,
    onClick?: () => void,
    color?: string,
    bgColor?: string,
    badge?: string,
    external?: boolean,
    href?: string
  }) => {
    const content = (
      <div className="relative group flex flex-col items-center justify-center p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer h-full min-h-[140px]">
        <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
          {typeof Icon === 'string' ? (
            <CyberIcon name={Icon} className="w-16 h-16" />
          ) : (
            <Icon className={cn("w-12 h-12", color)} />
          )}
        </div>
        
        <span className="text-[13px] font-bold text-[#2d5a8e] group-hover:text-blue-600 transition-colors text-center leading-tight">
          {label}
        </span>

        {badge && (
          <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-1 rounded-full shadow-sm z-10">
            {badge}
          </span>
        )}
      </div>
    )

    if (external && href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
          {content}
        </a>
      )
    }

    return (
      <button onClick={onClick} className="block w-full h-full text-center">
        {content}
      </button>
    )
  }

  const SectionCard = ({
    id,
    title,
    icon: Icon,
    color,
    bgColor,
    children
  }: {
    id: string,
    title: string,
    icon: any,
    color: string,
    bgColor: string,
    children: React.ReactNode
  }) => {
    const isExpanded = expandedSections.includes(id)

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className={`${bgColor} ${color} p-2 rounded-lg`}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-800 text-base tracking-tight">{title}</h3>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            {isExpanded ? (
              <ChevronRight className="w-4 h-4 rotate-90 transition-transform" />
            ) : (
              <ChevronRight className="w-4 h-4 transition-transform" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="p-6 bg-[#f8fafc]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
              {children}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-16 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-48 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">

      {/* 1-Click Apps Section */}
      <SectionCard
        id="apps"
        title="1-CLICK APPS"
        icon={Zap}
        color="text-violet-700"
        bgColor="bg-violet-50"
      >
        <MenuItem icon="wordpress" label="WordPress" onClick={() => setActiveSection('wordpress-install')} badge="1-CLICK" />
        <MenuItem icon="git-version" label="Git Integration" onClick={() => setActiveSection('git-deploy')} />
        <MenuItem icon={Globe} label="PrestaShop" color="text-pink-600" external href={`https://109.199.104.22:8090/websites/installApp?domain=${domain}&app=prestashop`} badge="E-COMMERCE" />
        <MenuItem icon={Mail} label="Mautic" color="text-purple-600" external href={`https://109.199.104.22:8090/websites/installApp?domain=${domain}&app=mautic`} />
      </SectionCard>

      {/* Backup Section */}
      <SectionCard
        id="backup"
        title="BACKUP"
        icon={Archive}
        color="text-teal-700"
        bgColor="bg-teal-50"
      >
        <MenuItem icon="backups" label="Create Backup" onClick={() => setActiveSection('cp-wp-backup')} />
        <MenuItem icon="backups" label="Restore Backup" onClick={() => setActiveSection('cp-wp-restore-backup')} />
        <MenuItem icon="backups" label="Remote Backup" onClick={() => setActiveSection('cp-wp-remote-backup')} />
        <MenuItem icon="backups" label="Backup Manager" onClick={() => setActiveSection('backup-manager')} />
      </SectionCard>

      {/* Configurations Section */}
      <SectionCard
        id="configs"
        title="CONFIGURATIONS"
        icon={Settings}
        color="text-cyan-700"
        bgColor="bg-cyan-50"
      >
        <MenuItem icon={Server} label="Apache Manager" color="text-cyan-600" external href={`https://109.199.104.22:8090/apacheManager/index?domain=${domain}`} />
        <MenuItem icon="file-manager" label="vHost Conf" color="text-cyan-600" external href={`https://109.199.104.22:8090/vhostTemplate/index?domain=${domain}`} />
        <MenuItem icon={Edit} label="Rewrite Rules" color="text-cyan-600" external href={`https://109.199.104.22:8090/website/rewriteRules?domain=${domain}`} />
        <MenuItem icon="ssl-tls" label="Add SSL" color="text-cyan-600" onClick={() => setActiveSection('cp-ssl')} />
        <MenuItem icon={Code} label="Change PHP" color="text-cyan-600" onClick={() => setActiveSection('cp-php')} />
      </SectionCard>

      {/* Databases Section */}
      <SectionCard
        id="databases"
        title="DATABASES"
        icon={Database}
        color="text-orange-700"
        bgColor="bg-orange-50"
      >
        <MenuItem icon="databases" label="Create Database" onClick={() => { setSelectedDNSDomain(domain); setActiveSection('cp-databases'); }} />
        <MenuItem icon="databases" label="Manage Databases" onClick={() => { setSelectedDNSDomain(domain); setActiveSection('cp-databases'); }} />
        <MenuItem icon="phpmyadmin" label="phpMyAdmin" external href="https://109.199.104.22:8090/dataBases/phpMyAdmin" />
      </SectionCard>

      {/* DNS Section */}
      <SectionCard
        id="dns"
        title="DNS"
        icon={Server}
        color="text-yellow-700"
        bgColor="bg-yellow-50"
      >
        <MenuItem icon="dns-zone" label="Edit DNS Zone" onClick={() => { setSelectedDNSDomain(domain); setActiveSection('domains-dns'); }} />
        <MenuItem icon="dns-zone" label="Create Zone" onClick={() => setActiveSection('cp-dns-create-zone')} />
        <MenuItem icon="dns-zone" label="Delete Zone" onClick={() => setActiveSection('cp-dns-delete-zone')} />
        <MenuItem icon="dns-zone" label="CloudFlare" onClick={() => setActiveSection('cp-dns-cloudflare')} />
      </SectionCard>

      {/* Domains Section - Resumida */}
      <SectionCard
        id="domains"
        title="DOMAINS"
        icon={Globe}
        color="text-blue-700"
        bgColor="bg-blue-50"
      >
        <MenuItem icon="addon-domains" label="Add Domains" onClick={() => setShowDomainModal(true)} />
        <MenuItem icon="addon-domains" label="List Domains" onClick={() => setActiveSection('domains-list')} />
        <MenuItem icon="addon-domains" label="Domain Alias" onClick={() => setActiveSection('cp-list-subdomains')} />
        <MenuItem icon="cron-jobs" label="Cron Jobs" external href={`https://109.199.104.22:8090/Cron/CronManager?domain=${domain}`} />
      </SectionCard>

      {/* Email Marketing Section */}
      <SectionCard
        id="email"
        title="EMAIL MARKETING"
        icon={Mail}
        color="text-indigo-700"
        bgColor="bg-indigo-50"
      >
        <MenuItem icon="mailing-lists" label="Create Lists" onClick={() => setActiveSection('newsletter')} />
        <MenuItem icon="mailing-lists" label="Manage Lists" onClick={() => setActiveSection('newsletter')} />
        <MenuItem icon={Server} label="SMTP Hosts" color="text-indigo-600" onClick={() => setActiveSection('setup-smtp')} />
        <MenuItem icon="email-accounts" label="Compose" onClick={() => setActiveSection('newsletter')} />
        <MenuItem icon="email-accounts" label="Send Emails" onClick={() => setActiveSection('newsletter')} />
      </SectionCard>

      {/* Emails Section */}
      <SectionCard
        id="email-mgmt"
        title="EMAILS"
        icon={Mail}
        color="text-rose-700"
        bgColor="bg-rose-50"
      >
        <MenuItem icon="email-accounts" label="Create Email" onClick={() => { setDomainEmailForm({ user: '', password: '', quota: '500' }); setShowDomainEmailModal(true); }} />
        <MenuItem icon="email-accounts" label="List Emails" onClick={() => setActiveSection('cp-email-mgmt')} />
        <MenuItem icon="email-accounts" label="Webmail" external href={`https://${domain}:8090/snappymail`} />
        <MenuItem icon="email-forwarding" label="Forwarding" onClick={() => setActiveSection('cp-email-forwarding')} />
        <MenuItem icon="email-deliverability" label="DKIM Manager" onClick={() => setActiveSection('cp-email-dkim')} />
      </SectionCard>

      {/* Files Section - Resumida */}
      <SectionCard
        id="files"
        title="FILES"
        icon={FolderOpen}
        color="text-emerald-700"
        bgColor="bg-emerald-50"
      >
        <MenuItem icon="file-manager" label="File Manager" onClick={() => { setFileManagerDomain(domain); setActiveSection('file-manager'); }} />
        <MenuItem icon="file-manager" label="open_basedir" external href={`https://109.199.104.22:8090/website/openBasedir?domain=${domain}`} />
        <MenuItem icon="ftp-accounts" label="Create FTP" onClick={() => setActiveSection('cp-ftp')} />
        <MenuItem icon="ftp-accounts" label="Delete FTP" onClick={() => setActiveSection('cp-ftp')} />
      </SectionCard>

      {/* Logs Section */}
      <SectionCard
        id="logs"
        title="LOGS"
        icon={FileText}
        color="text-amber-700"
        bgColor="bg-amber-50"
      >
        <MenuItem icon="metrics" label="Access Logs" external href={`https://109.199.104.22:8090/websites/viewAccessLogs?domain=${domain}`} />
        <MenuItem icon="metrics" label="Error Logs" external href={`https://109.199.104.22:8090/websites/viewErrorLogs?domain=${domain}`} />
      </SectionCard>

      {/* Security Section */}
      <SectionCard
        id="security"
        title="SECURITY"
        icon={Shield}
        color="text-red-700"
        bgColor="bg-red-50"
      >
        <MenuItem icon="ssl-tls" label="SSL / TLS" onClick={() => setActiveSection('cp-ssl')} />
        <MenuItem icon="mod-security" label="Firewall" onClick={() => setActiveSection('cp-security')} />
        <MenuItem icon="ip-blocker" label="Blocked IPs" onClick={() => setActiveSection('cp-security')} />
        <MenuItem icon="ssl-tls" label="Hotlink Protection" external href={`https://109.199.104.22:8090/website/hotlinkProtection?domain=${domain}`} />
      </SectionCard>

      {/* WordPress Section */}
      <SectionCard
        id="wordpress"
        title="WORDPRESS"
        icon={Globe2}
        color="text-blue-700"
        bgColor="bg-blue-50"
      >
        <MenuItem icon="wordpress" label="Install WP" onClick={() => setActiveSection('wordpress-install')} badge="1-CLICK" />
        <MenuItem icon="wordpress" label="WP Admin" external href={`https://${domain}/wp-admin`} />
        <MenuItem icon="wordpress" label="Plugins" onClick={() => setActiveSection('cp-wp-plugins')} />
        <MenuItem icon="backups" label="Backup" onClick={() => setActiveSection('cp-wp-backup')} />
        <MenuItem icon="backups" label="Restore" onClick={() => setActiveSection('cp-wp-restore-backup')} />
      </SectionCard>

      {/* Modal de Criação de Domínio */}
      {showDomainModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDomainModal(false)} />
          <div className="relative bg-white border border-gray-200 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Globe className="w-5 h-5 " />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Novo Domínio</h2>
                  <span className="text-[11px] text-gray-500 font-mono">Criar website no CyberPanel</span>
                </div>
              </div>
              <button onClick={() => setShowDomainModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Nome do Domínio</label>
                <input
                  value={domainForm.domain}
                  onChange={e => setDomainForm({ ...domainForm, domain: e.target.value })}
                  placeholder="exemplo.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Email do Administrador</label>
                <input
                  value={domainForm.email}
                  onChange={e => setDomainForm({ ...domainForm, email: e.target.value })}
                  placeholder="admin@exemplo.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Pacote</label>
                  <select
                    value={domainForm.packageName}
                    onChange={e => setDomainForm({ ...domainForm, packageName: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    {packages.map(p => (
                      <option key={p.packageName} value={p.packageName}>{p.packageName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Versão PHP</label>
                  <select
                    value={domainForm.php}
                    onChange={e => setDomainForm({ ...domainForm, php: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="7.4">PHP 7.4</option>
                    <option value="8.0">PHP 8.0</option>
                    <option value="8.1">PHP 8.1</option>
                    <option value="8.2">PHP 8.2</option>
                    <option value="8.3">PHP 8.3</option>
                  </select>
                </div>
              </div>
              {domainMsg && (
                <div className={`p-3 rounded text-sm ${domainMsg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {domainMsg}
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button onClick={() => setShowDomainModal(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreateDomain}
                disabled={creatingDomain || !domainForm.domain || !domainForm.email}
                className="bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100  px-4 py-2 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {creatingDomain ? <><RefreshCw className="w-4 h-4 animate-spin" /> Criando...</> : '+ Criar Domínio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação de Email (Domínio Específico) */}
      {showDomainEmailModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDomainEmailModal(false)} />
          <div className="relative bg-white border border-gray-200 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-600 rounded flex items-center justify-center shadow-lg shadow-rose-500/20">
                  <Mail className="w-5 h-5 " />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Novo E-mail</h2>
                  <span className="text-[11px] text-gray-500 font-mono">No domínio: {domain}</span>
                </div>
              </div>
              <button onClick={() => setShowDomainEmailModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Username</label>
                <div className="flex items-center gap-2">
                  <input
                    value={domainEmailForm.user}
                    onChange={e => setDomainEmailForm({ ...domainEmailForm, user: e.target.value })}
                    placeholder="admin"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                  />
                  <span className="text-gray-500 text-sm">@{domain}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
                  <input
                    type="password"
                    value={domainEmailForm.password}
                    onChange={e => setDomainEmailForm({ ...domainEmailForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quota (MB)</label>
                  <select
                    value={domainEmailForm.quota}
                    onChange={e => setDomainEmailForm({ ...domainEmailForm, quota: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                  >
                    <option value="500">500 MB</option>
                    <option value="1000">1 GB</option>
                    <option value="2000">2 GB</option>
                    <option value="5000">5 GB</option>
                    <option value="10000">10 GB</option>
                    <option value="unlimited">Ilimitado</option>
                  </select>
                </div>
              </div>
              {domainEmailMsg && (
                <div className={`p-3 rounded text-sm ${domainEmailMsg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {domainEmailMsg}
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button onClick={() => setShowDomainEmailModal(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreateDomainEmail}
                disabled={creatingDomainEmail || !domainEmailForm.user || !domainEmailForm.password}
                className="bg-rose-600 hover:bg-rose-700  px-4 py-2 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {creatingDomainEmail ? <><RefreshCw className="w-4 h-4 animate-spin" /> Criando...</> : '+ Criar Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResellerPage() {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [fileManagerDomain, setFileManagerDomain] = useState('')
  const [cyberPanelSites, setCyberPanelSites] = useState<CyberPanelWebsite[]>([])
  const [cyberPanelUsers, setCyberPanelUsers] = useState<CyberPanelUser[]>([])
  const [cyberPanelPackages, setCyberPanelPackages] = useState<CyberPanelPackage[]>([])
  const [isFetchingCyberPanel, setIsFetchingCyberPanel] = useState(false)
  const [selectedDatabaseDomain, setSelectedDatabaseDomain] = useState('')
  const [selectedManageDomain, setSelectedManageDomain] = useState<string>('')
  const [preSelectedEmailDomain, setPreSelectedEmailDomain] = useState<string>('')
  const [sessionUser, setSessionUser] = useState<string | null>(null)
  const [isComposeActive, setIsComposeActive] = useState(false)
  const [mailMarketingTab, setMailMarketingTab] = useState<'comp' | 'subs' | 'camp'>('comp')
  const [logoUrl, setLogoUrl] = useState<string>('/assets/simbolo.png');

  useEffect(() => {
    const savedLogo = localStorage.getItem('reseller_custom_logo');
    if (savedLogo) setLogoUrl(savedLogo);
  }, []);

  const searchParams = useSearchParams();
  const initialLoadDone = useRef(false);

  // Efeito para capturar section da URL - garantir dashboard como padrão
  useEffect(() => {
    // Sempre definir dashboard como padrão na carga inicial/recarga da página
    if (!initialLoadDone.current) {
      setActiveSection('dashboard');
      initialLoadDone.current = true;
      // Limpar qualquer parâmetro section da URL ao recarregar
      if (window.location.search.includes('section=')) {
        window.history.replaceState({}, '', '/revendedor');
      }
      return;
    }

    // Após a carga inicial, permitir navegação por parâmetros de URL (ex: links externos)
    const section = searchParams.get('section');
    if (section) {
      setActiveSection(section);
    }
  }, [searchParams]);

  // Efeito para capturar domínio vindo do botão "Base de Dados"
  useEffect(() => {
    // @ts-ignore
    if (window.__selectedDatabaseDomain && activeSection === 'cp-databases') {
      // @ts-ignore
      setSelectedDatabaseDomain(window.__selectedDatabaseDomain);
      // @ts-ignore
      window.__selectedDatabaseDomain = null;
    } else if (activeSection !== 'cp-databases') {
      setSelectedDatabaseDomain('');
    }
  }, [activeSection]);

  // Efeito para capturar domínio vindo do botão "Gerir"
  useEffect(() => {
    // @ts-ignore
    if (window.__selectedManageDomain && activeSection === 'manage-website') {
      // @ts-ignore
      setSelectedManageDomain(window.__selectedManageDomain);
      // @ts-ignore
      window.__selectedManageDomain = null;
    } else if (activeSection !== 'manage-website') {
      setSelectedManageDomain('');
    }
  }, [activeSection]);

  // Efeito para limpar preSelectedEmailDomain quando sair da seção de email
  useEffect(() => {
    if (!activeSection.includes('email') && !activeSection.includes('cp-email')) {
      setPreSelectedEmailDomain('');
    }
  }, [activeSection]);

  // Obter sessão do usuário
  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await createClientInstance.auth.getSession()
        if (session?.user?.email) {
          setSessionUser(session.user.email)
        }
      } catch (error) {
        console.error('Erro ao obter sessão:', error)
      }
    }
    getSession()
  }, [])

  const [syncing, setSyncing] = useState(false)
  const [selectedDNSDomain, setSelectedDNSDomain] = useState<string>('')
  const [dashboardSearch, setDashboardSearch] = useState('')

  // Modal de criação de email (movido para nível do AdminPage)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailForm, setEmailForm] = useState({
    user: '',
    password: '',
    quota: '500'
  })
  const [creatingEmail, setCreatingEmail] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

  useEffect(() => {
    loadCyberPanelData()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const sites = await cyberPanelAPI.listWebsites()
      if (Array.isArray(sites)) {
        setCyberPanelSites(sites)
        // Background sync
        void (async () => {
          for (const s of sites) {
            await syncWebsiteToSupabase(s)
          }
        })()
      }
    } catch (e) { console.error(e) }
    setSyncing(false)
  }

  const loadCyberPanelData = async () => {
    setIsFetchingCyberPanel(true)
    try {
      const [sites, users, packages] = await Promise.all([
        cyberPanelAPI.listWebsites().catch(() => []),
        cyberPanelAPI.listUsers().catch(() => []),
        cyberPanelAPI.listPackages().catch(() => []),
      ])

      const validSites = Array.isArray(sites) ? sites : []
      const validUsers = Array.isArray(users) ? users : []
      const validPackages = Array.isArray(packages) ? packages : []

      setCyberPanelSites(validSites)
      setCyberPanelUsers(validUsers)
      setCyberPanelPackages(validPackages)

      // Background Sync to Supabase
      void (async () => {
        for (const s of validSites) await syncWebsiteToSupabase(s)
        for (const u of validUsers) await syncUserToSupabase({
          username: u.userName,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          acl: u.acl,
          websitesLimit: u.websitesLimit,
          status: u.status
        })
        for (const p of validPackages) await syncPackageToSupabase(p)
      })()

    } catch (error) {
      console.error('Erro ao carregar dados CyberPanel:', error)
    } finally {
      setIsFetchingCyberPanel(false)
    }
  }

  // Definir domínio principal - filtrar contaboserver e domínios que começam com mail.
  const filteredSites = cyberPanelSites.filter(s =>
    !s.domain.includes('contaboserver') &&
    !s.domain.toLowerCase().startsWith('mail.')
  )
  const primaryDomain = filteredSites.length > 0
    ? filteredSites[0].domain
    : 'your-domain.com'

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'domains', label: 'Websites', icon: Globe },
    { id: 'cp-users', label: 'Contas', icon: Users },
    { id: 'webmail', label: 'Webmail (Caixa)', icon: Mail },
    { id: 'emails-new', label: 'Emails (Gestão)', icon: Mail },
    { id: 'newsletter', label: 'Marketing / News', icon: Layout },
    { id: 'git-deploy', label: 'Deploy / GitHub', icon: Download },
    { id: 'cp-api', label: 'Configurações', icon: Settings },
  ]

  const currentSidebarWidth = isCollapsed ? 80 : 250

  const getSectionInfo = (section: string): { title: string; description: string } => {
    const info: Record<string, { title: string; description: string }> = {
      'dashboard': { title: 'Dashboard', description: 'Painel de controlo principal' },
      'domains': { title: 'Dashboard', description: 'Gestão de websites e domínios' },
      'domains-list': { title: 'Dashboard', description: 'Listar todos os websites' },
      'domains-new': { title: 'Dashboard', description: 'Criar novo website' },
      'file-manager': { title: 'Dashboard', description: 'Gestão de ficheiros' },
      'cp-file-manager': { title: 'Dashboard', description: 'Gestor de ficheiros CyberPanel' },
      'clientes': { title: 'Dashboard', description: 'Gestão de clientes' },
      'cp-subdomains': { title: 'Dashboard', description: 'Gestão de subdomínios' },
      'cp-list-subdomains': { title: 'Dashboard', description: 'Listar subdomínios' },
      'cp-databases': { title: 'Dashboard', description: 'Gestão de bases de dados' },
      'cp-ftp': { title: 'Dashboard', description: 'Gestão de contas FTP' },
      'cp-users': { title: 'Dashboard', description: 'Utilizadores CyberPanel' },
      'cp-php': { title: 'Dashboard', description: 'Configuração PHP' },
      'cp-security': { title: 'Dashboard', description: 'Segurança e Firewall' },
      'cp-ssl': { title: 'Dashboard', description: 'Certificados SSL' },
      'cp-api': { title: 'Dashboard', description: 'Configurações da API' },
      'git-deploy': { title: 'Dashboard', description: 'Deploy e GitHub' },
      'emails-new': { title: 'Dashboard', description: 'Gestão de e-mails' },
      'emails-webmail': { title: 'Dashboard', description: 'Acesso ao webmail' },
      'webmail': { title: 'Dashboard', description: 'Webmail' },
      'cp-email-mgmt': { title: 'Dashboard', description: 'Listar contas de e-mail' },
      'cp-email-delete': { title: 'Dashboard', description: 'Apagar e-mails' },
      'cp-email-forwarding': { title: 'Dashboard', description: 'Encaminhamento de e-mails' },
      'cp-email-catchall': { title: 'Dashboard', description: 'Catch-All' },
      'cp-email-pattern-fwd': { title: 'Dashboard', description: 'Pattern Forwarding' },
      'cp-email-plus-addr': { title: 'Dashboard', description: 'Plus Addressing' },
      'cp-email-change-pass': { title: 'Dashboard', description: 'Alterar password de e-mail' },
      'cp-email-dkim': { title: 'Dashboard', description: 'Gestão de DKIM' },
      'cp-email-limits': { title: 'Dashboard', description: 'Limites de e-mail' },
      'setup-smtp': { title: 'Dashboard', description: 'Configurar SMTP' },
      'cp-wp-list': { title: 'Dashboard', description: 'Painel WordPress' },
      'cp-wp-plugins': { title: 'Dashboard', description: 'Plugins WordPress' },
      'cp-wp-backup': { title: 'Dashboard', description: 'Backup WordPress' },
      'cp-wp-restore-backup': { title: 'Dashboard', description: 'Restaurar backup WordPress' },
      'cp-wp-remote-backup': { title: 'Dashboard', description: 'Backup remoto WordPress' },
      'wordpress-install': { title: 'Dashboard', description: 'Instalar WordPress' },
      'wordpress-deploy': { title: 'Dashboard', description: 'Deploy WordPress' },
      'cp-modify-website': { title: 'Dashboard', description: 'Modificar website' },
      'cp-suspend-website': { title: 'Dashboard', description: 'Suspender website' },
      'cp-delete-website': { title: 'Dashboard', description: 'Apagar website' },
      'domain-manager': { title: 'Dashboard', description: 'Gestor de domínios' },
      'website-preview': { title: 'Dashboard', description: 'Preview de website' },
      'manage-website': { title: 'Gestão de Website', description: 'Gerir website e serviços' },
      'email-import': { title: 'Dashboard', description: 'Importar e-mails' },
      'packages-list': { title: 'Dashboard', description: 'Listar pacotes' },
      'packages-new': { title: 'Dashboard', description: 'Criar novo pacote' },
      'cp-reseller': { title: 'Dashboard', description: 'Centro de revenda' },
      'cp-dns-nameserver': { title: 'Dashboard', description: 'Nameservers' },
      'cp-dns-default-ns': { title: 'Dashboard', description: 'NS padrão' },
      'cp-dns-create-zone': { title: 'Dashboard', description: 'Criar zona DNS' },
      'cp-dns-delete-zone': { title: 'Dashboard', description: 'Apagar zona DNS' },
      'domains-dns': { title: 'Dashboard', description: 'Gestão de zona DNS' },
      'cp-dns-cloudflare': { title: 'Dashboard', description: 'CloudFlare' },
      'cp-dns-reset': { title: 'Dashboard', description: 'Reset DNS' },
      'dns-central': { title: 'DNS Central', description: 'Gestão unificada Mozserver ↔ Contabo' },
      'newsletter': { title: 'Dashboard', description: 'Email marketing' },
      'backup-manager': { title: 'Dashboard', description: 'Gestão de backups' },
      'infrastructure': { title: 'Dashboard', description: 'Infraestrutura' },
      'reports': { title: 'Dashboard', description: 'Relatórios' },
      'analyses': { title: 'Dashboard', description: 'Análises' },
    }
    return info[section] || { title: 'Dashboard', description: 'Painel de controlo' }
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <ResellerDashboard
          sites={filteredSites}
          isFetching={isFetchingCyberPanel}
          onNavigate={setActiveSection}
          onRefresh={loadCyberPanelData}
          onSetDNSDomain={setSelectedDNSDomain}
          onSetFileManagerDomain={setFileManagerDomain}
          sessionUser={sessionUser}
        />
      case 'domains':
        return <ListWebsitesSection
          sites={filteredSites}
          onRefresh={loadCyberPanelData}
          packages={cyberPanelPackages}
          setActiveSection={setActiveSection}
          setFileManagerDomain={setFileManagerDomain}
          setSelectedDNSDomain={setSelectedDNSDomain}
          loadCyberPanelData={loadCyberPanelData}
          syncing={syncing}
          handleSync={handleSync}
        />
      case 'domains-list':
        return <ListDomainsSection
          sites={filteredSites}
          onRefresh={loadCyberPanelData}
          setActiveSection={setActiveSection}
        />
      case 'file-manager':
      case 'cp-file-manager':
        return <FileManagerSection domain={fileManagerDomain || 'your-domain.com'} sites={cyberPanelSites} />
      case 'clientes':
        return <ClientesSection />
      case 'domains-new':
        return <CreateWebsiteSection packages={cyberPanelPackages} onRefresh={loadCyberPanelData} />
      case 'cp-subdomains':
        return <SubdomainsSection sites={filteredSites} />
      case 'website-preview':
        return <WebsitePreviewSection sites={filteredSites} />
      case 'email-import':
        return <EmailImportSection sites={filteredSites} />
      case 'cp-list-subdomains':
        return <ListSubdomainsSection sites={filteredSites} />
      case 'cp-modify-website':
        return <ModifyWebsiteSection sites={filteredSites} packages={cyberPanelPackages} />
      case 'cp-suspend-website':
        return <SuspendWebsiteSection sites={filteredSites} onRefresh={loadCyberPanelData} />
      case 'cp-delete-website':
        return <DeleteWebsiteSection sites={filteredSites} onRefresh={loadCyberPanelData} />
      case 'cp-databases':
        return <DatabasesSection sites={filteredSites} initialDomain={selectedDatabaseDomain} />
      case 'cp-ftp':
        return <FTPSection sites={filteredSites} />
      case 'webmail':
      case 'emails-webmail':
        return <WebmailSection
          userEmail={sessionUser}
          sites={filteredSites}
          useCyberPanelAPI={true}
          emailOrigem="geral@visualdesigne.com"
          onComposeStateChange={setIsComposeActive}
          isAdmin={true}
        />
      case 'emails-new':
      case 'cp-email-mgmt':
        return <EmailManagementSection sites={filteredSites} preSelectedDomain={preSelectedEmailDomain} />
      case 'cp-email-delete':
        return <EmailDeleteSection sites={filteredSites} />
      case 'cp-email-limits':
        return <EmailLimitsSection sites={filteredSites} />
      case 'cp-email-forwarding':
        return <EmailForwardingSection sites={filteredSites} />
      case 'cp-email-catchall':
        return <CatchAllEmailSection sites={filteredSites} />
      case 'cp-email-pattern-fwd':
        return <PatternForwardingSection sites={filteredSites} />
      case 'cp-email-plus-addr':
        return <PlusAddressingSection sites={filteredSites} />
      case 'cp-email-change-pass':
        return <EmailChangePasswordSection sites={filteredSites} />
      case 'cp-email-dkim':
        return <DKIMManagerSection sites={filteredSites} />
      case 'setup-smtp':
        return <SMTPConfigSection />
      case 'email-diagnostico':
        return <EmailDiagnosticoSection />
      case 'notifications':
        return <NotificationsSection />
      case 'renewals':
        return <RenewalsSection initialTab="overview" hideTabs={true} />
      case 'templates-renovacao':
        return <TemplatesSection />
      case 'cadastrar-renovacao':
        return <RenewalsSection initialTab="add" hideTabs={true} />
      case 'cp-users':
        return <CPUsersSection />
      case 'cp-reseller':
        return <ResellerSection />
      case 'cp-ssl':
        return <SSLSection sites={filteredSites} />
      case 'cp-security':
        return <SecuritySection sites={filteredSites} />
      case 'cp-php':
        return <PHPConfigSection sites={filteredSites} />

      case 'cp-wp-list':
        return <ListWordPressSection sites={filteredSites} onRefresh={loadCyberPanelData} setActiveSection={setActiveSection} setFileManagerDomain={setFileManagerDomain} setSelectedDNSDomain={setSelectedDNSDomain} />
      case 'cp-wp-plugins':
        return <WPPluginsSection sites={filteredSites} />
      case 'cp-wp-restore-backup':
        return <WPRestoreBackupSection sites={filteredSites} />
      case 'cp-wp-remote-backup':
        return <WPRemoteBackupSection sites={filteredSites} />
      case 'cp-dns-nameserver':
        return <DNSNameserverSection sites={filteredSites} />
      case 'cp-dns-default-ns':
        return <DNSDefaultNSSection />
      case 'cp-dns-create-zone':
        return <DNSCreateZoneSection sites={filteredSites} />
      case 'domains-dns':
        return <DNSZoneEditorSection
          sites={filteredSites}
          initialDomain={selectedDNSDomain || primaryDomain}
        />
      case 'cp-dns-delete-zone':
        return <DNSDeleteZoneSection sites={filteredSites} />
      case 'cp-dns-cloudflare':
        return <CloudFlareSection sites={filteredSites} />
      case 'cp-dns-reset':
        return <DNSResetSection sites={filteredSites} />
      case 'dns-central':
        return <DNSCentralSection />
      case 'cp-dns-zone-editor':
        return <DNSZoneEditorSection sites={filteredSites} initialDomain={primaryDomain} />
      case 'newsletter':
        return (
          <MailMarketingSection
            sites={filteredSites}
            currentUserEmail={sessionUser || undefined}
            activeTab={mailMarketingTab}
            onTabChange={setMailMarketingTab}
          />
        )

      case 'backup-manager':
      case 'cp-backup':
        return <BackupManagerSection sites={filteredSites} />
      case 'wordpress-install':
        return <WordPressInstallSection sites={filteredSites} onRefresh={loadCyberPanelData} />
      case 'cp-wp-backup':
        return <WPBackupSection sites={filteredSites} />
      case 'domain-manager':
        return <DomainManagerSection
          sites={filteredSites}
          packages={cyberPanelPackages}
          onCreateEmail={(domain) => {
            setPreSelectedEmailDomain(domain)
            setActiveSection('cp-email-mgmt')
          }}
        />

      case 'packages-list':
        return <PackagesSection packages={cyberPanelPackages} onRefresh={loadCyberPanelData} />
      case 'manage-website':
        return <ManageWebsiteSection
          domain={selectedManageDomain || primaryDomain}
          sites={filteredSites}
          setActiveSection={setActiveSection}
          setFileManagerDomain={setFileManagerDomain}
          setSelectedDNSDomain={setSelectedDNSDomain}
          packages={cyberPanelPackages}
          onRefresh={loadCyberPanelData}
        />
      case 'page-builders':
        // Redirecionar para a página de construtores do revendedor
        if (typeof window !== 'undefined') {
          window.location.href = '/revendedor/page-builders';
        }
        return <div className="p-8 text-center text-gray-500">Redirecionando para construtores...</div>;
      case 'templates-saved':
        return <div className="p-8"><h2 className="text-2xl font-bold mb-4">Templates Salvos</h2><p className="text-gray-600">Funcionalidade em desenvolvimento.</p></div>;
      case 'settings-branding':
        return <ResellerSettingsSection onLogoChange={setLogoUrl} />;
      case 'settings-profile':
        return <ResellerProfileSection />;
      default:
        return <ResellerDashboard 
          sites={filteredSites} 
          isFetching={isFetchingCyberPanel} 
          onNavigate={setActiveSection} 
          onRefresh={loadCyberPanelData} 
          onSetDNSDomain={setSelectedDNSDomain}
          onSetFileManagerDomain={setFileManagerDomain} 
          sessionUser={sessionUser}
        />
    }
  }

  // Função para criar email
  const handleCreateEmail = async () => {
    if (!emailForm.user || !emailForm.password) return
    setCreatingEmail(true)
    setEmailMsg('')
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createEmail',
          params: {
            email: `${emailForm.user}@${primaryDomain}`,
            password: emailForm.password
          }
        })
      })
      const data = await res.json()
      if (data.success) {
        setEmailMsg('Email criado com sucesso! Sincronizando acessos...')
        
        // Sincronizar novo email com Supabase Auth
        try {
          await fetch('/api/admin/sync-cyberpanel-users', { method: 'POST' });
        } catch (syncErr) {
          console.error('Erro na sincronização pós-criação:', syncErr);
        }

        setEmailMsg('Email criado e acessos sincronizados com sucesso!')
        setEmailForm({ user: '', password: '', quota: '500' })
        setTimeout(() => {
          setShowEmailModal(false)
          setActiveSection('emails-new')
        }, 1500)
      } else {
        setEmailMsg('Erro: ' + (data.error || 'Falha ao criar email'))
      }
    } catch (e: any) {
      setEmailMsg('Erro: ' + e.message)
    }
    setCreatingEmail(false)
  }

  // Estados para modal de cadastro de renovação
  const [showCadastroModal, setShowCadastroModal] = useState(false)
  const [cadastroForm, setCadastroForm] = useState({
    type: 'domain' as 'domain' | 'hosting',
    userEmail: '',
    domain: '',
    expiration: '',
    price: '',
    autoRenew: false,
    notes: ''
  })
  const [submittingCadastro, setSubmittingCadastro] = useState(false)
  const [cadastroMsg, setCadastroMsg] = useState('')

  // Função para submeter cadastro de renovação
  const handleSubmitCadastro = async () => {
    if (!cadastroForm.userEmail || !cadastroForm.domain || !cadastroForm.expiration) {
      setCadastroMsg('Preencha todos os campos obrigatórios')
      return
    }
    setSubmittingCadastro(true)
    setCadastroMsg('')
    try {
      const userRes = await fetch(`/api/users/search?email=${encodeURIComponent(cadastroForm.userEmail)}`)
      const userData = await userRes.json()
      if (!userData.user) {
        setCadastroMsg('Usuário não encontrado')
        setSubmittingCadastro(false)
        return
      }
      const res = await fetch('/api/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: cadastroForm.type,
          userId: userData.user.id,
          domainName: cadastroForm.domain,
          expirationDate: cadastroForm.expiration,
          renewalPrice: parseFloat(cadastroForm.price) || (cadastroForm.type === 'domain' ? 15 : 50),
          autoRenew: cadastroForm.autoRenew,
          notes: cadastroForm.notes
        })
      })
      if (res.ok) {
        setCadastroMsg('✅ Cadastrado com sucesso!')
        setCadastroForm({
          type: 'domain',
          userEmail: '',
          domain: '',
          expiration: '',
          price: '',
          autoRenew: false,
          notes: ''
        })
        setTimeout(() => {
          setShowCadastroModal(false)
          setCadastroMsg('')
          setActiveSection('renewals')
        }, 1500)
      } else {
        setCadastroMsg('❌ Erro ao cadastrar')
      }
    } catch (error) {
      console.error('Erro:', error)
      setCadastroMsg('❌ Erro ao cadastrar')
    }
    setSubmittingCadastro(false)
  }

  // Função para navegar com domínio padrão para emails
  const handleNavigate = (section: string) => {
    // Intercetar ação de criar email
    if (section === 'criar-email') {
      setEmailForm({ user: '', password: '', quota: '500' })
      setEmailMsg('')
      setShowEmailModal(true)
      return
    }
    // Intercetar ação de cadastrar renovação - abrir popup
    if (section === 'cadastrar-renovacao') {
      setCadastroForm({
        type: 'domain',
        userEmail: '',
        domain: '',
        expiration: '',
        price: '',
        autoRenew: false,
        notes: ''
      })
      setCadastroMsg('')
      setShowCadastroModal(true)
      return
    }
    // Se navegar para gestão de emails, definir domínio padrão visualdesigne.com
    if (section === 'emails-new' || section === 'cp-email-mgmt') {
      setPreSelectedEmailDomain('visualdesigne.com')
    }
    setActiveSection(section)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <ResellerSidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        sessionUser={sessionUser}
        customLogo={logoUrl}
      />
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Top Header - Escondido quando compose está ativo na seção de webmail */}
        <header className={`bg-white border-b border-gray-200 px-6 py-4 ${isComposeActive && activeSection === 'webmail' ? 'hidden' : ''}`}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {getSectionInfo(activeSection).title}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {getSectionInfo(activeSection).description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {activeSection === 'dashboard' && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={dashboardSearch}
                    onChange={e => setDashboardSearch(e.target.value)}
                    placeholder="Pesquisar ferramentas..."
                    className="w-[350px] pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">

                <a href="https://109.199.104.22:8090" target="_blank" rel="noopener noreferrer"
                  className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 text-xs font-bold px-4 py-2 rounded flex items-center gap-1.5 transition-all">
                  <Globe size={13} /> {t('admin.settings.cyberpanel')}
                </a>
                <button onClick={async () => { await createClientInstance.auth.signOut(); window.location.href = '/auth/login'; }}
                  className="bg-gray-50 border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800 text-xs font-bold px-4 py-2 rounded flex items-center gap-2 transition-all" title={t('sidebar.logout')}>
                  <LogOut size={14} />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className={`flex-1 ${['webmail', 'dashboard'].includes(activeSection) ? 'overflow-hidden p-0' : 'overflow-y-auto p-5'}`}>
          <div className={`${['webmail', 'dashboard'].includes(activeSection) ? 'h-full min-h-0 overflow-y-auto' : 'min-h-full'}`}>
            {renderSection()}
          </div>
        </main>

        {/* Modal de Criação de Email (Global - para o menu Criar E-mail) */}
        {showEmailModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowEmailModal(false)} />
            <div className="relative bg-white border border-gray-200 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center shadow-lg shadow-red-500/20">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Novo E-mail</h2>
                    <span className="text-[11px] text-gray-500 font-mono">No domínio: {primaryDomain}</span>
                  </div>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Username</label>
                  <div className="flex items-center gap-2">
                    <input
                      value={emailForm.user}
                      onChange={e => setEmailForm({ ...emailForm, user: e.target.value })}
                      placeholder="admin"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                    />
                    <span className="text-gray-500 text-sm">@{primaryDomain}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
                    <input
                      type="password"
                      value={emailForm.password}
                      onChange={e => setEmailForm({ ...emailForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quota (MB)</label>
                    <select
                      value={emailForm.quota}
                      onChange={e => setEmailForm({ ...emailForm, quota: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                    >
                      <option value="500">500 MB</option>
                      <option value="1000">1 GB</option>
                      <option value="2000">2 GB</option>
                      <option value="5000">5 GB</option>
                      <option value="10000">10 GB</option>
                      <option value="unlimited">Ilimitado</option>
                    </select>
                  </div>
                </div>
                {emailMsg && (
                  <div className={`p-3 rounded text-sm ${emailMsg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {emailMsg}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                <button onClick={() => setShowEmailModal(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleCreateEmail}
                  disabled={creatingEmail || !emailForm.user || !emailForm.password}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingEmail ? <><RefreshCw className="w-4 h-4 animate-spin" /> Criando...</> : '+ Criar Email'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Cadastro de Renovação (Notificações) */}
        {showCadastroModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowCadastroModal(false)} />
            <div className="relative bg-white border border-gray-200 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Cadastrar Renovação</h2>
                    <span className="text-[11px] text-gray-500 font-mono">Novo serviço para notificações</span>
                  </div>
                </div>
                <button onClick={() => setShowCadastroModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo</label>
                    <select
                      value={cadastroForm.type}
                      onChange={e => setCadastroForm({ ...cadastroForm, type: e.target.value as 'domain' | 'hosting' })}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="domain">Domínio</option>
                      <option value="hosting">Hospedagem</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email do Cliente *</label>
                    <input
                      type="email"
                      value={cadastroForm.userEmail}
                      onChange={e => setCadastroForm({ ...cadastroForm, userEmail: e.target.value })}
                      placeholder="cliente@email.com"
                      className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nome do Domínio *</label>
                  <input
                    type="text"
                    value={cadastroForm.domain}
                    onChange={e => setCadastroForm({ ...cadastroForm, domain: e.target.value })}
                    placeholder="exemplo.com"
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data de Vencimento *</label>
                    <input
                      type="date"
                      value={cadastroForm.expiration}
                      onChange={e => setCadastroForm({ ...cadastroForm, expiration: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preço de Renovação (MT)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cadastroForm.price}
                      onChange={e => setCadastroForm({ ...cadastroForm, price: e.target.value })}
                      placeholder={cadastroForm.type === 'domain' ? '15.00' : '50.00'}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border border-gray-200">
                  <input
                    type="checkbox"
                    id="autoRenew"
                    checked={cadastroForm.autoRenew}
                    onChange={e => setCadastroForm({ ...cadastroForm, autoRenew: e.target.checked })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="autoRenew" className="text-sm text-gray-700 cursor-pointer">
                    Auto-renovação habilitada
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notas</label>
                  <textarea
                    value={cadastroForm.notes}
                    onChange={e => setCadastroForm({ ...cadastroForm, notes: e.target.value })}
                    placeholder="Observações opcionais..."
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {cadastroMsg && (
                  <div className={`p-3 rounded text-sm ${cadastroMsg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {cadastroMsg}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                <button onClick={() => setShowCadastroModal(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitCadastro}
                  disabled={submittingCadastro || !cadastroForm.userEmail || !cadastroForm.domain || !cadastroForm.expiration}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingCadastro ? <><RefreshCw className="w-4 h-4 animate-spin" /> Cadastrando...</> : '+ Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
