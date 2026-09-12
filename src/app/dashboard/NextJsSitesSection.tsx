'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  RefreshCw, Plus, MoreVertical, X, ExternalLink, ChevronRight, Lock, LockOpen,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome'
import { Spinner } from '@/components/ui/spinner'
import { panelBtnPrimary, panelBtnSecondary, panelField, panelSectionCard, panelInnerDetailCard, panelMobileCardGrid } from '@/lib/panel-ui'

// Este servidor (Contabo) só fala com o Hestia — nunca mostrar o link para o
// DirectAdmin, que nem existe aqui. Variável NEXT_PUBLIC_ porque este é um
// componente de cliente (a versão server-only fica em '@/lib/hosting-provider').
const IS_HESTIA_ONLY_DEPLOY =
  (process.env.NEXT_PUBLIC_DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia'
import { SiteThumbnail } from '@/components/panel/ListWebsitesSection'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'
import { readListCache, writeListCache } from '@/lib/panel-list-cache'

const CACHE_KEY = 'vd_nextjs_sites_v1'

interface NextJsSiteRow {
  id: string
  domain: string
  name: string | null
  hostingNote: string | null
  siteUrl: string | null
  adminUrl: string | null
  pm2ProcessName: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface Pm2Process {
  name: string
  status: string
  cpu: number
  memoryMb: number
  uptimeMs: number | null
  restarts: number
}

type HealthState = { dns: boolean; server: boolean; ssl: boolean } | 'loading' | 'error'

const emptyForm = {
  id: '',
  domain: '',
  name: '',
  hostingNote: '',
  siteUrl: '',
  adminUrl: '',
  pm2ProcessName: '',
  notes: '',
}

function formatUptime(ms: number | null): string {
  if (!ms || ms <= 0) return '—'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

const SITE_DETAIL_CARD = `${panelInnerDetailCard} overflow-hidden`

/** O site institucional da VisualDesign fica sempre em primeiro na lista. */
const PINNED_DOMAIN = 'visualdesignmoz.com'

function siteLinkFor(row: NextJsSiteRow): string {
  return row.siteUrl || `https://${row.domain}`
}

export function NextJsSitesSection({
  sites,
  onNavigate,
}: {
  sites: DirectAdminWebsite[]
  onNavigate: (section: string, opts?: { domain?: string }) => void
}) {
  const [rows, setRows] = useState<NextJsSiteRow[]>(() => readListCache<NextJsSiteRow[]>(CACHE_KEY) ?? [])
  const [loading, setLoading] = useState(() => readListCache<NextJsSiteRow[]>(CACHE_KEY) === null)
  const [processes, setProcesses] = useState<Pm2Process[]>([])
  const [health, setHealth] = useState<Record<string, HealthState>>({})
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)
  const [form, setForm] = useState<typeof emptyForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aPinned = a.domain.toLowerCase() === PINNED_DOMAIN ? 0 : 1
      const bPinned = b.domain.toLowerCase() === PINNED_DOMAIN ? 0 : 1
      if (aPinned !== bPinned) return aPinned - bPinned
      return a.domain.localeCompare(b.domain)
    })
  }, [rows])

  const ownerByDomain = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sites) {
      if (s.domain) map.set(s.domain.toLowerCase(), (s.owner || 'admin').toLowerCase())
    }
    return map
  }, [sites])

  const loadSites = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/nextjs-sites', { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        setRows(data.sites)
        writeListCache(CACHE_KEY, data.sites)
      }
    } catch (e) {
      console.error('Erro ao carregar sites Next.js:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadProcesses = async () => {
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pm2ProcessList' }),
      })
      const data = await res.json()
      if (data.success) setProcesses(data.data.processes)
    } catch (e) {
      console.error('Erro ao carregar processos PM2:', e)
    }
  }

  const checkHealth = async (domain: string) => {
    setHealth((prev) => ({ ...prev, [domain]: 'loading' }))
    try {
      const res = await fetch(`/api/registrar/domain/health?domain=${encodeURIComponent(domain)}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Falha')
      setHealth((prev) => ({
        ...prev,
        [domain]: { dns: data.dns.ok, server: data.server.ok, ssl: data.ssl.ok },
      }))
    } catch {
      setHealth((prev) => ({ ...prev, [domain]: 'error' }))
    }
  }

  useEffect(() => {
    void loadSites()
    void loadProcesses()
  }, [])

  // Abre o primeiro site por defeito assim que a lista chega, para o
  // screenshot já ficar visível sem ser preciso clicar — só na carga
  // inicial, não volta a forçar se o utilizador colapsar manualmente.
  useEffect(() => {
    if (expandedDomain === null && sortedRows.length > 0) {
      setExpandedDomain(sortedRows[0].domain)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedRows])

  useEffect(() => {
    for (const row of rows) {
      if (!health[row.domain]) void checkHealth(row.domain)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const { setChrome } = useAdminSectionChrome()
  useEffect(() => {
    setChrome({
      toolbar: (
        <div className="flex items-center gap-2">
          <button className={panelBtnSecondary} onClick={() => { void loadSites(); void loadProcesses() }} disabled={loading}>
            {loading ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            <span>Actualizar</span>
          </button>
          <button className={panelBtnPrimary} onClick={() => { setFormError(''); setForm(emptyForm) }}>
            <Plus className="w-4 h-4" />
            <span>Adicionar site</span>
          </button>
        </div>
      ),
    })
    return () => setChrome(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const maxCpu = useMemo(
    () => Math.max(1, ...processes.map((p) => p.cpu)),
    [processes],
  )

  const closeForm = () => setForm(null)

  const submitForm = async () => {
    if (!form) return
    const domain = form.domain.trim().toLowerCase()
    if (!domain) {
      setFormError('Domínio obrigatório.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const isEdit = Boolean(form.id)
      const res = await fetch('/api/nextjs-sites', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id || undefined,
          domain,
          name: form.name.trim() || null,
          hostingNote: form.hostingNote.trim() || null,
          siteUrl: form.siteUrl.trim() || null,
          adminUrl: form.adminUrl.trim() || null,
          pm2ProcessName: form.pm2ProcessName.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao guardar')
      closeForm()
      await loadSites()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  const removeSite = async (row: NextJsSiteRow) => {
    if (!window.confirm(`Remover "${row.domain}" do registo? Isto não afecta o site em si.`)) return
    try {
      const res = await fetch(`/api/nextjs-sites?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Falha ao remover')
      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } catch (e) {
      console.error('Erro ao remover site:', e)
    }
  }

  return (
    <div className="space-y-4">
      {loading && rows.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 dark:text-zinc-500">A carregar sites...</div>
      ) : rows.length === 0 ? (
        <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>
          Ainda não há sites Next.js registados.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedRows.map((row) => {
            const proc = row.pm2ProcessName
              ? processes.find((p) => p.name === row.pm2ProcessName)
              : undefined
            const cpuPct = proc ? Math.round((proc.cpu / maxCpu) * 100) : null
            const owner = ownerByDomain.get(row.domain)
            const h = health[row.domain]
            const isOnline = typeof h === 'object' && h.server
            const isExpanded = expandedDomain === row.domain

            return (
              <div
                key={row.id}
                className={`bg-white rounded border dark:bg-zinc-900 ${isExpanded ? 'border-blue-200 dark:border-blue-900 shadow-md' : 'border-gray-200 dark:border-zinc-800 shadow-sm'} transition-all`}
              >
                <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center justify-start gap-2 md:gap-3">
                    <button
                      onClick={() => setExpandedDomain(isExpanded ? null : row.domain)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Expandir/Colapsar"
                    >
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    <a
                      href={siteLinkFor(row)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-sm text-gray-900 dark:text-zinc-100 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      {row.name || row.domain}
                    </a>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      h === 'loading' || h === undefined
                        ? 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'
                        : isOnline
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                    }`}>
                      {h === 'loading' || h === undefined ? 'A verificar...' : isOnline ? 'Online' : 'Offline'}
                    </span>
                    <span className="px-2 py-0.5 bg-black text-white rounded-full text-xs font-bold">Next.js</span>
                    {typeof h === 'object' && (
                      h.ssl ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <Lock className="w-3.5 h-3.5" /> SSL Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                          <LockOpen className="w-3.5 h-3.5" /> Sem SSL
                        </span>
                      )
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-start gap-2 shrink-0 md:justify-end">
                    {row.adminUrl && (
                      <>
                        <a
                          href={row.adminUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-medium transition-colors underline-offset-2 hover:underline"
                        >
                          Aceder ao backend
                        </a>
                        <span className="w-px h-[0.85em] shrink-0 bg-gray-300/80 dark:bg-zinc-600/80" aria-hidden />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFormError('')
                        setForm({
                          id: row.id,
                          domain: row.domain,
                          name: row.name || '',
                          hostingNote: row.hostingNote || '',
                          siteUrl: row.siteUrl || '',
                          adminUrl: row.adminUrl || '',
                          pm2ProcessName: row.pm2ProcessName || '',
                          notes: row.notes || '',
                        })
                      }}
                      className="text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-medium transition-colors underline-offset-2 hover:underline"
                    >
                      Editar
                    </button>
                    <span className="w-px h-[0.85em] shrink-0 bg-gray-300/80 dark:bg-zinc-600/80" aria-hidden />
                    <button
                      type="button"
                      onClick={() => void removeSite(row)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium transition-colors underline-offset-2 hover:underline"
                    >
                      Remover
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
                        {owner ? (
                          <>
                            <DropdownMenuItem
                              className="text-xs px-2 py-1.5"
                              onClick={() => onNavigate('dns-central', { domain: row.domain })}
                            >
                              Gerir DNS
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-xs px-2 py-1.5"
                              onClick={() => onNavigate('cp-dns-nameserver', { domain: row.domain })}
                            >
                              Nameservers
                            </DropdownMenuItem>
                            {!IS_HESTIA_ONLY_DEPLOY && (
                              <DropdownMenuItem asChild className="text-xs px-2 py-1.5">
                                <a href={`/api/directadmin-access?user=${encodeURIComponent(owner)}`}>
                                  Abrir no DirectAdmin
                                </a>
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : (
                          <div className="px-2 py-1.5 text-xs text-gray-400 dark:text-zinc-500 max-w-[14rem]">
                            Domínio não gerido neste servidor.
                          </div>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-zinc-800 p-4 space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:min-h-[10.5rem]">
                      <a
                        href={siteLinkFor(row)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Abrir ${row.domain}`}
                        className="w-full max-w-[300px] shrink-0 h-40 overflow-hidden rounded border border-gray-200 dark:border-zinc-600 md:w-[38%] md:max-w-[300px] md:h-[10.5rem] block"
                      >
                        <SiteThumbnail domain={row.domain} width={600} className="h-full w-full" objectPosition="center" />
                      </a>

                      <div className={`flex-1 ${panelMobileCardGrid} md:grid-cols-3 md:grid-rows-2`}>
                        <div className={SITE_DETAIL_CARD}>
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Estado</p>
                          <p className={`text-sm font-bold truncate ${isOnline ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {h === 'loading' || h === undefined ? 'A verificar...' : isOnline ? 'Online' : 'Offline'}
                          </p>
                        </div>
                        <div className={SITE_DETAIL_CARD}>
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">CPU (vs. outros sites)</p>
                          {proc ? (
                            <>
                              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{proc.cpu}%</p>
                              <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800">
                                <div className="h-1.5 rounded-full bg-red-500" style={{ width: `${Math.max(2, cpuPct || 0)}%` }} />
                              </div>
                            </>
                          ) : (
                            <p className="text-sm font-bold text-gray-400 dark:text-zinc-500 truncate">—</p>
                          )}
                        </div>
                        <div className={SITE_DETAIL_CARD}>
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Memória</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {proc ? `${proc.memoryMb} MB` : '—'}
                          </p>
                        </div>
                        <div className={SITE_DETAIL_CARD}>
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Uptime</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {proc ? `${formatUptime(proc.uptimeMs)} · ${proc.restarts} restarts` : '—'}
                          </p>
                        </div>
                        <div className={SITE_DETAIL_CARD}>
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Alojado em</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{row.hostingNote || '—'}</p>
                        </div>
                        <div className={SITE_DETAIL_CARD}>
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Processo PM2</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{row.pm2ProcessName || '—'}</p>
                        </div>
                      </div>
                    </div>
                    {row.notes && (
                      <p className="text-xs text-gray-500 dark:text-zinc-400 border-t border-gray-100 dark:border-zinc-800 pt-3">
                        {row.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeForm} />
          <div className="relative w-full max-w-lg rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {form.id ? 'Editar site Next.js' : 'Adicionar site Next.js'}
              </h2>
              <button onClick={closeForm} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Domínio</label>
                <input
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="visualdesignmoz.com"
                  className={`${panelField} w-full`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Visual Design"
                  className={`${panelField} w-full`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Onde está alojado</label>
                <input
                  value={form.hostingNote}
                  onChange={(e) => setForm({ ...form, hostingNote: e.target.value })}
                  placeholder="Hetzner — mesmo servidor / Vercel / outro"
                  className={`${panelField} w-full`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Link do site</label>
                <input
                  value={form.siteUrl}
                  onChange={(e) => setForm({ ...form, siteUrl: e.target.value })}
                  placeholder={`https://${form.domain || 'exemplo.com'}`}
                  className={`${panelField} w-full`}
                />
                <p className="text-[10px] italic text-gray-400">
                  Deixe em branco para usar https://{'{domínio}'} automaticamente.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Nome do processo PM2 (opcional — só sites no Hetzner)
                </label>
                <input
                  value={form.pm2ProcessName}
                  onChange={(e) => setForm({ ...form, pm2ProcessName: e.target.value })}
                  placeholder="visualdesign-site"
                  className={`${panelField} w-full`}
                />
                <p className="text-[10px] italic text-gray-400">
                  Activa a comparação de CPU/memória entre sites (vem de <code>pm2 list</code> no servidor).
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Link do backend/admin</label>
                <input
                  value={form.adminUrl}
                  onChange={(e) => setForm({ ...form, adminUrl: e.target.value })}
                  placeholder="https://visualdesignmoz.com/dashboard"
                  className={`${panelField} w-full`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className={`${panelField} w-full !h-auto py-2`}
                />
              </div>
              {formError && <p className="text-xs font-medium text-rose-600">{formError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-zinc-800">
              <button className={panelBtnSecondary} onClick={closeForm} disabled={saving}>Cancelar</button>
              <button className={panelBtnPrimary} onClick={() => void submitForm()} disabled={saving}>
                {saving ? <Spinner className="w-4 h-4" /> : null}
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
