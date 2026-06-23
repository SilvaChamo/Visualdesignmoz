import type { BackupScheduleRow } from '@/lib/panel-backup-schedule-types'

const DRAFT_KEY = 'panel-backup-schedule-draft'

export function writeBackupScheduleDraft(row: Partial<BackupScheduleRow> | null): void {
  if (typeof sessionStorage === 'undefined') return
  if (!row) {
    sessionStorage.removeItem(DRAFT_KEY)
    return
  }
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(row))
}

export function readBackupScheduleDraft(): Partial<BackupScheduleRow> | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<BackupScheduleRow>
  } catch {
    return null
  }
}

export function clearBackupScheduleDraft(): void {
  writeBackupScheduleDraft(null)
}
