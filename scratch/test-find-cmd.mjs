import { readFileSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { executeServerCommand } = await import('../src/lib/server-ssh-exec.ts')

const owner = 'admin'
const dir = `/home/${owner}/backups`
const findCmd = [
  `find ${dir} -maxdepth 4 -type f \\( -name '*.tar.gz' -o -name '*.tar' \\)`,
  `-printf '%s %TY-%Tm-%Td %TH:%TM %p\\n' 2>/dev/null`,
  `find ${dir}/backup -maxdepth 1 -type f \\( -name '*_bd.sql' -o -name 'admin_*.sql' \\)`,
  `-printf '%s %TY-%Tm-%Td %TH:%TM %p\\n' 2>/dev/null`,
].join('; ')

console.log('CMD:', findCmd)
const out = await executeServerCommand(findCmd)
console.log('OUT length:', out.length)
console.log(out.split('\n').slice(0, 5).join('\n'))
