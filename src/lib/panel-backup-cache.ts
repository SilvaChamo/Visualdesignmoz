import type { BackupFileRow, BackupTab } from '@/lib/da-backup-types'
import { BACKUP_TABS } from '@/lib/da-backup-types'

const STORAGE_KEY = 'vd_backup_mgr_v1'
const CACHE_MS = 15 * 60 * 1000

type BackupListCache = { at: number; rows: BackupFileRow[] }

type Store = {
  lists?: Record<string, BackupListCache>
}

function cacheKey(owner: string, scope: BackupTab) {
  return `${owner.toLowerCase()}:${scope}`
}

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: Store) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota */
  }
}

function fresh(at: number) {
  return Date.now() - at <= CACHE_MS
}

export function readBackupListCache(owner: string, scope: BackupTab): BackupListCache | null {
  if (!owner) return null
  const row = readStore().lists?.[cacheKey(owner, scope)]
  if (!row || !fresh(row.at)) return null
  return row
}

export function writeBackupListCache(owner: string, scope: BackupTab, rows: BackupFileRow[]) {
  if (!owner) return
  const store = readStore()
  store.lists = store.lists || {}
  store.lists[cacheKey(owner, scope)] = { at: Date.now(), rows }
  writeStore(store)
}

export function invalidateBackupListCache(owner?: string, scope?: BackupTab) {
  if (typeof window === 'undefined') return
  const store = readStore()
  if (!store.lists) return
  if (!owner) {
    store.lists = {}
    writeStore(store)
    return
  }
  if (scope) {
    delete store.lists[cacheKey(owner, scope)]
  } else {
    for (const key of Object.keys(store.lists)) {
      if (key.startsWith(`${owner.toLowerCase()}:`)) delete store.lists[key]
    }
  }
  writeStore(store)
}

async function fetchBackupList(
  primaryDomain: string,
  scope: BackupTab,
  accountDomains: string[],
): Promise<BackupFileRow[]> {
  const res = await fetch('/api/backup-manager', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'list',
      domain: primaryDomain,
      scope,
      accountDomains,
    }),
  })
  const data = await res.json() as { success?: boolean; data?: BackupFileRow[] }
  if (!data.success || !Array.isArray(data.data)) return []
  return data.data
}

export async function prefetchBackupLists(
  owner: string,
  primaryDomain: string,
  accountDomains: string[],
): Promise<void> {
  if (typeof window === 'undefined' || !owner || !primaryDomain) return
  for (const tab of BACKUP_TABS) {
    if (readBackupListCache(owner, tab.id)) continue
    try {
      const rows = await fetchBackupList(primaryDomain, tab.id, accountDomains)
      writeBackupListCache(owner, tab.id, rows)
    } catch {
      /* próximo tab */
    }
  }
}
