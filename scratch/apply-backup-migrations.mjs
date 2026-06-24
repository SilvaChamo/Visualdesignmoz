import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const admin = createClient(url, key)
const files = [
  'scripts/migrate-panel-backup-files.sql',
  'scripts/migrate-panel-backup-schedules.sql',
]

for (const file of files) {
  const sql = readFileSync(file, 'utf8')
  const { error } = await admin.rpc('exec_sql', { sql })
  console.log(error ? `${file}: ${error.message}` : `${file}: ok`)
}

for (const table of ['panel_backup_files', 'panel_backup_schedules']) {
  const { error } = await admin.from(table).select('id').limit(1)
  console.log(error ? `${table}: ${error.message}` : `${table}: ok`)
}

const { error: bucketErr } = await admin.storage.createBucket('panel-backups', { public: false })
if (bucketErr && !/already exists|duplicate/i.test(bucketErr.message)) {
  console.log(`panel-backups bucket: ${bucketErr.message}`)
} else {
  console.log('panel-backups bucket: ok')
}
