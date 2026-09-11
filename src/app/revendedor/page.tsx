'use client'

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

import {
  LogOut, RefreshCw, ChevronRight, Globe, Lock, Edit, Plus, Search, LockOpen, ExternalLink, Server, Archive, Database, Power, Trash2, Home, Users, Mail, Layout, Shield, ShieldCheck, Settings, Download, Send, Code, FolderOpen, Upload, X, Zap, Cloud, RotateCcw, FileCode, CheckCircle, HardDrive, FileText, AlertCircle, ChevronDown, Globe2, Plug, Layers, List, ChevronLeft, Bell, PauseCircle, Palette, Calendar, Clock, Eye, EyeOff
} from 'lucide-react'
import { getDirectAdminAccessUrl, getSnappyMailUrl, getServerHost, getCPUrl } from '@/lib/server-config';
import { ResellerSidebar } from '@/components/revendedor/ResellerSidebar'
import { ImpersonationBanner } from '@/components/encomendas/ImpersonationBanner'
import { Spinner } from '@/components/ui/spinner'
import { panelDashboardGrid, panelDashboardToolCard, panelDashboardToolLabel, panelSectionPadding, panelBtnSecondary } from '@/lib/panel-ui'
import { usePanelSidebarCollapsed } from '@/hooks/usePanelSidebarCollapsed'
import { ResellerDirectAccessSection } from '@/components/revendedor/ResellerDirectAccessSection'
import { ResellerDashboard } from '@/components/revendedor/ResellerDashboard'
import { WebmailSection } from '@/components/dashboard/WebmailSection'
import {
  DatabasesSection, FTPSection, EmailManagementSection,
  CPUsersSection, SSLSection, SSLViewSection, SecuritySection, PHPConfigSection,
  APIConfigSection, WPPluginsSection,
  ResellerSection, ModifyWebsiteSection, SuspendWebsiteSection,
  DeleteWebsiteSection, DNSDefaultNSSection,
  DNSCreateZoneSection, DNSDeleteZoneSection, CloudFlareSection,
  DNSResetSection, EmailDeleteSection, EmailLimitsSection,
  EmailForwardingSection, CatchAllEmailSection, PatternForwardingSection,
  PlusAddressingSection, EmailChangePasswordSection, DKIMManagerSection,
  WPRestoreBackupSection, WPRemoteBackupSection, ListSubdomainsSection,
  WebsitePreviewSection, EmailImportSection,
  PackagesSection, DNSZoneEditorSection, FileManagerSection, BackupManagerSection,
  WordPressInstallSection, WPBackupSection, DomainManagerSection, DeploySection,
  SMTPConfigSection, NameserverManagementSection
} from '../dashboard/DirectAdminSections'
import { ClientesDaSection } from '../dashboard/ClientesDaSection'
import { NotificationsSection } from '../dashboard/NotificationsSection'
import { RenewalsSection } from '../dashboard/RenewalsSection'
import { TemplatesSection } from '../dashboard/TemplatesSection'
import { DNSCentralSection } from '../dashboard/DNSCentralSection'
import { DomainTransferSection } from '../dashboard/DomainTransferSection'
import { DomainDetailSection } from '../dashboard/DomainDetailSection'
import {
  DomainsHubSection,
  type DomainHubTab,
} from '../dashboard/DomainsHubSection'
import { PanelPermissionsConfig } from '../dashboard/PanelPermissionsConfig'
import { ProvisionClienteSection } from '../dashboard/ProvisionClienteSection'
import { ProvisionAccountFormInline } from '../dashboard/ProvisionAccountFormInline'
import { ResellerProvisionForm } from '../dashboard/ResellerProvisionForm'
import { createDefaultResellerPackageForm } from '@/lib/reseller-package-form'
import { ResellerSettingsSection } from '@/components/revendedor/ResellerSettingsSection'
import { fetchCompanyLogoUrl } from '@/components/admin/CompanyLogoUpload'
import { ResellerProfileSection } from '@/components/revendedor/ResellerProfileSection'
import { ResellerNotificationsInbox } from '@/components/revendedor/ResellerNotificationsInbox'
import { directAdminAPI as panelAPI } from '@/lib/directadmin-api'
import { supabase as createClientInstance } from '@/lib/supabase'
import type { DirectAdminWebsite, DirectAdminUser, DirectAdminPackage } from '@/lib/directadmin-api'
import { cn } from '@/lib/utils'
import { MailMarketingSection } from '@/components/dashboard/MailMarketingSection'
import {
  fetchPanelBootstrap,
  fetchPanelBootstrapStaleWhileRevalidate,
  readBootstrapCache,
  clearPanelBootstrapCache,
  type PanelBootstrapData,
} from '@/lib/panel-data-from-server'
import { prefetchPanelContentFromBootstrap, resolvePrimaryDomainFromSites } from '@/lib/panel-prefetch'
import { OSHER_DOMAIN } from '@/lib/email-domains'
import { excludeResellerSelfPackages } from '@/lib/panel-contas-enrich'
import { WordPressHubSection } from '../dashboard/WordPressHubSection'
import { getPanelSectionMeta } from '@/lib/panel-section-meta'
import { resolvePanelNavigation, resolveSectionId, type PanelMenuItemDef } from '@/lib/panel-admin-menu'
import { PanelSectionKeepAlive } from '@/components/panel/PanelSectionKeepAlive'
import { PanelHeader } from '@/components/panel/PanelHeader'
import { AdminSectionChromeProvider, useAdminSectionChrome } from '@/components/admin/AdminSectionChrome'
import { ListWebsitesSection as PanelListWebsitesSection } from '@/components/panel/ListWebsitesSection'

const directAdminAPI = panelAPI

// Helper global para parse de state
const parseState = (state: any): string => {
  if (state === 1 || state === '1' || state === 'Active') return 'Active'
  if (state === 0 || state === '0' || state === 'Suspended') return 'Suspended'
  return state || 'Active'
}

// Secções que precisam de criar websites
function CreateWebsiteSection({ packages, onRefresh }: { packages: DirectAdminPackage[], onRefresh: () => void }) {
  const { t } = useI18n()
  const [form, setForm] = useState({ domain: '', email: '', username: 'admin', packageName: 'Default', php: '8.2' })
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  const handleCreate = async () => {
    if (!form.domain || !form.email) return
    setCreating(true); setMsg(''); setMsgType('')
    try {
      const ok = await directAdminAPI.createWebsite(form)
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
          {creating ? <Spinner className="w-4 h-4" /> : <Globe className="w-4 h-4" />} {creating ? t('admin.sites.newDesc').split(' ')[0] + '...' : t('admin.sites.new')}
        </button>
      </div>
    </div>
  )
}

// Simple domain list section - shows only domain names (card layout, same as admin)
function ListDomainsSection({ sites, onRefresh, setActiveSection }: {
  sites: DirectAdminWebsite[],
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
                      ● {parseState(site.state) === 'Active' ? 'Activo' : 'Suspenso'}
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
                    setActiveSection('domain-detail');
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
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params: { domain } })
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        alert('Erro: ' + (data.data?.output || data.error || 'desconhecido'))
      }
      await onRefresh()
    } catch (e: any) {
      alert('Erro de ligação: ' + e.message)
    }
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
                        setActiveSection('domain-detail');
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
                        {loading === s.domain ? <Spinner className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                        {parseState(s.state) === 'Active' ? 'Suspender' : 'Reactivar'}
                      </button>
                      <button
                        onClick={() => handleDelete(s.domain)}
                        disabled={loading === s.domain}
                        className="flex items-center gap-1.5 bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 px-4 py-2 rounded text-xs font-bold transition-colors disabled:opacity-50">
                        {loading === s.domain ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

function ListWebsitesSection({ sites, onRefresh, packages, setActiveSection, setFileManagerDomain, setSelectedDNSDomain, loadDirectAdminData, syncing, handleSync }: {
  sites: DirectAdminWebsite[],
  onRefresh: () => void,
  packages: DirectAdminPackage[],
  setActiveSection: (section: string) => void,
  setFileManagerDomain: (domain: string) => void,
  setSelectedDNSDomain: (domain: string) => void,
  loadDirectAdminData: () => void,
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
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params: { domain } })
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        alert('Erro: ' + (data.data?.output || data.error || 'desconhecido'))
      }
      await onRefresh()
    } catch (e: any) {
      alert('Erro de ligação: ' + e.message)
    }
    setLoading(null)
  }

  const handleSaveField = async (domain: string, field: string, value: string) => {
    setLoading(domain)
    let command = ''

    try {
      if (field === 'php') {
        command = `directadmin changePHP --domainName ${domain} --phpVersion "${value}" 2>&1`
      } else if (field === 'package') {
        command = `directadmin changePackage --domainName ${domain} --packageName "${value}" 2>&1`
      } else {
        // Para outros campos, usa modifyWebsite
        const res = await fetch('/api/server-exec', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'modifyWebsite', params: { domain, [field]: value } })
        })
        const data = await res.json().catch(() => ({}))
        if (!data.success) {
          alert('Erro: ' + (data.data?.output || data.error || 'desconhecido'))
        }
        setEditingField(null)
        await onRefresh()
        setLoading(null)
        return
      }

      const res = await fetch('/api/server-exec', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execCommand', params: { command } })
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        alert('Erro: ' + (data.data?.output || data.error || 'desconhecido'))
      }
      setEditingField(null)
      await onRefresh()
    } catch (e: any) {
      alert('Erro de ligação: ' + e.message)
    }
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
            sites.forEach(s => rows.push([s.domain, getServerHost(), s.state || 'Active', (s as any).package || 'Default']))
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
                    setActiveSection('domain-detail');
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
                      <p className="text-sm font-bold text-gray-900">{(s as any).ip || getServerHost()}</p>
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
                    onClick={() => {
                      setSelectedDNSDomain(s.domain)
                      setActiveSection('dns-central')
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
                          params: { command: `mkdir -p /home/backup/full && directadmin createBackup --domainName ${s.domain} --backupPath /home/backup/full 2>&1` }
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
                      ? <Spinner className="w-3.5 h-3.5" />
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
                {creating ? <><Spinner className="w-4 h-4" /> A criar...</> : '+ Criar Website'}
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
  const [listError, setListError] = useState('')

  const carregarClientes = async () => {
    setLoading(true)
    setListError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?order=created_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setClientes([])
        setListError(err.message || `Erro ao carregar clientes (${res.status})`)
      } else {
        const data = await res.json()
        setClientes(Array.isArray(data) ? data : [])
      }
    } catch (e: any) {
      setClientes([])
      setListError(e.message || 'Erro de ligação ao carregar clientes')
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
            {salvando ? <><Spinner className="w-4 h-4" />{t('admin.clientSection.saving')}</> : t('admin.clientSection.create')}
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

      {listError && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
          <span>{listError}</span>
          <button onClick={() => void carregarClientes()} className="font-bold underline shrink-0">
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="w-6 h-6" />
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          {listError ? '' : busca ? t('admin.clientSection.notFound') : t('admin.clientSection.empty')}
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

/** Reaproveitado tal e qual por /profissional (ver src/app/profissional/page.tsx)
 * — mesmo painel, só com menuDefs e basePath diferentes. */
export default function ResellerPage({
  menuDefs,
  basePath = '/revendedor',
}: {
  menuDefs?: PanelMenuItemDef[]
  basePath?: string
} = {}) {
  return (
    <AdminSectionChromeProvider>
      <ResellerPageContent menuDefs={menuDefs} basePath={basePath} />
    </AdminSectionChromeProvider>
  )
}

function ResellerPageContent({
  menuDefs,
  basePath,
}: {
  menuDefs?: PanelMenuItemDef[]
  basePath: string
}) {
  const router = useRouter()
  const { chrome } = useAdminSectionChrome()
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState('dashboard')
  const { isCollapsed, setIsCollapsed, isMobile } = usePanelSidebarCollapsed()
  const [fileManagerDomain, setFileManagerDomain] = useState('')
  const [directAdminSites, setDirectAdminSites] = useState<DirectAdminWebsite[]>([])
  const [directAdminUsers, setDirectAdminUsers] = useState<DirectAdminUser[]>([])
  const [directAdminPackages, setDirectAdminPackages] = useState<DirectAdminPackage[]>([])
  const [hestiaOnly, setHestiaOnly] = useState(false)
  const [isFetchingDirectAdmin, setIsFetchingDirectAdmin] = useState(false)
  const [selectedDatabaseDomain, setSelectedDatabaseDomain] = useState('')
  const [selectedManageDomain, setSelectedManageDomain] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('panel_last_managed_domain_reseller') || ''
    }
    return ''
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && selectedManageDomain) {
      localStorage.setItem('panel_last_managed_domain_reseller', selectedManageDomain)
    }
  }, [selectedManageDomain])
  const [preSelectedEmailDomain, setPreSelectedEmailDomain] = useState<string>('')
  const [sessionUser, setSessionUser] = useState<string | null>(null)
  const [resellerDisplayName, setResellerDisplayName] = useState<string | null>(null)
  const [resellerDaUsername, setResellerDaUsername] = useState<string | null>(null)
  const [resellerPrimaryDomain, setResellerPrimaryDomain] = useState<string | null>(null)
  const [isResellerSession, setIsResellerSession] = useState(false)
  const [isAdminImpersonating, setIsAdminImpersonating] = useState(false)
  const [isComposeActive, setIsComposeActive] = useState(false)
  const [mailMarketingTab, setMailMarketingTab] = useState<'comp' | 'subs' | 'camp'>('comp')
  const [domainHubTab, setDomainHubTab] = useState<DomainHubTab>('meus')
  const [logoUrl, setLogoUrl] = useState<string>('/assets/simbolo.png');

  useEffect(() => {
    fetchCompanyLogoUrl().then((url) => { if (url) setLogoUrl(url); });
  }, []);

  const searchParams = useSearchParams();
  const initialLoadDone = useRef(false);
  // Marca que acabámos de entrar em impersonate — o efeito que carrega os
  // dados do painel (mais abaixo) lê esta flag para forçar um pedido fresco
  // em vez de confiar na ordem de execução entre os dois efeitos (a cache
  // podia ainda não estar limpa quando o carregamento inicial a lia,
  // mostrando os dados/email do admin em vez do revendedor impersonado).
  const justImpersonatedRef = useRef(false);

  // Efeito para capturar section da URL - garantir dashboard como padrão
  useEffect(() => {
    // Sempre definir dashboard como padrão na carga inicial/recarga da página
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      if (searchParams.get('impersonate') === '1') {
        clearPanelBootstrapCache('reseller');
        justImpersonatedRef.current = true;
        window.history.replaceState({}, '', basePath);
      }
      setActiveSection('dashboard');
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
    if (window.__selectedManageDomain && activeSection === 'domain-detail') {
      // @ts-ignore
      setSelectedManageDomain(window.__selectedManageDomain);
      // @ts-ignore
      window.__selectedManageDomain = null;
    } else if (activeSection !== 'domain-detail') {
      setSelectedManageDomain('');
    }
  }, [activeSection]);

  // Efeito para limpar preSelectedEmailDomain quando sair da seção de email
  useEffect(() => {
    if (!activeSection.includes('email') && !activeSection.includes('cp-email')) {
      setPreSelectedEmailDomain('');
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'cp-ssl') {
      setSelectedSslDomain('');
    }
    if (activeSection !== 'cp-ssl-view') {
      setSelectedSslViewHostname('');
    }
  }, [activeSection]);


  const applyBootstrap = (boot: PanelBootstrapData) => {
    setDirectAdminSites(boot.sites)
    setDirectAdminUsers(boot.users)
    setDirectAdminPackages(boot.packages)
    setHestiaOnly(Boolean(boot.hestiaOnly || boot.hostingOwner))

    if (boot.resellerContext) {
      setResellerDaUsername(boot.resellerContext.daUsername)
      setSessionUser(boot.resellerContext.email)
      setResellerDisplayName(boot.resellerContext.displayName || null)
      setIsResellerSession(!boot.resellerContext.impersonating)
      setIsAdminImpersonating(Boolean(boot.resellerContext.impersonating))
      if (boot.resellerContext.primaryDomain) {
        setResellerPrimaryDomain(boot.resellerContext.primaryDomain)
      } else if (boot.resellerContext.daUsername) {
        const resolved = resolvePrimaryDomainFromSites(boot.sites, boot.resellerContext.daUsername)
        if (resolved) setResellerPrimaryDomain(resolved)
      }
    }

    prefetchPanelContentFromBootstrap(boot, 'reseller')
  }

  const bootstrapCacheApplied = useRef(false)
  useLayoutEffect(() => {
    if (bootstrapCacheApplied.current) return
    bootstrapCacheApplied.current = true
    // Acabado de entrar em impersonate — nunca aplicar a cache daqui (seria
    // do admin, de antes de impersonar); o efeito mais abaixo já força um
    // pedido fresco.
    if (searchParams.get('impersonate') === '1') return
    const cached = readBootstrapCache('reseller')
    if (cached) applyBootstrap(cached)
  }, [])

  const loadDirectAdminData = async (fresh = false) => {
    if (fresh) clearPanelBootstrapCache('reseller')

    const cached = !fresh ? readBootstrapCache('reseller') : null
    if (cached) {
      applyBootstrap(cached)
    } else {
      setIsFetchingDirectAdmin(true)
    }

    try {
      let latestBoot: PanelBootstrapData | null = cached
      if (cached && !fresh) {
        await fetchPanelBootstrapStaleWhileRevalidate((data) => {
          applyBootstrap(data)
          latestBoot = data
        }, 'reseller')
      } else {
        const boot = await fetchPanelBootstrap({ fresh: true, scope: 'reseller' })
        applyBootstrap(boot)
        latestBoot = boot
      }

      if (!latestBoot?.resellerContext) {
        const { data: { session } } = await createClientInstance.auth.getSession()
        const role = session?.user?.user_metadata?.role || session?.user?.app_metadata?.role
        if (role === 'reseller') {
          setIsResellerSession(true)
        }
        if (session?.user?.email) {
          setSessionUser(session.user.email.toLowerCase())
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados do painel:', error)
      const message = error instanceof Error ? error.message : ''
      if (
        message.includes('Não autorizado') ||
        message.includes('Unauthorized') ||
        message.includes('Acesso negado')
      ) {
        router.push('/login')
        return
      }
    } finally {
      setIsFetchingDirectAdmin(false)
    }
  }

  const [syncing, setSyncing] = useState(false)
  const [selectedDNSDomain, setSelectedDNSDomain] = useState<string>('')
  const [selectedSslDomain, setSelectedSslDomain] = useState<string>('')
  const [selectedSslViewHostname, setSelectedSslViewHostname] = useState<string>('')
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
    void loadDirectAdminData(justImpersonatedRef.current)
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      clearPanelBootstrapCache('reseller')
      await loadDirectAdminData(true)
    } catch (e) { console.error(e) }
    setSyncing(false)
  }

  // Apenas sites do revendedor activo
  const filteredSites = directAdminSites.filter((s) => {
    if (s.domain.includes('contaboserver')) return false
    if (s.domain.toLowerCase().startsWith('mail.')) return false
    const scopeUser = resellerDaUsername
    if (scopeUser) {
      if (s.owner && s.owner !== scopeUser) return false
    } else if (isResellerSession) {
      return false
    }
    return true
  })

  const primaryDomain =
    resellerPrimaryDomain ||
    resolvePrimaryDomainFromSites(filteredSites, resellerDaUsername) ||
    OSHER_DOMAIN

  const sortedSites = [...filteredSites].sort((a, b) => {
    const primary = primaryDomain.toLowerCase()
    const aPri = a.domain.toLowerCase() === primary ? 0 : 1
    const bPri = b.domain.toLowerCase() === primary ? 0 : 1
    if (aPri !== bPri) return aPri - bPri
    return a.domain.localeCompare(b.domain)
  })

  const scopedPackages = useMemo(() => {
    if (!resellerDaUsername) return directAdminPackages
    return excludeResellerSelfPackages(directAdminPackages, filteredSites, resellerDaUsername)
  }, [directAdminPackages, filteredSites, resellerDaUsername])

  const RESELLER_SECTION_META: Record<string, { title: string; description: string }> = {
    'notificacoes-recebidas': { title: 'Notificações', description: 'Mensagens recebidas na sua conta' },
    'acesso-directo': { title: 'Acesso directo', description: 'Entrada no servidor, webmail e ferramentas' },
    'settings-branding': { title: 'Branding e logo', description: 'Personalização da marca no painel' },
    'settings-profile': { title: 'Meu perfil', description: 'Dados da sua conta de revenda' },
  }

  const getSectionInfo = (section: string): { title: string; description: string } =>
    RESELLER_SECTION_META[section] ?? getPanelSectionMeta(section)

  const renderSectionFor = (sectionId: string, isActive: boolean) => {
    switch (sectionId) {
      case 'dashboard':
        return (
          <ResellerDashboard
            sites={filteredSites}
            isFetching={isFetchingDirectAdmin}
            onNavigate={handleNavigate}
            onRefresh={() => void loadDirectAdminData(true)}
            onSetFileManagerDomain={setFileManagerDomain}
            onSetDNSDomain={setSelectedDNSDomain}
            sessionUser={sessionUser}
            displayName={resellerDisplayName}
            activeDaUsername={resellerDaUsername}
          />
        )
      case 'acesso-directo':
        return (
          <ResellerDirectAccessSection
            sessionEmail={sessionUser}
            onOpenWebmailInPanel={() => handleNavigate('webmail')}
            hideDirectAdmin={hestiaOnly}
          />
        )
      case 'domains':
        return <ListWebsitesSection
          sites={filteredSites}
          onRefresh={() => void loadDirectAdminData(true)}
          packages={directAdminPackages}
          setActiveSection={setActiveSection}
          setFileManagerDomain={setFileManagerDomain}
          setSelectedDNSDomain={setSelectedDNSDomain}
          loadDirectAdminData={loadDirectAdminData}
          syncing={syncing}
          handleSync={handleSync}
        />
      case 'domains-list':
        return <ListDomainsSection
          sites={filteredSites}
          onRefresh={() => void loadDirectAdminData(true)}
          setActiveSection={setActiveSection}
        />
      case 'file-manager':
      case 'cp-file-manager':
        return <FileManagerSection domain={fileManagerDomain || primaryDomain} sites={sortedSites} isActive={isActive} />
      case 'cp-client-permissions':
        return <PanelPermissionsConfig role="client" />
      case 'cp-reseller-permissions':
        return <PanelPermissionsConfig role="reseller" />
      case 'provision-client':
      case 'cp-client-permissions':
      case 'cp-reseller-permissions':
      case 'clientes':
      case 'revendedores':
        return (
          <div className="w-full rounded border border-gray-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm text-gray-600 dark:text-zinc-400">Secção não disponível neste painel.</p>
          </div>
        )
      case 'domains-new':
        return <CreateWebsiteSection packages={directAdminPackages} onRefresh={() => void loadDirectAdminData(true)} />
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
      case 'databases':
      case 'cp-databases':
        return <DatabasesSection sites={filteredSites} initialDomain={selectedDatabaseDomain || selectedDNSDomain || primaryDomain} loggedInOwner={resellerDaUsername || undefined} />
      case 'cp-ftp':
        return <FTPSection sites={filteredSites} />
      case 'webmail':
      case 'emails-webmail':
        return <WebmailSection
          userEmail={sessionUser}
          sites={filteredSites}
          useDirectAdminAPI={true}
          emailOrigem={sessionUser || `noreply@${primaryDomain}`}
          onComposeStateChange={setIsComposeActive}
          isAdmin={false}
          onNavigate={handleNavigate}
          onBack={() => setActiveSection('dashboard')}
        />
      case 'emails-new':
      case 'cp-email-mgmt':
        return <EmailManagementSection sites={filteredSites} preSelectedDomain={preSelectedEmailDomain} isActive={isActive} ownerScopeToSites />
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
      case 'notifications':
        return <NotificationsSection />
      case 'notificacoes-recebidas':
        return <ResellerNotificationsInbox />
      case 'renewals':
        return <RenewalsSection initialTab="overview" hideTabs={true} />
      case 'templates-renovacao':
        return <TemplatesSection />
      case 'cadastrar-renovacao':
        return <RenewalsSection initialTab="add" hideTabs={true} />
      case 'cp-users':
        return <CPUsersSection key={resellerDaUsername || 'reseller'} onBootstrapRefresh={() => void loadDirectAdminData(true)} />
      case 'cp-reseller':
        return <ResellerSection />
      case 'hospedagem-contas':
        return (
          <ClientesDaSection
            variant="reseller"
            listFilter="all"
            packages={scopedPackages}
            initialView="list"
            isActive={isActive}
            onRefresh={() => void loadDirectAdminData(true)}
          />
        )
      case 'audit-form-create':
        return (
          <ProvisionClienteSection
            packages={scopedPackages}
            initialAccountType="client"
            mode="create"
            accountsApiBase="/api/revendedor/contas"
            onCancel={() => setActiveSection('hospedagem-contas')}
          />
        )
      case 'audit-form-edit':
        return (
          <ProvisionClienteSection
            packages={scopedPackages}
            mode="edit"
            editUser={{
              userName: 'joaosilva',
              email: 'joao.silva@exemplo.com',
              firstName: 'João',
              lastName: 'Silva',
              primaryDomain: 'joaosilva.com',
              packageName: 'Standard',
              type: 'client',
              websitesLimit: 5,
              emailsLimit: 50,
            }}
            accountsApiBase="/api/revendedor/contas"
            onCancel={() => setActiveSection('hospedagem-contas')}
          />
        )
      case 'audit-form-password':
        return <AuditFormPasswordDemo />
      case 'audit-form-message':
        return <AuditFormMessageDemo />
      case 'audit-form-inline':
        return (
          <ProvisionAccountFormInline
            packages={scopedPackages}
            initialAccountType="client"
            onCancel={() => setActiveSection('hospedagem-contas')}
          />
        )
      case 'audit-form-reseller':
        return <AuditFormResellerDemo />
      case 'cp-ssl':
        return (
          <SSLSection
            sites={sortedSites}
            initialDomain={selectedSslDomain || primaryDomain}
            setActiveSection={setActiveSection}
            setSelectedSslViewHostname={setSelectedSslViewHostname}
          />
        )
      case 'cp-ssl-view':
        return (
          <SSLViewSection
            sites={sortedSites}
            initialHostname={selectedSslViewHostname || selectedSslDomain || primaryDomain}
            setActiveSection={setActiveSection}
          />
        )
      case 'cp-security':
        return <SecuritySection sites={filteredSites} />
      case 'cp-php':
        return <PHPConfigSection sites={filteredSites} />
      case 'cp-api':
      case 'infrastructure':
        return <APIConfigSection />
      case 'domain-manager':
        return (
          <DomainsHubSection
            variant="reseller"
            isActive={isActive}
            initialTab={domainHubTab}
            sites={filteredSites}
            packages={scopedPackages}
            onRefresh={() => void loadDirectAdminData(true)}
            onCreateEmail={(domain) => {
              setPreSelectedEmailDomain(domain)
              setActiveSection('cp-email-mgmt')
            }}
            onNavigate={(section, opts) => {
              if (opts?.domain) setSelectedDNSDomain(opts.domain)
              handleNavigate(section)
            }}
            onHubPanelClose={() => setDomainHubTab('meus')}
          />
        )
      case 'deploy':
        return <DeploySection sites={filteredSites} />
      case 'packages-new':
        return <PackagesSection packages={scopedPackages} panelScope="reseller" onRefresh={() => void loadDirectAdminData(true)} />
      case 'reports':
      case 'analyses':
      case 'cp-audit-sync':
        return (
          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Métricas e relatórios</h2>
            <p className="text-sm text-gray-500">
              {hestiaOnly
                ? 'As métricas de sites e contas estão nas secções do próprio painel.'
                : 'Consulte estatísticas detalhadas no DirectAdmin nativo ou use o Centro DirectAdmin.'}
            </p>
            {!hestiaOnly ? (
            <a
              href={getDirectAdminAccessUrl('reseller')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex mt-4 text-sm font-bold text-red-600 hover:underline"
            >
              Abrir DirectAdmin →
            </a>
            ) : null}
          </div>
        )

      case 'cp-wp-list':
      case 'wp-sites':
        return (
          <PanelListWebsitesSection
            sites={sortedSites}
            wordpressOnly
            panelScope="reseller"
            wordpressOwner={resellerDaUsername ?? undefined}
            onRefresh={() => void loadDirectAdminData(true)}
            packages={scopedPackages}
            setActiveSection={setActiveSection}
            setFileManagerDomain={setFileManagerDomain}
            setSelectedDNSDomain={setSelectedDNSDomain}
            setSelectedSslDomain={setSelectedSslDomain}
            primaryDomain={primaryDomain}
            loadDirectAdminData={loadDirectAdminData}
            syncing={syncing}
            handleSync={handleSync}
          />
        )
      case 'cp-wp-plugins':
      case 'wp-plugins':
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
      case 'cp-wp-restore-backup':
        return <WPRestoreBackupSection sites={filteredSites} />
      case 'cp-wp-remote-backup':
        return <WPRemoteBackupSection sites={filteredSites} />
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
      case 'cp-dns-cloudflare':
        return <CloudFlareSection sites={filteredSites} />
      case 'cp-dns-reset':
        return <DNSResetSection sites={filteredSites} />
      case 'transferir-dominio':
        return <DomainTransferSection />
      case 'newsletter':
      case 'newsletter-subs':
      case 'newsletter-comp':
      case 'newsletter-camp':
        const derivedTab = activeSection === 'newsletter-subs' ? 'subs' :
          activeSection === 'newsletter-comp' ? 'comp' :
            activeSection === 'newsletter-camp' ? 'camp' : mailMarketingTab;
        return (
          <MailMarketingSection
            sites={filteredSites}
            currentUserEmail={sessionUser || undefined}
            activeTab={derivedTab}
            onTabChange={setMailMarketingTab}
            isAdminAccount={false}
          />
        )

      case 'backup-manager':
      case 'cp-backup':
      case 'cp-wp-backup':
      case 'cp-wp-restore-backup':
      case 'cp-wp-remote-backup':
        return (
          <BackupManagerSection
            sites={filteredSites}
            initialDomain={primaryDomain}
            isActive={isActive}
            setActiveSection={setActiveSection}
          />
        )
      case 'wordpress-install':
        return <WordPressInstallSection sites={filteredSites} onRefresh={() => void loadDirectAdminData(true)} />
      case 'packages-list':
        return <PackagesSection packages={scopedPackages} panelScope="reseller" onRefresh={() => void loadDirectAdminData(true)} />
      case 'domain-detail':
        return <DomainDetailSection
          domain={selectedManageDomain || primaryDomain}
          sites={filteredSites}
          onNavigate={handleNavigate}
          setActiveSection={setActiveSection}
          onRefresh={() => void loadDirectAdminData(true)}
        />
      case 'settings-branding':
        return <ResellerSettingsSection onLogoChange={(url) => setLogoUrl(url || '/assets/simbolo.png')} />;
      case 'settings-profile':
        return <ResellerProfileSection />;
      default:
        return (
          <ResellerDashboard
            sites={filteredSites}
            isFetching={isFetchingDirectAdmin}
            onNavigate={handleNavigate}
            onRefresh={() => void loadDirectAdminData(true)}
            onSetFileManagerDomain={setFileManagerDomain}
            onSetDNSDomain={setSelectedDNSDomain}
            sessionUser={sessionUser}
            displayName={resellerDisplayName}
            activeDaUsername={resellerDaUsername}
          />
        )
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
  const handleNavigate = (section: string) => {
    // Intercetar acção de criar email
    if (section === 'criar-email') {
      setEmailForm({ user: '', password: '', quota: '500' })
      setEmailMsg('')
      setShowEmailModal(true)
      return
    }
    // Intercetar acção de cadastrar renovação - abrir popup
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
    if (section === 'emails-new' || section === 'cp-email-mgmt') {
      setPreSelectedEmailDomain(primaryDomain)
    }
    const nav = resolvePanelNavigation(section)
    if (nav.domainHubTab) setDomainHubTab(nav.domainHubTab)
    setActiveSection(nav.section)
  }

  return (
    <div className="panel-shell font-panel flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-zinc-950">
      {isAdminImpersonating && (
        <ImpersonationBanner
          label={resellerDisplayName || 'revendedor'}
          subject="revendedor"
          exitEndpoint="/api/admin/impersonate?exit=1"
        />
      )}
      <div className="flex flex-1 min-h-0">
      <ResellerSidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        sessionUser={sessionUser}
        displayName={resellerDisplayName}
        customLogo={logoUrl}
        isMobile={isMobile}
        menuDefs={menuDefs}
        basePath={basePath}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950">
        <PanelHeader
          title={getSectionInfo(activeSection).title}
          description={getSectionInfo(activeSection).description}
          toolbar={chrome?.toolbar}
          search={
            activeSection === 'dashboard'
              ? {
                value: dashboardSearch,
                onChange: setDashboardSearch,
                placeholder: 'Pesquisar ferramentas...',
              }
              : undefined
          }
          hidden={isComposeActive && activeSection === 'webmail'}
          actions={
            <>
              {!hestiaOnly && ['hospedagem-contas', 'packages-list'].includes(activeSection) ? (
                <a
                  href={getDirectAdminAccessUrl('reseller')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={panelBtnSecondary}
                >
                  <Globe size={13} />
                  <span>{t('admin.settings.directadmin')}</span>
                </a>
              ) : null}
              <button
                type="button"
                onClick={async () => {
                  await createClientInstance.auth.signOut()
                  const { clearAllPanelClientCaches } = await import('@/lib/panel-session-cache-clear')
                  clearAllPanelClientCaches()
                  window.location.href = '/auth/login'
                }}
                className={panelBtnSecondary}
                title={t('sidebar.logout')}
              >
                <LogOut size={14} />
                <span>Sair da Conta</span>
              </button>
            </>
          }
        />

        <main
          className={`flex-1 min-h-0 ${activeSection === 'webmail'
              ? 'overflow-hidden p-0'
              : activeSection === 'dashboard'
                ? 'overflow-y-auto p-0'
                : 'overflow-y-auto p-4 lg:p-5'
            }`}
        >
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
                  {creatingEmail ? <><Spinner className="w-4 h-4" /> Criando...</> : '+ Criar Email'}
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
                  {submittingCadastro ? <><Spinner className="w-4 h-4" /> Cadastrando...</> : '+ Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

function AuditFormPasswordDemo() {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg max-w-md mx-auto space-y-4 shadow-sm">
      <div>
        <h3 className="font-bold text-gray-900">Demonstração: Alteração de Senha Rápida (Modal)</h3>
        <p className="text-xs text-gray-500">Este formulário é exibido como um modal pop-up na tabela de listagem de contas.</p>
      </div>
      <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800">
        <h4 className="mb-4 text-sm font-bold text-gray-900 dark:text-zinc-100">
          Alterar password — joaosilva
        </h4>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Nova password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value="senhaMockada123!"
                readOnly
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm pr-10 focus:border-zinc-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-rose-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Confirmar password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value="senhaMockada123!"
              readOnly
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 text-xs font-bold">
          <button type="button" className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100 text-gray-700">
            Cancelar
          </button>
          <button type="button" className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditFormMessageDemo() {
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg max-w-lg mx-auto space-y-4 shadow-sm">
      <div>
        <h3 className="font-bold text-gray-900">Demonstração: Enviar Mensagem (Modal)</h3>
        <p className="text-xs text-gray-500">Este formulário permite ao administrador enviar mensagens de email diretas ao proprietário da conta.</p>
      </div>
      <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-gray-900 dark:text-zinc-100">Enviar mensagem — joaosilva</h4>
          <button type="button" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <input
            value="joao.silva@exemplo.com"
            disabled
            placeholder="Para (email)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100"
          />
          <input
            value="Notificação sobre sua conta joaosilva"
            disabled
            placeholder="Assunto"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100"
          />
          <textarea
            value="Prezado João,\n\nEstamos entrando em contato para informar que..."
            disabled
            placeholder="Mensagem..."
            rows={5}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100"
          />
        </div>
        <button
          type="button"
          disabled
          className="mt-4 w-full flex justify-center py-2 px-4 border border-zinc-200 bg-zinc-100 rounded text-sm text-zinc-500 font-bold"
        >
          Enviar Mensagem
        </button>
      </div>
    </div>
  );
}

function AuditFormResellerDemo() {
  const [resellerForm, setResellerForm] = useState(() => createDefaultResellerPackageForm());
  const [domain, setDomain] = useState('exemplo-revendedor.com');
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg max-w-4xl mx-auto space-y-6 shadow-sm">
      <div className="border-b pb-4">
        <h2 className="text-lg font-bold text-gray-900">Demonstração: Formulário de Configuração de Pacote de Revenda (Inactivo)</h2>
        <p className="text-xs text-gray-500">
          Este formulário (ResellerProvisionForm) permitia configurar detalhadamente limites de recursos no DirectAdmin para novos revendedores.
        </p>
      </div>
      <div className="bg-gray-50 p-4 border border-gray-200 rounded dark:bg-zinc-900 dark:border-zinc-800">
        <ResellerProvisionForm
          form={resellerForm}
          onChange={setResellerForm}
          existingPackages={['Essencial', 'Expandido']}
          domain={domain}
          onDomainChange={setDomain}
        />
      </div>
    </div>
  );
}
