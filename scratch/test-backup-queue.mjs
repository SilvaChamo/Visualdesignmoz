import { readFileSync } from 'fs'
import { executeServerCommand } from '../src/lib/server-ssh-exec.ts'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const owner = 'admin'
const path = `/home/${owner}/backups/backup/admin_wp_matolario_visualdesignmoz_com.sql`
const before = await executeServerCommand(`stat -c '%s %Y' ${path} 2>/dev/null || echo missing`)
console.log('before stat:', before)

const { daLegacyRequestViaSshAsDaUser } = await import('../src/lib/da-api-ssh.ts')
const r = await daLegacyRequestViaSshAsDaUser(owner, 'POST', 'CMD_API_SITE_BACKUP', {
  action: 'backup',
  domain: 'visualdesignmoz.com',
  select0: 'database',
})
console.log('create:', r)

for (let i = 1; i <= 12; i++) {
  await new Promise((x) => setTimeout(x, 5000))
  const stat = await executeServerCommand(`stat -c '%s %Y' ${path} 2>/dev/null || echo missing`)
  console.log(`${i * 5}s:`, stat, stat !== before ? 'CHANGED' : 'same')
}
