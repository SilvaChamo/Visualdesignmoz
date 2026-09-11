'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Database, Users, ExternalLink, Plus, Trash2, Eye, EyeOff, KeyRound,
  Upload, Download, Search, Wrench, Rocket, ChevronDown, ChevronUp, User, Copy, Check,
} from 'lucide-react'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import {
  panelBtnPrimary, panelBtnSecondary, panelCard, panelControlHeight, panelField,
  panelInnerDetailCard,
} from '@/lib/panel-ui'
import type {
  DbDatabaseUser, DbListEntry, DbMetadata, DbPrivs, DbUserDatabase, DbUserEntry,
} from '@/lib/da-database-types'
import { formatDbSize, hasFullAccess, fullDbPrivileges, readOnlyDbPrivileges, DB_PRIVILEGE_LABELS } from '@/lib/da-database-types'
import {
  invalidateDbCaches, readDbListCache, readDbMetaCache, readDbUsersCache,
  writeDbListCache, writeDbMetaCache, writeDbUsersCache,
} from '@/lib/panel-databases-cache'

type View = 'databases' | 'users' | 'manage-db' | 'manage-user'

type ConfirmDialog = {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => Promise<void>
}

type DbOpAction = 'import' | 'export-sql' | 'export-gz' | 'check' | 'repair' | 'optimize'

type DbOpState = {
  action: DbOpAction
  phase: string
  percent: number | null
  fileName?: string
  result?: string
  done?: boolean
  error?: boolean
}

const DB_OP_LABEL: Record<DbOpAction, string> = {
  import: 'Importar',
  'export-sql': 'Exportar SQL',
  'export-gz': 'Exportar GZ',
  check: 'Verificar',
  repair: 'Reparar',
  optimize: 'Optimizar',
}

async function dbRequest<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/db-manager', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Operação falhou')
  }
  return data.data as T
}

function generatePassword(length = 16): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function PrivilegeEditor({
  privileges,
  onChange,
}: {
  privileges: DbPrivs
  onChange: (next: DbPrivs) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={panelBtnSecondary} onClick={() => onChange(fullDbPrivileges())}>
          Acesso total
        </button>
        <button type="button" className={panelBtnSecondary} onClick={() => onChange(readOnlyDbPrivileges())}>
          Só leitura
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DB_PRIVILEGE_LABELS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(privileges[key])}
              onChange={(e) => onChange({ ...privileges, [key]: e.target.checked })}
              className="rounded border-gray-300 text-red-600"
            />
            <span className="font-mono">{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function domainOptionsFromSites(sites: DirectAdminWebsite[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const site of sites) {
    const domain = (site.domain || '').trim()
    if (!domain || domain.includes('contaboserver') || seen.has(domain)) continue
    seen.add(domain)
    out.push(domain)
  }
  return out
}

function pickInitialDomain(sites: DirectAdminWebsite[], initial?: string): string {
  const options = domainOptionsFromSites(sites)
  if (initial && options.includes(initial)) return initial
  return options[0] || ''
}

function domainToDbHint(domain: string): string {
  const host = domain.replace(/^www\./i, '').split(':')[0]
  const label = host.split('.')[0] || host
  return label.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)
}

function domainMatchTokens(domain: string): string[] {
  const hint = domainToDbHint(domain).toLowerCase()
  const host = domain.replace(/^www\./i, '').split(':')[0].toLowerCase()
  const label = (host.split('.')[0] || host).replace(/[^a-z0-9]/g, '')
  const tokens = new Set<string>()
  if (hint) tokens.add(hint)
  if (label) tokens.add(label)
  for (let n = 5; n <= Math.min(label.length, 14); n++) tokens.add(label.slice(0, n))
  return [...tokens].filter((token) => token.length >= 4)
}

function stripOwnerPrefix(name: string, owner: string): string {
  const prefix = `${owner}_`
  return name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name
}

function findDatabaseForDomain(domain: string, databases: DbListEntry[]): DbListEntry | undefined {
  const tokens = domainMatchTokens(domain)
  if (!tokens.length || !databases.length) return undefined
  let best: { row: DbListEntry; score: number } | undefined
  for (const row of databases) {
    const hay = `${row.database} ${row.dbuser || ''}`.toLowerCase()
    let score = 0
    for (const token of tokens) {
      if (hay.includes(token)) score = Math.max(score, token.length)
    }
    if (score > 0 && (!best || score > best.score)) best = { row, score }
  }
  return best?.row
}

function DomainSelect({
  value,
  options,
  associatedDomains,
  onChange,
}: {
  value: string
  options: string[]
  associatedDomains?: Set<string>
  onChange: (domain: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${panelField} w-full dark:bg-zinc-900`}
    >
      {options.length === 0 ? (
        <option value="">Nenhum domínio desta conta</option>
      ) : (
        options.map((domain) => {
          const associated = associatedDomains?.has(domain)
          return (
            <option key={domain} value={domain}>
              {associated ? `${domain} · associado` : domain}
            </option>
          )
        })
      )}
    </select>
  )
}

function CopySecret({
  value,
  emptyHint = 'A senha actual não está em texto nesta conta. Defina uma nova senha para a copiar e configurar o site.',
}: {
  value: string
  emptyHint?: string
}) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!value) {
    return <p className="text-xs text-zinc-500">{emptyHint}</p>
  }
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        type={visible ? 'text' : 'password'}
        value={value}
        className={`${panelField} min-w-0 flex-1 font-mono dark:bg-zinc-900`}
      />
      <button type="button" className="p-2 text-zinc-400 hover:text-zinc-700" onClick={() => setVisible((v) => !v)} title={visible ? 'Ocultar' : 'Mostrar'}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button
        type="button"
        className="p-2 text-zinc-400 hover:text-zinc-700"
        title="Copiar"
        onClick={() => {
          void navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        }}
      >
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}

function UserSecurityPanel({
  dbuser,
  knownPassword,
  hostsValue,
  onHostsChange,
  newPassword,
  onNewPasswordChange,
  showNewPass,
  onToggleShowNew,
  busy,
  onChangePassword,
  onSaveHosts,
}: {
  dbuser: string
  knownPassword: string
  hostsValue: string
  onHostsChange: (value: string) => void
  newPassword: string
  onNewPasswordChange: (value: string) => void
  showNewPass: boolean
  onToggleShowNew: () => void
  busy: boolean
  onChangePassword: () => Promise<void>
  onSaveHosts: () => Promise<void>
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-bold uppercase text-zinc-500">Senha</p>
        <p className="mb-2 text-xs text-zinc-500">
          Senha actual de <span className="font-mono">{dbuser}</span> (lida do wp-config do site, se existir) — copie para configurar o site.
        </p>
        <CopySecret value={knownPassword} />
        <p className="mb-1.5 mt-3 text-xs font-bold uppercase text-zinc-500">Alterar senha</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            type={showNewPass ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)"
            className={`${panelField} w-full md:flex-1 dark:bg-zinc-900`}
          />
          <button type="button" className="p-2 text-zinc-400" onClick={onToggleShowNew}>
            {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            disabled={busy || newPassword.length < 8}
            className={panelBtnPrimary}
            onClick={() => void onChangePassword()}
          >
            Alterar senha
          </button>
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase text-zinc-500">Hosts permitidos</p>
        <p className="mb-2 text-xs text-zinc-500">Separados por vírgula. Para adicionar outro host, inclua-o na lista e guarde (ex.: localhost, %, 127.0.0.1).</p>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            value={hostsValue}
            onChange={(e) => onHostsChange(e.target.value)}
            className={`${panelField} w-full md:flex-1 font-mono text-xs dark:bg-zinc-900`}
          />
          <button
            type="button"
            disabled={busy || !hostsValue.trim()}
            className={panelBtnPrimary}
            onClick={() => void onSaveHosts()}
          >
            Guardar hosts
          </button>
        </div>
      </div>
    </div>
  )
}

function PrefixField({
  prefix, value, onChange, placeholder, type = 'text',
}: {
  prefix: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="flex overflow-hidden rounded border border-gray-300 dark:border-zinc-700">
      <span className={`${panelControlHeight} flex items-center bg-gray-50 px-3 text-xs font-mono text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400`}>
        {prefix}_
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${panelField} min-w-0 flex-1 rounded-none border-0 dark:bg-zinc-900`}
      />
    </div>
  )
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className={cn(panelInnerDetailCard, 'flex items-center gap-3 px-4 py-3')}>
      <Icon className="h-5 w-5 shrink-0 text-red-500" />
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      </div>
    </div>
  )
}

function DbPulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-gray-200 dark:bg-zinc-800', className)} />
}

function DbListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={cn(panelInnerDetailCard, 'flex items-center gap-3 px-4 py-3')}>
          <DbPulse className="h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <DbPulse className="h-3 w-28" />
            <DbPulse className="h-4 w-16" />
          </div>
        </div>
        <div className={cn(panelInnerDetailCard, 'flex items-center gap-3 px-4 py-3')}>
          <DbPulse className="h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <DbPulse className="h-3 w-24" />
            <DbPulse className="h-4 w-20" />
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded border border-gray-200 dark:border-zinc-700">
        <div className="flex gap-4 border-b border-gray-200 bg-gray-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <DbPulse key={i} className={cn('h-3', i === 0 ? 'w-24' : 'w-14')} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, r) => (
          <div key={r} className="flex gap-4 border-b border-gray-100 px-3 py-3 last:border-0 dark:border-zinc-800">
            <DbPulse className="h-4 w-1/4" />
            <DbPulse className="h-4 w-16" />
            <DbPulse className="h-4 w-10" />
            <DbPulse className="h-4 w-10" />
            <DbPulse className="ml-auto h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DatabasesManagerSection({
  sites,
  initialDomain,
  loggedInOwner,
}: {
  sites: DirectAdminWebsite[]
  initialDomain?: string
  /** Username de hospedagem de quem está autenticado (vdadmin, oshercollective, aamihe, …). */
  loggedInOwner?: string
}) {
  const sessionOwner = (loggedInOwner || '').trim().toLowerCase()
  const scopedSites = useMemo(
    () => (sessionOwner
      ? sites.filter((s) => (s.owner || '').trim().toLowerCase() === sessionOwner)
      : []),
    [sites, sessionOwner],
  )
  const domainOptions = useMemo(() => domainOptionsFromSites(scopedSites), [scopedSites])
  const [selectedDomain, setSelectedDomain] = useState(() => pickInitialDomain(
    sessionOwner ? sites.filter((s) => (s.owner || '').trim().toLowerCase() === sessionOwner) : [],
    initialDomain,
  ))
  const appliedInitialDomain = useRef(initialDomain || '')
  const owner = sessionOwner

  const listCache = useMemo(() => (owner ? readDbListCache(owner) : null), [owner])
  const usersCache = useMemo(() => (owner ? readDbUsersCache(owner) : null), [owner])

  const [view, setView] = useState<View>('databases')
  const [selectedDatabase, setSelectedDatabase] = useState('')
  const [selectedDbUser, setSelectedDbUser] = useState('')

  const [databases, setDatabases] = useState<DbListEntry[]>(() => listCache?.rows ?? [])
  const [totalBytes, setTotalBytes] = useState(() => listCache?.totalBytes ?? 0)
  const [dbLimit, setDbLimit] = useState<number | null>(() => listCache?.limit ?? null)
  const [users, setUsers] = useState<DbUserEntry[]>(() => usersCache?.rows ?? [])
  const [userLimit, setUserLimit] = useState<number | null>(() => usersCache?.limit ?? null)
  const [dbMeta, setDbMeta] = useState<DbMetadata | null>(null)
  const [dbUsers, setDbUsers] = useState<DbDatabaseUser[]>([])
  const [userDatabases, setUserDatabases] = useState<DbUserDatabase[]>([])
  const [userMeta, setUserMeta] = useState<DbUserEntry | null>(null)

  const [loading, setLoading] = useState(() => !listCache)
  const [syncing, setSyncing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pmaBusy, setPmaBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [noSize, setNoSize] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null)

  const [createDbName, setCreateDbName] = useState('')
  const [createDbUser, setCreateDbUser] = useState('')
  const [createDbPass, setCreateDbPass] = useState('')
  const [showCreatePass, setShowCreatePass] = useState(false)
  const [advancedCreate, setAdvancedCreate] = useState(false)
  const [createCharset, setCreateCharset] = useState('')
  const [createCollation, setCreateCollation] = useState('')

  const [createUserName, setCreateUserName] = useState('')
  const [createUserPass, setCreateUserPass] = useState('')
  const [showUserPass, setShowUserPass] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)
  const [grantUser, setGrantUser] = useState('')
  const [grantDatabase, setGrantDatabase] = useState('')
  const [hostsInput, setHostsInput] = useState('')
  const [importClean, setImportClean] = useState(false)
  const [dbOp, setDbOp] = useState<DbOpState | null>(null)
  const importWaitRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [privEdit, setPrivEdit] = useState<{ dbuser: string; database: string; privileges: DbPrivs } | null>(null)
  const [knownPassword, setKnownPassword] = useState('')
  const [createdSecret, setCreatedSecret] = useState<{ database?: string; dbuser?: string; password: string } | null>(null)
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>({})
  const [userNewPass, setUserNewPass] = useState<Record<string, string>>({})
  const [userHosts, setUserHosts] = useState<Record<string, string>>({})
  const [showUserNewPass, setShowUserNewPass] = useState<Record<string, boolean>>({})
  const dbUserNames = useMemo(() => dbUsers.map((u) => u.dbuser).join('|'), [dbUsers])

  const flash = (text: string, isError = false) => {
    if (isError) setError(text)
    else setMsg(text)
    setTimeout(() => { setMsg(''); setError('') }, 4500)
  }

  const loadDatabases = useCallback(async (opts?: { hadCache?: boolean }) => {
    if (!selectedDomain || !owner) return
    const hadCache = opts?.hadCache === true
    if (!hadCache) setLoading(true)
    else setSyncing(true)
    try {
      const data = await dbRequest<{ rows: DbListEntry[]; totalBytes: number }>({
        action: 'listDatabases',
        domain: selectedDomain,
        owner,
        noSize,
      })
      setDatabases(data.rows || [])
      setTotalBytes(data.totalBytes || 0)
      writeDbListCache(owner, data.rows || [], data.totalBytes || 0, dbLimit)
    } catch (e: unknown) {
      if (!hadCache) {
        setDatabases([])
        flash(e instanceof Error ? e.message : 'Não foi possível carregar bases de dados.', true)
      }
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [selectedDomain, owner, noSize, dbLimit])

  const loadUsers = useCallback(async (opts?: { hadCache?: boolean }) => {
    if (!selectedDomain || !owner) return
    const hadCache = opts?.hadCache === true
    if (!hadCache) setLoading(true)
    else setSyncing(true)
    try {
      const rows = await dbRequest<DbUserEntry[]>({ action: 'listUsers', domain: selectedDomain, owner })
      setUsers(rows || [])
      writeDbUsersCache(owner, rows || [], userLimit)
    } catch (e: unknown) {
      if (!hadCache) {
        setUsers([])
        flash(e instanceof Error ? e.message : 'Não foi possível carregar utilizadores.', true)
      }
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [selectedDomain, owner, userLimit])

  const loadDbDetail = useCallback(async (database: string, opts?: { hadCache?: boolean }) => {
    if (!selectedDomain || !owner || !database) return
    const cached = readDbMetaCache(database)
    if (cached && !opts?.hadCache) setDbMeta(cached)
    setLoading(!cached)
    setSyncing(Boolean(cached))
    try {
      const [meta, dbUsersRows] = await Promise.all([
        dbRequest<DbMetadata>({ action: 'getDatabase', domain: selectedDomain, owner, database }),
        dbRequest<DbDatabaseUser[]>({ action: 'listDatabaseUsers', domain: selectedDomain, owner, database }),
      ])
      setDbMeta(meta)
      setDbUsers(dbUsersRows || [])
      writeDbMetaCache(database, meta)
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Não foi possível carregar detalhes.', true)
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [selectedDomain, owner])

  const loadUserDetail = useCallback(async (dbuser: string) => {
    if (!selectedDomain || !owner || !dbuser) return
    setLoading(true)
    try {
      const [meta, dbs] = await Promise.all([
        dbRequest<DbUserEntry>({ action: 'getUser', domain: selectedDomain, owner, dbuser }),
        dbRequest<DbUserDatabase[]>({ action: 'listUserDatabases', domain: selectedDomain, owner, dbuser }),
      ])
      setUserMeta(meta)
      setUserDatabases(dbs || [])
      setHostsInput((meta.hostPatterns || []).join(', '))
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Não foi possível carregar utilizador.', true)
    } finally {
      setLoading(false)
    }
  }, [selectedDomain, owner])

  useEffect(() => {
    if (!selectedDomain || !owner) return
    const cachedList = readDbListCache(owner)
    const cachedUsers = readDbUsersCache(owner)
    if (cachedList) {
      setDatabases(cachedList.rows)
      setTotalBytes(cachedList.totalBytes)
    }
    if (cachedUsers) setUsers(cachedUsers.rows)
    if (view === 'databases' && !cachedList) setLoading(true)
    if (view === 'users' && !cachedUsers) setLoading(true)
    void loadDatabases({ hadCache: Boolean(cachedList) })
    void loadUsers({ hadCache: Boolean(cachedUsers) })
  }, [selectedDomain, owner, noSize, loadDatabases, loadUsers, view])

  useEffect(() => {
    if (view === 'manage-db' && selectedDatabase) void loadDbDetail(selectedDatabase)
  }, [view, selectedDatabase, loadDbDetail])

  useEffect(() => {
    if (view === 'manage-user' && selectedDbUser) void loadUserDetail(selectedDbUser)
  }, [view, selectedDbUser, loadUserDetail])

  useEffect(() => {
    if (initialDomain && domainOptions.includes(initialDomain) && initialDomain !== appliedInitialDomain.current) {
      appliedInitialDomain.current = initialDomain
      setSelectedDomain(initialDomain)
      setView('databases')
      return
    }
    if (!selectedDomain && domainOptions[0]) {
      setSelectedDomain(domainOptions[0])
      return
    }
    if (selectedDomain && domainOptions.length && !domainOptions.includes(selectedDomain)) {
      setSelectedDomain(domainOptions[0])
    }
  }, [initialDomain, domainOptions, selectedDomain])

  const createFieldsKeyRef = useRef('')

  const applyCreateFieldsFromDomain = (domain: string) => {
    if (!owner) return
    const row = findDatabaseForDomain(domain, databases)
    if (row) {
      setCreateDbName(stripOwnerPrefix(row.database, owner))
      setCreateDbUser(row.dbuser ? stripOwnerPrefix(row.dbuser, owner) : '')
      setCreateDbPass('')
      if (row.dbuser) {
        void dbRequest<{ password?: string | null }>({
          action: 'revealPassword',
          domain,
          owner,
          dbuser: row.dbuser,
          database: row.database,
        }).then((data) => {
          const password = data?.password || ''
          if (password && !/permanently added|known hosts/i.test(password)) {
            setCreateDbPass(password)
          }
        }).catch(() => undefined)
      }
      return
    }
    const hint = domainToDbHint(domain)
    setCreateDbName(hint)
    setCreateDbUser(hint)
    setCreateDbPass('')
  }

  const handleCreateDomainChange = (domain: string) => {
    createFieldsKeyRef.current = ''
    setSelectedDomain(domain)
  }

  useEffect(() => {
    if (view !== 'databases' || !selectedDomain || !owner) return
    const key = `${selectedDomain}::${databases.map((row) => row.database).join(',')}`
    if (createFieldsKeyRef.current === key) return
    createFieldsKeyRef.current = key
    applyCreateFieldsFromDomain(selectedDomain)
  }, [view, selectedDomain, owner, databases])

  const openPhpMyAdmin = (database?: string) => {
    if (pmaBusy) return
    const qs = new URLSearchParams({ action: 'phpmyadminSso' })
    if (selectedDomain) qs.set('domain', selectedDomain)
    if (database) qs.set('database', database)
    const opened = window.open(`/api/db-manager?${qs.toString()}`, '_blank', 'noopener,noreferrer')
    if (!opened) {
      flash('Permita pop-ups para abrir o MySQL numa nova aba.', true)
      return
    }
    setPmaBusy(true)
    window.setTimeout(() => setPmaBusy(false), 1600)
  }

  const runDbOp = async (action: 'check' | 'repair' | 'optimize', database: string) => {
    setBusy(true)
    setDbOp({ action, phase: `A ${DB_OP_LABEL[action].toLowerCase()} «${database}»…`, percent: null })
    try {
      const data = await dbRequest<unknown>({ action, domain: selectedDomain, owner, database })
      const result = typeof data === 'string' && data.trim()
        ? data.trim()
        : data != null && typeof data === 'object'
          ? JSON.stringify(data, null, 2)
          : `${DB_OP_LABEL[action]} concluído.`
      setDbOp({ action, phase: `${DB_OP_LABEL[action]} concluído.`, percent: 100, result, done: true })
      flash(`${DB_OP_LABEL[action]} concluído.`)
      invalidateDbCaches(owner, database)
      void loadDbDetail(database, { hadCache: true })
      void loadDatabases({ hadCache: true })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Operação falhou.'
      setDbOp({ action, phase: message, percent: 100, result: message, done: true, error: true })
      flash(message, true)
    } finally {
      setBusy(false)
    }
  }

  const clearImportWait = () => {
    if (importWaitRef.current != null) {
      clearInterval(importWaitRef.current)
      importWaitRef.current = null
    }
  }

  const handleImport = async (file: File) => {
    if (!selectedDatabase) return
    setBusy(true)
    clearImportWait()
    setDbOp({
      action: 'import',
      phase: `A enviar «${file.name}» (${formatDbSize(file.size)})…`,
      percent: 0,
      fileName: file.name,
    })
    try {
      const form = new FormData()
      form.append('domain', selectedDomain)
      form.append('owner', owner)
      form.append('database', selectedDatabase)
      form.append('sqlfile', file, file.name)
      form.append('clean', importClean ? 'yes' : 'no')
      const data = await new Promise<{ success?: boolean; error?: string; data?: { sizeBytes?: number; tableCount?: number } }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/db-manager')
        xhr.withCredentials = true
        xhr.timeout = 600_000
        xhr.ontimeout = () => reject(new Error('A importação demorou mais de 10 minutos e foi interrompida.'))
        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return
          const uploaded = Math.round((ev.loaded / ev.total) * 40)
          setDbOp((prev) => prev && prev.action === 'import' && !prev.done
            ? { ...prev, percent: uploaded, phase: `A enviar «${file.name}» (${formatDbSize(file.size)})… ${uploaded}%` }
            : prev)
        }
        xhr.upload.onload = () => {
          setDbOp((prev) => prev && prev.action === 'import' && !prev.done
            ? { ...prev, percent: Math.max(prev.percent ?? 40, 40), phase: `Ficheiro enviado. A importar para «${selectedDatabase}»…` }
            : prev)
          clearImportWait()
          importWaitRef.current = setInterval(() => {
            setDbOp((prev) => {
              if (!prev || prev.action !== 'import' || prev.done || prev.percent == null) return prev
              if (prev.percent >= 95) return prev
              return { ...prev, percent: Math.min(95, prev.percent + 1) }
            })
          }, 500)
        }
        xhr.onerror = () => reject(new Error('Falha de rede ao importar.'))
        xhr.onload = () => {
          clearImportWait()
          let parsed: { success?: boolean; error?: string; data?: { sizeBytes?: number; tableCount?: number } } = {}
          try { parsed = JSON.parse(xhr.responseText || '{}') } catch { /* ignore */ }
          if (xhr.status >= 400 || parsed.success === false) {
            reject(new Error(parsed.error || `Importação falhou (${xhr.status}).`))
            return
          }
          resolve(parsed)
        }
        xhr.send(form)
      })
      const importedSize = data?.data?.sizeBytes
      const importedTables = data?.data?.tableCount
      setDbOp({
        action: 'import',
        phase: 'Importação concluída.',
        percent: 100,
        fileName: file.name,
        result: importedSize
          ? `«${file.name}» importado para ${selectedDatabase} (${formatDbSize(importedSize)}).`
          : `«${file.name}» importado para ${selectedDatabase}.`,
        done: true,
      })
      flash('Importação concluída.')
      if (importedSize != null) {
        setDatabases((prev) => {
          const next = prev.map((row) => row.database === selectedDatabase
            ? { ...row, sizeBytes: importedSize, tableCount: importedTables ?? row.tableCount }
            : row)
          setTotalBytes(next.reduce((sum, row) => sum + (row.sizeBytes || 0), 0))
          return next
        })
      }
      invalidateDbCaches(owner, selectedDatabase)
      await loadDbDetail(selectedDatabase, { hadCache: true })
      await loadDatabases({ hadCache: true })
    } catch (e: unknown) {
      clearImportWait()
      const message = e instanceof Error ? e.message : 'Importação falhou.'
      setDbOp({
        action: 'import',
        phase: message,
        percent: 100,
        fileName: file.name,
        result: message,
        done: true,
        error: true,
      })
      flash(message, true)
    } finally {
      clearImportWait()
      setBusy(false)
    }
  }

  const handleExport = async (gzip: boolean) => {
    if (!selectedDatabase) return
    const action: DbOpAction = gzip ? 'export-gz' : 'export-sql'
    setBusy(true)
    setDbOp({
      action,
      phase: gzip ? `A gerar dump comprimido de «${selectedDatabase}»…` : `A gerar dump SQL de «${selectedDatabase}»…`,
      percent: null,
    })
    try {
      const res = await fetch(
        `/api/db-manager?action=export&domain=${encodeURIComponent(selectedDomain)}&owner=${encodeURIComponent(owner)}&database=${encodeURIComponent(selectedDatabase)}&gzip=${gzip ? '1' : '0'}`,
        { credentials: 'include' },
      )
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok || contentType.includes('application/json')) {
        const err = await res.json().catch(() => ({ error: 'Exportação falhou.' }))
        throw new Error(err.error || 'Exportação falhou.')
      }
      const blob = await res.blob()
      const filename = `${selectedDatabase}${gzip ? '.sql.gz' : '.sql'}`
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
      setDbOp({
        action,
        phase: 'Exportação concluída.',
        percent: 100,
        result: `${filename} (${formatDbSize(blob.size)})`,
        done: true,
      })
      flash(`Exportação concluída: ${filename}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Exportação falhou.'
      setDbOp({ action, phase: message, percent: 100, result: message, done: true, error: true })
      flash(message, true)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => () => {
    if (importWaitRef.current != null) clearInterval(importWaitRef.current)
  }, [])

  const handleCreateDatabase = async () => {
    if (!owner || !createDbName.trim()) return
    setBusy(true)
    try {
      const userSuffix = createDbUser.trim()
      const password = userSuffix ? (createDbPass || generatePassword()) : ''
      const data = await dbRequest<{ database: string; dbuser?: string; password?: string }>({
        action: 'createDatabase',
        domain: selectedDomain,
        owner,
        name: createDbName.trim(),
        dbuser: userSuffix,
        password,
        charset: advancedCreate ? createCharset : undefined,
        collation: advancedCreate ? createCollation : undefined,
        advanced: advancedCreate,
      })
      if (userSuffix && data.password) {
        setCreatedSecret({ database: data.database, dbuser: data.dbuser, password: data.password })
        setKnownPassword(data.password)
        flash(`Base «${data.database}» e utilizador «${data.dbuser}» criados e associados. Copie a senha abaixo.`)
      } else {
        setCreatedSecret(null)
        flash(`Base «${data.database}» criada. Associe um utilizador na página desta base.`)
      }
      setCreateDbName('')
      setCreateDbUser('')
      setCreateDbPass('')
      invalidateDbCaches(owner)
      void loadDatabases({ hadCache: true })
      void loadUsers({ hadCache: true })
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Criação falhou.', true)
    } finally {
      setBusy(false)
    }
  }

  const handleCreateUser = async () => {
    if (!createUserName.trim() || !createUserPass) return
    setBusy(true)
    try {
      const data = await dbRequest<{ dbuser: string; password?: string }>({
        action: 'createUser',
        domain: selectedDomain,
        owner,
        dbuser: createUserName.trim(),
        password: createUserPass,
      })
      setCreatedSecret({ dbuser: data.dbuser, password: data.password || createUserPass })
      setKnownPassword(data.password || createUserPass)
      flash('Utilizador criado. Ainda sem base — associe-o numa base existente.')
      setCreateUserName('')
      setCreateUserPass('')
      invalidateDbCaches(owner)
      void loadUsers({ hadCache: true })
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Criação falhou.', true)
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = () => {
    if (view === 'databases') return 'Bases de dados'
    if (view === 'users') return 'Bases de dados / Utilizadores'
    if (view === 'manage-db') return `Bases de dados / ${selectedDatabase}`
    return `Bases de dados / Utilizadores / ${selectedDbUser}`
  }

  const breadcrumbLine = breadcrumb()

  const savePrivileges = async () => {
    if (!privEdit) return
    setBusy(true)
    try {
      await dbRequest({
        action: 'changePrivs',
        domain: selectedDomain,
        owner,
        database: privEdit.database,
        dbuser: privEdit.dbuser,
        privileges: privEdit.privileges,
      })
      flash('Privilégios actualizados.')
      setPrivEdit(null)
      if (view === 'manage-db' && selectedDatabase) void loadDbDetail(selectedDatabase, { hadCache: true })
      if (view === 'manage-user' && selectedDbUser) void loadUserDetail(selectedDbUser)
      void loadDatabases({ hadCache: true })
      void loadUsers({ hadCache: true })
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Não foi possível guardar os privilégios.', true)
    } finally {
      setBusy(false)
    }
  }

  const associatedDomains = useMemo(() => {
    const set = new Set<string>()
    for (const domain of domainOptions) {
      if (findDatabaseForDomain(domain, databases)) set.add(domain)
    }
    return set
  }, [domainOptions, databases])

  const selectedDomainDb = useMemo(
    () => findDatabaseForDomain(selectedDomain, databases),
    [selectedDomain, databases],
  )

  const createDbExists = useMemo(() => {
    const suffix = createDbName.trim()
    if (!owner || !suffix) return false
    const full = suffix.toLowerCase().startsWith(`${owner}_`.toLowerCase()) ? suffix : `${owner}_${suffix}`
    return databases.some((row) => row.database.toLowerCase() === full.toLowerCase())
  }, [owner, createDbName, databases])

  useEffect(() => {
    if (view !== 'manage-user' || !selectedDbUser || !owner || !selectedDomain) return
    let cancelled = false
    setKnownPassword('')
    void dbRequest<{ password?: string | null }>({
      action: 'revealPassword',
      domain: selectedDomain,
      owner,
      dbuser: selectedDbUser,
      database: selectedDatabase || undefined,
    })
      .then((data) => {
        if (!cancelled && data?.password) setKnownPassword(data.password)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [view, selectedDbUser, owner, selectedDomain])

  useEffect(() => {
    setUserHosts((prev) => {
      const next = { ...prev }
      for (const u of dbUsers) {
        next[u.dbuser] = (u.hostPatterns || []).join(', ')
      }
      return next
    })
    if (view === 'manage-db') {
      setGrantUser(dbUsers[0]?.dbuser || '')
    }
  }, [dbUserNames, dbUsers, view])

  useEffect(() => {
    if (view !== 'manage-db' || !selectedDomain || !owner || !dbUserNames) return
    const names = dbUserNames.split('|').filter(Boolean)
    let cancelled = false
    void Promise.all(names.map(async (dbuser) => {
      try {
        const data = await dbRequest<{ password?: string | null }>({
          action: 'revealPassword',
          domain: selectedDomain,
          owner,
          dbuser,
          database: selectedDatabase,
        })
        return [dbuser, /permanently added|known hosts/i.test(data?.password || '') ? '' : (data?.password || '')] as const
      } catch {
        return [dbuser, ''] as const
      }
    })).then((pairs) => {
      if (!cancelled) setUserPasswords((prev) => ({ ...prev, ...Object.fromEntries(pairs) }))
    })
    return () => { cancelled = true }
  }, [view, selectedDomain, owner, selectedDatabase, dbUserNames])

  const changeUserPassword = async (dbuser: string, override?: string) => {
    const pwd = (override ?? userNewPass[dbuser] ?? newPassword).trim()
    if (pwd.length < 8 || !selectedDomain || !owner) return
    setBusy(true)
    try {
      const data = await dbRequest<{ password?: string }>({
        action: 'changePassword', domain: selectedDomain, owner, dbuser, newPassword: pwd,
      })
      const next = data?.password || pwd
      setUserPasswords((p) => ({ ...p, [dbuser]: next }))
      setCreatedSecret({ dbuser, password: next })
      setUserNewPass((p) => {
        const copy = { ...p }
        delete copy[dbuser]
        return copy
      })
      if (dbuser === selectedDbUser) {
        setKnownPassword(next)
        setNewPassword('')
      }
      flash('Senha alterada. Copie-a abaixo para actualizar o site.')
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Falhou.', true)
    } finally {
      setBusy(false)
    }
  }

  const saveUserHosts = async (dbuser: string) => {
    const raw = userHosts[dbuser] ?? hostsInput
    const hostPatterns = raw.split(',').map((h) => h.trim()).filter(Boolean)
    if (!hostPatterns.length || !selectedDomain || !owner) return
    setBusy(true)
    try {
      await dbRequest({ action: 'changeHosts', domain: selectedDomain, owner, dbuser, hostPatterns })
      if (view === 'manage-db' && selectedDatabase) void loadDbDetail(selectedDatabase, { hadCache: true })
      if (view === 'manage-user' && selectedDbUser === dbuser) void loadUserDetail(dbuser)
      flash('Hosts actualizados.')
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Falhou.', true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-xl space-y-1.5">
          {view === 'manage-db' && selectedDatabase ? (
            <p className="text-base font-semibold font-mono text-zinc-900 dark:text-zinc-100">{selectedDatabase}</p>
          ) : view === 'manage-user' && selectedDbUser ? (
            <p className="text-base font-semibold font-mono text-zinc-900 dark:text-zinc-100">{selectedDbUser}</p>
          ) : (
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{breadcrumbLine}</p>
          )}
          {owner ? (
            <p className="text-xs text-zinc-500">
              Utilizador da conta principal: <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{owner}</span> —
            </p>
          ) : (
            <p className="text-xs text-zinc-500">A identificar a conta autenticada…</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view !== 'databases' ? (
            <button
              type="button"
              className={panelBtnSecondary}
              onClick={() => {
                if (view === 'manage-user') { setView('users'); return }
                if (view === 'manage-db') { setView('databases'); return }
                setView('databases')
              }}
            >
              {view === 'manage-db' ? 'Lista de bases' : 'Gerir bases de dados'}
            </button>
          ) : null}
          {view === 'databases' ? (
            <>
              <button type="button" disabled={pmaBusy} className={panelBtnSecondary} onClick={() => openPhpMyAdmin()}>
                {pmaBusy ? <Spinner className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                {pmaBusy ? 'A abrir MySQL…' : 'phpMyAdmin'}
              </button>
              <button type="button" className={panelBtnPrimary} onClick={() => setView('users')}>
                <Users className="h-4 w-4" /> Gerir utilizadores
              </button>
            </>
          ) : null}
          {view === 'manage-db' ? (
            <button type="button" disabled={pmaBusy || !selectedDatabase} className={panelBtnSecondary} onClick={() => openPhpMyAdmin(selectedDatabase)}>
              {pmaBusy ? <Spinner className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
              {pmaBusy ? 'A abrir MySQL…' : 'phpMyAdmin'}
            </button>
          ) : null}
          {view === 'users' || view === 'manage-user' ? (
            <button type="button" className={panelBtnPrimary} onClick={() => setView('databases')}>
              <Database className="h-4 w-4" /> Gerir bases de dados
            </button>
          ) : null}
        </div>
      </div>

      {msg ? <div className="rounded border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{msg}</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      {!selectedDomain ? (
        <div className={`${panelCard} p-8 text-center text-sm text-zinc-500`}>Nenhum website associado a esta secção.</div>
      ) : null}

      {selectedDomain && view === 'databases' ? (
        <>
          <div className={`${panelCard} space-y-4 p-6`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Lista de bases de dados</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Todas as bases de dados da conta <span className="font-mono">{owner}</span>, com tamanho, utilizadores e tabelas.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-500">
                <input type="checkbox" checked={noSize} onChange={(e) => setNoSize(e.target.checked)} className="rounded border-gray-300 text-red-600" />
                Não calcular tamanho (listagem mais rápida)
              </label>
            </div>

            {loading && !databases.length ? (
              <DbListSkeleton />
            ) : (
              <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                label="Número de bases de dados"
                value={`${databases.length}${dbLimit != null ? ` / ${dbLimit}` : ' / Ilimitado'}`}
                icon={Database}
              />
              <StatCard label="Tamanho total" value={formatDbSize(totalBytes)} icon={Database} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-700">
                  <tr>
                    <th className="px-3 py-2">Base de dados</th>
                    <th className="px-3 py-2">Utilizador</th>
                    <th className="px-3 py-2">Tamanho</th>
                    <th className="px-3 py-2">Acessos</th>
                    <th className="px-3 py-2">Tabelas</th>
                    <th className="px-3 py-2 text-right">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {databases.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-zinc-400">Nenhuma base de dados.</td></tr>
                  ) : databases.map((db) => (
                    <tr key={db.database} className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-2 font-mono font-medium">{db.database}</td>
                      <td className="px-3 py-2 font-mono text-zinc-600">{db.dbuser || '—'}</td>
                      <td className="px-3 py-2 text-zinc-600">{formatDbSize(db.sizeBytes)}</td>
                      <td className="px-3 py-2">{db.userCount}</td>
                      <td className="px-3 py-2">{db.tableCount}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className={panelBtnSecondary}
                            onClick={() => { setSelectedDatabase(db.database); setView('manage-db') }}
                          >
                            Gerir
                          </button>
                          <button
                            type="button"
                            className={`${panelBtnSecondary} border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400`}
                            onClick={() => setConfirm({
                              title: 'Eliminar base de dados',
                              message: `Eliminar permanentemente «${db.database}»?`,
                              confirmLabel: 'Eliminar',
                              danger: true,
                              onConfirm: async () => {
                                await dbRequest({ action: 'deleteDatabase', domain: selectedDomain, owner, database: db.database })
                                invalidateDbCaches(owner, db.database)
                                void loadDatabases({ hadCache: true })
                                flash('Base de dados eliminada.')
                              },
                            })}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </>
            )}
          </div>

          <div className={`${panelCard} space-y-4 p-6`}>
            <div>
              <h3 className="text-sm font-bold">Criar uma nova base de dados</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Pode criar só a base e associar um utilizador depois. Se preencher o utilizador, os dois nascem ligados. Deixe o utilizador vazio para criar a base sozinha.
              </p>
            </div>
            <div className="max-w-md">
              <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Domínio</label>
              <DomainSelect
                value={selectedDomain}
                options={domainOptions}
                associatedDomains={associatedDomains}
                onChange={handleCreateDomainChange}
              />
              {selectedDomainDb ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Este domínio já tem a base <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{selectedDomainDb.database}</span>
                  {selectedDomainDb.dbuser ? <> · utilizador <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{selectedDomainDb.dbuser}</span></> : null}.
                </p>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">Ainda não há base associada a este domínio. Os nomes abaixo são uma sugestão.</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Nome da base de dados</label>
                <PrefixField prefix={owner} value={createDbName} onChange={setCreateDbName} placeholder="minha_bd" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Nome de utilizador (opcional)</label>
                <PrefixField prefix={owner} value={createDbUser} onChange={setCreateDbUser} placeholder="vazio = só a base" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Senha do utilizador</label>
                <div className="relative">
                  <input
                    type={showCreatePass ? 'text' : 'password'}
                    value={createDbPass}
                    onChange={(e) => setCreateDbPass(e.target.value)}
                    placeholder={createDbUser.trim() ? 'Auto-gerada se vazia' : 'Só se criar utilizador'}
                    disabled={!createDbUser.trim()}
                    className={`${panelField} w-full pr-20 dark:bg-zinc-900`}
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                    <button type="button" className="p-1 text-zinc-400 hover:text-zinc-600" onClick={() => setCreateDbPass(generatePassword())} title="Gerar senha"><KeyRound className="h-4 w-4" /></button>
                    <button type="button" className="p-1 text-zinc-400 hover:text-zinc-600" onClick={() => setShowCreatePass((v) => !v)}>
                      {showCreatePass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {createdSecret?.password && view === 'databases' ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-green-800">Senha para configurar o site</p>
                {createdSecret.database ? <p className="mb-1 text-xs font-mono text-zinc-600">Base: {createdSecret.database}</p> : null}
                {createdSecret.dbuser ? <p className="mb-2 text-xs font-mono text-zinc-600">Utilizador: {createdSecret.dbuser}</p> : null}
                <CopySecret value={createdSecret.password} />
              </div>
            ) : null}
            <button type="button" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700" onClick={() => setAdvancedCreate((v) => !v)}>
              Modo avançado {advancedCreate ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {advancedCreate ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Charset</label>
                  <input value={createCharset} onChange={(e) => setCreateCharset(e.target.value)} placeholder="utf8mb4" className={`${panelField} w-full dark:bg-zinc-900`} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Collation</label>
                  <input value={createCollation} onChange={(e) => setCreateCollation(e.target.value)} placeholder="utf8mb4_general_ci" className={`${panelField} w-full dark:bg-zinc-900`} />
                </div>
              </div>
            ) : null}
            <div className="flex justify-end">
              <button type="button" disabled={busy || !owner || !createDbName.trim() || createDbExists} className={panelBtnPrimary} onClick={() => void handleCreateDatabase()}>
                {busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {createDbExists ? 'Já existe' : 'Criar'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {selectedDomain && view === 'users' ? (
        <>
          <div className={`${panelCard} space-y-4 p-6`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Contas de utilizadores</h3>
                <p className="mt-1 text-xs text-zinc-500">Utilizadores de bases de dados e hosts permitidos.</p>
              </div>
              <p className="text-xs text-zinc-500">Utilizadores: <strong>{users.length}</strong>{userLimit != null ? ` / ${userLimit}` : ' / Ilimitado'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-gray-200 text-xs font-bold uppercase text-zinc-500 dark:border-zinc-700">
                  <tr>
                    <th className="px-3 py-2">Utilizador</th>
                    <th className="px-3 py-2">Hosts permitidos</th>
                    <th className="px-3 py-2 text-right">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {loading && !users.length ? (
                    <tr><td colSpan={3} className="py-10 text-center"><Spinner className="mx-auto h-6 w-6" /></td></tr>
                  ) : users.map((u) => (
                    <tr key={u.dbuser}>
                      <td className="px-3 py-2 font-mono">{u.dbuser}</td>
                      <td className="px-3 py-2 text-xs text-zinc-600">{u.hostPatterns?.join(', ') || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button type="button" className={panelBtnSecondary} onClick={() => { setSelectedDbUser(u.dbuser); setView('manage-user') }}>Gerir</button>
                          <button
                            type="button"
                            className={`${panelBtnSecondary} border-red-300 text-red-600`}
                            onClick={() => setConfirm({
                              title: 'Eliminar utilizador',
                              message: `Eliminar «${u.dbuser}»?`,
                              confirmLabel: 'Eliminar',
                              danger: true,
                              onConfirm: async () => {
                                await dbRequest({ action: 'deleteUser', domain: selectedDomain, owner, dbuser: u.dbuser })
                                invalidateDbCaches(owner)
                                void loadUsers({ hadCache: true })
                                flash('Utilizador eliminado.')
                              },
                            })}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${panelCard} space-y-4 p-6`}>
            <h3 className="text-sm font-bold">Criar uma nova conta</h3>
            <p className="text-xs text-zinc-500">O utilizador nasce sem base. Depois associe-o a uma base existente — ou crie os dois juntos no formulário da página de bases.</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Nome de utilizador</label>
                <PrefixField prefix={owner} value={createUserName} onChange={setCreateUserName} placeholder="db_user" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Senha</label>
                <div className="relative">
                  <input
                    type={showUserPass ? 'text' : 'password'}
                    value={createUserPass}
                    onChange={(e) => setCreateUserPass(e.target.value)}
                    className={`${panelField} w-full pr-20 dark:bg-zinc-900`}
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                    <button type="button" className="p-1 text-zinc-400" onClick={() => setCreateUserPass(generatePassword())}><KeyRound className="h-4 w-4" /></button>
                    <button type="button" className="p-1 text-zinc-400" onClick={() => setShowUserPass((v) => !v)}>
                      {showUserPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" disabled={busy || !createUserName.trim() || createUserPass.length < 8} className={panelBtnPrimary} onClick={() => void handleCreateUser()}>
                {busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Criar utilizador
              </button>
            </div>
            {createdSecret?.password && view === 'users' ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-green-800">Senha para configurar o site</p>
                {createdSecret.dbuser ? <p className="mb-2 text-xs font-mono text-zinc-600">Utilizador: {createdSecret.dbuser}</p> : null}
                <CopySecret value={createdSecret.password} />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {selectedDomain && view === 'manage-db' && loading && !dbMeta ? (
        <div className={`${panelCard} py-12 text-center`}><Spinner className="mx-auto h-6 w-6" /></div>
      ) : null}

      {selectedDomain && view === 'manage-db' && dbMeta ? (
        <div className="space-y-4">
          <div className={`${panelCard} p-6`}>
            <h3 className="mb-4 text-sm font-bold">Informações detalhadas</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ['Nome', dbMeta.database],
                ['Charset', dbMeta.defaultCharset],
                ['Collation', dbMeta.defaultCollation],
                ['Tamanho', formatDbSize(dbMeta.sizeBytes)],
                ['Utilizadores', String(dbMeta.userCount)],
                ['Tabelas', String(dbMeta.tableCount)],
                ['Vistas', String(dbMeta.viewCount)],
                ['Eventos', String(dbMeta.eventCount)],
                ['Gatilhos', String(dbMeta.triggerCount)],
                ['Rotinas', String(dbMeta.routineCount)],
              ].map(([label, value]) => (
                <div key={label} className={panelInnerDetailCard}>
                  <p className="text-xs text-zinc-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold break-all">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`${panelCard} space-y-4 p-6`}>
            <h3 className="text-sm font-bold">Acesso de utilizadores</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs font-bold uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Utilizador</th>
                    <th className="px-3 py-2 text-left">Privilégios</th>
                    <th className="px-3 py-2 text-right">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-800">
                  {dbUsers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-sm text-zinc-500">
                        Nenhum utilizador associado. Use o card abaixo para associar.
                      </td>
                    </tr>
                  ) : dbUsers.map((u) => (
                    <tr key={u.dbuser}>
                      <td className="px-3 py-2 font-mono">{u.dbuser}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600">
                          {hasFullAccess(u.privileges) ? 'Acesso total' : 'Personalizado'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end flex-wrap gap-2">
                          <button type="button" disabled={pmaBusy} className={panelBtnSecondary} onClick={() => openPhpMyAdmin(selectedDatabase)}>
                            {pmaBusy ? <Spinner className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                            {pmaBusy ? 'A abrir MySQL…' : 'phpMyAdmin'}
                          </button>
                          <button
                            type="button"
                            className={panelBtnSecondary}
                            onClick={() => setPrivEdit({ dbuser: u.dbuser, database: selectedDatabase, privileges: { ...u.privileges } })}
                          >
                            Editar privilégios
                          </button>
                          <button
                            type="button"
                            className={`${panelBtnSecondary} border-red-300 text-red-600`}
                            onClick={() => setConfirm({
                              title: 'Desassociar utilizador',
                              message: `Desassociar «${u.dbuser}» de «${selectedDatabase}»?`,
                              confirmLabel: 'Desassociar',
                              danger: true,
                              onConfirm: async () => {
                                await dbRequest({ action: 'revokeAccess', domain: selectedDomain, owner, database: selectedDatabase, dbuser: u.dbuser })
                                void loadDbDetail(selectedDatabase, { hadCache: true })
                                flash('Utilizador desassociado.')
                              },
                            })}
                          >
                            Desassociar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {privEdit && privEdit.database === selectedDatabase ? (
              <div className="rounded border border-red-200 bg-red-50/40 p-4 dark:border-red-900 dark:bg-red-950/20">
                <p className="mb-3 text-sm font-bold">
                  Privilégios de <span className="font-mono">{privEdit.dbuser}</span> em <span className="font-mono">{privEdit.database}</span>
                </p>
                <PrivilegeEditor
                  privileges={privEdit.privileges}
                  onChange={(privileges) => setPrivEdit({ ...privEdit, privileges })}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className={panelBtnSecondary} onClick={() => setPrivEdit(null)}>Cancelar</button>
                  <button type="button" disabled={busy} className={panelBtnPrimary} onClick={() => void savePrivileges()}>
                    {busy ? <Spinner className="h-4 w-4" /> : null} Guardar privilégios
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {(() => {
            const primaryUser = dbUsers[0]?.dbuser || ''
            const associated = Boolean(primaryUser)
            const rawPass = (createdSecret?.dbuser === primaryUser ? createdSecret.password : '') || userPasswords[primaryUser] || ''
            const currentPass = /permanently added|known hosts/i.test(rawPass) ? '' : rawPass
            const passwordField = userNewPass[primaryUser] ?? currentPass
            const hostsField = userHosts[primaryUser] ?? (dbUsers[0]?.hostPatterns || []).join(', ')
            return (
              <div className={`${panelCard} space-y-3 p-6`}>
                <h3 className="text-sm font-bold">Senha, associação e hosts</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-zinc-500">Base de dados</label>
                    <p className={`${panelField} flex items-center font-mono`}>{selectedDatabase}</p>
                    {associated ? (
                      <p className={`${panelField} flex items-center font-mono`}>{primaryUser}</p>
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={grantUser}
                          onChange={(e) => setGrantUser(e.target.value)}
                          className={`${panelField} min-w-0 flex-1 dark:bg-zinc-900`}
                        >
                          <option value="">Seleccione o utilizador…</option>
                          {users.map((u) => (
                            <option key={u.dbuser} value={u.dbuser}>{u.dbuser}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!grantUser || busy}
                          className={panelBtnPrimary}
                          onClick={async () => {
                            setBusy(true)
                            try {
                              await dbRequest({ action: 'grantAccess', domain: selectedDomain, owner, database: selectedDatabase, dbuser: grantUser })
                              void loadDbDetail(selectedDatabase, { hadCache: true })
                              void loadUsers({ hadCache: true })
                              flash('Utilizador associado.')
                            } catch (e: unknown) {
                              flash(e instanceof Error ? e.message : 'Falhou.', true)
                            } finally { setBusy(false) }
                          }}
                        >
                          Associar
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-zinc-500">Hosts</label>
                    <input
                      value={hostsField}
                      onChange={(e) => {
                        if (!primaryUser) return
                        setUserHosts((p) => ({ ...p, [primaryUser]: e.target.value }))
                      }}
                      placeholder={primaryUser ? 'localhost, %' : 'Associe um utilizador primeiro'}
                      disabled={!primaryUser || busy}
                      className={`${panelField} w-full font-mono text-xs dark:bg-zinc-900`}
                    />
                    <button
                      type="button"
                      disabled={busy || !primaryUser || !hostsField.trim()}
                      className={`${panelBtnPrimary} w-full`}
                      onClick={() => void saveUserHosts(primaryUser)}
                    >
                      Guardar hosts
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-zinc-500">Senha</label>
                    <input
                      type="text"
                      value={passwordField}
                      onChange={(e) => {
                        if (!primaryUser) return
                        setUserNewPass((p) => ({ ...p, [primaryUser]: e.target.value }))
                      }}
                      placeholder={primaryUser ? 'Senha actual ou nova senha' : 'Sem utilizador associado'}
                      disabled={!primaryUser || busy}
                      className={`${panelField} w-full font-mono dark:bg-zinc-900`}
                    />
                    <button
                      type="button"
                      disabled={busy || !primaryUser || passwordField.trim().length < 8}
                      className={`${panelBtnPrimary} w-full`}
                      onClick={() => void changeUserPassword(primaryUser, passwordField)}
                    >
                      Alterar senha
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}

          <div className={`${panelCard} space-y-4 p-6`}>
            <h3 className="text-sm font-bold">Operações de base de dados</h3>
            <p className="text-xs text-zinc-500">Importar, exportar, verificar, reparar ou optimizar «{selectedDatabase}».</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <label className={cn(panelBtnSecondary, 'cursor-pointer', busy && 'pointer-events-none opacity-50')}>
                {busy && dbOp?.action === 'import' && !dbOp.done ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                Importar
                <input
                  type="file"
                  accept=".sql,.sql.gz,.gz,.zip"
                  disabled={busy}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleImport(f)
                    e.target.value = ''
                  }}
                />
              </label>
              <button type="button" disabled={busy} className={panelBtnSecondary} onClick={() => void handleExport(false)}>
                {busy && dbOp?.action === 'export-sql' ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                Exportar SQL
              </button>
              <button type="button" disabled={busy} className={panelBtnSecondary} onClick={() => void handleExport(true)}>
                {busy && dbOp?.action === 'export-gz' ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                Exportar GZ
              </button>
              <button type="button" disabled={busy} className={panelBtnSecondary} onClick={() => void runDbOp('check', selectedDatabase)}>
                {busy && dbOp?.action === 'check' ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                Verificar
              </button>
              <button type="button" disabled={busy} className={panelBtnSecondary} onClick={() => void runDbOp('repair', selectedDatabase)}>
                {busy && dbOp?.action === 'repair' ? <Spinner className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                Reparar
              </button>
              <button type="button" disabled={busy} className={panelBtnSecondary} onClick={() => void runDbOp('optimize', selectedDatabase)}>
                {busy && dbOp?.action === 'optimize' ? <Spinner className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
                Optimizar
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <input type="checkbox" checked={importClean} disabled={busy} onChange={(e) => setImportClean(e.target.checked)} className="rounded border-gray-300 text-red-600" />
              Limpar base de dados antes de importar
            </label>
            {dbOp ? (
              <div className={cn(
                'rounded-lg border p-4',
                dbOp.error
                  ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
                  : dbOp.done
                    ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20'
                    : 'border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800/40',
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {DB_OP_LABEL[dbOp.action]}
                      {dbOp.fileName ? <span className="font-normal text-zinc-500"> · {dbOp.fileName}</span> : null}
                    </p>
                    <p className={cn('mt-0.5 text-xs', dbOp.error ? 'text-red-700' : 'text-zinc-600 dark:text-zinc-400')}>{dbOp.phase}</p>
                  </div>
                  {!dbOp.done ? <Spinner className="h-4 w-4 shrink-0" /> : null}
                </div>
                {dbOp.percent != null ? (
                  <div className="mt-3 h-2 overflow-hidden rounded bg-white dark:bg-zinc-900">
                    <div
                      className={cn('h-2 rounded transition-all duration-300', dbOp.error ? 'bg-red-500' : 'bg-red-600')}
                      style={{ width: `${Math.max(2, dbOp.percent)}%` }}
                    />
                  </div>
                ) : !dbOp.done ? (
                  <div className="mt-3 h-2 overflow-hidden rounded bg-white dark:bg-zinc-900">
                    <div className="h-2 w-1/3 animate-pulse rounded bg-red-400" />
                  </div>
                ) : null}
                {dbOp.percent != null && !dbOp.done ? (
                  <p className="mt-1 text-right text-[11px] font-mono text-zinc-500">{dbOp.percent}%</p>
                ) : null}
                {dbOp.result ? (
                  <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-white p-2 text-[11px] font-mono text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {dbOp.result}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedDomain && view === 'manage-user' && userMeta ? (
        <div className="space-y-4">
          <div className={`${panelCard} p-6`}>
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-red-500" />
              <h3 className="text-sm font-bold font-mono">{userMeta.dbuser}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Bases de dados" value={String(userDatabases.length)} icon={Database} />
              <StatCard label="Hosts permitidos" value={String(userMeta.hostPatterns?.length || 0)} icon={Users} />
            </div>
          </div>

          <div className={`${panelCard} space-y-3 p-6`}>
            <h3 className="text-sm font-bold">Senha e hosts</h3>
            <UserSecurityPanel
              dbuser={selectedDbUser}
              knownPassword={createdSecret?.dbuser === selectedDbUser ? createdSecret.password : knownPassword}
              hostsValue={hostsInput}
              onHostsChange={setHostsInput}
              newPassword={newPassword}
              onNewPasswordChange={setNewPassword}
              showNewPass={showNewPass}
              onToggleShowNew={() => setShowNewPass((v) => !v)}
              busy={busy}
              onChangePassword={() => changeUserPassword(selectedDbUser)}
              onSaveHosts={() => saveUserHosts(selectedDbUser)}
            />
          </div>

          <div className={`${panelCard} space-y-4 p-6`}>
            <h3 className="text-sm font-bold">Acesso às bases de dados</h3>
            <table className="w-full text-sm">
              <thead className="border-b text-xs font-bold uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Base de dados</th>
                  <th className="px-3 py-2 text-left">Privilégios</th>
                  <th className="px-3 py-2 text-right">Acções</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-zinc-800">
                {userDatabases.map((d) => (
                  <tr key={d.database}>
                    <td className="px-3 py-2 font-mono">{d.database}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600">
                        {hasFullAccess(d.privileges) ? 'Acesso total' : 'Personalizado'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end flex-wrap gap-2">
                        <button
                          type="button"
                          className={panelBtnSecondary}
                          onClick={() => setPrivEdit({ dbuser: selectedDbUser, database: d.database, privileges: { ...d.privileges } })}
                        >
                          Editar privilégios
                        </button>
                        <button
                          type="button"
                          className={`${panelBtnSecondary} border-red-300 text-red-600`}
                          onClick={() => setConfirm({
                            title: 'Desassociar utilizador',
                            message: `Desassociar «${selectedDbUser}» de «${d.database}»?`,
                            confirmLabel: 'Desassociar',
                            danger: true,
                            onConfirm: async () => {
                              await dbRequest({ action: 'revokeAccess', domain: selectedDomain, owner, database: d.database, dbuser: selectedDbUser })
                              void loadUserDetail(selectedDbUser)
                              flash('Utilizador desassociado.')
                            },
                          })}
                        >
                          Desassociar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {privEdit && privEdit.dbuser === selectedDbUser ? (
              <div className="rounded border border-red-200 bg-red-50/40 p-4 dark:border-red-900 dark:bg-red-950/20">
                <p className="mb-3 text-sm font-bold">
                  Privilégios de <span className="font-mono">{privEdit.dbuser}</span> em <span className="font-mono">{privEdit.database}</span>
                </p>
                <PrivilegeEditor
                  privileges={privEdit.privileges}
                  onChange={(privileges) => setPrivEdit({ ...privEdit, privileges })}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className={panelBtnSecondary} onClick={() => setPrivEdit(null)}>Cancelar</button>
                  <button type="button" disabled={busy} className={panelBtnPrimary} onClick={() => void savePrivileges()}>
                    {busy ? <Spinner className="h-4 w-4" /> : null} Guardar privilégios
                  </button>
                </div>
              </div>
            ) : null}
            <div className="border-t pt-4 dark:border-zinc-700">
              <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Associar a uma base de dados</label>
              <div className="flex flex-col gap-2 md:flex-row">
                <select value={grantDatabase} onChange={(e) => setGrantDatabase(e.target.value)} className={`${panelField} w-full md:flex-1 dark:bg-zinc-900`}>
                  <option value="">Seleccione a base de dados…</option>
                  {databases.map((d) => {
                    const associated = userDatabases.some((ud) => ud.database === d.database)
                    return (
                      <option key={d.database} value={d.database}>
                        {d.database}{associated ? ' · associado' : ''}
                      </option>
                    )
                  })}
                </select>
                <button
                  type="button"
                  disabled={!grantDatabase || busy || userDatabases.some((ud) => ud.database === grantDatabase)}
                  className={panelBtnPrimary}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await dbRequest({ action: 'grantAccess', domain: selectedDomain, owner, database: grantDatabase, dbuser: selectedDbUser })
                      setGrantDatabase('')
                      void loadUserDetail(selectedDbUser)
                      flash('Base associada.')
                    } catch (e: unknown) {
                      flash(e instanceof Error ? e.message : 'Falhou.', true)
                    } finally { setBusy(false) }
                  }}
                >
                  <Plus className="h-4 w-4" /> Associar
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !busy && setConfirm(null)} />
          <div className={`${panelCard} relative w-full max-w-lg space-y-4 p-6`}>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{confirm.title}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{confirm.message}</p>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirm(null)} className={panelBtnSecondary}>Cancelar</button>
              <button
                type="button"
                disabled={busy}
                className={confirm.danger ? `${panelBtnPrimary} border-red-400` : panelBtnPrimary}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await confirm.onConfirm()
                    setConfirm(null)
                  } catch (e: unknown) {
                    flash(e instanceof Error ? e.message : 'Operação falhou.', true)
                  } finally { setBusy(false) }
                }}
              >
                {busy ? <Spinner className="h-4 w-4" /> : null}
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { DatabasesManagerSection as DatabasesSection }
