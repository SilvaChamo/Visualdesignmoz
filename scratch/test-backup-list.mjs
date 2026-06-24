import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { daBackupListFiles } = await import('../src/lib/da-backup-api.ts')

const files = await daBackupListFiles('admin', 'mltmark.com')
console.log('daBackupListFiles count:', files.length)
console.log('mltmark:', files.filter((f) => f.filename.includes('mltmark')))

const { listBackupsForOwner } = await import('../src/lib/panel-backup-mirror.ts')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const { data: sites } = await admin
  .from('panel_sites')
  .select('domain, owner')
  .ilike('domain', '%mltmark%')
  .limit(5)

console.log('sites:', sites)

const site = sites?.[0]
if (!site) {
  console.log('mltmark not found in panel_sites')
  process.exit(0)
}

const owner = site.owner
const domain = site.domain
console.log(`Testing owner=${owner} domain=${domain}`)

const accountDomains = [domain]

const all = await listBackupsForOwner(owner, domain, undefined, accountDomains)
console.log('all backups:', all.length, all.map((b) => ({ f: b.filename, scope: b.scope, domain: b.domain })))

const dbs = await listBackupsForOwner(owner, domain, 'databases', accountDomains)
console.log('databases tab:', dbs.length, dbs.map((b) => b.filename))

const { data: mirror } = await admin.from('panel_backup_files').select('filename, scope, domain').eq('owner', owner.toLowerCase())
console.log('mirror rows:', mirror?.length, mirror)
