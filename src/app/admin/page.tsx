'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

import {
  LogOut, RefreshCw, ChevronRight, Globe, Lock, Edit, Plus, Search, LockOpen, ExternalLink, Server, Archive, Database, Power, Trash2, Home, Users, Mail, Layout, Shield, ShieldCheck, Settings, Download, Send, Code, FolderOpen, Upload, X, Zap, Cloud, RotateCcw, FileCode, ArrowLeft, CheckCircle, HardDrive, FileText, AlertCircle, ChevronDown, Globe2, Plug, Layers, List, ChevronLeft, Bell, PauseCircle, Calendar, Clock, MoreVertical
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getCPUrl, getSnappyMailUrl, getServerHost, getHestiaUrl, getActivePanelUrl, getDirectAdminFileManagerUrl, getDirectAdminAccessUrl, getDirectAdminWordPressUrl } from '@/lib/server-config';
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminSectionChromeProvider, useAdminSectionChrome } from '@/components/admin/AdminSectionChrome'
import { PanelHeader } from '@/components/panel/PanelHeader'
import { PanelSectionKeepAlive } from '@/components/panel/PanelSectionKeepAlive'
import { panelBtnSecondary } from '@/lib/panel-ui'
import { CpanelDashboard } from './CpanelDashboard'
import { EmailWebmailSection } from '@/components/dashboard/EmailWebmailSection'
import { WebmailSection } from '@/components/dashboard/WebmailSection'
import {
  DatabasesSection, FTPSection, EmailManagementSection,
  CPUsersSection, SSLSection, SSLViewSection, PHPConfigSection,
  APIConfigSection, GitDeploySection, WPPluginsSection,
  ResellerSection, ModifyWebsiteSection, SuspendWebsiteSection,
  DeleteWebsiteSection, DNSNameserverSection, DNSDefaultNSSection,
  DNSCreateZoneSection, DNSDeleteZoneSection,
  DNSResetSection, EmailDeleteSection, EmailLimitsSection,
  EmailForwardingSection, CatchAllEmailSection, PatternForwardingSection,
  PlusAddressingSection, EmailChangePasswordSection, DKIMManagerSection,
  WPRestoreBackupSection, WPRemoteBackupSection, ListSubdomainsSection,
  WebsitePreviewSection, EmailImportSection,
  PackagesSection, DNSZoneEditorSection, FileManagerSection, BackupManagerSection,
  WordPressInstallSection, WPBackupSection, DomainManagerSection, DeploySection,
  SMTPConfigSection, AuditSyncSection, NameserverManagementSection
} from './DirectAdminSections'
import { EmailDiagnosticoSection } from './EmailDiagnosticoSection'
import { NotificationsSection } from './NotificationsSection'
import { InfraManagerSection } from './InfraManagerSection'
import { NewsManagerSection } from './NewsManagerSection'
import { RenewalsSection } from './RenewalsSection'
import { TemplatesSection } from './TemplatesSection'
import { DNSCentralSection } from './DNSCentralSection'
import { DomainTransferSection } from './DomainTransferSection'
import {
  DomainsHubSection,
  isDomainHubSection,
  sectionToDomainTab,
  type DomainHubTab,
} from './DomainsHubSection'
import { PanelPermissionsConfig } from './PanelPermissionsConfig'
import { ClientesDaSection } from './ClientesDaSection'
import { WordPressHubSection } from './WordPressHubSection'
import { getPanelSectionMeta } from '@/lib/panel-section-meta'
import { loadScreenshot, prefetchScreenshot, getCachedScreenshot } from '@/lib/site-screenshot-cache'
import { readSiteSslCache, writeSiteSslCache } from '@/lib/site-ssl-cache'
import { readWpInstallsCache, writeWpInstallsCache } from '@/lib/panel-wp-cache'
import { resolveSectionId } from '@/lib/panel-admin-menu'
import { directAdminAPI as panelAPI } from '@/lib/directadmin-api'
import { supabase as createClientInstance } from '@/lib/supabase'
import type { DirectAdminWebsite, DirectAdminUser, DirectAdminPackage } from '@/lib/directadmin-api'
import { removeWebsiteFromSupabase, syncWebsiteToSupabase } from '@/lib/supabase-sync'
import { cn } from '@/lib/utils'
import { MailMarketingSection } from '@/components/dashboard/MailMarketingSection'
import { DirectAdminEmailsSection } from './DirectAdminEmailsSection'
import {
  fetchPanelBootstrap,
  fetchPanelBootstrapStaleWhileRevalidate,
  readBootstrapCache,
  clearPanelBootstrapCache,
  type PanelBootstrapData,
  type PanelBootstrapScope,
} from '@/lib/panel-data-from-server'
import { prefetchPanelContentFromBootstrap } from '@/lib/panel-prefetch'
import { auth as panelAuth } from '@/lib/supabase-client'

const directAdminAPI = panelAPI

// Helper global para parse de state
const parseState = (state: any): string => {
  // Em DirectAdmin: 0 = Active, 1 = Suspended
  if (state === 0 || state === '0' || state === 'Active') return 'Active'
  if (state === 1 || state === '1' || state === 'Suspended') return 'Suspended'
  return state || 'Active'
}

function formatSiteDiskUsage(value?: string | number | null): string {
  if (value == null || value === '' || value === '0') return '—'
  const str = String(value).trim()
  if (/[a-zA-Z]/.test(str)) return str
  const num = parseFloat(str)
  if (Number.isNaN(num)) return str
  if (num >= 1024) return `${(num / 1024).toFixed(2)} GB`
  return `${num.toFixed(1)} MB`
}

function formatSitePhpVersion(site: DirectAdminWebsite): string {
  const v = site.phpVersion?.trim()
  if (!v) return '—'
  return v.toUpperCase().startsWith('PHP') ? v : `PHP ${v}`
}

function getSiteIpAddress(site: DirectAdminWebsite): string {
  return site.ip?.trim() || getServerHost()
}

function SiteThumbnail({
  domain,
  width = 320,
  className,
}: {
  domain: string
  width?: number
  className?: string
}) {
  const [src, setSrc] = useState<string | null>(() => getCachedScreenshot(domain, width))

  useEffect(() => {
    const cached = getCachedScreenshot(domain, width)
    if (cached) {
      setSrc(cached)
      return
    }

    let cancelled = false
    void loadScreenshot(domain, width).then((url) => {
      if (!cancelled && url) setSrc(url)
    })
    return () => { cancelled = true }
  }, [domain, width])

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-zinc-800 ${className || ''}`}>
        <Globe className="h-8 w-8 animate-pulse text-gray-300 dark:text-zinc-600" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={`Pré-visualização de ${domain}`}
      className={`block object-cover object-top ${className || ''}`}
      loading="lazy"
      decoding="async"
    />
  )
}

function DirectAdminManualNotice({
  title = 'DirectAdmin externo',
  description = 'A integração automática com o DirectAdmin foi desligada. Use o painel DirectAdmin nativo para gerir esta função.',
  href = getDirectAdminAccessUrl('admin'),
}: {
  title?: string
  description?: string
  href?: string
}) {
  return (
    <div className="max-w-2xl bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
          <ExternalLink className="w-5 h-5 text-orange-600" />
        </div>
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir DirectAdmin
          </a>
        </div>
      </div>
    </div>
  )
}

// Secções que precisam de criar websites
function CreateWebsiteSection({ packages, onRefresh }: { packages: DirectAdminPackage[], onRefresh: () => void }) {
  const { t } = useI18n()
  const [form, setForm] = useState({ domain: '', email: '', username: 'admin', packageName: 'Default', php: '8.2' })
  const [creating, setCreating] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [createdDomain, setCreatedDomain] = useState('')

  const handleCreate = async () => {
    if (!form.domain || !form.email) return
    setCreating(true)
    try {
      await directAdminAPI.createWebsite(form)
      setCreatedDomain(form.domain)
      setShowSuccessModal(true)
      // Limpar formulário após criação bem sucedida
      setForm({ domain: '', email: '', username: 'admin', packageName: 'Default', php: '8.2' })
      // Forçar actualização imediata da lista
      onRefresh()
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
    setCreating(false)
  }

  return (
    <div className="space-y-6 w-full">
      <div><h1 className="text-xl font-bold text-gray-900">{t('admin.sites.new')}</h1><p className="text-gray-500 mt-1">{t('admin.sites.newDesc')}</p></div>
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
        <button onClick={handleCreate} disabled={creating || !form.domain || !form.email} className="bg-black hover:bg-red-600  px-5 py-2.5 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />} {creating ? t('admin.sites.newDesc').split(' ')[0] + '...' : t('admin.sites.new')}
        </button>
      </div>

      {/* Popup de Confirmação - Site Criado com Sucesso */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSuccessModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Site Criado!</h3>
              <p className="text-gray-600 mb-6">
                O site <span className="font-semibold text-gray-900">{createdDomain}</span> foi criado com sucesso.
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                OK, Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Simple domain list section - shows only domain names
// Simple domain list section - shows only domain names
function ListDomainsSection({ sites, onRefresh, setActiveSection, setFileManagerDomain, setSelectedDNSDomain }: {
  sites: DirectAdminWebsite[],
  onRefresh: () => void,
  setActiveSection: (section: string) => void,
  setFileManagerDomain?: (domain: string) => void,
  setSelectedDNSDomain?: (domain: string) => void
}) {
  const [search, setSearch] = useState('')

  const filteredSites = search
    ? sites.filter(s => s.domain.toLowerCase().includes(search.toLowerCase()))
    : sites

  const parseState = (state: any) => {
    if (state === 1 || state === '1' || state === 'Active') return 'Active'
    if (state === 0 || state === '0' || state === 'Suspended') return 'Suspended'
    return state || 'Active'
  }

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

      {/* Domain Cards List */}
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
                  onClick={() => {
                    if (setSelectedDNSDomain) setSelectedDNSDomain(site.domain);
                    setActiveSection('cp-dns-nameserver');
                  }}
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
  sites: DirectAdminWebsite[],
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
          <button 
            onClick={() => setActiveSection('cp-audit-sync')}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded transition-colors"
          >
            <ShieldCheck className="w-3 h-3" />
            Sincronizar
          </button>
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
                          <p className="text-sm font-bold text-gray-900">{(s as any).ip || getServerHost()}</p>
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
                            const ok = await directAdminAPI.issueSSL(s.domain)
                            alert(ok ? '✅ SSL emitido com sucesso!' : '❌ Erro ao emitir SSL.')
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
                          setActiveSection('dns-central');
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

function sortSitesPrimaryFirst(list: DirectAdminWebsite[], primaryDomain?: string | null) {
  if (!primaryDomain) return list
  const primary = primaryDomain.toLowerCase()
  return [...list].sort((a, b) => {
    const aPri = a.domain.toLowerCase() === primary ? 0 : 1
    const bPri = b.domain.toLowerCase() === primary ? 0 : 1
    if (aPri !== bPri) return aPri - bPri
    return a.domain.localeCompare(b.domain)
  })
}

function isAdminOwnedSite(site: DirectAdminWebsite, resellerOwners: Set<string>): boolean {
  const owner = (site.owner || 'admin').trim().toLowerCase()
  if (resellerOwners.has(owner)) return false
  return owner === 'admin'
}

function isWordPressSite(site: DirectAdminWebsite): boolean {
  return site.siteType === 'wordpress' || site.hasWordPress === true
}

function ListWebsitesSection({ sites, onRefresh, packages, setActiveSection, setFileManagerDomain, setSelectedDNSDomain, setSelectedSslDomain, primaryDomain, loadDirectAdminData, syncing, handleSync, daLoadError, wordpressOnly = false }: {
  sites: DirectAdminWebsite[],
  onRefresh: () => void,
  packages: DirectAdminPackage[],
  setActiveSection: (section: string) => void,
  setFileManagerDomain: (domain: string) => void,
  setSelectedDNSDomain: (domain: string) => void,
  setSelectedSslDomain: (domain: string) => void,
  primaryDomain?: string | null,
  loadDirectAdminData: () => void,
  syncing: boolean,
  handleSync: () => void,
  daLoadError?: string,
  wordpressOnly?: boolean,
}) {
  const [expandedSite, setExpandedSite] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<{ domain: string, field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ domain: '', email: '', username: 'admin', packageName: 'Default', php: 'PHP 8.2' })
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')
  const [siteDiskInfo, setSiteDiskInfo] = useState<Record<string, string>>({})
  const [liveSsl, setLiveSsl] = useState<Record<string, boolean>>(() => readSiteSslCache())
  const [wpDomainSet, setWpDomainSet] = useState<Set<string>>(() =>
    wordpressOnly ? new Set(readWpInstallsCache().map((d) => d.toLowerCase())) : new Set(),
  )
  const [wpListLoading, setWpListLoading] = useState(false)

  const sitesArray = Array.isArray(sites) ? sites : []

  /** WordPress: espelho + detecção no servidor (só domínios da conta — API filtrada). */
  const mergedSitesArray = useMemo(() => {
    if (!wordpressOnly) return sitesArray
    const map = new Map<string, DirectAdminWebsite>()
    for (const s of sitesArray) {
      if (!s.domain) continue
      map.set(s.domain.toLowerCase(), s)
    }
    for (const domain of wpDomainSet) {
      const existing = map.get(domain)
      if (existing) {
        map.set(domain, {
          ...existing,
          siteType: 'wordpress',
          hasWordPress: true,
        })
      } else {
        map.set(domain, {
          id: domain,
          domain,
          owner: 'admin',
          state: 'Active',
          siteType: 'wordpress',
          hasWordPress: true,
        })
      }
    }
    return Array.from(map.values())
  }, [sitesArray, wpDomainSet, wordpressOnly])

  const filtered = sortSitesPrimaryFirst(
    mergedSitesArray.filter(s => {
      if (!s.domain.toLowerCase().includes(search.toLowerCase())) return false
      if (s.domain.includes('contaboserver')) return false
      if (s.domain.toLowerCase().startsWith('mail')) return false
      if (wordpressOnly) {
        const owner = (s.owner || 'admin').trim().toLowerCase()
        if (owner !== 'admin') return false
      }
      if (wordpressOnly && !isWordPressSite(s) && !wpDomainSet.has(s.domain.toLowerCase())) return false
      return true
    }),
    primaryDomain,
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSites = filtered.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    const targets = wordpressOnly ? paginatedSites : sitesArray
    const thumbWidth = wordpressOnly ? 320 : 600
    const limit = wordpressOnly ? 8 : 12
    for (const s of targets.slice(0, limit)) {
      void prefetchScreenshot(s.domain, thumbWidth)
    }
  }, [
    wordpressOnly,
    paginatedSites.map((s) => s.domain).join('|'),
    sitesArray.map((s) => s.domain).join('|'),
  ])

  useEffect(() => {
    if (!wordpressOnly) return
    let cancelled = false
    const cached = readWpInstallsCache()
    if (cached.length > 0) {
      setWpDomainSet(new Set(cached.map((d) => d.toLowerCase())))
    } else {
      setWpListLoading(true)
    }
    void (async () => {
      try {
        const { supabase } = await import('@/lib/supabase-client')
        await supabase.auth.getSession()
        const res = await fetch('/api/admin/wp-update', { credentials: 'include' })
        const data = await res.json()
        if (cancelled || !data.success || !Array.isArray(data.installs)) return
        const domains = data.installs.map((i: { domain: string }) => i.domain.toLowerCase())
        writeWpInstallsCache(domains)
        setWpDomainSet(new Set(domains))
      } catch {
        /* mantém cache/espelho */
      } finally {
        if (!cancelled) setWpListLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [wordpressOnly])

  useEffect(() => {
    const domains = filtered.map((s) => s.domain).filter(Boolean)
    if (!domains.length) return

    const cached = readSiteSslCache()
    const missing = domains.filter((d) => cached[d] === undefined)
    if (!missing.length) {
      setLiveSsl(cached)
      return
    }

    let cancelled = false
    const loadSsl = async () => {
      try {
        const res = await fetch('/api/server-exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'checkSitesSsl', params: { domains: missing } }),
        })
        const data = await res.json()
        if (!cancelled && data.success && data.data?.ssl) {
          const merged = { ...cached, ...(data.data.ssl as Record<string, boolean>) }
          writeSiteSslCache(merged)
          setLiveSsl(merged)
        }
      } catch {
        /* mantém cache */
      }
    }
    void loadSsl()
    return () => { cancelled = true }
  }, [filtered.map((s) => s.domain).join('|')])

  useEffect(() => {
    if (!expandedSite || siteDiskInfo[expandedSite]) return
    const site = sitesArray.find((s) => s.domain === expandedSite)
    const fetchUsage = async () => {
      try {
        const res = await fetch('/api/server-exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'siteDiskUsage',
            params: { domain: expandedSite, owner: site?.owner || 'admin' },
          }),
        })
        const data = await res.json()
        if (data.success && data.data?.usage) {
          setSiteDiskInfo((prev) => ({ ...prev, [expandedSite]: data.data.usage }))
        }
      } catch (e) {
        console.error(e)
      }
    }
    void fetchUsage()
  }, [expandedSite, sites, siteDiskInfo])

  const isSslActive = (site: DirectAdminWebsite) => {
    if (liveSsl[site.domain] !== undefined) return liveSsl[site.domain]
    if (site.ssl === true) return true
    const status = (site.sslStatus || '').toLowerCase()
    return status === 'secure' || status.includes('activ') || status.includes('enabled')
  }

  const daOk = (result: unknown) => {
    if (!result || typeof result !== 'object') return true
    return (result as { success?: boolean }).success !== false
  }

  const openFileManager = (domain: string) => {
    setFileManagerDomain(domain)
    setTimeout(() => setActiveSection('file-manager'), 50)
  }

  const openDnsEditor = (domain: string) => {
    setSelectedDNSDomain(domain)
    setTimeout(() => setActiveSection('dns-central'), 50)
  }

  const openDatabases = (domain: string) => {
    // @ts-ignore
    window.__selectedDatabaseDomain = domain
    setTimeout(() => setActiveSection('cp-databases'), 50)
  }

  const openSslPage = (domain: string) => {
    setSelectedSslDomain(domain)
    setTimeout(() => setActiveSection('cp-ssl'), 50)
  }

  const openBackupPage = (domain: string) => {
    // @ts-ignore
    window.__selectedBackupDomain = domain
    setTimeout(() => setActiveSection('backup-manager'), 50)
  }

  // Manter sempre o primeiro card da página expandido
  useEffect(() => {
    if (paginatedSites.length > 0) {
      setExpandedSite(paginatedSites[0].domain)
    }
  }, [currentPage, paginatedSites.map((s) => s.domain).join('|')])

  const handleDelete = async (domain: string) => {
    if (!confirm(`⚠️ Apagar "${domain}"?\n\nEsta acção é IRREVERSÍVEL — o site e todos os seus ficheiros serão eliminados do servidor!`)) return
    setLoading(domain)
    try {
      const result = await directAdminAPI.deleteWebsite(domain)
      if (daOk(result)) {
        await removeWebsiteFromSupabase(domain)
        await onRefresh()
      } else {
        alert('Erro ao apagar o site.')
      }
    } catch (e: unknown) {
      alert('Erro: ' + (e instanceof Error ? e.message : 'desconhecido'))
    }
    setLoading(null)
  }

  const handleSuspend = async (domain: string, state: string) => {
    setLoading(`${domain}-suspend`)
    try {
      const result = state === 'Active'
        ? await directAdminAPI.suspendWebsite(domain)
        : await directAdminAPI.unsuspendWebsite(domain)
      if (daOk(result)) {
        await syncWebsiteToSupabase({
          domain,
          status: state === 'Active' ? 'Suspended' : 'Active',
        })
        await onRefresh()
      } else {
        alert('Erro ao alterar estado do site.')
      }
    } catch (e: unknown) {
      alert('Erro: ' + (e instanceof Error ? e.message : 'desconhecido'))
    }
    setLoading(null)
  }

  const handleSaveField = async (domain: string, field: string, value: string) => {
    setLoading(`${domain}-edit`)
    try {
      const site = sitesArray.find((s) => s.domain === domain)

      if (field === 'state') {
        const result = value === 'Active'
          ? await directAdminAPI.unsuspendWebsite(domain)
          : await directAdminAPI.suspendWebsite(domain)
        if (!daOk(result)) {
          alert('Erro ao alterar estado.')
          return
        }
      } else if (field === 'php') {
        const result = await directAdminAPI.changePHPVersion({
          domain,
          phpVersion: value,
          owner: site?.owner || 'admin',
        })
        if (!daOk(result)) {
          alert('Erro ao alterar versão PHP.')
          return
        }
      } else if (field === 'package') {
        const res = await fetch('/api/server-exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'execCommand',
            params: { command: `directadmin changePackage --domainName ${domain} --packageName "${value}" 2>&1` },
          }),
        })
        const data = await res.json()
        const output = data.data?.output || ''
        if (!data.success || output.toLowerCase().includes('error')) {
          alert('Erro: ' + (output || data.error || 'desconhecido'))
          return
        }
      } else {
        const res = await fetch('/api/server-exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'modifyWebsite', params: { domain, [field]: value } }),
        })
        const data = await res.json()
        if (!data.success) {
          alert('Erro: ' + (data.error || 'desconhecido'))
          return
        }
      }

      setEditingField(null)
      await onRefresh()
    } catch (e: unknown) {
      alert('Erro: ' + (e instanceof Error ? e.message : 'desconhecido'))
    }
    setLoading(null)
  }

  const SITE_DETAIL_CARD = 'bg-gray-50 rounded p-3 border border-gray-200 h-[4.75rem] min-h-[4.75rem] box-border overflow-hidden'

  const EditableField = ({ domain, field, value, label }: { domain: string, field: string, value: string, label: string }) => {
    const isEditing = editingField?.domain === domain && editingField?.field === field
    return (
      <div className={SITE_DETAIL_CARD}>
        <p className="text-xs font-bold text-gray-400 uppercase mb-1">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            {field === 'state' ? (
              <select value={editValue} onChange={e => setEditValue(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white flex-1">
                <option>Active</option>
                <option>Suspended</option>
              </select>
            ) : field === 'php' ? (
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
      <div className="flex items-center justify-between gap-4">
        <span className="text-base font-bold text-gray-900 shrink-0 dark:text-zinc-100">
          Websites ({filtered.length})
        </span>

        <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
          <div className="relative flex-1 max-w-md min-w-[14rem]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar websites..."
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm w-full" />
          </div>
          <button onClick={() => setActiveSection('wordpress-install')}
            className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 hover:text-green-700 px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5 transition-all shrink-0">
            <Plus className="w-3 h-3" /> Criar Website
          </button>
        </div>
      </div>

      {msg && <div className="px-4 py-2.5 rounded text-sm bg-green-50 text-green-700 border border-green-200">{msg}</div>}

      {daLoadError && (
        <div className="px-4 py-3 rounded text-sm bg-red-50 text-red-800 border border-red-200">
          <strong>DirectAdmin:</strong> {daLoadError}
          {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
            <p className="mt-2 text-red-700/90">
              Em <code>localhost</code> a API do DirectAdmin pode falhar (IP bloqueado ou sem acesso directo). Use o painel em produção{' '}
              (<strong>visualdesignmoz.com/admin</strong>), o DirectAdmin em{' '}
              <strong>https://host.visualdesignmoz.com:2026/</strong>, ou configure <code>SSH_PRIVATE_KEY</code> no{' '}
              <code>.env.local</code> para SSH <code>root@37.27.17.25 -p 2234</code>.
            </p>
          )}
        </div>
      )}

      {filtered.length === 0 && !daLoadError && (
        <p className="text-center text-gray-500 py-8">
          {wordpressOnly && wpListLoading
            ? 'A detectar sites WordPress…'
            : wordpressOnly
              ? 'Nenhum site WordPress nesta conta.'
              : 'Nenhum website encontrado no DirectAdmin.'}
        </p>
      )}

      {/* Lista de sites como cards expansíveis */}
      <div className="space-y-2">
        {paginatedSites.map((s, i) => (
          <div key={i} className={`bg-white rounded border ${expandedSite === s.domain ? 'border-blue-200 shadow-md' : 'border-gray-200 shadow-sm'} transition-all`}>

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
                <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">
                  {s.domain}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${parseState(s.state) === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {parseState(s.state) || 'Active'}
                </span>
                {/* Badge por tipo de site */}
                {s.siteType === 'wordpress' && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">WordPress</span>}
                {s.siteType === 'nextjs' && <span className="px-2 py-0.5 bg-black  rounded-full text-xs font-bold">Next.js</span>}
                {s.siteType === 'html' && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">HTML/PHP</span>}
                {isSslActive(s) ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <Lock className="w-3.5 h-3.5" /> SSL Activo
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSslPage(s.domain)}
                    className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 hover:underline underline-offset-2"
                  >
                    <LockOpen className="w-3.5 h-3.5" /> Sem SSL
                  </button>
                )}
              </div>

              {/* Acções */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openFileManager(s.domain)}
                  className="text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-medium transition-colors underline-offset-2 hover:underline">
                  Explorar directório
                </button>
                <span
                  className="w-px h-[0.85em] shrink-0 bg-gray-300/80 dark:bg-zinc-600/80"
                  aria-hidden
                />
                <button
                  type="button"
                  disabled={loading === `${s.domain}-suspend`}
                  onClick={() => handleSuspend(s.domain, parseState(s.state) || 'Active')}
                  className="text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-medium transition-colors underline-offset-2 hover:underline disabled:opacity-50">
                  {loading === `${s.domain}-suspend`
                    ? 'A processar...'
                    : parseState(s.state) === 'Active' ? 'Suspender' : 'Activar'}
                </button>
                <span
                  className="w-px h-[0.85em] shrink-0 bg-gray-300/80 dark:bg-zinc-600/80"
                  aria-hidden
                />
                <button
                  type="button"
                  disabled={loading === s.domain}
                  onClick={() => handleDelete(s.domain)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium transition-colors underline-offset-2 hover:underline disabled:opacity-50">
                  {loading === s.domain ? 'A apagar...' : 'Apagar'}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                      aria-label="Mais opções"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="left"
                    align="center"
                    sideOffset={6}
                    className="z-[200] w-32 max-w-[8rem] p-1 text-xs !bg-white dark:!bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-lg"
                  >
                    <DropdownMenuItem className="text-xs px-2 py-1.5" onClick={() => openSslPage(s.domain)}>
                      Emitir SSL
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs px-2 py-1.5" onClick={() => openDnsEditor(s.domain)}>
                      Editar DNS
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs px-2 py-1.5" onClick={() => openBackupPage(s.domain)}>
                      Backup
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs px-2 py-1.5" onClick={() => openDatabases(s.domain)}>
                      Base de Dados
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Conteúdo expandido */}
            {expandedSite === s.domain && (
              <div className="border-t border-gray-100 p-4 space-y-4">

                {/* Miniatura + 6 cards uniformes */}
                <div className="flex gap-3 items-stretch min-h-[10.5rem]">
                  <div className="w-[38%] max-w-[300px] shrink-0 h-[10.5rem] overflow-hidden rounded border border-gray-200 dark:border-zinc-600">
                    <SiteThumbnail
                      domain={s.domain}
                      width={wordpressOnly ? 320 : 600}
                      className="h-full w-full"
                    />
                  </div>

                  <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-3">
                    <EditableField domain={s.domain} field="state" value={parseState(s.state) || 'Active'} label="State" />
                    <div className={SITE_DETAIL_CARD}>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">IP Address</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{getSiteIpAddress(s)}</p>
                    </div>
                    <EditableField domain={s.domain} field="php" value={formatSitePhpVersion(s)} label="PHP Version" />
                    <div className={SITE_DETAIL_CARD}>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Disk Usage</p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {siteDiskInfo[s.domain] || formatSiteDiskUsage(s.diskUsage)}
                      </p>
                    </div>
                    <EditableField domain={s.domain} field="package" value={s.package || 'Default'} label="Package" />
                    <div className={SITE_DETAIL_CARD}>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Owner</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{s.owner || '—'}</p>
                    </div>
                  </div>
                </div>

                {!wordpressOnly ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDNSDomain(s.domain)
                      setActiveSection('domain-manager')
                    }}
                    className="flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                  >
                    Gerir
                  </button>
                  <button
                    type="button"
                    disabled={loading === `${s.domain}-ssl`}
                    onClick={() => openSslPage(s.domain)}
                    className="flex items-center gap-1.5 rounded border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400"
                  >
                    <Lock className="h-3.5 w-3.5" /> Issue SSL
                  </button>
                  <button
                    type="button"
                    onClick={() => openFileManager(s.domain)}
                    className="flex items-center gap-1.5 rounded border border-purple-300 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-600 transition-colors hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Ficheiros
                  </button>
                  <button
                    type="button"
                    onClick={() => openDnsEditor(s.domain)}
                    className="flex items-center gap-1.5 rounded border border-fuchsia-300 bg-fuchsia-50 px-4 py-2 text-xs font-bold text-fuchsia-600 transition-colors hover:bg-fuchsia-100 dark:border-fuchsia-800 dark:bg-fuchsia-950/30 dark:text-fuchsia-400"
                  >
                    <Globe2 className="h-3.5 w-3.5" /> Editar DNS
                  </button>
                  <button
                    type="button"
                    onClick={() => openBackupPage(s.domain)}
                    className="flex items-center gap-1.5 rounded border border-gray-300 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <Archive className="h-3.5 w-3.5" /> Backup
                  </button>
                  <button
                    type="button"
                    onClick={() => openDatabases(s.domain)}
                    className="flex items-center gap-1.5 rounded border border-cyan-300 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-600 transition-colors hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-400"
                  >
                    <Database className="h-3.5 w-3.5" /> Base de Dados
                  </button>
                  <button
                    type="button"
                    disabled={loading === `${s.domain}-suspend`}
                    onClick={() => handleSuspend(s.domain, parseState(s.state) || 'Active')}
                    className="flex items-center gap-1.5 rounded border border-orange-300 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-100 disabled:opacity-50 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400"
                  >
                    <PauseCircle className="h-3.5 w-3.5" />
                    {parseState(s.state) === 'Active' ? 'Suspender' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    disabled={loading === s.domain}
                    onClick={() => handleDelete(s.domain)}
                    className="flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Apagar
                  </button>
                </div>
                ) : null}
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
                try {
                  const result = await directAdminAPI.createWebsite({
                    domain: createForm.domain,
                    email: createForm.email,
                    packageName: createForm.packageName,
                    phpVersion: createForm.php,
                  })
                  if (daOk(result)) {
                    setCreateMsg('Website criado com sucesso!')
                    setTimeout(() => { setShowCreateModal(false); setCreateMsg(''); onRefresh() }, 1500)
                  } else {
                    setCreateMsg('Erro: ' + ((result as { output?: string; error?: string })?.output || (result as { error?: string })?.error || 'desconhecido'))
                  }
                } catch (e: unknown) {
                  setCreateMsg('Erro: ' + (e instanceof Error ? e.message : 'desconhecido'))
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
          <h1 className="text-xl font-bold text-gray-900">{t('admin.clientSection.title')}</h1>
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
// MANAGE WEBSITE SECTION - DirectAdmin Management Interface
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
  sites: DirectAdminWebsite[]
  setActiveSection: (section: string) => void
  setFileManagerDomain: (domain: string) => void
  setSelectedDNSDomain: (domain: string) => void
  packages?: DirectAdminPackage[]
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
    setSiteData(site || { domain, state: 'Active', ip: getServerHost(), phpVersion: '8.2', package: 'Default', owner: 'admin' })
    setLoading(false)
  }, [domain, sites])

  const siteOwner = siteData?.owner || 'admin'

  const handleIssueSSL = async () => {
    if (!confirm(`Deseja emitir certificado SSL para ${domain}?`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'issueSSL',
          params: { domain }
        })
      })
      const data = await res.json()
      if (data.success) {
        alert('SSL emitido com sucesso!')
        onRefresh?.()
      } else {
        alert('Erro ao emitir SSL: ' + (data.error || 'Verifique os logs do servidor.'))
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
    setLoading(false)
  }

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
  // CUSTOM ICONS (PANEL STYLE)
  // ============================================================
  const CyberIcon = ({ name, className }: { name: string; className?: string }) => {
    // Usar Lucide com cores premium
    switch (name) {
      case 'email-accounts': return <Mail className={cn(className, "text-rose-500")} />
      case 'email-forwarding': return <Send className={cn(className, "text-orange-500")} />
      case 'email-deliverability': return <ShieldCheck className={cn(className, "text-emerald-500")} />
      case 'file-manager': return <FolderOpen className={cn(className, "text-blue-500")} />
      case 'ftp-accounts': return <Cloud className={cn(className, "text-sky-500")} />
      case 'disk-usage': return <HardDrive className={cn(className, "text-gray-500")} />
      case 'databases': return <Database className={cn(className, "text-orange-500")} />
      case 'addon-domains': return <Globe className={cn(className, "text-indigo-500")} />
      case 'dns-zone': return <Layers className={cn(className, "text-yellow-500")} />
      case 'ssl-tls': return <Lock className={cn(className, "text-red-500")} />
      case 'wordpress': return <Zap className={cn(className, "text-blue-600")} />
      case 'backups': return <Archive className={cn(className, "text-teal-500")} />
      case 'git-version': return <Code className={cn(className, "text-orange-600")} />
      case 'mod-security': return <Shield className={cn(className, "text-amber-500")} />
      case 'ip-blocker': return <X className={cn(className, "text-red-600")} />
      case 'cron-jobs': return <Clock className={cn(className, "text-green-500")} />
      case 'metrics': return <Layout className={cn(className, "text-blue-500")} />
      case 'mx-entry': return <Mail className={cn(className, "text-indigo-500")} />
      case 'mailing-lists': return <Users className={cn(className, "text-pink-500")} />
      case 'phpmyadmin': return <Database className={cn(className, "text-blue-700")} />
      default: return <Globe className={className} />
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
    href,
    isForm = false
  }: {
    icon: any,
    label: string,
    description?: string,
    onClick?: () => void,
    color?: string,
    bgColor?: string,
    badge?: string,
    external?: boolean,
    href?: string,
    isForm?: boolean
  }) => {
    const content = (
      <div className="relative group flex flex-col items-center justify-center p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer h-full min-h-[130px]">
        <div className={cn(
          "mb-3 p-3 rounded-full transform group-hover:scale-110 transition-transform duration-300",
          bgColor || "bg-gray-50"
        )}>
          {typeof Icon === 'string' ? (
            <CyberIcon name={Icon} className="w-8 h-8" />
          ) : (
            <Icon className={cn("w-8 h-8", color)} />
          )}
        </div>
        
        <span className="text-[12px] font-bold text-gray-700 group-hover:text-blue-600 transition-colors text-center leading-tight uppercase tracking-tight">
          {label}
        </span>

        {badge && (
          <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10">
            {badge}
          </span>
        )}
      </div>
    )

    if (external && href) {
      if (isForm) {
        return (
          <form action={href} method="POST" target="_blank" className="h-full">
            <input type="hidden" name="email" value={localStorage.getItem(`last_email_${domain}`) || ''} />
            <input type="hidden" name="password" value={localStorage.getItem(`last_pass_${domain}`) || ''} />
            <button type="submit" className="block w-full h-full">
              {content}
            </button>
          </form>
        )
      }
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
    <div className="p-6 space-y-6">

      {/* 1-Click Apps Section */}
      <SectionCard
        id="apps"
        title="1-CLICK APPS"
        icon={Zap}
        color="text-violet-700"
        bgColor="bg-violet-50"
      >
        <MenuItem icon="wordpress" label="WordPress" external href={getDirectAdminWordPressUrl()} badge="DIRECTADMIN" />
        <MenuItem icon="git-version" label="Git Integration" onClick={() => setActiveSection('git-deploy')} />
        <MenuItem icon={Globe} label="PrestaShop" color="text-pink-600" external href={`${getHestiaUrl()}/list/webapp?domain=${domain}&app=prestashop`} badge="E-COMMERCE" />
        <MenuItem icon={Mail} label="Mautic" color="text-purple-600" external href={`${getHestiaUrl()}/list/webapp?domain=${domain}&app=mautic`} />
      </SectionCard>

      {/* Backup Section */}
      <SectionCard
        id="backup"
        title="BACKUP"
        icon={Archive}
        color="text-teal-700"
        bgColor="bg-teal-50"
      >
        <MenuItem icon="backups" label="Gestão de Backups" onClick={() => setActiveSection('backup-manager')} />
      </SectionCard>

      {/* Configurations Section */}
      <SectionCard
        id="configs"
        title="CONFIGURATIONS"
        icon={Settings}
        color="text-cyan-700"
        bgColor="bg-cyan-50"
      >
        <MenuItem icon={Server} label="Web Server" color="text-cyan-600" external href={getDirectAdminAccessUrl('admin')} />
        <MenuItem icon="file-manager" label="vHost Conf" color="text-cyan-600" external href={getDirectAdminAccessUrl('admin')} />
        <MenuItem icon={Edit} label="Rewrite Rules" color="text-cyan-600" external href={getDirectAdminFileManagerUrl(domain, siteOwner)} />
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
        <MenuItem icon="phpmyadmin" label="phpMyAdmin" external href={`${getCPUrl()}/dataBases/phpMyAdmin`} />
      </SectionCard>

      {/* DNS Section */}
      <SectionCard
        id="dns"
        title="DNS"
        icon={Server}
        color="text-yellow-700"
        bgColor="bg-yellow-50"
      >
        <MenuItem icon="dns-zone" label="Edit DNS Zone" onClick={() => { setSelectedDNSDomain(domain); setActiveSection('dns-central'); }} />
        <MenuItem icon="dns-zone" label="Create Zone" onClick={() => setActiveSection('cp-dns-create-zone')} />
        <MenuItem icon="dns-zone" label="Delete Zone" onClick={() => setActiveSection('cp-dns-delete-zone')} />
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
        <MenuItem icon="cron-jobs" label="Cron Jobs" external href={`${getHestiaUrl()}/list/cron/`} />
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
        <MenuItem 
          icon="email-accounts" 
          label="Webmail" 
          external 
          href={`${getHestiaUrl()}/list/mail/`} 
          bgColor="bg-rose-100" 
          color="text-rose-600" 
        />
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
        <MenuItem icon="file-manager" label="DirectAdmin Files" external href={getDirectAdminFileManagerUrl(domain, siteOwner)} />
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
        <MenuItem icon="metrics" label="Access Logs" external href={`${getHestiaUrl()}/list/web-stats/?domain=${domain}`} />
        <MenuItem icon="metrics" label="Error Logs" external href={`${getHestiaUrl()}/list/web-stats/?domain=${domain}`} />
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
        <MenuItem icon="ssl-tls" label="SSL Status" external href={`${getHestiaUrl()}/list/web/?domain=${domain}`} />
      </SectionCard>

      {/* WordPress Section */}
      <SectionCard
        id="wordpress"
        title="WORDPRESS"
        icon={Globe2}
        color="text-blue-700"
        bgColor="bg-blue-50"
      >
        <MenuItem icon="wordpress" label="Install WP" external href={getDirectAdminWordPressUrl()} badge="DIRECTADMIN" />
        <MenuItem icon="wordpress" label="WP Admin" external href={`https://${domain}/wp-admin`} />
        <MenuItem icon="wordpress" label="Plugins" onClick={() => setActiveSection('cp-wp-plugins')} />
        <MenuItem icon="backups" label="Backups" onClick={() => setActiveSection('backup-manager')} />
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
                  <span className="text-[11px] text-gray-500 font-mono">Criar website no DirectAdmin</span>
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

export default function AdminPage() {
  return (
    <AdminSectionChromeProvider>
      <AdminPageContent />
    </AdminSectionChromeProvider>
  );
}

function AdminPageContent() {
  const { chrome } = useAdminSectionChrome();
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [fileManagerDomain, setFileManagerDomain] = useState('')
  const [directAdminSites, setDirectAdminSites] = useState<DirectAdminWebsite[]>([])
  const [directAdminUsers, setDirectAdminUsers] = useState<DirectAdminUser[]>([])
  const [directAdminPackages, setDirectAdminPackages] = useState<DirectAdminPackage[]>([])
  const [isFetchingDirectAdmin, setIsFetchingDirectAdmin] = useState(false)
  const [selectedDatabaseDomain, setSelectedDatabaseDomain] = useState('')
  const [selectedBackupDomain, setSelectedBackupDomain] = useState('')
  const [preSelectedEmailDomain, setPreSelectedEmailDomain] = useState<string>('')
  const [sessionUser, setSessionUser] = useState<string | null>(null)
  const [isComposeActive, setIsComposeActive] = useState(false)
  const [mailMarketingTab, setMailMarketingTab] = useState<'comp' | 'subs' | 'camp'>('comp')
  const [domainHubTab, setDomainHubTab] = useState<DomainHubTab>('meus')
  const [provisionAccountType, setProvisionAccountType] = useState<'client' | 'reseller' | 'professional' | 'admin'>('client')
  const [contasListResetToken, setContasListResetToken] = useState(0)

  const searchParams = useSearchParams();
  const initialLoadDone = useRef(false);

  // Efeito para capturar section da URL - garantir dashboard como padrão
  useEffect(() => {
    // Sempre definir dashboard como padrão na carga inicial/recarga da página
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      const section = searchParams.get('section');
      setActiveSection(section || 'dashboard');
      if (section || searchParams.get('impersonate_error')) {
        const err = searchParams.get('impersonate_error');
        window.history.replaceState(
          {},
          '',
          err ? `/admin?impersonate_error=${encodeURIComponent(err)}` : '/admin',
        );
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

  // Efeito para capturar domínio vindo do botão "Backup"
  useEffect(() => {
    // @ts-ignore
    if (window.__selectedBackupDomain && activeSection === 'backup-manager') {
      // @ts-ignore
      setSelectedBackupDomain(window.__selectedBackupDomain);
      // @ts-ignore
      window.__selectedBackupDomain = null;
    } else if (activeSection !== 'backup-manager') {
      setSelectedBackupDomain('');
    }
  }, [activeSection]);

  // Efeito para limpar preSelectedEmailDomain quando sair da seção de email
  useEffect(() => {
    if (!activeSection.includes('email') && !activeSection.includes('cp-email')) {
      setPreSelectedEmailDomain('');
    }
  }, [activeSection]);

  // Efeito para limpar domínio SSL quando sair da secção
  useEffect(() => {
    if (activeSection !== 'cp-ssl') {
      setSelectedSslDomain('');
    }
    if (activeSection !== 'cp-ssl-view') {
      setSelectedSslViewHostname('');
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
  const [daLoadError, setDaLoadError] = useState('')
  const [selectedDNSDomain, setSelectedDNSDomain] = useState<string>('')
  const [selectedSslDomain, setSelectedSslDomain] = useState<string>('')
  const [selectedSslViewHostname, setSelectedSslViewHostname] = useState<string>('')
  const [accountDaUsername, setAccountDaUsername] = useState<string>('visualdesign')
  const [accountPrimaryDomain, setAccountPrimaryDomain] = useState<string | null>(null)
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

  const resolveBootstrapScope = async (): Promise<PanelBootstrapScope> => {
    const role = await panelAuth.getUserRole()
    return role === 'reseller' ? 'reseller' : 'admin'
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const scope = await resolveBootstrapScope()
      clearPanelBootstrapCache(scope)
      await loadDirectAdminData(true)
    } catch (e) {
      console.error(e)
    }
    setSyncing(false)
  }

  const applyBootstrap = (boot: PanelBootstrapData) => {
    setDirectAdminSites(boot.sites)
    setDirectAdminUsers(boot.users)
    setDirectAdminPackages(boot.packages)
    if (boot.resellerContext?.daUsername) {
      setAccountDaUsername(boot.resellerContext.daUsername)
    }
    const username = (boot.resellerContext?.daUsername ?? accountDaUsername).toLowerCase()
    let primary: string | null = boot.resellerContext?.primaryDomain?.toLowerCase() ?? null
    if (!primary && username) {
      const ownerSites = boot.sites.filter((s) => {
        const o = (s.owner || 'admin').toLowerCase()
        return (o === username || (o === 'admin' && (username === 'visualdesign' || username === 'admin')))
          && !s.domain.includes('contaboserver')
      })
      const match = ownerSites.find((s) => s.domain.toLowerCase().startsWith(username))
        ?? ownerSites.find((s) => s.domain.toLowerCase().includes(username))
      primary = match?.domain.toLowerCase() ?? ownerSites[0]?.domain.toLowerCase() ?? null
    }
    if (!primary) {
      const vd = boot.sites.find((s) => s.domain.toLowerCase() === 'visualdesignmoz.com')
        ?? boot.sites.find((s) => {
          const o = (s.owner || 'admin').toLowerCase()
          return o === username || (o === 'admin' && (username === 'visualdesign' || username === 'admin'))
        })
      primary = vd?.domain.toLowerCase() ?? null
    }
    setAccountPrimaryDomain(primary)
    if (!boot.sites.length && boot.meta?.source === 'mirror') {
      setDaLoadError('Sem sites no espelho — sincronização em curso.')
    } else {
      setDaLoadError('')
    }
    prefetchPanelContentFromBootstrap(boot, 'admin')
  }

  const loadDirectAdminData = async (fresh = false) => {
    const scope = await resolveBootstrapScope()
    if (fresh) clearPanelBootstrapCache(scope)

    const cached = !fresh ? readBootstrapCache(scope) : null
    if (cached) {
      applyBootstrap(cached)
    } else {
      setIsFetchingDirectAdmin(true)
    }
    setDaLoadError('')

    try {
      if (cached && !fresh) {
        await fetchPanelBootstrapStaleWhileRevalidate(applyBootstrap, scope)
      } else {
        const boot = await fetchPanelBootstrap({ fresh: true, scope })
        applyBootstrap(boot)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao carregar dados'
      setDaLoadError(message)
      console.error(e)
    } finally {
      setIsFetchingDirectAdmin(false)
    }
  }

  useEffect(() => {
    void loadDirectAdminData(false)
    const loadProfileOwner = async () => {
      try {
        const { data: { session } } = await createClientInstance.auth.getSession()
        const user = session?.user
        if (!user) return
        const { profileAuthOrFilter } = await import('@/lib/profile-db')
        const { data } = await createClientInstance
          .from('profiles')
          .select('da_username, role')
          .or(profileAuthOrFilter(user.id))
          .maybeSingle()
        const fromProfile = data?.da_username?.trim()
        if (fromProfile) {
          setAccountDaUsername(fromProfile)
        } else if (data?.role === 'admin') {
          setAccountDaUsername('visualdesign')
        }
      } catch (e) {
        console.error('Erro ao carregar owner da conta:', e)
      }
    }
    void loadProfileOwner()
  }, [])

  // Filtrar sites — conta admin vê todos os sites com owner "admin"
  const resellerOwners = useMemo(
    () =>
      new Set(
        directAdminUsers
          .filter((u) => (u.acl || u.type || '').toLowerCase() === 'reseller')
          .map((u) => String(u.userName || u.id).toLowerCase()),
      ),
    [directAdminUsers],
  )
  const filteredSitesBase = useMemo(
    () =>
      directAdminSites.filter((s) => {
        if (s.domain.includes('contaboserver')) return false
        if (s.domain.toLowerCase().startsWith('mail.')) return false
        if (!isAdminOwnedSite(s, resellerOwners)) return false
        return true
      }),
    [directAdminSites, resellerOwners],
  )
  const filteredSites = useMemo(
    () => sortSitesPrimaryFirst(filteredSitesBase, accountPrimaryDomain),
    [filteredSitesBase, accountPrimaryDomain],
  )
  const domainHubSites = useMemo(
    () =>
      directAdminSites.filter((s) => {
        if (s.domain.includes('contaboserver')) return false
        if (s.domain.toLowerCase().startsWith('mail.')) return false
        return true
      }),
    [directAdminSites],
  )
  const primaryDomain = accountPrimaryDomain
    || (filteredSites.length > 0 ? filteredSites[0].domain : 'your-domain.com')

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

  const getSectionInfo = (section: string) => getPanelSectionMeta(section)

  const renderSectionFor = (sectionId: string, isActive: boolean) => {
    switch (sectionId) {
      case 'cp-client-permissions':
        return <PanelPermissionsConfig role="client" />
      case 'cp-reseller-permissions':
        return <PanelPermissionsConfig role="reseller" />
      case 'provision-client':
        return (
          <ClientesDaSection
            listFilter="all"
            packages={directAdminPackages}
            initialView="create"
            initialAccountType={provisionAccountType === 'admin' ? 'professional' : provisionAccountType}
            isActive={isActive}
            listResetToken={contasListResetToken}
            onRefresh={() => void loadDirectAdminData(true)}
          />
        )
      case 'hospedagem-contas':
        return (
          <ClientesDaSection
            listFilter="all"
            packages={directAdminPackages}
            initialView="list"
            isActive={isActive}
            listResetToken={contasListResetToken}
            onRefresh={() => void loadDirectAdminData(true)}
          />
        )
      case 'dashboard':
        return <CpanelDashboard
          sites={filteredSites}
          users={directAdminUsers}
          isFetching={isFetchingDirectAdmin}
          onNavigate={setActiveSection}
          onRefresh={() => void loadDirectAdminData(true)}
          onSetDNSDomain={setSelectedDNSDomain}
          onSetFileManagerDomain={setFileManagerDomain}
          searchQuery={sectionId === activeSection ? dashboardSearch : ''}
          onSearchChange={setDashboardSearch}
        />
      case 'domains':
        return <ListWebsitesSection
          sites={filteredSites}
          onRefresh={() => void loadDirectAdminData(true)}
          packages={directAdminPackages}
          setActiveSection={setActiveSection}
          setFileManagerDomain={setFileManagerDomain}
          setSelectedDNSDomain={setSelectedDNSDomain}
          setSelectedSslDomain={setSelectedSslDomain}
          primaryDomain={accountPrimaryDomain}
          loadDirectAdminData={loadDirectAdminData}
          syncing={syncing}
          handleSync={handleSync}
          daLoadError={daLoadError}
        />
      case 'domains-list':
        return <ListDomainsSection
          sites={filteredSites}
          onRefresh={() => void loadDirectAdminData(true)}
          setActiveSection={setActiveSection}
          setFileManagerDomain={setFileManagerDomain}
        />
      case 'file-manager':
      case 'cp-file-manager':
        return <FileManagerSection domain={fileManagerDomain || primaryDomain} sites={filteredSites} />
      case 'infra-manager':
        return <InfraManagerSection />
      case 'news-manager':
        return <NewsManagerSection />
      case 'clientes':
        return <CPUsersSection variant="panels" panelScope="client" isActive={isActive} onBootstrapRefresh={() => void loadDirectAdminData(true)} />
      case 'revendedores':
        return (
          <CPUsersSection
            variant="panels"
            panelScope="reseller"
            isActive={isActive}
            onBootstrapRefresh={() => void loadDirectAdminData(true)}
            onNavigate={(section, opts) => {
              if (opts?.accountType) setProvisionAccountType(opts.accountType)
              handleNavigate(section)
            }}
          />
        )
      case 'domains-new':
      case 'porkbun-domains':
      case 'porkbun-my-domains':
        return null
      case 'domain-manager':
        return (
          <DomainsHubSection
            variant="admin"
            isActive={isActive}
            initialTab={domainHubTab}
            sites={domainHubSites}
            packages={directAdminPackages}
            onRefresh={() => void loadDirectAdminData(true)}
            onCreateEmail={(domain) => {
              setPreSelectedEmailDomain(domain)
              setActiveSection('cp-email-mgmt')
            }}
            onNavigate={(section, opts) => {
              if (opts?.domain) setSelectedDNSDomain(opts.domain)
              setActiveSection(section)
            }}
            onHubPanelClose={() => setDomainHubTab('meus')}
          />
        )
      case 'cp-subdomains':
        return null
      case 'website-preview':
        return <WebsitePreviewSection sites={filteredSites} />
      case 'email-import':
        return <EmailImportSection sites={filteredSites} />
      case 'cp-list-subdomains':
        return <ListSubdomainsSection sites={filteredSites} />
      case 'cp-modify-website':
        return <ModifyWebsiteSection sites={filteredSites} packages={directAdminPackages} />
      case 'cp-suspend-website':
        return <SuspendWebsiteSection sites={filteredSites} onRefresh={() => void loadDirectAdminData(true)} />
      case 'cp-delete-website':
        return <DeleteWebsiteSection sites={filteredSites} onRefresh={() => void loadDirectAdminData(true)} />
      case 'cp-databases':
        return <DatabasesSection sites={filteredSites} initialDomain={selectedDatabaseDomain || selectedDNSDomain || primaryDomain} />
      case 'cp-ftp':
        return <FTPSection sites={filteredSites} />
      case 'webmail':
      case 'emails-webmail':
        return <WebmailSection
          userEmail={sessionUser}
          sites={filteredSites}
          useDirectAdminAPI={true}
          emailOrigem="geral@visualdesignmoz.com"
          onComposeStateChange={setIsComposeActive}
          isAdmin={true}
          onNavigate={handleNavigate}
        />
      case 'emails-new':
      case 'cp-email-mgmt':
        return <EmailManagementSection sites={filteredSites} preSelectedDomain={preSelectedEmailDomain} isActive={isActive} />
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
      case 'da-emails':
        return <DirectAdminEmailsSection />
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
        return <CPUsersSection variant="panels" panelScope="users" isActive={isActive} onBootstrapRefresh={() => void loadDirectAdminData(true)} />
      case 'cp-reseller':
        return <ResellerSection />
      case 'cp-ssl':
        return (
          <SSLSection
            sites={filteredSites}
            initialDomain={selectedSslDomain || primaryDomain}
            setActiveSection={setActiveSection}
            setSelectedSslViewHostname={setSelectedSslViewHostname}
          />
        )
      case 'cp-ssl-view':
        return (
          <SSLViewSection
            sites={filteredSites}
            initialHostname={selectedSslViewHostname || selectedSslDomain || primaryDomain}
            setActiveSection={setActiveSection}
          />
        )
      case 'cp-security':
        return <SSLSection sites={filteredSites} setActiveSection={setActiveSection} />
      case 'cp-dns-cloudflare':
        return (
          <DNSCentralSection
            sites={filteredSites}
            initialDomain={selectedDNSDomain || primaryDomain}
          />
        )
      case 'cp-php':
        return <PHPConfigSection sites={filteredSites} />
      case 'cp-api':
      case 'infrastructure':
        return <APIConfigSection />
      case 'backup-manager':
      case 'cp-backup':
      case 'cp-wp-backup':
      case 'cp-wp-restore-backup':
      case 'cp-wp-remote-backup':
      case 'wp-backup':
        return (
          <BackupManagerSection
            sites={filteredSites}
            initialDomain={selectedBackupDomain || primaryDomain}
            isActive={isActive}
          />
        )
      case 'wp-sites':
      case 'cp-wp-list':
        return (
          <ListWebsitesSection
            sites={filteredSites}
            wordpressOnly
            onRefresh={() => void loadDirectAdminData(true)}
            packages={directAdminPackages}
            setActiveSection={setActiveSection}
            setFileManagerDomain={setFileManagerDomain}
            setSelectedDNSDomain={setSelectedDNSDomain}
            setSelectedSslDomain={setSelectedSslDomain}
            primaryDomain={accountPrimaryDomain}
            loadDirectAdminData={loadDirectAdminData}
            syncing={syncing}
            handleSync={handleSync}
            daLoadError={daLoadError}
          />
        )
      case 'wp-plugins':
      case 'cp-wp-plugins':
      case 'wp-update':
        return (
          <WordPressHubSection
            sites={filteredSites}
            initialTab="plugins"
            autoSelectFirstWp
            setFileManagerDomain={setFileManagerDomain}
            setActiveSection={setActiveSection}
            onRefresh={() => void loadDirectAdminData(true)}
          />
        )
      case 'wordpress-install':
        return (
          <WordPressHubSection
            sites={filteredSites}
            initialTab="install"
            setFileManagerDomain={setFileManagerDomain}
            setActiveSection={setActiveSection}
            onRefresh={() => void loadDirectAdminData(true)}
          />
        )
      case 'cp-audit-sync':
        return <AuditSyncSection onRefresh={() => void loadDirectAdminData(true)} />
      case 'cp-dns-nameserver':
        return (
          <NameserverManagementSection
            sites={filteredSites}
            initialDomain={selectedDNSDomain || primaryDomain}
          />
        )
      case 'cp-dns-default-ns':
        return <DNSDefaultNSSection />
      case 'cp-dns-create-zone':
        return <DNSCreateZoneSection sites={filteredSites} />
      case 'domains-dns':
      case 'dns-central':
      case 'cp-dns-zone-editor':
        return (
          <DNSCentralSection
            sites={filteredSites}
            initialDomain={selectedDNSDomain || primaryDomain}
          />
        )
      case 'cp-dns-delete-zone':
        return <DNSDeleteZoneSection sites={filteredSites} />
      case 'cp-dns-reset':
        return <DNSResetSection sites={filteredSites} />
      case 'transferir-dominio':
        return <DomainTransferSection />
      case 'newsletter':
        return (
          <MailMarketingSection
            sites={filteredSites}
            currentUserEmail={sessionUser || undefined}
            activeTab={mailMarketingTab}
            onTabChange={setMailMarketingTab}
          />
        )
      case 'git-deploy':
        return <GitDeploySection />
      case 'deploy':
        return <DeploySection sites={directAdminSites} />
      case 'packages-list':
        return <PackagesSection packages={directAdminPackages} onRefresh={() => void loadDirectAdminData(true)} isActive={isActive} />
      case 'page-builders':
        // Redirecionar para a página de construtores
        if (typeof window !== 'undefined') {
          window.location.href = '/admin/page-builders';
        }
        return <div className="p-8 text-center text-gray-500">Redirecionando para construtores...</div>;
      case 'templates-saved':
        return <div className="p-8"><h2 className="text-2xl font-bold mb-4">Templates Salvos</h2><p className="text-gray-600">Funcionalidade em desenvolvimento.</p></div>;
      default:
        return <CpanelDashboard sites={filteredSites} users={directAdminUsers} isFetching={isFetchingDirectAdmin} onNavigate={setActiveSection} onRefresh={() => void loadDirectAdminData(true)} onSetFileManagerDomain={setFileManagerDomain} />
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
          await fetch('/api/admin/sync-directadmin-users', { method: 'POST' });
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
  const handleNavigate = (section: string, opts?: { accountType?: 'client' | 'reseller' | 'admin' }) => {
    if (section === 'provision-client') {
      setProvisionAccountType(opts?.accountType || 'client')
    }
    if (section === 'hospedagem-contas') {
      setContasListResetToken((t) => t + 1)
    }
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
    // Se navegar para gestão de emails, definir domínio padrão visualdesignmoz.com
    if (section === 'emails-new' || section === 'cp-email-mgmt') {
      setPreSelectedEmailDomain('visualdesignmoz.com')
    }
    if (isDomainHubSection(section)) {
      setDomainHubTab(sectionToDomainTab(section))
      setActiveSection('domain-manager')
      return
    }
    setActiveSection(section)
  }

  return (
    <div className="panel-shell font-panel flex h-screen overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <AdminSidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        sessionUser={sessionUser}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PanelHeader
          title={chrome?.title ?? getSectionInfo(activeSection).title}
          description={chrome?.description ?? getSectionInfo(activeSection).description}
          back={chrome?.back}
          search={
            chrome?.search ??
            (activeSection === 'dashboard' && !chrome
              ? {
                  value: dashboardSearch,
                  onChange: setDashboardSearch,
                  placeholder: 'Pesquisar ferramentas...',
                }
              : undefined)
          }
          toolbar={chrome?.toolbar}
          alerts={chrome?.alerts}
          hidden={isComposeActive && activeSection === 'webmail'}
          actions={
            <>
              {activeSection === 'dashboard' ? (
                <a
                  href={getDirectAdminAccessUrl('admin')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={panelBtnSecondary}
                  title="Entrada automática no DirectAdmin"
                >
                  <Server size={14} />
                  <span>DirectAdmin</span>
                </a>
              ) : null}
              <button
                onClick={async () => { await createClientInstance.auth.signOut(); window.location.href = '/auth/login'; }}
                className={panelBtnSecondary}
                title={t('sidebar.logout')}
              >
                <LogOut size={14} />
                <span>Sair</span>
              </button>
            </>
          }
        />

        <main className={`panel-content flex-1 ${['webmail', 'cp-reseller', 'cp-reseller-permissions'].includes(activeSection) ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 lg:p-5'}`}>
          <div className={`${activeSection === 'webmail' ? 'h-full min-h-0' : 'min-h-full'}`}>
            <PanelSectionKeepAlive activeSection={activeSection} renderSection={renderSectionFor} />
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
