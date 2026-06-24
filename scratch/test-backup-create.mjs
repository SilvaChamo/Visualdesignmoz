import { readFileSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const domain = process.argv[2] || 'visualdesignmoz.com'
const owner = 'admin'

const { daBackupCreate, daBackupListFiles } = await import('../src/lib/da-backup-api.ts')

const before = await daBackupListFiles(owner, domain)
console.log('before:', before.length)

const r = await daBackupCreate(owner, domain, ['database'])
console.log('create:', r)

await new Promise((resolve) => setTimeout(resolve, 4000))

const after = await daBackupListFiles(owner, domain)
console.log('after:', after.length, 'new:', after.length - before.length)
