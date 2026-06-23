import { createClient } from '@supabase/supabase-js'
import { daBackupListFiles, daBackupViewItems } from '@/lib/da-backup-api'
import type { BackupFileRow, BackupItemId, BackupTab } from '@/lib/da-backup-types'
import { inferBackupScope } from '@/lib/da-backup-types'
import { PANEL_SLUG } from '@/lib/panel-tenant'
import { listBucketBackups } from '@/lib/panel-backup-bucket'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  )
}

type MirrorRow = {
  id: string
  owner: string
  domain: string
  filename: string
  scope: BackupTab
  size_bytes: number
  size_label: string
  source: 'server' | 'bucket' | 'both'
  server_path: string | null
  bucket_path: string | null
  backup_date: string
}

function toClientRow(r: MirrorRow): BackupFileRow {
  return {
    filename: r.filename,
    size: r.size_label || '—',
    sizeBytes: Number(r.size_bytes) || 0,
    date: r.backup_date ? new Date(r.backup_date).toLocaleString('pt-PT') : '—',
    path: r.server_path || r.bucket_path || '',
    scope: r.scope,
    source: r.source === 'both' ? 'bucket' : r.source,
    domain: r.domain,
    bucketPath: r.bucket_path || undefined,
  }
}

export async function upsertBackupMirror(input: {
  owner: string
  domain: string
  filename: string
  scope: BackupTab
  sizeBytes?: number
  sizeLabel?: string
  source?: 'server' | 'bucket' | 'both'
  serverPath?: string
  bucketPath?: string
}): Promise<void> {
  const payload = {
    panel_slug: PANEL_SLUG,
    owner: input.owner.toLowerCase(),
    domain: input.domain,
    filename: input.filename,
    scope: input.scope,
    size_bytes: input.sizeBytes ?? 0,
    size_label: input.sizeLabel ?? '—',
    source: input.source ?? 'server',
    server_path: input.serverPath ?? (
      /\.sql$/i.test(input.filename)
        ? `/home/${input.owner}/backups/backup/${input.filename}`
        : `/home/${input.owner}/backups/${input.filename}`
    ),
    bucket_path: input.bucketPath ?? null,
    backup_date: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  await db()
    .from('panel_backup_files')
    .delete()
    .eq('panel_slug', PANEL_SLUG)
    .eq('owner', input.owner.toLowerCase())
    .eq('filename', input.filename)
  const { error } = await db()
    .from('panel_backup_files')
    .upsert(payload, { onConflict: 'panel_slug,owner,domain,filename' })
  if (error) throw new Error(error.message)
}

export async function deleteBackupMirror(
  owner: string,
  domain: string,
  filename: string,
): Promise<void> {
  await db()
    .from('panel_backup_files')
    .delete()
    .eq('panel_slug', PANEL_SLUG)
    .eq('owner', owner.toLowerCase())
    .eq('domain', domain)
    .eq('filename', filename)
}

export async function listMirrorBackups(
  owner: string,
  scope?: BackupTab,
): Promise<BackupFileRow[]> {
  let query = db()
    .from('panel_backup_files')
    .select('*')
    .eq('panel_slug', PANEL_SLUG)
    .eq('owner', owner.toLowerCase())
    .order('backup_date', { ascending: false })

  if (scope) query = query.eq('scope', scope)

  const { data, error } = await query
  if (error) {
    if (/does not exist|relation/i.test(error.message)) return []
    throw new Error(error.message)
  }
  return (data as MirrorRow[] || []).map(toClientRow)
}

async function resolveBackupDomain(
  filename: string,
  accountDomains: string[],
  primaryDomain: string,
): Promise<string> {
  const domains = accountDomains.length ? accountDomains : [primaryDomain]
  if (/\.sql$/i.test(filename)) {
    const dbName = filename.replace(/\.sql$/i, '')
    const { data } = await db()
      .from('panel_databases')
      .select('domain')
      .eq('db_name', dbName)
    const matches = (data || []).map((r) => String(r.domain))
    const inAccount = matches.filter((d) => domains.includes(d))
    if (inAccount.length === 1) return inAccount[0]
    if (inAccount.length > 1) {
      return inAccount.find((d) => d === primaryDomain) || inAccount[0]
    }
    if (matches.length) {
      return matches.find((d) => d === primaryDomain) || matches[0]
    }
  }
  return domains.find((d) => filename.toLowerCase().includes(d.toLowerCase())) || primaryDomain
}

/** Sincroniza ficheiros do servidor e balde para o espelho Supabase. */
export async function syncBackupsToMirror(
  owner: string,
  primaryDomain: string,
  accountDomains: string[] = [],
): Promise<void> {
  const domains = accountDomains.length ? accountDomains : [primaryDomain]

  const serverFiles = await daBackupListFiles(owner, primaryDomain)

  for (const file of serverFiles) {
    const fileDomain = await resolveBackupDomain(file.filename, domains, primaryDomain)
    let scope: BackupTab = file.scope || 'full'
    if (scope === 'full' && !/\.sql$/i.test(file.filename)) {
      try {
        const view = await daBackupViewItems(owner, fileDomain, file.filename)
        const items = (view.items || []) as BackupItemId[]
        if (items.length) scope = inferBackupScope(items)
      } catch {
        /* manter scope */
      }
    }
    await upsertBackupMirror({
      owner,
      domain: fileDomain,
      filename: file.filename,
      scope,
      sizeBytes: file.sizeBytes,
      sizeLabel: file.size,
      source: 'server',
      serverPath: file.path,
    }).catch(() => undefined)
  }

  const bucketFiles = await listBucketBackups(owner)
  for (const file of bucketFiles) {
    await upsertBackupMirror({
      owner,
      domain: file.domain || primaryDomain,
      filename: file.filename,
      scope: file.scope,
      sizeBytes: file.sizeBytes,
      sizeLabel: file.size,
      source: file.bucketPath ? 'both' : 'bucket',
      bucketPath: file.bucketPath,
    }).catch(() => undefined)
  }
}

export async function listBackupsForOwner(
  owner: string,
  primaryDomain: string,
  scope?: BackupTab,
  accountDomains: string[] = [],
): Promise<BackupFileRow[]> {
  try {
    await syncBackupsToMirror(owner, primaryDomain, accountDomains)
  } catch {
    /* espelho opcional se tabela em falta */
  }

  const mirror = await listMirrorBackups(owner, scope)
  let rows = mirror.length
    ? mirror
    : await (async () => {
      const { listClassifiedBackups } = await import('@/lib/panel-backup-bucket')
      return listClassifiedBackups(owner, primaryDomain, scope)
    })()

  if (accountDomains.length) {
    rows = rows.filter((row) => {
      if (/\.sql$/i.test(row.filename)) {
        return accountDomains.some((d) => {
          const short = d.split('.')[0].toLowerCase()
          return row.filename.toLowerCase().includes(short)
        })
      }
      return !row.domain || accountDomains.includes(row.domain)
    })
  }

  return rows
}
