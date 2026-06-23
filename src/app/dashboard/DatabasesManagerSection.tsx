'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Database, Users, ExternalLink, Loader2, Plus, Trash2, Eye, EyeOff, KeyRound,
  Upload, Download, Search, Wrench, Rocket, ChevronDown, ChevronUp, User,
} from 'lucide-react'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'
import { cn } from '@/lib/utils'
import {
  panelBtnPrimary, panelBtnSecondary, panelCard, panelControlHeight, panelField,
  panelInnerDetailCard,
} from '@/lib/panel-ui'
import type {
  DbDatabaseUser, DbListEntry, DbMetadata, DbUserDatabase, DbUserEntry,
} from '@/lib/da-database-types'
import { formatDbSize, hasFullAccess } from '@/lib/da-database-types'
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
}: {
  sites: DirectAdminWebsite[]
  initialDomain?: string
}) {
  const selectedDomain = useMemo(() => {
    if (initialDomain) return initialDomain
    return sites.find((s) => !s.domain.includes('contaboserver'))?.domain || sites[0]?.domain || ''
  }, [initialDomain, sites])

  const owner = useMemo(
    () => sites.find((s) => s.domain === selectedDomain)?.owner || 'admin',
    [sites, selectedDomain],
  )

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
    if (!selectedDomain || view !== 'databases') return
    const cached = readDbListCache(owner)
    if (cached) {
      setDatabases(cached.rows)
      setTotalBytes(cached.totalBytes)
      setLoading(false)
    }
    void loadDatabases({ hadCache: Boolean(cached) })
  }, [selectedDomain, owner, view, noSize, loadDatabases])

  useEffect(() => {
    if (!selectedDomain || view !== 'users') return
    const cached = readDbUsersCache(owner)
    if (cached) {
      setUsers(cached.rows)
      setLoading(false)
    }
    void loadUsers({ hadCache: Boolean(cached) })
  }, [selectedDomain, owner, view, loadUsers])

  useEffect(() => {
    if (view === 'manage-db' && selectedDatabase) void loadDbDetail(selectedDatabase)
  }, [view, selectedDatabase, loadDbDetail])

  useEffect(() => {
    if (view === 'manage-user' && selectedDbUser) void loadUserDetail(selectedDbUser)
  }, [view, selectedDbUser, loadUserDetail])

  const openPhpMyAdmin = async (database?: string) => {
    setBusy(true)
    try {
      const data = await dbRequest<{ url: string }>({
        action: 'phpmyadminSso', domain: selectedDomain, owner, database,
      })
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Não foi possível abrir o gestor SQL.', true)
    } finally {
      setBusy(false)
    }
  }

  const runDbOp = async (action: string, database: string) => {
    setBusy(true)
    try {
      await dbRequest({ action, domain: selectedDomain, owner, database })
      flash('Operação concluída.')
      invalidateDbCaches(owner, database)
      void loadDbDetail(database, { hadCache: true })
      void loadDatabases({ hadCache: true })
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Operação falhou.', true)
    } finally {
      setBusy(false)
    }
  }

  const handleCreateDatabase = async () => {
    if (!createDbName.trim()) return
    setBusy(true)
    try {
      const data = await dbRequest<{ database: string; dbuser?: string; password?: string }>({
        action: 'createDatabase',
        domain: selectedDomain,
        owner,
        name: createDbName.trim(),
        dbuser: createDbUser.trim() || createDbName.trim(),
        password: createDbPass || generatePassword(),
        charset: advancedCreate ? createCharset : undefined,
        collation: advancedCreate ? createCollation : undefined,
        advanced: advancedCreate,
      })
      flash(`Base de dados «${data.database}» criada.`)
      setCreateDbName('')
      setCreateDbUser('')
      setCreateDbPass('')
      invalidateDbCaches(owner)
      void loadDatabases({ hadCache: true })
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
      await dbRequest({
        action: 'createUser',
        domain: selectedDomain,
        owner,
        dbuser: createUserName.trim(),
        password: createUserPass,
      })
      flash('Utilizador criado.')
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

  const handleImport = async (file: File) => {
    if (!selectedDatabase) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('domain', selectedDomain)
      form.append('owner', owner)
      form.append('database', selectedDatabase)
      form.append('sqlfile', file)
      form.append('clean', importClean ? 'yes' : 'no')
      const res = await fetch('/api/db-manager', { method: 'POST', credentials: 'include', body: form })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Importação falhou')
      flash('Importação concluída.')
      invalidateDbCaches(owner, selectedDatabase)
      void loadDbDetail(selectedDatabase, { hadCache: true })
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Importação falhou.', true)
    } finally {
      setBusy(false)
    }
  }

  const exportUrl = (database: string, gzip: boolean) =>
    `/api/db-manager?action=export&domain=${encodeURIComponent(selectedDomain)}&owner=${encodeURIComponent(owner)}&database=${encodeURIComponent(database)}&gzip=${gzip ? '1' : '0'}`

  const breadcrumb = () => {
    if (view === 'databases') return 'Bases de dados'
    if (view === 'users') return 'Bases de dados / Utilizadores'
    if (view === 'manage-db') return `Bases de dados / ${selectedDatabase}`
    return `Bases de dados / Utilizadores / ${selectedDbUser}`
  }

  const breadcrumbLine = `${breadcrumb()}${selectedDomain ? ` · ${selectedDomain}` : ''}`

  const availableGrantUsers = users.filter(
    (u) => !dbUsers.some((du) => du.dbuser === u.dbuser),
  )

  const availableGrantDbs = databases.filter(
    (d) => !userDatabases.some((ud) => ud.database === d.database),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{breadcrumbLine}</span>
        </p>
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
              Gerir bases de dados
            </button>
          ) : null}
          {view === 'databases' ? (
            <>
              <button type="button" disabled={busy} className={panelBtnSecondary} onClick={() => void openPhpMyAdmin()}>
                <ExternalLink className="h-4 w-4" /> phpMyAdmin
              </button>
              <button type="button" className={panelBtnPrimary} onClick={() => setView('users')}>
                <Users className="h-4 w-4" /> Gerir utilizadores
              </button>
            </>
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
      {syncing ? <p className="text-xs text-zinc-400">A actualizar…</p> : null}

      {!selectedDomain ? (
        <div className={`${panelCard} p-8 text-center text-sm text-zinc-500`}>Nenhum website associado a esta secção.</div>
      ) : null}

      {selectedDomain && view === 'databases' ? (
        <>
          <div className={`${panelCard} space-y-4 p-6`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Lista de bases de dados</h3>
                <p className="mt-1 text-sm text-zinc-500">Todas as bases de dados da conta, com tamanho, utilizadores e tabelas.</p>
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
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Tamanho</th>
                    <th className="px-3 py-2">Utilizadores</th>
                    <th className="px-3 py-2">Tabelas</th>
                    <th className="px-3 py-2 text-right">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {databases.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-10 text-center text-zinc-400">Nenhuma base de dados.</td></tr>
                  ) : databases.map((db) => (
                    <tr key={db.database} className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-2 font-mono font-medium">{db.database}</td>
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
              <p className="mt-1 text-xs text-zinc-500">Modo rápido cria utilizador com o mesmo nome; use modo avançado para charset e collation.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Nome da base de dados</label>
                <PrefixField prefix={owner} value={createDbName} onChange={setCreateDbName} placeholder="minha_bd" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Nome de utilizador</label>
                <PrefixField prefix={owner} value={createDbUser} onChange={setCreateDbUser} placeholder="minha_bd" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Senha</label>
                <div className="relative">
                  <input
                    type={showCreatePass ? 'text' : 'password'}
                    value={createDbPass}
                    onChange={(e) => setCreateDbPass(e.target.value)}
                    placeholder="Auto-gerada se vazia"
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
              <button type="button" disabled={busy || !createDbName.trim()} className={panelBtnPrimary} onClick={() => void handleCreateDatabase()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar
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
                    <tr><td colSpan={3} className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-400" /></td></tr>
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
            <p className="text-xs text-zinc-500">O utilizador não terá acesso a bases de dados até ser autorizado.</p>
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
              <button type="button" disabled={busy || !createUserName.trim() || !createUserPass} className={panelBtnPrimary} onClick={() => void handleCreateUser()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar
              </button>
            </div>
          </div>
        </>
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
                  {dbUsers.map((u) => (
                    <tr key={u.dbuser}>
                      <td className="px-3 py-2 font-mono">{u.dbuser}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600">
                          {hasFullAccess(u.privileges) ? 'Acesso total' : 'Personalizado'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end flex-wrap gap-2">
                          <button type="button" className={panelBtnSecondary} onClick={() => { setSelectedDbUser(u.dbuser); setView('manage-user') }}>Gerir</button>
                          <button type="button" className={panelBtnSecondary} onClick={() => void openPhpMyAdmin(selectedDatabase)}>phpMyAdmin</button>
                          <button
                            type="button"
                            className={`${panelBtnSecondary} border-red-300 text-red-600`}
                            onClick={() => setConfirm({
                              title: 'Revogar acesso',
                              message: `Revogar acesso de «${u.dbuser}» a «${selectedDatabase}»?`,
                              confirmLabel: 'Revogar',
                              danger: true,
                              onConfirm: async () => {
                                await dbRequest({ action: 'revokeAccess', domain: selectedDomain, owner, database: selectedDatabase, dbuser: u.dbuser })
                                void loadDbDetail(selectedDatabase, { hadCache: true })
                                flash('Acesso revogado.')
                              },
                            })}
                          >
                            Revogar acesso
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 pt-4 dark:border-zinc-700">
              <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Conceder acesso a utilizador adicional</label>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <select value={grantUser} onChange={(e) => setGrantUser(e.target.value)} className={`${panelField} w-full md:flex-1 dark:bg-zinc-900`}>
                  <option value="">Seleccione o utilizador…</option>
                  {availableGrantUsers.map((u) => <option key={u.dbuser} value={u.dbuser}>{u.dbuser}</option>)}
                </select>
                <button
                  type="button"
                  disabled={!grantUser || busy}
                  className={panelBtnPrimary}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await dbRequest({ action: 'grantAccess', domain: selectedDomain, owner, database: selectedDatabase, dbuser: grantUser })
                      setGrantUser('')
                      void loadDbDetail(selectedDatabase, { hadCache: true })
                      flash('Acesso concedido.')
                    } catch (e: unknown) {
                      flash(e instanceof Error ? e.message : 'Falhou.', true)
                    } finally { setBusy(false) }
                  }}
                >
                  <Plus className="h-4 w-4" /> Conceder acesso total
                </button>
              </div>
            </div>
          </div>

          <div className={`${panelCard} space-y-4 p-6`}>
            <h3 className="text-sm font-bold">Operações de base de dados</h3>
            <p className="text-xs text-zinc-500">Importar, exportar, verificar, reparar ou optimizar.</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <label className={`${panelBtnSecondary} cursor-pointer`}>
                <Upload className="h-4 w-4" /> Importar
                <input type="file" accept=".sql,.gz,.zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); e.target.value = '' }} />
              </label>
              <a href={exportUrl(selectedDatabase, false)} className={panelBtnSecondary}><Download className="h-4 w-4" /> Exportar SQL</a>
              <a href={exportUrl(selectedDatabase, true)} className={panelBtnSecondary}><Download className="h-4 w-4" /> Exportar GZ</a>
              <button type="button" className={panelBtnSecondary} onClick={() => void runDbOp('check', selectedDatabase)}><Search className="h-4 w-4" /> Verificar</button>
              <button type="button" className={panelBtnSecondary} onClick={() => void runDbOp('repair', selectedDatabase)}><Wrench className="h-4 w-4" /> Reparar</button>
              <button type="button" className={panelBtnSecondary} onClick={() => void runDbOp('optimize', selectedDatabase)}><Rocket className="h-4 w-4" /> Optimizar</button>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <input type="checkbox" checked={importClean} onChange={(e) => setImportClean(e.target.checked)} className="rounded border-gray-300 text-red-600" />
              Limpar base de dados antes de importar
            </label>
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
            <h3 className="text-sm font-bold">Gestão de senha</h3>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha (mín. 8 caracteres)"
                className={`${panelField} w-full md:flex-1 dark:bg-zinc-900`}
              />
              <button type="button" className="p-2 text-zinc-400" onClick={() => setShowNewPass((v) => !v)}>
                {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="button"
                disabled={busy || newPassword.length < 8}
                className={panelBtnPrimary}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await dbRequest({ action: 'changePassword', domain: selectedDomain, owner, dbuser: selectedDbUser, newPassword })
                    setNewPassword('')
                    flash('Senha alterada.')
                  } catch (e: unknown) {
                    flash(e instanceof Error ? e.message : 'Falhou.', true)
                  } finally { setBusy(false) }
                }}
              >
                Alterar senha
              </button>
            </div>
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
                        <button type="button" className={panelBtnSecondary} onClick={() => { setSelectedDatabase(d.database); setView('manage-db') }}>Gerir</button>
                        <button
                          type="button"
                          className={`${panelBtnSecondary} border-red-300 text-red-600`}
                          onClick={() => setConfirm({
                            title: 'Revogar acesso',
                            message: `Revogar acesso de «${selectedDbUser}» a «${d.database}»?`,
                            confirmLabel: 'Revogar',
                            danger: true,
                            onConfirm: async () => {
                              await dbRequest({ action: 'revokeAccess', domain: selectedDomain, owner, database: d.database, dbuser: selectedDbUser })
                              void loadUserDetail(selectedDbUser)
                              flash('Acesso revogado.')
                            },
                          })}
                        >
                          Revogar acesso
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t pt-4 dark:border-zinc-700">
              <label className="mb-1.5 block text-xs font-bold uppercase text-zinc-500">Conceder acesso a base de dados adicional</label>
              <div className="flex flex-col gap-2 md:flex-row">
                <select value={grantDatabase} onChange={(e) => setGrantDatabase(e.target.value)} className={`${panelField} w-full md:flex-1 dark:bg-zinc-900`}>
                  <option value="">Seleccione a base de dados…</option>
                  {availableGrantDbs.map((d) => <option key={d.database} value={d.database}>{d.database}</option>)}
                </select>
                <button
                  type="button"
                  disabled={!grantDatabase || busy}
                  className={panelBtnPrimary}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await dbRequest({ action: 'grantAccess', domain: selectedDomain, owner, database: grantDatabase, dbuser: selectedDbUser })
                      setGrantDatabase('')
                      void loadUserDetail(selectedDbUser)
                      flash('Acesso concedido.')
                    } catch (e: unknown) {
                      flash(e instanceof Error ? e.message : 'Falhou.', true)
                    } finally { setBusy(false) }
                  }}
                >
                  <Plus className="h-4 w-4" /> Conceder acesso total
                </button>
              </div>
            </div>
          </div>

          <div className={`${panelCard} p-6`}>
            <h3 className="mb-2 text-sm font-bold">Hosts permitidos</h3>
            <p className="mb-3 text-xs text-zinc-500">Separados por vírgula (ex.: localhost, %, 127.0.0.1)</p>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                value={hostsInput}
                onChange={(e) => setHostsInput(e.target.value)}
                className={`${panelField} w-full md:flex-1 font-mono text-xs dark:bg-zinc-900`}
              />
              <button
                type="button"
                disabled={busy || !hostsInput.trim()}
                className={panelBtnPrimary}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const hostPatterns = hostsInput.split(',').map((h) => h.trim()).filter(Boolean)
                    await dbRequest({ action: 'changeHosts', domain: selectedDomain, owner, dbuser: selectedDbUser, hostPatterns })
                    void loadUserDetail(selectedDbUser)
                    flash('Hosts actualizados.')
                  } catch (e: unknown) {
                    flash(e instanceof Error ? e.message : 'Falhou.', true)
                  } finally { setBusy(false) }
                }}
              >
                Guardar hosts
              </button>
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
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
