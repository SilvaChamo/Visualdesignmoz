'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'
import { cn } from '@/lib/utils'
import {
  panelBtnPrimary, panelBtnSecondary, panelCard, panelField, panelInnerDetailCard,
} from '@/lib/panel-ui'
import {
  BACKUP_ITEMS, BACKUP_TABS, TAB_BACKUP_ITEMS, type BackupItemId, type BackupTab,
} from '@/lib/da-backup-types'
import {
  DEFAULT_MONTH_DAYS, FREQUENCY_LABELS, WEEKDAY_LABELS,
  type BackupDomainMode, type BackupFrequency, type BackupScheduleRow,
} from '@/lib/panel-backup-schedule-types'
import { formatScheduleWhen } from '@/lib/panel-backup-schedule-utils'
import { backupOptionChip, backupOptionChipActive, backupOptionGrid } from '@/lib/backup-option-ui'

const btnGreen =
  'inline-flex h-[38px] items-center justify-center gap-1.5 rounded border border-green-600 bg-transparent px-4 text-sm font-medium text-green-600 transition-colors hover:bg-green-600/10 disabled:opacity-50 dark:border-green-500 dark:text-green-500'

async function scheduleRequest<T = unknown>(
  method: 'GET' | 'POST',
  payload?: Record<string, unknown>,
): Promise<T> {
  const init: RequestInit = { method, credentials: 'include' }
  if (method === 'GET') {
    const q = new URLSearchParams({ domain: String(payload?.domain || '') })
    init.method = 'GET'
    const res = await fetch(`/api/backup-schedule?${q}`, init)
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.error || 'Operação falhou')
    return data.data as T
  }
  const res = await fetch('/api/backup-schedule', {
    ...init,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Operação falhou')
  return data.data as T
}

export function BackupAutoConfigSection({
  sites,
  initialDomain,
  setActiveSection,
}: {
  sites: DirectAdminWebsite[]
  initialDomain?: string
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

  const owner = useMemo(
    () => sites.find((s) => s.domain === primaryDomain)?.owner || 'admin',
    [sites, primaryDomain],
  )

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const [enabled, setEnabled] = useState(false)
  const [frequency, setFrequency] = useState<BackupFrequency>('weekly')
  const [runTime, setRunTime] = useState('03:00')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [runsPerMonth, setRunsPerMonth] = useState(1)
  const [monthDays, setMonthDays] = useState<number[]>([1])
  const [domainMode, setDomainMode] = useState<BackupDomainMode>('all')
  const [pickedDomains, setPickedDomains] = useState<string[]>([])
  const [backupScope, setBackupScope] = useState<BackupTab>('full')
  const [backupItems, setBackupItems] = useState<BackupItemId[]>(BACKUP_ITEMS.map((i) => i.id))
  const [retentionDays, setRetentionDays] = useState(30)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [nextRun, setNextRun] = useState<string | null>(null)

  const flash = (text: string, isError = false) => {
    if (isError) setError(text)
    else setMsg(text)
    setTimeout(() => { setMsg(''); setError('') }, 4500)
  }

  const applyRow = (row: BackupScheduleRow | null) => {
    if (!row) {
      setPickedDomains(accountDomains)
      return
    }
    setEnabled(row.enabled)
    setFrequency(row.frequency)
    setRunTime(row.run_time)
    setDayOfWeek(row.day_of_week ?? 1)
    setRunsPerMonth(row.runs_per_month)
    setMonthDays(row.month_days)
    setDomainMode(row.domain_mode)
    setPickedDomains(row.domain_mode === 'all' ? accountDomains : row.domains)
    setBackupScope(row.backup_scope)
    setBackupItems(row.backup_items.length ? row.backup_items : TAB_BACKUP_ITEMS[row.backup_scope])
    setRetentionDays(row.retention_days)
    setLastRun(row.last_run_at)
    setNextRun(row.next_run_at)
  }

  const load = useCallback(async () => {
    if (!primaryDomain) return
    setLoading(true)
    try {
      const row = await scheduleRequest<BackupScheduleRow | null>('GET', {
        domain: primaryDomain,
      })
      applyRow(row)
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Não foi possível carregar.', true)
    } finally {
      setLoading(false)
    }
  }, [primaryDomain, owner, accountDomains])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (domainMode === 'all') setPickedDomains(accountDomains)
  }, [domainMode, accountDomains])

  useEffect(() => {
    if (backupScope !== 'full') {
      setBackupItems(TAB_BACKUP_ITEMS[backupScope])
    }
  }, [backupScope])

  useEffect(() => {
    setMonthDays(DEFAULT_MONTH_DAYS[runsPerMonth] || [1])
  }, [runsPerMonth])

  const toggleDomain = (domain: string) => {
    setPickedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain],
    )
  }

  const toggleItem = (id: BackupItemId) => {
    setBackupItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleSave = async () => {
    if (!primaryDomain) return
    if (domainMode === 'selected' && !pickedDomains.length) {
      flash('Seleccione pelo menos um domínio.', true)
      return
    }
    setSaving(true)
    try {
      await scheduleRequest<BackupScheduleRow>('POST', {
        action: 'save',
        domain: primaryDomain,
        enabled,
        frequency,
        runTime,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
        runsPerMonth,
        monthDays,
        domainMode,
        domains: domainMode === 'all' ? accountDomains : pickedDomains,
        backupScope,
        backupItems: backupScope === 'full' ? backupItems : TAB_BACKUP_ITEMS[backupScope],
        retentionDays,
      })
      flash('Configuração guardada.')
      if (setActiveSection) setActiveSection('wp-backup-report')
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Guardar falhou.', true)
    } finally {
      setSaving(false)
    }
  }

  const preview = formatScheduleWhen({
    frequency,
    run_time: runTime,
    day_of_week: dayOfWeek,
    runs_per_month: runsPerMonth,
    month_days: monthDays,
  })

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {primaryDomain ? (
        <p className="text-sm text-zinc-500">
          Conta: <span className="font-mono text-zinc-700 dark:text-zinc-300">{primaryDomain}</span>
          {' · '}
          Utilizador: <span className="font-mono">{owner}</span>
        </p>
      ) : null}

      {msg ? <div className="rounded border border-green-200 bg-green-50/80 px-4 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">{msg}</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50/80 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">{error}</div> : null}

      <div className={`${panelCard} space-y-5 p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Backup automático</h3>
            <p className="mt-1 text-sm text-zinc-500">Cópias agendadas enviadas para o armazenamento remoto do painel.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Activar
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-500">Frequência</span>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as BackupFrequency)}
              className={`${panelField} w-full`}
            >
              {(Object.keys(FREQUENCY_LABELS) as BackupFrequency[]).map((f) => (
                <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-500">Hora</span>
            <input type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} className={`${panelField} w-full`} />
          </label>
          {frequency === 'weekly' ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-500">Dia da semana</span>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className={`${panelField} w-full`}>
                {WEEKDAY_LABELS.map((label, i) => (
                  <option key={label} value={i}>{label}</option>
                ))}
              </select>
            </label>
          ) : null}
          {frequency === 'monthly' ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-500">Vezes por mês</span>
                <select value={runsPerMonth} onChange={(e) => setRunsPerMonth(Number(e.target.value))} className={`${panelField} w-full`}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-zinc-500">Dias do mês</span>
                <div className="flex flex-wrap gap-1.5">
                  {monthDays.map((d) => (
                    <span key={d} className="rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                      dia {d}
                    </span>
                  ))}
                </div>
              </label>
            </>
          ) : null}
        </div>

        <p className="text-sm text-zinc-500">{preview}</p>

        <div className="space-y-3">
          <span className="text-sm font-medium text-zinc-500">Âmbito do backup</span>
          <select value={backupScope} onChange={(e) => setBackupScope(e.target.value as BackupTab)} className={`${panelField} w-full max-w-md`}>
            {BACKUP_TABS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          {backupScope === 'full' ? (
            <div className={backupOptionGrid}>
              {BACKUP_ITEMS.map((item) => (
                <label
                  key={item.id}
                  className={cn(
                    backupOptionChip,
                    backupItems.includes(item.id) && backupOptionChipActive,
                  )}
                >
                  <input
                    type="checkbox"
                    checked={backupItems.includes(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="rounded border-gray-300 text-red-600"
                  />
                  <span className="truncate">{item.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {TAB_BACKUP_ITEMS[backupScope].map((id) => (
                <span key={id} className="rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                  {BACKUP_ITEMS.find((i) => i.id === id)?.label || id}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <span className="text-xs font-medium text-zinc-500">Domínios</span>
          <select
            value={domainMode}
            onChange={(e) => setDomainMode(e.target.value as BackupDomainMode)}
            className={`${panelField} w-full max-w-md`}
          >
            <option value="all">Backup geral (todos os domínios)</option>
            <option value="selected">Domínios seleccionados</option>
          </select>
          {domainMode === 'selected' ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {accountDomains.map((domain) => (
                <label key={domain} className={cn(panelInnerDetailCard, 'flex items-center gap-2 py-2')}>
                  <input
                    type="checkbox"
                    checked={pickedDomains.includes(domain)}
                    onChange={() => toggleDomain(domain)}
                    className="rounded border-gray-300 text-red-600"
                  />
                  <span className="truncate font-mono text-xs">{domain}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">{accountDomains.length} domínio(s) incluído(s) automaticamente.</p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">Retenção (dias)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value) || 30)}
              className={`${panelField} w-full max-w-[8rem]`}
            />
          </label>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">Destino</span>
            <p className={`${panelInnerDetailCard} text-xs text-zinc-600 dark:text-zinc-400`}>
              Armazenamento remoto do painel (cópias automáticas)
            </p>
          </div>
        </div>

        {(lastRun || nextRun) ? (
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            {lastRun ? <span>Última execução: {new Date(lastRun).toLocaleString('pt-PT')}</span> : null}
            {nextRun ? <span>Próxima execução: {new Date(nextRun).toLocaleString('pt-PT')}</span> : null}
          </div>
        ) : null}

        <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-zinc-800">
          <button type="button" onClick={() => void handleSave()} disabled={saving} className={btnGreen}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar configuração
          </button>
        </div>
      </div>
    </div>
  )
}
