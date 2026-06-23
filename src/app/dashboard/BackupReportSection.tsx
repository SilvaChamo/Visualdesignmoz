'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive, Copy, Loader2, MoreVertical, Pencil, Play, Plus, RotateCcw, Server, Trash2,
} from 'lucide-react'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'
import { cn } from '@/lib/utils'
import { panelBtnSecondary, panelCard } from '@/lib/panel-ui'
import { BACKUP_TABS } from '@/lib/da-backup-types'
import type { BackupScheduleRow } from '@/lib/panel-backup-schedule-types'
import { formatScheduleWhen } from '@/lib/panel-backup-schedule-utils'
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome'

const btnGreen =
  'inline-flex h-[38px] items-center justify-center gap-1.5 rounded border border-green-600 bg-transparent px-4 text-sm font-medium text-green-600 transition-colors hover:bg-green-600/10 disabled:opacity-50 dark:border-green-500 dark:text-green-500'

type ReportTab = 'schedules' | 'settings'

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

function scopeLabel(scope: BackupScheduleRow['backup_scope']) {
  return BACKUP_TABS.find((t) => t.id === scope)?.label || scope
}

function whoLabel(row: BackupScheduleRow) {
  if (row.domain_mode === 'all') return 'Todos os domínios'
  if (!row.domains.length) return 'Domínios seleccionados'
  return row.domains.length === 1 ? row.domains[0] : `${row.domains.length} domínios`
}

function whereLabel(row: BackupScheduleRow) {
  return `${row.bucket_name}/${row.owner}/${row.backup_scope}/`
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

  const [tab, setTab] = useState<ReportTab>('schedules')
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
      flash(e instanceof Error ? e.message : 'Erro ao carregar relatório.', true)
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
      await scheduleApi({ action: 'run-now', domain: row.domains[0] || primaryDomain })
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
      await scheduleApi({ action: 'delete', domain: row.domains[0] || primaryDomain })
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Backup e restauro</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Gestão de cópias automáticas agendadas.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 text-sm dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setTab('schedules')}
          className={cn(
            'border-b-2 pb-2 font-medium transition-colors',
            tab === 'schedules'
              ? 'border-red-500 text-red-500'
              : 'border-transparent text-zinc-500 hover:text-zinc-300',
          )}
        >
          Backup e restauro
        </button>
        <button
          type="button"
          onClick={() => setActiveSection?.('wp-backup-auto')}
          className="border-b-2 border-transparent pb-2 font-medium text-zinc-500 transition-colors hover:text-zinc-300"
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
          <Server className="mx-auto mb-3 h-10 w-10 text-zinc-400" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Nenhum backup automático agendado</p>
          {setActiveSection ? (
            <button type="button" onClick={() => setActiveSection('wp-backup-auto')} className={`${btnGreen} mt-4`}>
              <Plus className="h-4 w-4" /> Agendar backup
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`${panelCard} relative flex flex-wrap items-start gap-4 p-4 md:flex-nowrap`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/50 text-zinc-400">
                <Server className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-zinc-100">
                    {formatScheduleWhen(row)}
                  </p>
                  <span className={cn(
                    'rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                    row.enabled
                      ? 'border-green-700 text-green-500'
                      : 'border-zinc-600 text-zinc-500',
                  )}
                  >
                    {row.enabled ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <span className="text-zinc-500">O quê</span>
                    <p className="mt-0.5 text-zinc-300">{scopeLabel(row.backup_scope)}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Onde</span>
                    <p className="mt-0.5 truncate font-mono text-zinc-400">{whereLabel(row)}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Quem</span>
                    <p className="mt-0.5 truncate text-zinc-300">{whoLabel(row)}</p>
                  </div>
                </div>
                {row.next_run_at ? (
                  <p className="text-[11px] text-zinc-500">
                    Próxima execução: {new Date(row.next_run_at).toLocaleString('pt-PT')}
                  </p>
                ) : null}
              </div>
              <div className="relative ml-auto shrink-0">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => setMenuId(menuId === row.id ? null : row.id)}
                  className={panelBtnSecondary}
                  aria-label="Acções"
                >
                  {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                </button>
                {menuId === row.id ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)} />
                    <div className={`${panelCard} absolute right-0 top-full z-50 mt-1 min-w-[11rem] py-1 shadow-lg`}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800"
                        onClick={() => { setMenuId(null); setActiveSection?.('wp-backup-auto') }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-sky-400" /> Modificar
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800"
                        onClick={() => void runNow(row)}
                      >
                        <Play className="h-3.5 w-3.5 text-sky-400" /> Executar agora
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800"
                        onClick={() => { setMenuId(null); setActiveSection?.('wp-backup-auto') }}
                      >
                        <Copy className="h-3.5 w-3.5 text-sky-400" /> Duplicar
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 hover:bg-zinc-800"
                        onClick={() => void remove(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
