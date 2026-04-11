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
  icon: React.ElementType
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
      >
        <div className="flex items-center gap-3">
          <div className={`${section.bgColor} ${section.color} p-2 rounded-lg`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">{section.title}</h3>
            <span className="text-xs text-gray-400">{section.items.length} opções</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${section.color.replace('text-', 'bg-').replace('-700', '-500').replace('-600', '-500')}`}></span>
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
          )}
        </div>
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {section.items.map((item) => {
              const ItemIcon = item.icon
              const isExternal = item.external

              const content = (
                <div className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group text-center bg-gray-50/50">
                  <div className={`${item.color || section.color} p-2.5 rounded-lg bg-white shadow-sm group-hover:scale-110 transition-transform`}>
                    <ItemIcon className="w-6 h-6" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-gray-700 font-semibold leading-tight block">{item.label}</span>
                    {item.description && (
                      <span className="text-[10px] text-gray-400 block">{item.description}</span>
                    )}
                  </div>
                  {item.badge && (
                    <span className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
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
                    className="relative"
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
                    className="relative"
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="relative text-left"
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
        const res = await fetch('/api/server-exec', {
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
        const res = await fetch('/api/server-exec', {
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
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execCommand',
          params: { command: `cyberpanel issueSSL --domainName ${domain} 2>&1` }
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
        // Fetch website data from CyberPanel
        const res = await fetch('/api/cyberpanel', {
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
              ip: site.ip || '109.199.104.22',
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
  // DEFINE ALL SECTIONS BASED ON CYBERPANEL FEATURES
  // ============================================================
  const sections: SectionData[] = [
    {
      id: 'email',
      title: 'EMAIL MARKETING',
      icon: Mail,
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      items: [
        { id: 'create-lists', label: 'Create Lists', icon: FileText, description: 'Criar listas de email', color: 'text-indigo-600', onClick: () => router.push('/admin/mensagens?tab=subscritores') },
        { id: 'manage-lists', label: 'Manage Lists', icon: List, description: 'Gerir subscritores', color: 'text-indigo-600', onClick: () => router.push('/admin/mensagens?tab=subscritores') },
        { id: 'smtp-hosts', label: 'SMTP Hosts', icon: Server, description: 'Configurar SMTP', color: 'text-indigo-600', onClick: () => router.push('/admin/setup-smtp') },
        { id: 'compose', label: 'Compose', icon: Edit, description: 'Escrever email', color: 'text-indigo-600', onClick: () => router.push('/admin/mensagens') },
        { id: 'send-emails', label: 'Send Emails', icon: SendIcon, description: 'Campanhas de email', color: 'text-indigo-600', onClick: () => router.push('/admin/mensagens?tab=campanhas') },
      ]
    },
    {
      id: 'logs',
      title: 'LOGS',
      icon: FileText,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      items: [
        { id: 'access-logs', label: 'Access Logs', icon: FileCode, description: 'Logs de acesso', color: 'text-amber-600', onClick: () => window.open(`https://109.199.104.22:8090/websites/viewAccessLogs?domain=${domain}`, '_blank') },
        { id: 'error-logs', label: 'Error Logs', icon: AlertCircle, description: 'Logs de erro', color: 'text-amber-600', onClick: () => window.open(`https://109.199.104.22:8090/websites/viewErrorLogs?domain=${domain}`, '_blank') },
      ]
    },
    {
      id: 'domains',
      title: 'DOMAINS',
      icon: Globe,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      items: [
        { id: 'add-domains', label: 'Add Domains', icon: Plus, description: 'Adicionar domínio', color: 'text-blue-600', onClick: () => router.push('/admin?page=domains-new') },
        { id: 'list-domains', label: 'List Domains', icon: List, description: 'Listar websites', color: 'text-blue-600', onClick: () => router.push('/admin?page=domains-list') },
        { id: 'domain-alias', label: 'Domain Alias', icon: Globe2, description: 'Aliases de domínio', color: 'text-blue-600', onClick: () => router.push('/admin?page=cp-list-subdomains') },
        { id: 'cron-jobs', label: 'Cron Jobs', icon: Zap, description: 'Tarefas agendadas', color: 'text-blue-600', onClick: () => window.open(`https://109.199.104.22:8090/Cron/CronManager?domain=${domain}`, '_blank') },
      ]
    },
    {
      id: 'configurations',
      title: 'CONFIGURATIONS',
      icon: Settings,
      color: 'text-cyan-700',
      bgColor: 'bg-cyan-50',
      borderColor: 'border-cyan-200',
      items: [
        { id: 'apache-manager', label: 'Apache Manager', icon: Server, description: 'Gestão Apache', color: 'text-cyan-600', onClick: () => window.open(`https://109.199.104.22:8090/apacheManager/index?domain=${domain}`, '_blank') },
        { id: 'vhost-conf', label: 'vHost Conf', icon: FileCode, description: 'Configuração vHost', color: 'text-cyan-600', onClick: () => window.open(`https://109.199.104.22:8090/vhostTemplate/index?domain=${domain}`, '_blank') },
        { id: 'rewrite-rules', label: 'Rewrite Rules', icon: Edit, description: 'Regras de rewrite', color: 'text-cyan-600', onClick: () => window.open(`https://109.199.104.22:8090/website/rewriteRules?domain=${domain}`, '_blank') },
        { id: 'add-ssl', label: 'Add SSL', icon: Lock, description: 'Adicionar SSL', color: 'text-cyan-600', onClick: () => router.push('/admin?page=cp-ssl') },
        { id: 'change-php', label: 'Change PHP', icon: Code, description: 'Alterar versão PHP', color: 'text-cyan-600', onClick: () => router.push('/admin?page=cp-php') },
      ]
    },
    {
      id: 'files',
      title: 'FILES',
      icon: FolderOpen,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      items: [
        { id: 'file-manager', label: 'File Manager', icon: FolderOpen, description: 'Gestor de ficheiros', color: 'text-emerald-600', onClick: () => router.push(`/admin?page=file-manager&domain=${domain}`) },
        { id: 'open-basedir', label: 'open_basedir', icon: Shield, description: 'Restrições PHP', color: 'text-emerald-600', onClick: () => window.open(`https://109.199.104.22:8090/website/openBasedir?domain=${domain}`, '_blank') },
        { id: 'create-ftp', label: 'Create FTP Acct', icon: Upload, description: 'Criar conta FTP', color: 'text-emerald-600', onClick: () => router.push('/admin?page=cp-ftp') },
        { id: 'delete-ftp', label: 'Delete FTP Acct', icon: X, description: 'Apagar conta FTP', color: 'text-red-600', onClick: () => router.push('/admin?page=cp-ftp') },
      ]
    },
    {
      id: 'databases',
      title: 'DATABASES',
      icon: Database,
      color: 'text-orange-700',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      items: [
        { id: 'create-db', label: 'Create Database', icon: Plus, description: 'Criar base de dados', color: 'text-orange-600', onClick: () => router.push('/admin?page=cp-databases') },
        { id: 'manage-db', label: 'Manage Databases', icon: Database, description: 'Gerir bases de dados', color: 'text-orange-600', onClick: () => router.push('/admin?page=cp-databases') },
        { id: 'phpmyadmin', label: 'phpMyAdmin', icon: ExternalLink, description: 'Abrir phpMyAdmin', color: 'text-orange-600', external: true, href: 'https://109.199.104.22:8090/dataBases/phpMyAdmin' },
      ]
    },
    {
      id: 'email-mgmt',
      title: 'EMAILS',
      icon: Mail,
      color: 'text-rose-700',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      items: [
        { id: 'create-email', label: 'Create Email', icon: Plus, description: 'Criar conta de email', color: 'text-rose-600', onClick: () => router.push('/admin?page=emails-new') },
        { id: 'list-emails', label: 'List Emails', icon: List, description: 'Listar contas', color: 'text-rose-600', onClick: () => router.push('/admin?page=cp-email-mgmt') },
        { id: 'webmail', label: 'Webmail', icon: ExternalLink, description: 'Aceder webmail', color: 'text-rose-600', external: true, href: `https://${domain}:8090/snappymail` },
        { id: 'email-forwarding', label: 'Forwarding', icon: ArrowLeft, description: 'Encaminhamento', color: 'text-rose-600', onClick: () => router.push('/admin?page=cp-email-forwarding') },
        { id: 'dkim', label: 'DKIM Manager', icon: Shield, description: 'Gestão DKIM', color: 'text-rose-600', onClick: () => router.push('/admin?page=cp-email-dkim') },
      ]
    },
    {
      id: 'wordpress',
      title: 'WORDPRESS',
      icon: Globe2,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      items: [
        { id: 'wp-install', label: 'Install WP', icon: Download, description: 'Instalar WordPress', color: 'text-blue-600', onClick: () => router.push('/admin?page=wordpress-install'), badge: '1-CLICK' },
        { id: 'wp-admin', label: 'WP Admin', icon: ExternalLink, description: 'Painel WordPress', color: 'text-blue-600', external: true, href: `https://${domain}/wp-admin` },
        { id: 'wp-plugins', label: 'Plugins', icon: Plug, description: 'Gerir plugins', color: 'text-blue-600', onClick: () => router.push('/admin?page=cp-wp-plugins') },
        { id: 'wp-backup', label: 'Backup', icon: Archive, description: 'Backup WordPress', color: 'text-blue-600', onClick: () => router.push('/admin?page=cp-wp-backup') },
        { id: 'wp-restore', label: 'Restore', icon: RotateCcw, description: 'Restaurar backup', color: 'text-blue-600', onClick: () => router.push('/admin?page=cp-wp-restore-backup') },
      ]
    },
    {
      id: 'apps',
      title: '1-CLICK APPS',
      icon: Zap,
      color: 'text-violet-700',
      bgColor: 'bg-violet-50',
      borderColor: 'border-violet-200',
      items: [
        { id: 'app-wordpress', label: 'WordPress', icon: Globe2, description: 'CMS mais popular', color: 'text-blue-600', onClick: () => router.push('/admin?page=wordpress-install'), badge: '1-CLICK' },
        { id: 'app-git', label: 'Git Integration', icon: GitIcon, description: 'Version control', color: 'text-orange-600', onClick: () => router.push('/admin?page=git-deploy') },
        { id: 'app-prestashop', label: 'PrestaShop', icon: ShopIcon, description: 'E-commerce profissional', color: 'text-pink-600', onClick: () => router.push('/admin?page=wordpress-install'), badge: 'E-COMMERCE' },
        { id: 'app-mautic', label: 'Mautic', icon: Mail, description: 'Marketing automation', color: 'text-purple-600', onClick: () => router.push('/admin?page=wordpress-install') },
      ]
    },
    {
      id: 'security',
      title: 'SECURITY',
      icon: Shield,
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      items: [
        { id: 'ssl-tls', label: 'SSL / TLS', icon: Lock, description: 'Certificados SSL', color: 'text-red-600', onClick: () => router.push('/admin?page=cp-ssl') },
        { id: 'firewall', label: 'Firewall', icon: Shield, description: 'ModSecurity', color: 'text-red-600', onClick: () => router.push('/admin?page=cp-security') },
        { id: 'blocked-ips', label: 'Blocked IPs', icon: AlertCircle, description: 'IPs bloqueados', color: 'text-red-600', onClick: () => router.push('/admin?page=cp-security') },
        { id: 'hotlink', label: 'Hotlink Protection', icon: Lock, description: 'Proteção hotlink', color: 'text-red-600', onClick: () => window.open(`https://109.199.104.22:8090/website/hotlinkProtection?domain=${domain}`, '_blank') },
      ]
    },
    {
      id: 'backup',
      title: 'BACKUP',
      icon: Archive,
      color: 'text-teal-700',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
      items: [
        { id: 'create-backup', label: 'Create Backup', icon: Download, description: 'Criar backup', color: 'text-teal-600', onClick: () => router.push('/admin?page=cp-wp-backup') },
        { id: 'restore-backup', label: 'Restore Backup', icon: RotateCcw, description: 'Restaurar backup', color: 'text-teal-600', onClick: () => router.push('/admin?page=cp-wp-restore-backup') },
        { id: 'remote-backup', label: 'Remote Backup', icon: Cloud, description: 'Backup remoto', color: 'text-teal-600', onClick: () => router.push('/admin?page=cp-wp-remote-backup') },
        { id: 'backup-manager', label: 'Backup Manager', icon: HardDrive, description: 'Gestão de backups', color: 'text-teal-600', onClick: () => router.push('/admin?page=backup-manager') },
      ]
    },
    {
      id: 'dns',
      title: 'DNS',
      icon: Server,
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      items: [
        { id: 'edit-dns', label: 'Edit DNS Zone', icon: Edit, description: 'Editar zona DNS', color: 'text-yellow-600', onClick: () => router.push(`/admin?page=domains-dns&domain=${domain}`) },
        { id: 'create-zone', label: 'Create Zone', icon: Plus, description: 'Criar zona DNS', color: 'text-yellow-600', onClick: () => router.push('/admin?page=cp-dns-create-zone') },
        { id: 'delete-zone', label: 'Delete Zone', icon: Trash2, description: 'Apagar zona', color: 'text-red-600', onClick: () => router.push('/admin?page=cp-dns-delete-zone') },
        { id: 'cloudflare', label: 'CloudFlare', icon: Cloud, description: 'Integração CF', color: 'text-yellow-600', onClick: () => router.push('/admin?page=cp-dns-cloudflare') },
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
                href="https://109.199.104.22:8090"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Server className="w-4 h-4" />
                CyberPanel
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
// CUSTOM ICONS
// ============================================================
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
