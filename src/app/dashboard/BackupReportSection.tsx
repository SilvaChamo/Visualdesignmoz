'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive, Copy, HardDrive, Loader2, MoreVertical, Pencil, Play, Plus, RotateCcw, Trash2,
} from 'lucide-react'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'
import { cn } from '@/lib/utils'
import { panelBtnSecondary, panelCard, panelInnerDetailCard, panelTabList, panelTabBtn } from '@/lib/panel-ui'
import { BACKUP_ITEMS, BACKUP_TABS } from '@/lib/da-backup-types'
import type { BackupScheduleRow } from '@/lib/panel-backup-schedule-types'
import { formatScheduleWhen } from '@/lib/panel-backup-schedule-utils'
import { writeBackupScheduleDraft } from '@/lib/panel-backup-schedule-draft'
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome'

const btnGreen =
  'inline-flex h-[38px] items-center justify-center gap-1.5 rounded border border-green-600 bg-transparent px-4 text-sm font-medium text-green-600 transition-colors hover:bg-green-600/10 disabled:opacity-50 dark:border-green-500 dark:text-green-500'

async function scheduleApi<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/backup-schedule', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Operação falhou')
  return data.data as T
}

function resolveEditDomain(row: BackupScheduleRow, sites: DirectAdminWebsite[], fallback: string): string {
  if (row.domains.length) return row.domains[0]
  const match = sites.find((s) => s.owner?.toLowerCase() === row.owner.toLowerCase())
  return match?.domain || fallback
}

function whatLabel(row: BackupScheduleRow): string {
  if (row.backup_scope === 'full') {
    const allIds = BACKUP_ITEMS.map((i) => i.id)
    const hasAll = allIds.every((id) => row.backup_items.includes(id))
    if (hasAll || row.backup_items.length >= 9) return 'Todos os dados'
  }
  return BACKUP_TABS.find((t) => t.id === row.backup_scope)?.label || row.backup_scope
}

function whoLabel(row: BackupScheduleRow): string {
  if (row.domain_mode === 'all') return 'Todos os domínios'
  if (!row.domains.length) return 'Domínios seleccionados'
  return row.domains.length === 1 ? row.domains[0] : `${row.domains.length} domínios`
}

function openScheduleEditor(
  row: BackupScheduleRow,
  sites: DirectAdminWebsite[],
  fallbackDomain: string,
  setActiveSection: ((section: string) => void) | undefined,
  duplicate = false,
) {
  const domain = resolveEditDomain(row, sites, fallbackDomain)
  writeBackupScheduleDraft(duplicate ? { ...row, enabled: false } : row)
  if (typeof window !== 'undefined') {
    ;(window as Window & { __selectedBackupDomain?: string | null }).__selectedBackupDomain = domain
  }
  setActiveSection?.('wp-backup-auto')
}

export function BackupReportSection({
  sites,
  initialDomain,
  isActive = true,
  setActiveSection,
}: {
  sites: DirectAdminWebsite[]
  initialDomain?: string
  isActive?: boolean
  setActiveSection?: (section: string) => void
}) {
  const accountDomains = useMemo(
    () => [...new Set(sites.map((s) => s.domain).filter((d) => d && !d.includes('contaboserver')))],
    [sites],
  )
  const primaryDomain = useMemo(() => {
    if (initialDomain && accountDomains.includes(initialDomain)) return initialDomain
    return accountDomains[0] || ''
  }, [initialDomain, accountDomains])

  const [rows, setRows] = useState<BackupScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const { setChrome } = useAdminSectionChrome()

  const flash = (text: string, isError = false) => {
    if (isError) setError(text)
    else setMsg(text)
    setTimeout(() => { setMsg(''); setError('') }, 4500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = primaryDomain ? `?domain=${encodeURIComponent(primaryDomain)}&list=1` : '?list=1'
      const res = await fetch(`/api/backup-schedule${q}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível carregar.')
      const list = Array.isArray(data.data) ? data.data : data.data ? [data.data] : []
      setRows(list as BackupScheduleRow[])
    } catch (e: unknown) {
      setRows([])
      flash(e instanceof Error ? e.message : 'Erro ao carregar agendamentos.', true)
    } finally {
      setLoading(false)
    }
  }, [primaryDomain])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!isActive) return
    setChrome({
      toolbar: (
        <div className="flex flex-wrap items-center gap-2">
          {setActiveSection ? (
            <button type="button" onClick={() => setActiveSection('wp-backup-auto')} className={btnGreen}>
              <Plus className="h-4 w-4" /> Agendar
            </button>
          ) : null}
          {setActiveSection ? (
            <button type="button" onClick={() => setActiveSection('wp-backup')} className={panelBtnSecondary}>
              <RotateCcw className="h-4 w-4" /> Restaurar
            </button>
          ) : null}
          <button type="button" onClick={() => void load()} disabled={loading} className={panelBtnSecondary}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            Actualizar
          </button>
        </div>
      ),
    })
    return () => setChrome(null)
  }, [isActive, loading, setChrome, load, setActiveSection])

  const runNow = async (row: BackupScheduleRow) => {
    setBusyId(row.id)
    setMenuId(null)
    try {
      const domain = resolveEditDomain(row, sites, primaryDomain)
      await scheduleApi({ action: 'run-now', domain })
      flash('Backup executado.')
      await load()
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Execução falhou.', true)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (row: BackupScheduleRow) => {
    setBusyId(row.id)
    setMenuId(null)
    try {
      const domain = resolveEditDomain(row, sites, primaryDomain)
      await scheduleApi({ action: 'delete', domain })
      flash('Agendamento eliminado.')
      await load()
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Eliminar falhou.', true)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className={cn(panelTabList, 'text-sm')}>
        <span className={cn(panelTabBtn, 'border-b-red-500 text-red-500')}>
          Backup e restauro
        </span>
        <button
          type="button"
          onClick={() => setActiveSection?.('wp-backup-auto')}
          className={cn(panelTabBtn, 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')}
        >
          Configurações do backup
        </button>
      </div>

      {msg ? <div className="rounded border border-green-200 bg-green-50/80 px-4 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">{msg}</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50/80 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">{error}</div> : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className={`${panelCard} px-6 py-12 text-center`}>
          <HardDrive className="mx-auto mb-3 h-10 w-10 text-zinc-400" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Nenhum backup automático agendado</p>
          <p className="mt-1 text-sm text-zinc-500">Configure a frequência, domínios e destino das cópias.</p>
          {setActiveSection ? (
            <button type="button" onClick={() => setActiveSection('wp-backup-auto')} className={`${btnGreen} mt-4`}>
              <Plus className="h-4 w-4" /> Agendar backup
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <article key={row.id} className={`${panelCard} overflow-hidden`}>
              <div className="flex items-start gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {formatScheduleWhen(row)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Conta: <span className="font-mono text-zinc-700 dark:text-zinc-300">{row.owner}</span>
                        {row.enabled ? (
                          <span className="ml-2 rounded border border-green-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-green-600 dark:border-green-900 dark:text-green-400">
                            Activo
                          </span>
                        ) : (
                          <span className="ml-2 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
                            Inactivo
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => setMenuId(menuId === row.id ? null : row.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-zinc-500 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        aria-label="Acções do agendamento"
                      >
                        {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                      </button>
                      {menuId === row.id ? (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)} aria-hidden />
                          <div className={`${panelCard} absolute right-0 top-full z-50 mt-1 min-w-[12rem] py-1 shadow-lg`}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              onClick={() => {
                                setMenuId(null)
                                openScheduleEditor(row, sites, primaryDomain, setActiveSection, false)
                              }}
                            >
                              <Pencil className="h-4 w-4 text-sky-500" /> Modificar
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              onClick={() => void runNow(row)}
                            >
                              <Play className="h-4 w-4 text-sky-500" /> Executar agora
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              onClick={() => {
                                setMenuId(null)
                                openScheduleEditor(row, sites, primaryDomain, setActiveSection, true)
                              }}
                            >
                              <Copy className="h-4 w-4 text-sky-500" /> Duplicar
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                              onClick={() => void remove(row)}
                            >
                              <Trash2 className="h-4 w-4" /> Eliminar
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className={cn(panelInnerDetailCard, 'grid gap-4 border-x-0 border-b-0 sm:grid-cols-3')}>
                <div>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">O quê</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{whatLabel(row)}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Onde</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Armazenamento remoto do painel
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Retenção: {row.retention_days} dias
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Quem</p>
                  <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">{whoLabel(row)}</p>
                </div>
              </div>

              {row.next_run_at ? (
                <p className="border-t border-gray-100 px-5 py-2 text-xs text-zinc-500 dark:border-zinc-800">
                  Próxima execução: {new Date(row.next_run_at).toLocaleString('pt-PT')}
                  {row.last_run_at ? ` · Última: ${new Date(row.last_run_at).toLocaleString('pt-PT')}` : ''}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
