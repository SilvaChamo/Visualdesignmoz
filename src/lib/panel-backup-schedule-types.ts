import type { BackupItemId, BackupTab } from '@/lib/da-backup-types'

export type BackupFrequency = 'daily' | 'weekly' | 'monthly'
export type BackupDomainMode = 'all' | 'selected'

export type BackupScheduleRow = {
  id: string
  panel_slug: string
  owner: string
  enabled: boolean
  frequency: BackupFrequency
  run_time: string
  day_of_week: number | null
  runs_per_month: number
  month_days: number[]
  domain_mode: BackupDomainMode
  domains: string[]
  backup_scope: BackupTab
  backup_items: BackupItemId[]
  bucket_name: string
  retention_days: number
  last_run_at: string | null
  next_run_at: string | null
  updated_at: string
}

export type BackupScheduleInput = {
  owner: string
  enabled: boolean
  frequency: BackupFrequency
  runTime: string
  dayOfWeek: number | null
  runsPerMonth: number
  monthDays: number[]
  domainMode: BackupDomainMode
  domains: string[]
  backupScope: BackupTab
  backupItems: BackupItemId[]
  retentionDays: number
}

export const WEEKDAY_LABELS = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
] as const

export const FREQUENCY_LABELS: Record<BackupFrequency, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
}

export const DEFAULT_MONTH_DAYS: Record<number, number[]> = {
  1: [1],
  2: [1, 15],
  3: [1, 10, 20],
  4: [1, 8, 15, 22],
}
