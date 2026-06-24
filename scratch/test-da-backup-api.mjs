import { readFileSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { daLegacyRequestViaSshAsDaUser } = await import('../src/lib/da-api-ssh.ts')
const { executeServerCommand } = await import('../src/lib/server-ssh-exec.ts')

const owner = 'admin'
const domain = 'mltmark.com'

const api = await daLegacyRequestViaSshAsDaUser(owner, 'GET', 'CMD_API_SITE_BACKUP', { domain })
console.log('GET backup API:', JSON.stringify(api, null, 2))

const ls = await executeServerCommand(`find /home/${owner}/backups -maxdepth 3 -type f \\( -name '*.tar.gz' -o -name '*.tar' -o -name '*_bd.sql' \\) 2>/dev/null | head -20`)
console.log('find files:\n', ls)
