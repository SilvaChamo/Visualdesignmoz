import { readFileSync } from 'fs';

async function main() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const { daRequest } = await import('../src/lib/directadmin');
  const { resolveDirectAdminCredentials } = await import('../src/lib/directadmin-credentials');
  const creds = await resolveDirectAdminCredentials('admin');

  for (const cmd of ['CMD_API_LOGIN_KEYS', 'CMD_API_API_ACCESS']) {
    const res = await daRequest(
      cmd,
      'POST',
      { json: 'yes', action: 'create', user: 'oshercollective', keyname: 'visualdesign-sync' },
      creds,
    );
    console.log(cmd, res.error ? res.details : JSON.stringify(res.data).slice(0, 200));
  }
}

main().catch(console.error);
