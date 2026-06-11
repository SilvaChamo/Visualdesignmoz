import { readFileSync } from 'fs';

async function main() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const { daRequest } = await import('../src/lib/directadmin');
  const { resolveDirectAdminCredentials } = await import('../src/lib/directadmin-credentials');
  const creds = await resolveDirectAdminCredentials('admin');
  const res = await daRequest(
    'CMD_API_DNS_CONTROL',
    'GET',
    { json: 'yes', action: 'list', domain: 'aamihe.com' },
    creds,
  );
  console.log('error', res.error, res.details || '');
  const data = res.data || {};
  const keys = Object.keys(data).filter((k) => !['error', 'text', 'details'].includes(k));
  console.log('keyCount', keys.length);
  const records = data.records;
  if (Array.isArray(records)) {
    console.log('records count', records.length);
    console.log(JSON.stringify(records.slice(0, 5), null, 2));
  } else {
    for (const k of keys.slice(0, 25)) console.log(k, ':', String(data[k]).slice(0, 200));
  }
}

main().catch((e) => console.error(e.message));
