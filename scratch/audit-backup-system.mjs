import { readFileSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const domain = process.argv[2] || 'mltmark.com'
const results = []

async function test(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail })
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) })
  }
}

await test('list backups (databases tab)', async () => {
  const { listBackupsForOwner } = await import('../src/lib/panel-backup-mirror.ts')
  const rows = await listBackupsForOwner('admin', domain, 'databases', [domain])
  return `${rows.length} ficheiro(s): ${rows.map((r) => r.filename).join(', ') || '—'}`
})

await test('list backups (full tab)', async () => {
  const { listBackupsForOwner } = await import('../src/lib/panel-backup-mirror.ts')
  const rows = await listBackupsForOwner('admin', domain, 'full', [domain])
  return `${rows.length} ficheiro(s)`
})

await test('daBackupListFiles', async () => {
  const { daBackupListFiles } = await import('../src/lib/da-backup-api.ts')
  const files = await daBackupListFiles('admin', domain)
  return `${files.length} no servidor`
})

await test('mirror table panel_backup_files', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await admin.from('panel_backup_files').select('filename,scope').eq('owner', 'admin').limit(5)
  if (error) throw new Error(error.message)
  return `${data?.length ?? 0} registo(s) espelho`
})

await test('schedule table panel_backup_schedules', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await admin.from('panel_backup_schedules').select('owner,enabled').limit(3)
  if (error) throw new Error(error.message)
  return `${data?.length ?? 0} agendamento(s)`
})

await test('bucket panel-backups list', async () => {
  const { listBucketBackups } = await import('../src/lib/panel-backup-bucket.ts')
  const rows = await listBucketBackups('admin', 'databases')
  return `${rows.length} no armazenamento`
})

await test('daBackupReadFile sample', async () => {
  const { daBackupListFiles, daBackupReadFile } = await import('../src/lib/da-backup-api.ts')
  const files = await daBackupListFiles('admin', domain)
  const sample = files.find((f) => f.filename.includes('mltmark')) || files[0]
  if (!sample) return 'sem ficheiros para testar leitura'
  const read = await daBackupReadFile('admin', sample.filename)
  if (!read.ok) throw new Error(read.error || 'leitura falhou')
  return `OK ${sample.filename} (${read.base64?.length ?? 0} b64 chars)`
})

await test('daBackupViewItems sample', async () => {
  const { daBackupListFiles, daBackupViewItems } = await import('../src/lib/da-backup-api.ts')
  const files = await daBackupListFiles('admin', domain)
  const sample = files[0]
  if (!sample) return 'sem ficheiros'
  const view = await daBackupViewItems('admin', domain, sample.filename)
  if (!view.ok) throw new Error(view.error || 'view falhou')
  return `items: ${(view.items || []).join(', ') || '—'}`
})

console.log(JSON.stringify({ domain, results }, null, 2))
