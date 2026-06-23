'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, ChevronRight, Globe, Lock, Edit, Plus, Search, LockOpen,
  Archive, Database, FolderOpen, Globe2, PauseCircle, Trash2, MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getServerHost } from '@/lib/server-config';
import { loadScreenshot, prefetchScreenshot, getCachedScreenshot } from '@/lib/site-screenshot-cache';
import { readSiteSslCache, writeSiteSslCache } from '@/lib/site-ssl-cache';
import { readWpInstallsCache, writeWpInstallsCache } from '@/lib/panel-wp-cache';
import type { PanelBootstrapScope } from '@/lib/panel-data-from-server';
import { directAdminAPI } from '@/lib/directadmin-api';
import type { DirectAdminWebsite, DirectAdminPackage } from '@/lib/directadmin-api';
import { removeWebsiteFromSupabase, syncWebsiteToSupabase } from '@/lib/supabase-sync';
import { panelInnerDetailCard, panelMobileCardGrid } from '@/lib/panel-ui';

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

function ListWebsitesSection({ sites, onRefresh, packages, setActiveSection, setFileManagerDomain, setSelectedDNSDomain, setSelectedSslDomain, primaryDomain, loadDirectAdminData, syncing, handleSync, daLoadError, wordpressOnly = false,
  wordpressOwner = 'admin',
  panelScope = 'admin',
}: {
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
  /** Dono dos sites na vista WordPress (admin = 'admin', revendedor = utilizador DA). */
  wordpressOwner?: string,
  panelScope?: PanelBootstrapScope,
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
    wordpressOnly ? new Set(readWpInstallsCache(panelScope).map((d) => d.toLowerCase())) : new Set(),
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
          owner: wordpressOwner || '',
          state: 'Active',
          siteType: 'wordpress',
          hasWordPress: true,
        })
      }
    }
    return Array.from(map.values())
  }, [sitesArray, wpDomainSet, wordpressOnly, wordpressOwner])

  const filtered = sortSitesPrimaryFirst(
    mergedSitesArray.filter(s => {
      if (!s.domain.toLowerCase().includes(search.toLowerCase())) return false
      if (s.domain.includes('contaboserver')) return false
      if (s.domain.toLowerCase().startsWith('mail')) return false
      if (wordpressOnly) {
        const owner = (s.owner || '').trim().toLowerCase()
        const expected = (wordpressOwner || '').trim().toLowerCase()
        if (!expected || owner !== expected) return false
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
    const cached = readWpInstallsCache(panelScope)
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
        writeWpInstallsCache(domains, panelScope)
        setWpDomainSet(new Set(domains))
      } catch {
        /* mantém cache/espelho */
      } finally {
        if (!cancelled) setWpListLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [wordpressOnly, panelScope])

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
    setTimeout(() => setActiveSection('wp-backup'), 50)
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

  const SITE_DETAIL_CARD = `${panelInnerDetailCard} overflow-hidden`;

  const EditableField = ({ domain, field, value, label }: { domain: string, field: string, value: string, label: string }) => {
    const isEditing = editingField?.domain === domain && editingField?.field === field
    return (
      <div className={SITE_DETAIL_CARD}>
        <p className="text-xs font-bold text-gray-400 uppercase mb-1">{label}</p>
        {isEditing ? (
          <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
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
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900 truncate">{value || '-'}</p>
            <button onClick={() => { setEditingField({ domain, field }); setEditValue(value) }}
              className="text-gray-400 hover:text-blue-500 ml-2">
              <Edit className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    )
  }

  if (wordpressOnly && !wordpressOwner?.trim()) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-500 dark:text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin text-red-600 mr-2" />
        A sincronizar conta activa…
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:min-w-0 sm:flex-1">
          <div className="relative w-full sm:w-[14rem] sm:shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar websites..."
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm w-full" />
          </div>
          <span className="text-left text-base font-bold text-gray-900 shrink-0 dark:text-zinc-100">
            Websites ({filtered.length})
          </span>
        </div>

        <button onClick={() => setActiveSection('wordpress-install')}
          className="bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 hover:text-green-700 px-4 py-2 rounded text-xs font-bold flex items-center justify-start gap-1.5 transition-all shrink-0 w-full sm:w-auto">
          <Plus className="w-3 h-3" /> Criar Website
        </button>
      </div>

      {msg && <div className="px-4 py-2.5 rounded text-sm bg-green-50 text-green-700 border border-green-200">{msg}</div>}

      {daLoadError && (
        <div className="px-4 py-3 rounded text-sm bg-red-50 text-red-800 border border-red-200">
          <strong>DirectAdmin:</strong> {daLoadError}
          {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
            <p className="mt-2 text-red-700/90">
              Em <code>localhost</code> a API do DirectAdmin pode falhar (IP bloqueado ou sem acesso directo). Use o painel em produção{' '}
              (<strong>visualdesignmoz.com/dashboard</strong>), o DirectAdmin em{' '}
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
            <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">

              {/* Info do site */}
              <div className="flex flex-wrap items-center justify-start gap-2 md:gap-3">
                <button
                  onClick={() => setExpandedSite(expandedSite === s.domain ? null : s.domain)}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  title="Expandir/Colapsar"
                >
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedSite === s.domain ? 'rotate-90' : ''}`} />
                </button>
                <a
                  href={`https://${s.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-sm text-gray-900 dark:text-zinc-100 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  {s.domain}
                </a>
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
              <div className="flex flex-wrap items-center justify-start gap-2 shrink-0 md:justify-end">
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
                    className="z-[200] min-w-max p-1 text-xs !bg-white dark:!bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-lg"
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
                    {isWordPressSite(s) && (
                      <DropdownMenuItem className="text-xs px-2 py-1.5" onClick={() => {
                        // @ts-ignore
                        window.__selectedWpDomain = s.domain;
                        setActiveSection('wp-users');
                      }}>
                        Acessos WordPress
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Conteúdo expandido */}
            {expandedSite === s.domain && (
              <div className="border-t border-gray-100 p-4 space-y-4">

                {/* Miniatura + 6 cards uniformes */}
                <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:min-h-[10.5rem]">
                  <div className="w-full max-w-[300px] shrink-0 h-40 overflow-hidden rounded border border-gray-200 dark:border-zinc-600 md:w-[38%] md:max-w-[300px] md:h-[10.5rem]">
                    <SiteThumbnail
                      domain={s.domain}
                      width={wordpressOnly ? 320 : 600}
                      className="h-full w-full"
                    />
                  </div>

                  <div className={`flex-1 ${panelMobileCardGrid} md:grid-cols-3 md:grid-rows-2`}>
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
                <div className="flex flex-wrap items-center justify-start gap-2 border-t border-gray-100 pt-3 dark:border-zinc-800">
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

export { ListWebsitesSection, sortSitesPrimaryFirst };
