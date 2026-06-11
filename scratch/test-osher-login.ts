import { readFileSync } from 'fs';

async function main() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const pass = process.env.OSHER_DA_SYNC_PASSWORD || '1YkLc8INaRZ_k47AK0kOluzgrdQ9RsfX';
  const { daRequest } = await import('../src/lib/directadmin');
  const { decryptDaSecret } = await import('../src/lib/da-credential-store');
  const { createClient } = await import('@supabase/supabase-js');

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await admin.from('panel_users').select('da_password_encrypted').eq('username', 'oshercollective').single();
  const stored = data?.da_password_encrypted ? decryptDaSecret(data.da_password_encrypted) : '';

  for (const password of [pass, stored].filter(Boolean)) {
    const res = await daRequest(
      'CMD_API_POP',
      'GET',
      { json: 'yes', action: 'list', domain: 'msdnmoz.org' },
      { role: 'reseller', user: 'oshercollective', password },
    );
    console.log('try len', password.length, res.error ? res.details?.slice(0, 80) : 'OK', Object.keys(res.data || {}).slice(0, 3));
  }
}

main();
