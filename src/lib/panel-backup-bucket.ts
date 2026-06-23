import { createClient } from '@supabase/supabase-js'
import {
  daBackupListFiles, daBackupReadFile, daBackupViewItems,
} from '@/lib/da-backup-api'
import type { BackupFileRow, BackupItemId, BackupTab } from '@/lib/da-backup-types'
import { inferBackupScope } from '@/lib/da-backup-types'

const BUCKET = 'panel-backups'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, key)
}

async function ensureBucket(bucket: string): Promise<void> {
  const client = admin()
  const { error } = await client.storage.createBucket(bucket, { public: false })
  if (error && !/already exists|duplicate/i.test(error.message)) {
    // balde pode já existir — ignorar
  }
}

function bucketPath(owner: string, scope: BackupTab, domain: string, filename: string) {
  return `${owner}/${scope}/${domain}/${filename}`
}

export async function uploadBackupFileToBucket(
  owner: string,
  domain: string,
  scope: BackupTab,
  filename: string,
  bucket = BUCKET,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const read = await daBackupReadFile(owner, filename)
  if (!read.ok || !read.base64) return { ok: false, error: read.error || 'Leitura do backup falhou.' }

  await ensureBucket(bucket)
  const bytes = Buffer.from(read.base64, 'base64')
  const path = bucketPath(owner, scope, domain, filename)
  const { error } = await admin().storage.from(bucket).upload(path, bytes, {
    contentType: 'application/gzip',
    upsert: true,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, path }
}

export async function listBucketBackups(
  owner: string,
  scope?: BackupTab,
  bucket = BUCKET,
): Promise<BackupFileRow[]> {
  const client = admin()
  const scopes: BackupTab[] = scope
    ? [scope]
    : ['full', 'files', 'databases', 'emails', 'ftp']

  const rows: BackupFileRow[] = []

  for (const sc of scopes) {
    const prefix = `${owner}/${sc}`
    const { data: domains } = await client.storage.from(bucket).list(`${owner}/${sc}`, { limit: 200 })
    if (!domains?.length) continue

    for (const domainEntry of domains) {
      if (!domainEntry.name || domainEntry.name === '.emptyFolderPlaceholder') continue
      const domain = domainEntry.name
      const { data: files } = await client.storage.from(bucket).list(`${owner}/${sc}/${domain}`, { limit: 200 })
      for (const file of files || []) {
        if (!file.name || file.name === '.emptyFolderPlaceholder') continue
        const sizeBytes = file.metadata?.size ? Number(file.metadata.size) : 0
        rows.push({
          filename: file.name,
          size: formatBytes(sizeBytes),
          sizeBytes,
          date: file.created_at ? new Date(file.created_at).toLocaleString('pt-PT') : '—',
          path: bucketPath(owner, sc, domain, file.name),
          scope: sc,
          source: 'bucket',
          domain,
          bucketPath: bucketPath(owner, sc, domain, file.name),
        })
      }
    }
  }

  return rows.sort((a, b) => b.filename.localeCompare(a.filename))
}

export async function readBucketBackup(path: string, bucket = BUCKET): Promise<{ ok: boolean; base64?: string; error?: string }> {
  const { data, error } = await admin().storage.from(bucket).download(path)
  if (error || !data) return { ok: false, error: error?.message || 'Download falhou.' }
  const buf = Buffer.from(await data.arrayBuffer())
  return { ok: true, base64: buf.toString('base64') }
}

export async function deleteBucketBackup(path: string, bucket = BUCKET): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin().storage.from(bucket).remove([path])
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function listClassifiedBackups(
  owner: string,
  domain: string,
  scope?: BackupTab,
): Promise<BackupFileRow[]> {
  const serverFiles = await daBackupListFiles(owner, domain)
  const bucketFiles = await listBucketBackups(owner, scope)

  const classifiedServer = await Promise.all(serverFiles.map(async (row) => {
    try {
      const view = await daBackupViewItems(owner, domain, row.filename)
      const items = (view.items || []) as BackupItemId[]
      const fileScope = items.length ? inferBackupScope(items) : (scope ?? 'full')
      return {
        ...row,
        scope: fileScope,
        source: 'server' as const,
        domain,
      }
    } catch {
      return {
        ...row,
        scope: scope ?? 'full',
        source: 'server' as const,
        domain,
      }
    }
  }))

  const merged = new Map<string, BackupFileRow>()
  for (const row of [...classifiedServer, ...bucketFiles]) {
    if (scope && row.scope !== scope) continue
    const key = `${row.scope}:${row.domain || domain}:${row.filename}`
    const existing = merged.get(key)
    if (!existing || row.source === 'bucket') merged.set(key, row)
  }

  return [...merged.values()].sort((a, b) => b.filename.localeCompare(a.filename))
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1 }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

export async function uploadLatestBackupToBucket(
  owner: string,
  domain: string,
  bucket = BUCKET,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const files = await daBackupListFiles(owner, domain)
  if (!files.length) return { ok: false, error: 'Nenhum backup encontrado para enviar.' }
  const latest = [...files].sort((a, b) => b.filename.localeCompare(a.filename))[0]
  return uploadBackupFileToBucket(owner, domain, 'full', latest.filename, bucket)
}

export async function pruneBucketBackups(
  owner: string,
  retentionDays: number,
  bucket = BUCKET,
): Promise<void> {
  if (retentionDays <= 0) return
  const client = admin()
  const scopes: BackupTab[] = ['full', 'files', 'databases', 'emails', 'ftp']
  const cutoff = Date.now() - retentionDays * 86400000

  for (const sc of scopes) {
    const { data: domains } = await client.storage.from(bucket).list(`${owner}/${sc}`, { limit: 200 })
    for (const d of domains || []) {
      if (!d.name) continue
      const { data: files } = await client.storage.from(bucket).list(`${owner}/${sc}/${d.name}`, { limit: 200 })
      for (const f of files || []) {
        if (!f.name) continue
        const created = f.created_at ? new Date(f.created_at).getTime() : 0
        if (created && created < cutoff) {
          await client.storage.from(bucket).remove([`${owner}/${sc}/${d.name}/${f.name}`])
        }
      }
    }
  }
}
