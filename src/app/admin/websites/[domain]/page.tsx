'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Mail, FileText, Globe, Server, Lock, Settings, Database, FolderOpen,
  Upload, Download, Code, Shield, ExternalLink, ArrowLeft, RefreshCw,
  Play, Pause, Trash2, Edit, Copy, CheckCircle, AlertCircle, Zap,
  Layout, Archive, Users, Package, Monitor, Wifi, Key, FileCode,
  HardDrive, Cloud, RotateCcw, Power, Plus, List, Filter, BookOpen,
  ChevronRight, Globe2, Plug, Search, Layers, X
} from 'lucide-react'
import Link from 'next/link'
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

// ============================================================
// TYPES & INTERFACES
// ============================================================
interface WebsiteData {
  domain: string
  state: string
  ip: string
  package: string
  phpVersion: string
  owner: string
  ssl: boolean
  diskUsage?: string
  siteType?: string
}

interface MenuItem {
  id: string
  label: string
  icon: React.ElementType | string // Can be a component or an identifier for custom SVG
  description?: string
  color?: string
  onClick?: () => void
  href?: string
  external?: boolean
  badge?: string
}

interface SectionData {
  id: string
  title: string
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
  items: MenuItem[]
}

// ============================================================
// SKELETON COMPONENTS
// ============================================================
const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-gray-200 rounded-md", className)} />
)

// ============================================================
// SECTION CARD COMPONENT
// ============================================================
function SectionCard({ section, domain }: { section: SectionData; domain: string }) {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const Icon = section.icon

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
      >
        <div className="flex items-center gap-3">
          <div className={`${section.bgColor} ${section.color} p-2 rounded-lg`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-800 text-base tracking-tight">{section.title}</h3>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-xs font-medium">{section.items.length} itens</span>
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4 rotate-90" />
          )}
        </div>
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-6 bg-[#f8fafc]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
            {section.items.map((item) => {
              const ItemIcon = item.icon
              const isExternal = item.external

              const content = (
                <div className="relative group flex flex-col items-center justify-center p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer h-full min-h-[140px]">
                  <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
                    {typeof ItemIcon === 'string' ? (
                      <CyberIcon name={ItemIcon} className="w-16 h-16" />
                    ) : (
                      <ItemIcon className={cn("w-12 h-12", item.color || section.color)} />
                    )}
                  </div>
                  
                  <span className="text-[13px] font-bold text-[#2d5a8e] group-hover:text-blue-600 transition-colors text-center leading-tight">
                    {item.label}
                  </span>

                  {item.badge && (
                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-1 rounded-full shadow-sm z-10">
                      {item.badge}
                    </span>
                  )}
                </div>
              )

              if (isExternal && item.href) {
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {content}
                  </a>
                )
              }

              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block"
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="block w-full text-center"
                >
                  {content}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// QUICK STATS COMPONENT
// ============================================================
function QuickStats({ domain, data }: { domain: string; data: WebsiteData | null }) {
  const [sslStatus, setSslStatus] = useState<'checking' | 'active' | 'inactive'>('checking')
  const [diskUsage, setDiskUsage] = useState<string>('Calculando...')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkSSL = async () => {
      try {
        const res = await fetch('/api/da', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'execCommand',
            params: { command: `curl -sI https://${domain} | head -1` }
          })
        })
        const result = await res.json()
        const output = result.data?.output || ''
        setSslStatus(output.includes('200') || output.includes('301') || output.includes('302') ? 'active' : 'inactive')
      } catch {
        setSslStatus('inactive')
      }
    }

    const getDiskUsage = async () => {
      try {
        const res = await fetch('/api/da', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'siteDiskUsage', params: { domain } })
        })
        const result = await res.json()
        if (result.success) {
          setDiskUsage(result.data.usage)
        }
      } catch {
        setDiskUsage('N/A')
      }
    }

    checkSSL()
    getDiskUsage()
  }, [domain])

  const handleIssueSSL = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/da', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execCommand',
          params: { command: `v-add-letsencrypt-domain admin ${domain} 2>&1` }
        })
      })
      const result = await res.json()
      const output = result.data?.output || ''
      if (output.toLowerCase().includes('success') || output.toLowerCase().includes('issued')) {
        alert(`✅ SSL emitido com sucesso para ${domain}!`)
        setSslStatus('active')
      } else {
        alert(`⚠️ Erro ao emitir SSL:\n\n${output}`)
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
    setLoading(false)
  }

  const stats = [
    { label: 'Estado', value: data?.state || 'Active', color: data?.state === 'Active' ? 'text-green-600' : 'text-red-600', icon: CheckCircle },
    { label: 'SSL', value: sslStatus === 'active' ? 'Activo' : sslStatus === 'checking' ? 'A verificar...' : 'Inactivo', color: sslStatus === 'active' ? 'text-green-600' : sslStatus === 'checking' ? 'text-amber-600' : 'text-red-600', icon: Lock },
    { label: 'PHP', value: data?.phpVersion || '8.2', color: 'text-purple-600', icon: Code },
    { label: 'Disco', value: diskUsage, color: 'text-blue-600', icon: HardDrive },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 text-sm">Estatísticas Rápidas</h3>
        {sslStatus !== 'active' && sslStatus !== 'checking' && (
          <button
            onClick={handleIssueSSL}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
            {loading ? 'A emitir...' : 'Emitir SSL'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <div key={i} className="text-center p-3 bg-gray-50 rounded-lg">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
              <p className="text-xs text-gray-400 uppercase font-bold">{stat.label}</p>
              <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export default function ManageWebsitePage() {
  const params = useParams()
  const router = useRouter()
  const domain = decodeURIComponent(params.domain as string)

  const [loading, setLoading] = useState(true)
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch website data from DirectAdmin
        const res = await fetch('/api/da', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetchWebsites' })
        })
        const data = await res.json()
        if (data.success) {
          const site = data.data.websites.find((w: any) => w.domain === domain)
          if (site) {
            setWebsiteData({
              domain: site.domain,
              state: site.state === 1 || site.state === '1' ? 'Active' : 'Suspended',
              ip: site.ip || getServerHost(),
              package: site.package || 'Default',
              phpVersion: site.php || 'PHP 8.2',
              owner: site.admin || 'admin',
              ssl: site.ssl === 1 || site.ssl === true,
              siteType: site.siteType
            })
          }
        }
      } catch (e) {
        console.error('Error fetching website data:', e)
      }
      setLoading(false)
    }

    fetchData()
  }, [domain])

  const handleRefresh = async () => {
    setRefreshing(true)
    window.location.reload()
  }

  // ============================================================
  // DEFINE ALL SECTIONS BASED ON DIRECTADMIN FEATURES
  // ============================================================
  const sections: SectionData[] = [
    {
      id: 'email-mgmt',
      title: 'EMAIL',
      icon: Mail,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      items: [
        { id: 'email-accounts', label: 'Email Accounts', icon: 'email-accounts', onClick: () => router.push('/admin?page=emails-new') },
        { id: 'email-forwarding', label: 'Forwarding', icon: 'email-forwarding', onClick: () => router.push('/admin?page=cp-email-forwarding') },
        { id: 'email-deliverability', label: 'Deliverability', icon: 'email-deliverability', onClick: () => router.push('/admin?page=cp-email-dkim') },
        { id: 'mailing-lists', label: 'Mailing Lists', icon: 'mailing-lists', onClick: () => router.push('/admin/mensagens?tab=subscritores') },
        { id: 'mx-entry', label: 'MX Entry', icon: 'mx-entry', onClick: () => router.push(`/admin?page=domains-dns&domain=${domain}`) },
      ]
    },
    {
      id: 'files',
      title: 'FILES',
      icon: FolderOpen,
      color: 'text-orange-700',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      items: [
        { id: 'file-manager', label: 'File Manager', icon: 'file-manager', onClick: () => router.push(`/admin?page=file-manager&domain=${domain}`) },
        { id: 'ftp-accounts', label: 'FTP Accounts', icon: 'ftp-accounts', onClick: () => router.push('/admin?page=cp-ftp') },
        { id: 'disk-usage', label: 'Disk Usage', icon: 'disk-usage', onClick: () => router.push(`/admin?page=file-manager&domain=${domain}`) },
        { id: 'git-version', label: 'Git Version Control', icon: 'git-version', onClick: () => router.push('/admin?page=git-deploy') },
        { id: 'backups', label: 'Backups', icon: 'backups', onClick: () => router.push('/admin?page=backup-manager') },
      ]
    },
    {
      id: 'databases',
      title: 'DATABASES',
      icon: Database,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      items: [
        { id: 'create-db', label: 'Databases', icon: 'databases', onClick: () => router.push('/admin?page=cp-databases') },
        { id: 'phpmyadmin', label: 'phpMyAdmin', icon: 'phpmyadmin', external: true, href: `https://${domain}:2222/phpMyAdmin/` },
      ]
    },
    {
      id: 'domains-section',
      title: 'DOMAINS',
      icon: Globe,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      items: [
        { id: 'addon-domains', label: 'Addon Domains', icon: 'addon-domains', onClick: () => router.push('/admin?page=domains-new') },
        { id: 'dns-zone', label: 'DNS Zone Editor', icon: 'dns-zone', onClick: () => router.push(`/admin?page=domains-dns&domain=${domain}`) },
        { id: 'domain-alias', label: 'Domain Aliases', icon: 'domain-alias', onClick: () => router.push('/admin?page=cp-list-subdomains') },
        { id: 'domain-redirects', label: 'Redirects', icon: 'domain-redirects', onClick: () => router.push('/admin?page=cp-list-subdomains') },
      ]
    },
    {
      id: 'security-section',
      title: 'SECURITY',
      icon: Shield,
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      items: [
        { id: 'ssl-tls', label: 'SSL / TLS', icon: 'ssl-tls', onClick: () => router.push('/admin?page=cp-ssl') },
        { id: 'ip-blocker', label: 'IP Blocker', icon: 'ip-blocker', onClick: () => router.push('/admin?page=cp-security') },
        { id: 'mod-security', label: 'ModSecurity', icon: 'mod-security', onClick: () => router.push('/admin?page=cp-security') },
      ]
    },
    {
      id: 'metrics-section',
      title: 'METRICS',
      icon: Monitor,
      color: 'text-gray-700',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      items: [
        { id: 'metrics', label: 'Metrics', icon: 'metrics', onClick: () => window.open(`${getHestiaUrl()}/list/web-log/?domain=${domain}`, '_blank') },
        { id: 'cron-jobs', label: 'Cron Jobs', icon: 'cron-jobs', onClick: () => window.open(`${getHestiaUrl()}/list/cron/`, '_blank') },
      ]
    },
    {
      id: 'apps',
      title: 'SOFTWARE',
      icon: Zap,
      color: 'text-violet-700',
      bgColor: 'bg-violet-50',
      borderColor: 'border-violet-200',
      items: [
        { id: 'app-wordpress', label: 'WordPress', icon: 'wordpress', onClick: () => router.push('/admin?page=wordpress-install'), badge: '1-CLICK' },
        { id: 'applications', label: 'Applications', icon: 'applications', onClick: () => router.push('/admin?page=wordpress-install') },
      ]
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin?page=domains-list"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Voltar</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">{domain}</h1>
                <p className="text-sm text-gray-500">Gestão de Website</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                websiteData?.state === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {websiteData?.state || 'Active'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Visitar Site
              </a>
              <a
                href={`https://${getServerHost()}:2222`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Server className="w-4 h-4" />
                DirectAdmin
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="space-y-6">
          {/* Quick Stats */}
          <QuickStats domain={domain} data={websiteData} />

          {/* Sections Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sections.slice(0, 6).map((section) => (
              <SectionCard key={section.id} section={section} domain={domain} />
            ))}
          </div>

          {/* Full Width Sections */}
          <div className="space-y-4">
            {sections.slice(6).map((section) => (
              <SectionCard key={section.id} section={section} domain={domain} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

// ============================================================
// CUSTOM ICONS (DIRECTADMIN STYLE)
// ============================================================
function CyberIcon({ name, className }: { name: string; className?: string }) {
  // Mapping of IDs to colorful SVGs matching the reference image
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
    default:
      return <Globe className={className} />
  }
}

function SendIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function GitIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

function ShopIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v18H3zM9 9h6v6H9z" />
    </svg>
  )
}
