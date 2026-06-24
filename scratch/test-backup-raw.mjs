import { readFileSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const domain = process.argv[2] || 'visualdesignmoz.com'
const owner = 'admin'

const { daLegacyRequestViaSshAsDaUser } = await import('../src/lib/da-api-ssh.ts')
const { daBackupListFiles } = await import('../src/lib/da-backup-api.ts')

const before = await daBackupListFiles(owner, domain)
console.log('before:', before.map((f) => f.filename))

const result = await daLegacyRequestViaSshAsDaUser(owner, 'POST', 'CMD_API_SITE_BACKUP', {
  action: 'backup',
  domain,
  select0: 'database',
})
console.log('raw result:', JSON.stringify(result, null, 2))

for (const wait of [5, 10, 15, 20]) {
  await new Promise((r) => setTimeout(r, 5000))
  const after = await daBackupListFiles(owner, domain)
  const newFiles = after.filter((f) => !before.some((b) => b.filename === f.filename))
  console.log(`after ${wait}s: total=${after.length} new=${newFiles.length}`, newFiles.map((f) => f.filename))
}
