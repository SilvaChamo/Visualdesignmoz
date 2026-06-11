import { readFileSync } from 'fs';

async function main() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const { daRequest } = await import('../src/lib/directadmin');
  const { resolveDirectAdminCredentials } = await import('../src/lib/directadmin-credentials');
  const creds = await resolveDirectAdminCredentials('admin');
  const pass = '1YkLc8INaRZ_k47AK0kOluzgrdQ9RsfX';

  const keyRes = await daRequest(
    'CMD_API_LOGIN_KEYS',
    'POST',
    { json: 'yes', action: 'create', user: 'oshercollective', keyname: 'vdpanelsync', passwd: pass, passwd2: pass, hours: '0' },
    creds,
  );
  console.log('key', keyRes.error ? keyRes.details : JSON.stringify(keyRes.data));

  const mod = await daRequest(
    'CMD_API_MODIFY_USER',
    'POST',
    { json: 'yes', action: 'single', user: 'oshercollective', passwd: pass, passwd2: pass },
    creds,
  );
  console.log('modify', mod.error ? mod.details : 'OK');
}

main();
