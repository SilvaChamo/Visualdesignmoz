'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

import {
  LogOut, RefreshCw, ChevronRight, Globe, Lock, Edit, Plus, Search, LockOpen, ExternalLink, Server, Archive, Database, Power, Trash2, Home, Users, Mail, Layout, Shield, ShieldCheck, Settings, Download, Send, Code, FolderOpen, Upload, X, Zap, Cloud, RotateCcw, FileCode, ArrowLeft, CheckCircle, HardDrive, AlertCircle, ChevronDown, Globe2, Plug, Layers, List, ChevronLeft, Bell, PauseCircle, Calendar, Clock, MoreVertical, Eye, EyeOff
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getCPUrl, getSnappyMailUrl, getServerHost, getActivePanelUrl, getDirectAdminFileManagerUrl, getDirectAdminAccessUrl, getDirectAdminWordPressUrl } from '@/lib/server-config';
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { Spinner } from '@/components/ui/spinner'
import { AdminSectionChromeProvider, useAdminSectionChrome } from '@/components/admin/AdminSectionChrome'
import { PanelHeader } from '@/components/panel/PanelHeader'
import { PanelSectionKeepAlive } from '@/components/panel/PanelSectionKeepAlive'
import { ListWebsitesSection, sortSitesPrimaryFirst } from '@/components/panel/ListWebsitesSection'
import { panelBtnSecondary, panelDashboardGrid, panelDashboardToolCard, panelDashboardToolLabel, panelSectionPadding } from '@/lib/panel-ui'
import { usePanelSidebarCollapsed } from '@/hooks/usePanelSidebarCollapsed'
import { CpanelDashboard } from './CpanelDashboard'
import type { DomainHubTab } from './DomainsHubSection'

// Secções carregadas sob pedido (next/dynamic) em vez de importadas estaticamente:
// evita que o JS de todas as ~50 secções do painel (incluindo o HostingSections.tsx
// de ~12 mil linhas) seja descarregado logo ao abrir /dashboard, mesmo que o
// utilizador só visite a vista inicial ou uma única secção.
const sectionLoadingFallback = (
  <div className={`${panelSectionPadding} flex min-h-[40vh] items-center justify-center`}>
    <Spinner className="w-6 h-6 text-gray-400" />
  </div>
)
const WebmailSection = dynamic(() => import('@/components/dashboard/WebmailSection').then(m => m.WebmailSection), { ssr: false, loading: () => sectionLoadingFallback })
const DatabasesSection = dynamic(() => import('./HostingSections').then(m => m.DatabasesSection), { ssr: false, loading: () => sectionLoadingFallback })
const FTPSection = dynamic(() => import('./HostingSections').then(m => m.FTPSection), { ssr: false, loading: () => sectionLoadingFallback })
const EmailManagementSection = dynamic(() => import('./HostingSections').then(m => m.EmailManagementSection), { ssr: false, loading: () => sectionLoadingFallback })
const CPUsersSection = dynamic(() => import('./HostingSections').then(m => m.CPUsersSection), { ssr: false, loading: () => sectionLoadingFallback })
const SSLSection = dynamic(() => import('./HostingSections').then(m => m.SSLSection), { ssr: false, loading: () => sectionLoadingFallback })
const SSLViewSection = dynamic(() => import('./HostingSections').then(m => m.SSLViewSection), { ssr: false, loading: () => sectionLoadingFallback })
const PHPConfigSection = dynamic(() => import('./HostingSections').then(m => m.PHPConfigSection), { ssr: false, loading: () => sectionLoadingFallback })
const APIConfigSection = dynamic(() => import('./HostingSections').then(m => m.APIConfigSection), { ssr: false, loading: () => sectionLoadingFallback })
const GitDeploySection = dynamic(() => import('./HostingSections').then(m => m.GitDeploySection), { ssr: false, loading: () => sectionLoadingFallback })
const WPPluginsSection = dynamic(() => import('./HostingSections').then(m => m.WPPluginsSection), { ssr: false, loading: () => sectionLoadingFallback })
const ResellerSection = dynamic(() => import('./HostingSections').then(m => m.ResellerSection), { ssr: false, loading: () => sectionLoadingFallback })
const ModifyWebsiteSection = dynamic(() => import('./HostingSections').then(m => m.ModifyWebsiteSection), { ssr: false, loading: () => sectionLoadingFallback })
const SuspendWebsiteSection = dynamic(() => import('./HostingSections').then(m => m.SuspendWebsiteSection), { ssr: false, loading: () => sectionLoadingFallback })
const DeleteWebsiteSection = dynamic(() => import('./HostingSections').then(m => m.DeleteWebsiteSection), { ssr: false, loading: () => sectionLoadingFallback })
const DNSNameserverSection = dynamic(() => import('./HostingSections').then(m => m.DNSNameserverSection), { ssr: false, loading: () => sectionLoadingFallback })
const DNSDefaultNSSection = dynamic(() => import('./HostingSections').then(m => m.DNSDefaultNSSection), { ssr: false, loading: () => sectionLoadingFallback })
const DNSCreateZoneSection = dynamic(() => import('./HostingSections').then(m => m.DNSCreateZoneSection), { ssr: false, loading: () => sectionLoadingFallback })
const DNSDeleteZoneSection = dynamic(() => import('./HostingSections').then(m => m.DNSDeleteZoneSection), { ssr: false, loading: () => sectionLoadingFallback })
const DNSResetSection = dynamic(() => import('./HostingSections').then(m => m.DNSResetSection), { ssr: false, loading: () => sectionLoadingFallback })
const EmailDeleteSection = dynamic(() => import('./HostingSections').then(m => m.EmailDeleteSection), { ssr: false, loading: () => sectionLoadingFallback })
const EmailLimitsSection = dynamic(() => import('./HostingSections').then(m => m.EmailLimitsSection), { ssr: false, loading: () => sectionLoadingFallback })
const EmailForwardingSection = dynamic(() => import('./HostingSections').then(m => m.EmailForwardingSection), { ssr: false, loading: () => sectionLoadingFallback })
const CatchAllEmailSection = dynamic(() => import('./HostingSections').then(m => m.CatchAllEmailSection), { ssr: false, loading: () => sectionLoadingFallback })
const PatternForwardingSection = dynamic(() => import('./HostingSections').then(m => m.PatternForwardingSection), { ssr: false, loading: () => sectionLoadingFallback })
const PlusAddressingSection = dynamic(() => import('./HostingSections').then(m => m.PlusAddressingSection), { ssr: false, loading: () => sectionLoadingFallback })
const EmailChangePasswordSection = dynamic(() => import('./HostingSections').then(m => m.EmailChangePasswordSection), { ssr: false, loading: () => sectionLoadingFallback })
const DKIMManagerSection = dynamic(() => import('./HostingSections').then(m => m.DKIMManagerSection), { ssr: false, loading: () => sectionLoadingFallback })
const WPRestoreBackupSection = dynamic(() => import('./HostingSections').then(m => m.WPRestoreBackupSection), { ssr: false, loading: () => sectionLoadingFallback })
const WPRemoteBackupSection = dynamic(() => import('./HostingSections').then(m => m.WPRemoteBackupSection), { ssr: false, loading: () => sectionLoadingFallback })
const ListSubdomainsSection = dynamic(() => import('./HostingSections').then(m => m.ListSubdomainsSection), { ssr: false, loading: () => sectionLoadingFallback })
const WebsitePreviewSection = dynamic(() => import('./HostingSections').then(m => m.WebsitePreviewSection), { ssr: false, loading: () => sectionLoadingFallback })
const EmailImportSection = dynamic(() => import('./HostingSections').then(m => m.EmailImportSection), { ssr: false, loading: () => sectionLoadingFallback })
const PackagesSection = dynamic(() => import('./HostingSections').then(m => m.PackagesSection), { ssr: false, loading: () => sectionLoadingFallback })
const DNSZoneEditorSection = dynamic(() => import('./HostingSections').then(m => m.DNSZoneEditorSection), { ssr: false, loading: () => sectionLoadingFallback })
const FileManagerSection = dynamic(() => import('./HostingSections').then(m => m.FileManagerSection), { ssr: false, loading: () => sectionLoadingFallback })
const BackupManagerSection = dynamic(() => import('./HostingSections').then(m => m.BackupManagerSection), { ssr: false, loading: () => sectionLoadingFallback })
const WordPressInstallSection = dynamic(() => import('./HostingSections').then(m => m.WordPressInstallSection), { ssr: false, loading: () => sectionLoadingFallback })
const WPBackupSection = dynamic(() => import('./HostingSections').then(m => m.WPBackupSection), { ssr: false, loading: () => sectionLoadingFallback })
const DomainManagerSection = dynamic(() => import('./HostingSections').then(m => m.DomainManagerSection), { ssr: false, loading: () => sectionLoadingFallback })
const DeploySection = dynamic(() => import('./HostingSections').then(m => m.DeploySection), { ssr: false, loading: () => sectionLoadingFallback })
const SMTPConfigSection = dynamic(() => import('./HostingSections').then(m => m.SMTPConfigSection), { ssr: false, loading: () => sectionLoadingFallback })
const AuditSyncSection = dynamic(() => import('./HostingSections').then(m => m.AuditSyncSection), { ssr: false, loading: () => sectionLoadingFallback })
const NameserverManagementSection = dynamic(() => import('./HostingSections').then(m => m.NameserverManagementSection), { ssr: false, loading: () => sectionLoadingFallback })
const SecuritySection = dynamic(() => import('./HostingSections').then(m => m.SecuritySection), { ssr: false, loading: () => sectionLoadingFallback })
const NewsManagerSection = dynamic(() => import('./NewsManagerSection').then(m => m.NewsManagerSection), { ssr: false, loading: () => sectionLoadingFallback })
const RenewalsSection = dynamic(() => import('./RenewalsSection').then(m => m.RenewalsSection), { ssr: false, loading: () => sectionLoadingFallback })
const HostingPendingSection = dynamic(() => import('./HostingPendingSection').then(m => m.HostingPendingSection), { ssr: false, loading: () => sectionLoadingFallback })
const NotificationsSection = dynamic(() => import('./NotificationsSection').then(m => m.NotificationsSection), { ssr: false, loading: () => sectionLoadingFallback })
const CotacoesSection = dynamic(() => import('./CotacoesSection').then(m => m.CotacoesSection), { ssr: false, loading: () => sectionLoadingFallback })
const ContabilidadeTable = dynamic(() => import('@/components/quotations/ContabilidadeTable').then(m => m.ContabilidadeTable), { ssr: false, loading: () => sectionLoadingFallback })
const NextJsSitesSection = dynamic(() => import('./NextJsSitesSection').then(m => m.NextJsSitesSection), { ssr: false, loading: () => sectionLoadingFallback })
const TemplatesSection = dynamic(() => import('./TemplatesSection').then(m => m.TemplatesSection), { ssr: false })
const DNSCentralSection = dynamic(() => import('./DNSCentralSection').then(m => m.DNSCentralSection), { ssr: false, loading: () => sectionLoadingFallback })
const DomainTransferSection = dynamic(() => import('./DomainTransferSection').then(m => m.DomainTransferSection), { ssr: false, loading: () => sectionLoadingFallback })
const DomainDetailSection = dynamic(() => import('./DomainDetailSection').then(m => m.DomainDetailSection), { ssr: false, loading: () => sectionLoadingFallback })
const DomainsHubSection = dynamic(() => import('./DomainsHubSection').then(m => m.DomainsHubSection), { ssr: false, loading: () => sectionLoadingFallback })
const PanelPermissionsConfig = dynamic(() => import('./PanelPermissionsConfig').then(m => m.PanelPermissionsConfig), { ssr: false, loading: () => sectionLoadingFallback })
const ClientesDaSection = dynamic(() => import('./ClientesDaSection').then(m => m.ClientesDaSection), { ssr: false, loading: () => sectionLoadingFallback })
const AccountMessageTemplatesSection = dynamic(() => import('./HostingAccountMgmtSections').then(m => m.AccountMessageTemplatesSection), { ssr: false, loading: () => sectionLoadingFallback })
const BulkChangePasswordsSection = dynamic(() => import('./HostingAccountMgmtSections').then(m => m.BulkChangePasswordsSection), { ssr: false, loading: () => sectionLoadingFallback })
const MoveUsersBetweenResellersSection = dynamic(() => import('./HostingAccountMgmtSections').then(m => m.MoveUsersBetweenResellersSection), { ssr: false, loading: () => sectionLoadingFallback })
const WordPressHubSection = dynamic(() => import('./WordPressHubSection').then(m => m.WordPressHubSection), { ssr: false, loading: () => sectionLoadingFallback })
const WordPressUsersSection = dynamic(() => import('./WordPressUsersSection').then(m => m.WordPressUsersSection), { ssr: false, loading: () => sectionLoadingFallback })
import { getPanelSectionMeta } from '@/lib/panel-section-meta'
import { loadScreenshot, prefetchScreenshot, getCachedScreenshot } from '@/lib/site-screenshot-cache'
import { readSiteSslCache, writeSiteSslCache } from '@/lib/site-ssl-cache'
import { readWpInstallsCache, writeWpInstallsCache } from '@/lib/panel-wp-cache'
import { resolvePanelNavigation, resolveSectionId, PANEL_EXTERNAL_PATHS } from '@/lib/panel-admin-menu'
import { getStaffAdminMenu, isManagerSectionAllowed, type PanelCapabilities } from '@/lib/panel-role-capabilities'
import { filterMenuByPrivileges } from '@/lib/panel-menu-privileges'
import { ADMIN_MENU_ITEM_DEFS } from '@/lib/panel-admin-menu'
import { usePanelMenuPrivileges } from '@/hooks/usePanelMenuPrivileges'
import { directAdminAPI as panelAPI } from '@/lib/directadmin-api'
import { supabase as createClientInstance } from '@/lib/supabase'
import type { DirectAdminWebsite, DirectAdminUser, DirectAdminPackage } from '@/lib/directadmin-api'
import { removeWebsiteFromSupabase, syncWebsiteToSupabase } from '@/lib/supabase-sync'
import { cn } from '@/lib/utils'
import {
  fetchPanelBootstrap,
  fetchPanelBootstrapStaleWhileRevalidate,
  readBootstrapCache,
  clearPanelBootstrapCache,
  type PanelBootstrapData,
  type PanelBootstrapScope,
} from '@/lib/panel-data-from-server'
import { prefetchPanelContentFromBootstrap } from '@/lib/panel-prefetch'
import { applyAdminPanelScope, buildResellerOwnerTree, isAdminPanelSite } from '@/lib/panel-scope-filter'
import { PRIMARY_RESELLER_DA_USER, isCompanyHostingOwner } from '@/lib/panel-contas-enrich'
import { auth as panelAuth } from '@/lib/supabase-client'

const MailMarketingSection = dynamic(() => import('@/components/dashboard/MailMarketingSection').then(m => m.MailMarketingSection), { ssr: false, loading: () => sectionLoadingFallback })
const EncomendasClientesSection = dynamic(() => import('@/components/dashboard/EncomendasClientesSection').then(m => m.EncomendasClientesSection), { ssr: false, loading: () => sectionLoadingFallback })
const DirectAdminEmailsSection = dynamic(() => import('./DirectAdminEmailsSection').then(m => m.DirectAdminEmailsSection), { ssr: false, loading: () => sectionLoadingFallback })

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
          {creating ? <Spinner className="w-4 h-4" /> : <Globe className="w-4 h-4" />} {creating ? t('admin.sites.newDesc').split(' ')[0] + '...' : t('admin.sites.new')}
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
                      ● {parseState(site.state) === 'Active' ? 'Activo' : 'Suspenso'}
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
                        {loading === s.domain ? <Spinner className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
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
                        onClick={() => {
                          // @ts-ignore
                          window.__selectedBackupDomain = s.domain
                          setActiveSection('wp-backup')
                        }}
                        className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded text-xs font-bold transition-colors">
                        <Archive className="w-3.5 h-3.5" /> Backup
                      </button>
                      <button
                        onClick={() => {
                          if (setSelectedDNSDomain) setSelectedDNSDomain(s.domain);
                          setActiveSection('databases');
                        }}
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
          <Spinner className="w-6 h-6" />
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
  const { isCollapsed, setIsCollapsed, isMobile } = usePanelSidebarCollapsed()
  const [fileManagerDomain, setFileManagerDomain] = useState('')
  const [directAdminSites, setDirectAdminSites] = useState<DirectAdminWebsite[]>([])
  const [directAdminUsers, setDirectAdminUsers] = useState<DirectAdminUser[]>([])
  const [directAdminPackages, setDirectAdminPackages] = useState<DirectAdminPackage[]>([])
  const [isFetchingDirectAdmin, setIsFetchingDirectAdmin] = useState(false)
  const [selectedDatabaseDomain, setSelectedDatabaseDomain] = useState('')
  const [selectedBackupDomain, setSelectedBackupDomain] = useState('')
  const [preSelectedEmailDomain, setPreSelectedEmailDomain] = useState<string>('')
  const [sessionUser, setSessionUser] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [panelCapabilities, setPanelCapabilities] = useState<PanelCapabilities | null>(null)
  const { privileges: managerMenuPrivileges } = usePanelMenuPrivileges('manager')
  const adminSidebarMenuDefs = useMemo(() => {
    if (!panelCapabilities) return undefined
    if (panelCapabilities.role === 'manager') {
      const base = ADMIN_MENU_ITEM_DEFS.filter((item) => item.isNewMenu !== false)
      return filterMenuByPrivileges(base.length ? base : ADMIN_MENU_ITEM_DEFS, managerMenuPrivileges)
    }
    return getStaffAdminMenu(panelCapabilities)
  }, [panelCapabilities, managerMenuPrivileges])
  const [isComposeActive, setIsComposeActive] = useState(false)
  const [mailMarketingTab, setMailMarketingTab] = useState<'comp' | 'subs' | 'camp'>('comp')
  const [domainHubTab, setDomainHubTab] = useState<DomainHubTab>('meus')
  const [packagesOpenCreate, setPackagesOpenCreate] = useState(false)
  const [selectedManageDomain, setSelectedManageDomain] = useState('')
  const [provisionAccountType, setProvisionAccountType] = useState<'client' | 'reseller' | 'professional' | 'admin'>('client')
  const [contasListResetToken, setContasListResetToken] = useState(0)

  const searchParams = useSearchParams();
  const router = useRouter();
  const initialLoadDone = useRef(false);
  const lastAppliedSectionRef = useRef<string>('dashboard');

  const applyPanelNavigation = useCallback((sectionId: string) => {
    const nav = resolvePanelNavigation(sectionId)
    if (nav.domainHubTab) setDomainHubTab(nav.domainHubTab)
    if (nav.openPackagesCreate) setPackagesOpenCreate(true)
    else if (nav.section !== 'packages-list') setPackagesOpenCreate(false)
    setActiveSection(nav.section)
    lastAppliedSectionRef.current = nav.section
  }, [])

  // Efeito para capturar section da URL - garantir dashboard como padrão, mas
  // manter a última secção activa mesmo quando a página é reloaded sem query string.
  useEffect(() => {
    const section = searchParams.get('section');
    const storedSection = typeof window !== 'undefined' ? window.sessionStorage.getItem('vd-dashboard-section') : null

    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      const targetSection = section || storedSection || 'dashboard'
      applyPanelNavigation(targetSection);

      if (section || searchParams.get('impersonate_error')) {
        const err = searchParams.get('impersonate_error');
        const nextUrl = err ? `/dashboard?impersonate_error=${encodeURIComponent(err)}` : '/dashboard'
        window.history.replaceState({}, '', nextUrl);
      }
      return;
    }

    if (section) {
      applyPanelNavigation(section);
    }
  }, [searchParams, applyPanelNavigation]);

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem('vd-dashboard-section', activeSection)
  }, [activeSection]);

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
    const backupSections = new Set([
      'backup-manager', 'wp-backup', 'cp-backup',
      'cp-wp-backup', 'cp-wp-restore-backup', 'cp-wp-remote-backup',
    ])
    // @ts-ignore
    if (window.__selectedBackupDomain && backupSections.has(activeSection)) {
      // @ts-ignore
      setSelectedBackupDomain(window.__selectedBackupDomain);
      // @ts-ignore
      window.__selectedBackupDomain = null;
    } else if (!backupSections.has(activeSection)) {
      setSelectedBackupDomain('');
    }
  }, [activeSection]);

  useEffect(() => {
    // @ts-ignore
    if (window.__selectedManageDomain && activeSection === 'domain-detail') {
      // @ts-ignore
      setSelectedManageDomain(window.__selectedManageDomain);
      // @ts-ignore
      window.__selectedManageDomain = null;
    } else if (activeSection === 'domain-detail') {
      // Refresh directo (sem passar pelo clique que define window.__selectedManageDomain,
      // que se perde sempre num reload a sério) — sem isto caía sempre no fallback
      // 'primaryDomain' de page.tsx, mostrando SILENCIOSAMENTE outro domínio
      // qualquer em vez do que estava mesmo a ser visto (confirmado ao vivo 1 set:
      // "Gerir domínio" do entrecamposblog.com virava visualdesignmoz.com só com F5).
      const stored = typeof window !== 'undefined' ? window.sessionStorage.getItem('vd-dashboard-manage-domain') : null
      if (stored) setSelectedManageDomain(stored)
    } else {
      setSelectedManageDomain('');
    }
  }, [activeSection]);

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedManageDomain) window.sessionStorage.setItem('vd-dashboard-manage-domain', selectedManageDomain)
  }, [selectedManageDomain]);

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
  const [bootHostingOwner, setBootHostingOwner] = useState<string | null>(null)
  const [bootHestiaOnly, setBootHestiaOnly] = useState(false)
  const [allHostingSites, setAllHostingSites] = useState<DirectAdminWebsite[]>([])
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
    setBootHostingOwner(boot.hostingOwner || null)
    setBootHestiaOnly(Boolean(boot.hestiaOnly))
    if (boot.session?.capabilities) {
      setPanelCapabilities(boot.session.capabilities);
    }
    const scoped = boot.resellerContext
      ? { sites: boot.sites, users: boot.users, packages: boot.packages }
      : applyAdminPanelScope(boot)
    setDirectAdminSites(scoped.sites)
    setAllHostingSites(
      Array.isArray(boot.allSites) && boot.allSites.length > 0 ? boot.allSites : scoped.sites,
    )
    setDirectAdminUsers(scoped.users)
    setDirectAdminPackages(scoped.packages)
    if (boot.resellerContext?.daUsername) {
      setAccountDaUsername(boot.resellerContext.daUsername)
    }
    const username = (boot.resellerContext?.daUsername ?? accountDaUsername).toLowerCase()
    let primary: string | null = boot.resellerContext?.primaryDomain?.toLowerCase() ?? null
    if (!primary && username) {
      const ownerSites = scoped.sites.filter((s) => {
        const o = (s.owner || 'admin').toLowerCase()
        return (o === username || (o === 'admin' && (username === 'visualdesign' || username === 'admin')))
          && !s.domain.includes('contaboserver')
      })
      const match = ownerSites.find((s) => s.domain.toLowerCase().startsWith(username))
        ?? ownerSites.find((s) => s.domain.toLowerCase().includes(username))
      primary = match?.domain.toLowerCase() ?? ownerSites[0]?.domain.toLowerCase() ?? null
    }
    if (!primary) {
      const vd = scoped.sites.find((s) => s.domain.toLowerCase() === 'visualdesignmoz.com')
        ?? scoped.sites.find((s) => {
          const o = (s.owner || 'admin').toLowerCase()
          return o === username || (o === 'admin' && (username === 'visualdesign' || username === 'admin'))
        })
      primary = vd?.domain.toLowerCase() ?? null
    }
    setAccountPrimaryDomain(primary)
    if (!scoped.sites.length && boot.meta?.source === 'mirror') {
      setDaLoadError('Sem sites no espelho — sincronização em curso.')
    } else {
      setDaLoadError('')
    }
    prefetchPanelContentFromBootstrap(
      { sites: scoped.sites, packages: scoped.packages, resellerContext: boot.resellerContext },
      'admin',
    )
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
  const resellerTree = useMemo(
    () => buildResellerOwnerTree(directAdminUsers),
    [directAdminUsers],
  )
  const filteredSitesBase = useMemo(
    () =>
      directAdminSites.filter((s) => {
        if (s.domain.includes('contaboserver')) return false
        if (s.domain.toLowerCase().startsWith('mail.')) return false
        return isAdminPanelSite(s, resellerTree)
      }),
    [directAdminSites, resellerTree],
  )
  const filteredSites = useMemo(
    () => sortSitesPrimaryFirst(filteredSitesBase, accountPrimaryDomain),
    [filteredSitesBase, accountPrimaryDomain],
  )
  const domainHubSites = useMemo(
    () =>
      (allHostingSites.length > 0 ? allHostingSites : filteredSitesBase).filter((s) => {
        if (s.domain.includes('contaboserver')) return false
        if (s.domain.toLowerCase().startsWith('mail.')) return false
        return true
      }),
    [allHostingSites, filteredSitesBase],
  )
  const clientOwnership = useMemo(() => {
    const clientAccounts = directAdminUsers.filter((user) => {
      const accountType = String(user.acl || user.type || '').trim().toLowerCase()
      if (accountType !== 'user' && accountType !== 'client' && accountType !== 'guest') return false
      const name = String(user.userName || '').trim().toLowerCase()
      if (!name || name === PRIMARY_RESELLER_DA_USER.toLowerCase()) return false
      if (isCompanyHostingOwner(name, bootHostingOwner)) return false
      return true
    })
    return {
      owners: clientAccounts.map((user) => user.userName).filter(Boolean),
      emails: clientAccounts.map((user) => user.email).filter(Boolean) as string[],
    }
  }, [directAdminUsers, bootHostingOwner])
  const primaryDomain = accountPrimaryDomain
    || (filteredSites.length > 0 ? filteredSites[0].domain : 'your-domain.com')

  const getSectionInfo = (section: string) => getPanelSectionMeta(section)

  const renderSectionFor = (sectionId: string, isActive: boolean) => {
    if (panelCapabilities?.role === 'manager' && !isManagerSectionAllowed(sectionId)) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Esta área não está disponível no perfil profissional. Pode gerir sites WordPress e configurações
          dos serviços já atribuídos, mas não criar utilizadores, pacotes nem contas de hospedagem.
        </div>
      );
    }

    switch (sectionId) {
      case 'notificacoes-servidor':
        return <NotificationsSection defaultTab="list" filterCategory="system" />
      case 'cp-client-permissions':
        return <PanelPermissionsConfig role="client" />
      case 'cp-reseller-permissions':
        return <PanelPermissionsConfig role="reseller" />
      case 'provision-client':
      case 'provision-reseller':
      case 'provision-admin':
        return (
          <ClientesDaSection
            listFilter="all"
            packages={directAdminPackages}
            initialView="create"
            initialAccountType={
              sectionId === 'provision-reseller'
                ? 'reseller'
                : sectionId === 'provision-admin'
                  ? 'professional'
                  : provisionAccountType === 'admin'
                    ? 'professional'
                    : provisionAccountType
            }
            isActive={isActive}
            listResetToken={contasListResetToken}
            onRefresh={() => void loadDirectAdminData(true)}
          />
        )
      case 'hospedagem-contas':
        return (
          <ClientesDaSection
            listFilter="all"
            listScope="all"
            packages={directAdminPackages}
            initialView="list"
            isActive={isActive}
            listResetToken={contasListResetToken}
            onRefresh={() => void loadDirectAdminData(true)}
          />
        )
      case 'hospedagem-meus':
        return (
          <ClientesDaSection
            listFilter="all"
            listScope="direct"
            packages={directAdminPackages}
            initialView="list"
            isActive={isActive}
            listResetToken={contasListResetToken}
            onRefresh={() => void loadDirectAdminData(true)}
          />
        )
      case 'hospedagem-mover-revenda':
        return <MoveUsersBetweenResellersSection isActive={isActive} />
      case 'hospedagem-templates-mensagem':
        return <AccountMessageTemplatesSection isActive={isActive} />
      case 'hospedagem-alterar-senhas':
        return <BulkChangePasswordsSection isActive={isActive} />
      case 'hospedagem-administradores':
        return (
          <CPUsersSection
            variant="panels"
            panelScope="users"
            initialUsersScopeFilter="admin"
            isActive={isActive}
            onBootstrapRefresh={() => void loadDirectAdminData(true)}
            onNavigate={handleNavigate}
          />
        )
      case 'dashboard':
        return <CpanelDashboard
          sites={filteredSites}
          users={directAdminUsers}
          isFetching={isFetchingDirectAdmin}
          onNavigate={handleNavigate}
          onRefresh={() => void loadDirectAdminData(true)}
          onSetDNSDomain={setSelectedDNSDomain}
          onSetFileManagerDomain={setFileManagerDomain}
          searchQuery={sectionId === activeSection ? dashboardSearch : ''}
          onSearchChange={setDashboardSearch}
        />
      case 'domains':
      case 'domains-list':
        return (
          <DomainsHubSection
            variant="admin"
            isActive={isActive}
            initialTab="meus"
            sites={domainHubSites}
            packages={directAdminPackages}
            adminEmail={sessionUser}
            hostingOwner={bootHostingOwner}
            clientOwners={clientOwnership.owners}
            clientEmails={clientOwnership.emails}
            onRefresh={() => void loadDirectAdminData(true)}
            onCreateEmail={(domain) => {
              setPreSelectedEmailDomain(domain)
              setActiveSection('cp-email-mgmt')
            }}
            onNavigate={(section, opts) => {
              if (opts?.domain) setSelectedDNSDomain(opts.domain)
              handleNavigate(section, opts)
            }}
            onHubPanelClose={() => setDomainHubTab('meus')}
          />
        )
      case 'file-manager':
      case 'cp-file-manager':
        return <FileManagerSection domain={fileManagerDomain || primaryDomain} sites={filteredSites} isActive={isActive} loggedInOwner={bootHostingOwner || undefined} />
      case 'news-manager':
        return <NewsManagerSection />
      case 'utilizadores-revendedores':
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
      case 'utilizadores-visitantes':
        return (
          <CPUsersSection
            variant="panels"
            panelScope="users"
            initialUsersScopeFilter="guest"
            isActive={isActive}
            onBootstrapRefresh={() => void loadDirectAdminData(true)}
            onNavigate={handleNavigate}
          />
        )
      case 'utilizadores-gestao':
        return (
          <CPUsersSection
            variant="panels"
            panelScope="users"
            initialUsersScopeFilter="manager"
            isActive={isActive}
            onBootstrapRefresh={() => void loadDirectAdminData(true)}
            onNavigate={handleNavigate}
          />
        )
      case 'domain-manager':
        return (
          <DomainsHubSection
            variant="admin"
            isActive={isActive}
            initialTab={domainHubTab}
            sites={domainHubSites}
            packages={directAdminPackages}
            adminEmail={sessionUser}
            hostingOwner={bootHostingOwner}
            clientOwners={clientOwnership.owners}
            clientEmails={clientOwnership.emails}
            onRefresh={() => void loadDirectAdminData(true)}
            onCreateEmail={(domain) => {
              setPreSelectedEmailDomain(domain)
              setActiveSection('cp-email-mgmt')
            }}
            onNavigate={(section, opts) => {
              if (opts?.domain) setSelectedDNSDomain(opts.domain)
              handleNavigate(section, opts)
            }}
            onHubPanelClose={() => setDomainHubTab('meus')}
          />
        )
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
        return <DatabasesSection sites={domainHubSites} initialDomain={selectedDatabaseDomain || selectedDNSDomain || primaryDomain} loggedInOwner={bootHostingOwner || undefined} />
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
      case 'renewals':
        return <RenewalsSection initialTab="overview" hideTabs={true} />
      case 'templates-renovacao':
        return <TemplatesSection />
      case 'cadastrar-renovacao':
        return <RenewalsSection initialTab="add" hideTabs={true} />
      case 'cotacoes':
        return <CotacoesSection />
      case 'cotacoes-contas':
        return <EncomendasClientesSection isActive={isActive} />
      case 'contabilidade':
        return <ContabilidadeTable />
      case 'nextjs-sites':
        return (
          <NextJsSitesSection
            sites={directAdminSites}
            onNavigate={(section, opts) => {
              if (opts?.domain) setSelectedDNSDomain(opts.domain)
              handleNavigate(section)
            }}
          />
        )
      case 'cp-users':
        return <CPUsersSection variant="panels" panelScope="users" isActive={isActive} onBootstrapRefresh={() => void loadDirectAdminData(true)} onNavigate={handleNavigate} />
      case 'wp-users':
        return <WordPressUsersSection sites={filteredSites} isActive={isActive} setActiveSection={setActiveSection} />
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
        return <SecuritySection sites={filteredSites} />
      case 'cp-dns-cloudflare':
        return (
          <DNSCentralSection
            sites={filteredSites}
            initialDomain={selectedDNSDomain || primaryDomain}
            isActive={isActive}
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
            siteLocked={Boolean(selectedBackupDomain)}
            isActive={isActive}
            setActiveSection={setActiveSection}
          />
        )
      case 'wp-sites':
      case 'cp-wp-list':
        return (
          <ListWebsitesSection
            sites={filteredSites}
            wordpressOnly
            wordpressOwner={bootHostingOwner || 'admin'}
            panelScope="admin"
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
            isActive={isActive}
          />
        )
      case 'cp-dns-delete-zone':
        return <DNSDeleteZoneSection sites={filteredSites} />
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
                           activeSection === 'newsletter-camp' ? 'camp' :
                           mailMarketingTab;
        return (
          <MailMarketingSection
            sites={filteredSites}
            currentUserEmail={sessionUser || undefined}
            activeTab={derivedTab}
            onTabChange={(tab) => {
              setMailMarketingTab(tab);
              if (activeSection !== 'newsletter') {
                setActiveSection('newsletter');
              }
            }}
          />
        )
      case 'git-deploy':
        return <GitDeploySection />
      case 'deploy':
        return <DeploySection sites={directAdminSites} />
      case 'packages-list':
        return (
          <PackagesSection
            packages={directAdminPackages}
            onRefresh={() => void loadDirectAdminData(true)}
            isActive={isActive}
            initialOpenCreate={packagesOpenCreate}
            packageScope="user"
          />
        )
      case 'hospedagem-pendentes':
        return <HostingPendingSection />
      case 'packages-reseller':
        return (
          <PackagesSection
            packages={directAdminPackages}
            onRefresh={() => void loadDirectAdminData(true)}
            isActive={isActive}
            initialOpenCreate={packagesOpenCreate}
            packageScope="reseller"
          />
        )
      case 'domain-detail':
        return (
          <DomainDetailSection
            domain={selectedManageDomain || primaryDomain}
            sites={filteredSites}
            onNavigate={(section, opts) => {
              if (opts?.domain) setSelectedDNSDomain(opts.domain)
              handleNavigate(section)
            }}
            setActiveSection={setActiveSection}
            onRefresh={() => void loadDirectAdminData(true)}
          />
        )
      default:
        return <CpanelDashboard sites={filteredSites} users={directAdminUsers} isFetching={isFetchingDirectAdmin} onNavigate={handleNavigate} onRefresh={() => void loadDirectAdminData(true)} onSetFileManagerDomain={setFileManagerDomain} />
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
  const handleNavigate = (section: string, opts?: { accountType?: 'client' | 'reseller' | 'admin'; domain?: string }) => {
    const externalPath = PANEL_EXTERNAL_PATHS[section]
    if (externalPath) {
      router.push(externalPath)
      return
    }
    if (section === 'provision-reseller') {
      setProvisionAccountType('reseller')
    } else if (section === 'provision-admin') {
      setProvisionAccountType('professional')
    }
    if (section === 'provision-client') {
      setProvisionAccountType(opts?.accountType || 'client')
    }
    if (section === 'hospedagem-contas') {
      setContasListResetToken((t) => t + 1)
    }
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
    // Se navegar para gestão de emails, definir domínio padrão visualdesignmoz.com
    if (section === 'emails-new' || section === 'cp-email-mgmt') {
      setPreSelectedEmailDomain('visualdesignmoz.com')
    }
    const nav = resolvePanelNavigation(section)
    if (nav.domainHubTab) setDomainHubTab(nav.domainHubTab)
    if (nav.openPackagesCreate) setPackagesOpenCreate(true)
    else if (nav.section !== 'packages-list') setPackagesOpenCreate(false)
    // Definir o domínio na mesma passagem que activeSection — se ficasse só
    // para o efeito que lê window.__selectedManageDomain, a primeira
    // renderização de "domain-detail" usava primaryDomain (errado) durante
    // um ciclo, antes do efeito corrigir; os cartões de pacote/conta ficavam
    // a faltar ou trocados até algo forçar outra renderização.
    if (nav.section === 'domain-detail' && opts?.domain) setSelectedManageDomain(opts.domain)
    setActiveSection(nav.section)
  }

  return (
    <div className="panel-shell font-panel flex h-screen overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <AdminSidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        sessionUser={sessionUser}
        isMobile={isMobile}
        menuDefs={adminSidebarMenuDefs}
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
              {activeSection === 'dashboard' && panelCapabilities?.role !== 'manager' && !bootHestiaOnly && !bootHostingOwner ? (
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
                onClick={async () => {
                  setIsSigningOut(true)
                  await createClientInstance.auth.signOut()
                  const { clearAllPanelClientCaches } = await import('@/lib/panel-session-cache-clear')
                  clearAllPanelClientCaches()
                  window.location.href = '/auth/login'
                }}
                disabled={isSigningOut}
                className={`${panelBtnSecondary} disabled:opacity-60 disabled:cursor-wait active:scale-[0.97] transition-transform`}
                title={t('sidebar.logout')}
              >
                {isSigningOut ? (
                  <Spinner className="w-3.5 h-3.5" />
                ) : (
                  <LogOut size={14} />
                )}
                <span>{isSigningOut ? 'A sair…' : 'Sair'}</span>
              </button>
            </>
          }
        />

        <main className={`panel-content flex-1 ${
          ['webmail', 'cp-reseller'].includes(activeSection)
            ? 'overflow-hidden p-0'
            : ['file-manager', 'cp-file-manager'].includes(activeSection)
              ? 'overflow-y-auto pt-0 px-4 pb-4 lg:px-5 lg:pb-5'
              : activeSection === 'cotacoes'
                ? 'overflow-y-auto pt-0 pl-0 pr-4 pb-4 lg:pr-5 lg:pb-5'
                : 'overflow-y-auto p-4 lg:p-5'
        }`}>
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
  )
}
