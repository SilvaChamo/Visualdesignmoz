import { createClient } from '@supabase/supabase-js'
import { daBackupCreate, daBackupListFiles, waitForBackupFileChange } from '@/lib/da-backup-api'
import { TAB_BACKUP_ITEMS } from '@/lib/da-backup-types'
import type { BackupItemId, BackupTab } from '@/lib/da-backup-types'
import { pruneBucketBackups, uploadBackupFileToBucket, uploadHestiaBackupToBucket } from '@/lib/panel-backup-bucket'
import { computeNextRunAt } from '@/lib/panel-backup-schedule-utils'
import { listHostingDomains } from '@/lib/hosting-resolver'
import { getProviderByUsername } from '@/lib/hosting-provider'
import * as hestiaAdapter from '@/lib/hestia-adapter'
import type { MirrorScope } from '@/lib/panel-mirror-read'

/**
 * Faz o backup Hestia de uma conta inteira (v-backup-user não separa por
 * domínio nem por item — ao contrário do DirectAdmin, é sempre tudo:
 * web+mail+BD+cron+userdir de uma vez). Corre uma única vez por conta,
 * nunca por domínio.
 */
async function runHestiaBackup(
  owner: string,
  bucketName: string,
): Promise<{ ok: boolean; error?: string }> {
  const before = new Set((await hestiaAdapter.listBackups(owner)).map((b) => b.filename))
  const created = await hestiaAdapter.createBackup(owner)
  if (!created.ok) return { ok: false, error: created.error || 'Criação falhou' }

  const after = await hestiaAdapter.listBackups(owner)
  const fresh = after.find((b) => !before.has(b.filename))
  // v-backup-user é síncrono (bloqueia até acabar) — se não apareceu nenhum
  // ficheiro novo, é porque hoje já tinha corrido e o nome (por data) ficou
  // igual; usa o mais recente em vez de falhar.
  const filename = fresh?.filename || after[0]?.filename
  if (!filename) return { ok: false, error: 'Ficheiro de backup não encontrado' }

  const uploaded = await uploadHestiaBackupToBucket(owner, filename, bucketName)
  if (!uploaded.ok) {
    // backup no servidor criado — aviso apenas, não falha o agendamento por isto
  }
  return { ok: true }
}

export async function runBackupScheduleRow(
  row: Record<string, unknown>,
  mirrorScope?: MirrorScope,
): Promise<{ ok: boolean; error?: string }> {
  const owner = String(row.owner)
  const scope = String(row.backup_scope || 'full') as BackupTab
  const items = (Array.isArray(row.backup_items) && row.backup_items.length
    ? row.backup_items
    : TAB_BACKUP_ITEMS[scope]) as BackupItemId[]
  const bucketName = String(row.bucket_name || 'panel-backups')

  const provider = await getProviderByUsername(owner)
  if (provider === 'hestia') {
    const result = await runHestiaBackup(owner, bucketName)
    if (!result.ok) return result
  } else {
    let domains: string[] = []
    if (row.domain_mode === 'selected' && Array.isArray(row.domains) && row.domains.length) {
      domains = row.domains.map(String)
    } else {
      const sites = await listHostingDomains(mirrorScope || { role: 'admin' })
      domains = [...new Set(sites.filter((s) => s.owner?.toLowerCase() === owner).map((s) => s.domain))]
    }

    for (const domain of domains) {
      const before = await daBackupListFiles(owner, domain)
      const created = await daBackupCreate(owner, domain, items)
      if (!created.ok) return { ok: false, error: created.error || 'Criação falhou' }

      let filename = created.filename
      if (!filename) {
        filename = await waitForBackupFileChange(owner, domain, before)
      }
      if (!filename) {
        return {
          ok: false,
          error: created.queued
            ? 'Backup em fila no servidor — tente novamente dentro de um minuto'
            : 'Ficheiro de backup não encontrado',
        }
      }

      const uploaded = await uploadBackupFileToBucket(owner, domain, scope, filename, bucketName)
      if (!uploaded.ok) {
        // backup no servidor criado — aviso apenas
      }
    }
  }

  await pruneBucketBackups(owner, Number(row.retention_days) || 30, bucketName)

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
