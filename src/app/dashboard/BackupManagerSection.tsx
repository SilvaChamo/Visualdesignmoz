'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive, Clock, Download, Loader2, Plus, RefreshCw, RotateCcw, Trash2,
} from 'lucide-react'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'
import { cn } from '@/lib/utils'
import {
  panelBtnPrimary, panelBtnSecondary, panelCard, panelInnerDetailCard,
} from '@/lib/panel-ui'
import {
  BACKUP_ITEMS, BACKUP_TABS, TAB_BACKUP_ITEMS,
  type BackupFileRow, type BackupItemId, type BackupTab,
} from '@/lib/da-backup-types'
import {
  backupOptionChip, backupOptionChipActive, backupOptionGrid,
  backupDomainGrid, backupDomainItem, backupDomainItemStatic,
  backupDomainModeLabel, backupDomainModeRow, backupDomainSection,
} from '@/lib/backup-option-ui'
import {
  invalidateBackupListCache,
  readBackupListCache,
  writeBackupListCache,
} from '@/lib/panel-backup-cache'
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome'

type BackupDomainMode = 'all' | 'selected'

type ConfirmDialog = {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => Promise<void>
}

type RestoreDialog = {
  file: string
  items: BackupItemId[]
  selected: BackupItemId[]
}

async function backupRequest<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/backup-manager', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Operação falhou')
  return data.data as T
}

async function downloadBackupFile(
  domain: string,
  file: string,
  bucketPath?: string,
): Promise<void> {
  const res = await fetch('/api/backup-manager', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'download',
      domain,
      file,
      bucketPath: bucketPath || '',
    }),
  })
  if (!res.ok) {
    let message = 'Transferência falhou.'
    try {
      const err = await res.json() as { error?: string }
      if (err.error) message = err.error
    } catch { /* blob */ }
    throw new Error(message)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file || 'backup'
  link.click()
  URL.revokeObjectURL(url)
}

const btnGreen =
  'inline-flex h-[38px] items-center justify-center gap-1.5 rounded border border-green-600 bg-transparent px-4 text-sm font-medium text-green-600 transition-colors hover:bg-green-600/10 disabled:opacity-50 dark:border-green-500 dark:text-green-500'

export function BackupManagerSection({
  sites,
  initialDomain,
  isActive = true,
  setActiveSection,
  siteLocked = false,
}: {
  sites: DirectAdminWebsite[]
  initialDomain?: string
  isActive?: boolean
  setActiveSection?: (section: string) => void
  /** Um único site pré-seleccionado (ex.: menu do cartão WP) — oculta selector de domínios */
  siteLocked?: boolean
}) {
  const accountDomains = useMemo(() => {
    const all = [...new Set(sites.map((s) => s.domain).filter((d) => d && !d.includes('contaboserver')))]
    if (siteLocked && initialDomain && all.includes(initialDomain)) return [initialDomain]
    return all
  }, [sites, siteLocked, initialDomain])

  const listDomain = useMemo(() => {
    if (initialDomain && accountDomains.includes(initialDomain)) return initialDomain
    return accountDomains[0] || ''
  }, [initialDomain, accountDomains])

  const owner = useMemo(
    () => sites.find((s) => s.domain === listDomain)?.owner || 'admin',
    [sites, listDomain],
  )

  const [activeTab, setActiveTab] = useState<BackupTab>('full')
  const [domainMode, setDomainMode] = useState<BackupDomainMode>(siteLocked ? 'selected' : 'all')
  const [pickedDomains, setPickedDomains] = useState<string[]>(
    () => (siteLocked && initialDomain ? [initialDomain] : []),
  )
  const [backups, setBackups] = useState<BackupFileRow[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [fullSelection, setFullSelection] = useState<BackupItemId[]>(BACKUP_ITEMS.map((i) => i.id))
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null)
  const [restore, setRestore] = useState<RestoreDialog | null>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [downloading, setDownloading] = useState('')

  const { setChrome } = useAdminSectionChrome()

  const targetDomains = useMemo(
    () => (siteLocked ? [listDomain].filter(Boolean) : domainMode === 'all' ? accountDomains : pickedDomains),
    [siteLocked, listDomain, domainMode, accountDomains, pickedDomains],
  )

  useEffect(() => {
    if (siteLocked && listDomain) {
      setDomainMode('selected')
      setPickedDomains([listDomain])
      return
    }
    if (domainMode === 'all') setPickedDomains(accountDomains)
  }, [siteLocked, listDomain, domainMode, accountDomains])

  const setDomainModeAll = () => {
    setDomainMode('all')
    setPickedDomains(accountDomains)
  }

  const setDomainModeSelected = () => {
    setDomainMode('selected')
    setPickedDomains([])
  }

  const flash = (text: string, isError = false) => {
    if (isError) setError(text)
    else setMsg(text)
    setTimeout(() => { setMsg(''); setError('') }, 4500)
  }

  const loadBackups = useCallback(async (opts?: { silent?: boolean }) => {
    if (!listDomain || !owner) return
    const cached = readBackupListCache(owner, activeTab)
    if (cached?.rows?.length) setBackups(cached.rows)
    if (!cached?.rows?.length && !opts?.silent) setLoading(true)
    try {
      const rows = await backupRequest<BackupFileRow[]>({
        action: 'list', domain: listDomain, scope: activeTab, accountDomains,
      })
      setBackups(rows || [])
      writeBackupListCache(owner, activeTab, rows || [])
    } catch (e: unknown) {
      if (!cached?.rows?.length) setBackups([])
      flash(e instanceof Error ? e.message : 'Não foi possível carregar backups.', true)
    } finally {
      setLoading(false)
    }
  }, [listDomain, owner, activeTab, accountDomains])

  useEffect(() => {
    if (!listDomain || !owner) return
    const cached = readBackupListCache(owner, activeTab)
    if (cached?.rows?.length) setBackups(cached.rows)
    void loadBackups({ silent: Boolean(cached?.rows?.length) })
  }, [listDomain, loadBackups, activeTab, owner])

  const tabItems = TAB_BACKUP_ITEMS[activeTab]

  const toggleFullItem = (id: BackupItemId) => {
    setFullSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const togglePickedDomain = (domain: string) => {
    setPickedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain],
    )
  }

  const handleCreate = useCallback(async () => {
    if (!targetDomains.length) {
      flash('Seleccione pelo menos um domínio.', true)
      return
    }
    const items = activeTab === 'full' ? fullSelection : tabItems
    if (!items.length) {
      flash('Seleccione pelo menos um item para o backup.', true)
      return
    }
    setCreating(true)
    try {
      const data = await backupRequest<{ warnings?: string[]; created?: string[] }>({
        action: 'create-batch',
        domain: listDomain,
        domains: targetDomains,
        items,
        scope: activeTab,
      })
      if (data?.warnings?.length) {
        flash(`Backup criado. ${data.warnings.join('; ')}`)
      } else if (data?.created?.length) {
        flash(targetDomains.length > 1
          ? `Backup criado para ${data.created.length} domínio(s).`
          : 'Backup criado com sucesso.')
      } else {
        flash('Backup criado com sucesso.')
      }
      invalidateBackupListCache(owner)
      await loadBackups()
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Criação falhou.', true)
    } finally {
      setCreating(false)
    }
  }, [targetDomains, activeTab, fullSelection, tabItems, listDomain, loadBackups])

  const openRestore = async (file: string) => {
    setRestoreBusy(true)
    try {
      const data = await backupRequest<{ items: BackupItemId[] }>({
        action: 'view', domain: listDomain, file,
      })
      const available = data.items || []
      const defaults = tabItems.filter((i) => available.includes(i))
      setRestore({
        file,
        items: available,
        selected: defaults.length ? defaults : available,
      })
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Não foi possível ler o backup.', true)
    } finally {
      setRestoreBusy(false)
    }
  }

  const confirmRestore = async () => {
    if (!restore || !restore.selected.length) return
    setRestoreBusy(true)
    try {
      await backupRequest({
        action: 'restore',
        domain: listDomain,
        file: restore.file,
        items: restore.selected,
      })
      setRestore(null)
      flash('Restauro concluído.')
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Restauro falhou.', true)
    } finally {
      setRestoreBusy(false)
    }
  }

  useEffect(() => {
    if (!isActive) return
    setChrome({
      toolbar: (
        <button
          type="button"
          onClick={() => void loadBackups()}
          disabled={!listDomain || loading}
          className={panelBtnSecondary}
          title="Actualizar lista"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Actualizar
        </button>
      ),
    })
    return () => setChrome(null)
  }, [isActive, listDomain, loading, setChrome, loadBackups])

  const tabDescription: Record<BackupTab, string> = {
    full: '',
    files: 'Inclui ficheiros do site e a base de dados correspondente.',
    databases: 'Backup apenas das bases de dados MySQL.',
    emails: 'Backup de contas e definições de email.',
    ftp: 'Backup de contas e definições FTP.',
  }

  return (
    <div className="w-full space-y-4">
      {msg ? <div className="rounded border border-green-200 bg-green-50/80 px-4 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">{msg}</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50/80 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">{error}</div> : null}

      <div className={`${panelCard} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex flex-wrap">
            {BACKUP_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-red-600 bg-white text-red-600 dark:border-red-500 dark:bg-zinc-900 dark:text-red-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {listDomain ? (
            <p className="px-4 py-3 text-sm text-zinc-500">
              Conta: <span className="font-mono text-zinc-700 dark:text-zinc-300">{listDomain}</span>
              {' · '}
              Utilizador: <span className="font-mono">{owner}</span>
            </p>
          ) : null}
        </div>

        <div className="space-y-4 p-6">
          {!siteLocked ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className={backupDomainModeRow}>
                  <label className={backupDomainModeLabel}>
                    <input
                      type="checkbox"
                      checked={domainMode === 'all'}
                      onChange={() => { if (domainMode !== 'all') setDomainModeAll() }}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    Backup geral (todos os domínios)
                  </label>
                  <label className={backupDomainModeLabel}>
                    <input
                      type="checkbox"
                      checked={domainMode === 'selected'}
                      onChange={() => { if (domainMode !== 'selected') setDomainModeSelected() }}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    Domínios seleccionados
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={!targetDomains.length || creating}
                    className={btnGreen}
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {creating ? 'A criar…' : 'Criar backup'}
                  </button>
                  {setActiveSection ? (
                    <button
                      type="button"
                      onClick={() => setActiveSection('wp-backup-report')}
                      className={panelBtnSecondary}
                    >
                      <Clock className="h-4 w-4" /> Backup automático
                    </button>
                  ) : null}
                </div>
              </div>

              {accountDomains.length > 0 ? (
                <div className={backupDomainSection}>
                  <div className={backupDomainGrid}>
                    {accountDomains.map((domain) => (
                      domainMode === 'selected' ? (
                        <label key={domain} className={backupDomainItem}>
                          <input
                            type="checkbox"
                            checked={pickedDomains.includes(domain)}
                            onChange={() => togglePickedDomain(domain)}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="truncate font-mono">{domain}</span>
                        </label>
                      ) : (
                        <span key={domain} className={backupDomainItemStatic}>
                          <span className="truncate font-mono">{domain}</span>
                        </span>
                      )
                    ))}
                  </div>
                </div>
              ) : null}

              {domainMode === 'all' && accountDomains.length > 0 ? (
                <p className="text-sm text-zinc-500">
                  Todos os domínios acima incluídos no backup geral.
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!targetDomains.length || creating}
                className={btnGreen}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creating ? 'A criar…' : 'Criar backup'}
              </button>
            </div>
          )}

          {tabDescription[activeTab] ? (
            <p className="text-sm text-zinc-500">{tabDescription[activeTab]}</p>
          ) : null}

          {activeTab === 'full' ? (
            <div className={backupOptionGrid}>
              {BACKUP_ITEMS.map((item) => (
                <label
                  key={item.id}
                  className={cn(
                    backupOptionChip,
                    fullSelection.includes(item.id) && backupOptionChipActive,
                  )}
                >
                  <input
                    type="checkbox"
                    checked={fullSelection.includes(item.id)}
                    onChange={() => toggleFullItem(item.id)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="truncate">{item.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tabItems.map((id) => {
                const label = BACKUP_ITEMS.find((i) => i.id === id)?.label || id
                return (
                  <span
                    key={id}
                    className="rounded border border-zinc-200 bg-transparent px-3 py-1.5 text-sm font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                  >
                    {label}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className={`${panelCard} overflow-hidden`}>
        <div className="border-b border-gray-200 px-6 py-4 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Backups — {BACKUP_TABS.find((t) => t.id === activeTab)?.label}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">Cópias deste tipo no servidor e no armazenamento remoto.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-gray-200 bg-gray-50/50 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3">Ficheiro</th>
                <th className="px-4 py-3">Domínio</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tamanho</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3 text-right">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {!listDomain ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-400">Nenhum website associado.</td></tr>
              ) : loading && !backups.length ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-red-500" /></td></tr>
              ) : backups.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center">
                  <Archive className="mx-auto mb-2 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                  <p className="font-medium text-zinc-500">Nenhum backup nesta categoria</p>
                  <p className="text-sm text-zinc-400">Use «Criar backup» no separador activo.</p>
                </td></tr>
              ) : backups.map((b) => (
                <tr key={`${b.source}-${b.bucketPath || b.filename}`} className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/30">
                  <td className="px-4 py-3 font-mono text-sm">{b.filename}</td>
                  <td className="px-4 py-3 font-mono text-sm text-zinc-500">{b.domain || listDomain}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{b.date}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{b.size}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{b.source === 'bucket' ? 'Armazenamento' : 'Servidor'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {b.source === 'server' ? (
                        <button
                          type="button"
                          disabled={restoreBusy}
                          className={panelBtnSecondary}
                          onClick={() => void openRestore(b.filename)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={downloading === b.filename}
                        className={panelBtnSecondary}
                        onClick={() => {
                          setDownloading(b.filename)
                          void downloadBackupFile(listDomain, b.filename, b.bucketPath)
                            .catch((e: unknown) => flash(e instanceof Error ? e.message : 'Transferência falhou.', true))
                            .finally(() => setDownloading(''))
                        }}
                      >
                        {downloading === b.filename
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Download className="h-3.5 w-3.5" />}
                        Transferir
                      </button>
                      <button
                        type="button"
                        className={`${panelBtnSecondary} border-red-300 text-red-600 dark:border-red-800 dark:text-red-400`}
                        onClick={() => setConfirm({
                          title: 'Eliminar backup',
                          message: `Eliminar «${b.filename}»? Esta acção é irreversível.`,
                          confirmLabel: 'Eliminar',
                          danger: true,
                          onConfirm: async () => {
                            await backupRequest({
                              action: 'delete',
                              domain: listDomain,
                              file: b.source === 'server' ? b.filename : '',
                              bucketPath: b.bucketPath || '',
                            })
                            invalidateBackupListCache(owner)
                            await loadBackups()
                            flash('Backup eliminado.')
                          },
                        })}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirm ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !restoreBusy && setConfirm(null)} />
          <div className={`${panelCard} relative w-full max-w-lg space-y-4 p-6`}>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{confirm.title}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{confirm.message}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className={panelBtnSecondary}>Cancelar</button>
              <button
                type="button"
                className={confirm.danger ? panelBtnPrimary : panelBtnSecondary}
                onClick={async () => {
                  try {
                    await confirm.onConfirm()
                    setConfirm(null)
                  } catch (e: unknown) {
                    flash(e instanceof Error ? e.message : 'Operação falhou.', true)
                  }
                }}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {restore ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !restoreBusy && setRestore(null)} />
          <div className={`${panelCard} relative w-full max-w-lg space-y-4 p-6`}>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Restaurar backup</h3>
            <p className="break-all text-xs text-zinc-500">{restore.file}</p>
            <p className="text-xs text-red-600 dark:text-red-400">Isto substitui os dados actuais dos itens seleccionados.</p>
            <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
              {restore.items.map((id) => {
                const label = BACKUP_ITEMS.find((i) => i.id === id)?.label || id
                return (
                  <label key={id} className={cn(panelInnerDetailCard, 'flex items-center gap-2 py-2')}>
                    <input
                      type="checkbox"
                      checked={restore.selected.includes(id)}
                      onChange={() => setRestore((r) => {
                        if (!r) return r
                        const selected = r.selected.includes(id)
                          ? r.selected.filter((x) => x !== id)
                          : [...r.selected, id]
                        return { ...r, selected }
                      })}
                      className="rounded border-gray-300 text-red-600"
                    />
                    <span className="text-xs">{label}</span>
                  </label>
                )
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={restoreBusy} onClick={() => setRestore(null)} className={panelBtnSecondary}>Cancelar</button>
              <button
                type="button"
                disabled={restoreBusy || !restore.selected.length}
                className={panelBtnPrimary}
                onClick={() => void confirmRestore()}
              >
                {restoreBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Restaurar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
