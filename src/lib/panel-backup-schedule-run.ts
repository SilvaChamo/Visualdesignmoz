import { createClient } from '@supabase/supabase-js'
import { daBackupCreate, daBackupListFiles } from '@/lib/da-backup-api'
import { TAB_BACKUP_ITEMS } from '@/lib/da-backup-types'
import type { BackupItemId, BackupTab } from '@/lib/da-backup-types'
import { pruneBucketBackups, uploadBackupFileToBucket } from '@/lib/panel-backup-bucket'
import { computeNextRunAt } from '@/lib/panel-backup-schedule-utils'
import { listMirrorWebsites } from '@/lib/panel-mirror-read'
import type { MirrorScope } from '@/lib/panel-mirror-read'

export async function runBackupScheduleRow(
  row: Record<string, unknown>,
  mirrorScope?: MirrorScope,
): Promise<{ ok: boolean; error?: string }> {
  const owner = String(row.owner)
  const scope = String(row.backup_scope || 'full') as BackupTab
  const items = (Array.isArray(row.backup_items) && row.backup_items.length
    ? row.backup_items
    : TAB_BACKUP_ITEMS[scope]) as BackupItemId[]

  let domains: string[] = []
  if (row.domain_mode === 'selected' && Array.isArray(row.domains) && row.domains.length) {
    domains = row.domains.map(String)
  } else {
    const sites = await listMirrorWebsites(mirrorScope || { role: 'admin' })
    domains = [...new Set(sites.filter((s) => s.owner?.toLowerCase() === owner).map((s) => s.domain))]
  }

  for (const domain of domains) {
    const created = await daBackupCreate(owner, domain, items)
    if (!created.ok) return { ok: false, error: created.error || 'Criação falhou' }

    let filename = created.filename
    if (!filename) {
      const files = await daBackupListFiles(owner, domain)
      filename = [...files].sort((a, b) => b.filename.localeCompare(a.filename))[0]?.filename
    }
    if (!filename) return { ok: false, error: 'Ficheiro de backup não encontrado' }

    const uploaded = await uploadBackupFileToBucket(
      owner, domain, scope, filename, String(row.bucket_name || 'panel-backups'),
    )
    if (!uploaded.ok) {
      // backup no servidor criado — aviso apenas
    }
  }

  await pruneBucketBackups(owner, Number(row.retention_days) || 30, String(row.bucket_name || 'panel-backups'))

  const now = new Date()
  const next = computeNextRunAt({
    frequency: row.frequency as 'daily' | 'weekly' | 'monthly',
    runTime: String(row.run_time).slice(0, 5),
    dayOfWeek: row.day_of_week == null ? 1 : Number(row.day_of_week),
    runsPerMonth: Number(row.runs_per_month) || 1,
    monthDays: Array.isArray(row.month_days) ? row.month_days.map(Number) : [1],
    from: now,
  })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  )
  await db.from('panel_backup_schedules').update({
    last_run_at: now.toISOString(),
    next_run_at: next.toISOString(),
    updated_at: now.toISOString(),
  }).eq('id', row.id)

  return { ok: true }
}
