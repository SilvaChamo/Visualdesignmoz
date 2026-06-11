import { readFileSync } from 'fs';

async function main() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  process.env.DIRECTADMIN_USE_SSH = 'false';
  const { daRequest } = await import('../src/lib/directadmin');
  const { resolveDirectAdminCredentials } = await import('../src/lib/directadmin-credentials');
  const creds = await resolveDirectAdminCredentials('admin');
  const domain = 'aamihe.com';

  const add = await daRequest(
    'CMD_API_DNS_CONTROL',
    'POST',
    {
      json: 'yes',
      action: 'add',
      domain,
      type: 'TXT',
      name: '_vdtest',
      value: 'panel-dns-test',
      ttl: '300',
    },
    creds,
  );
  console.log('add', add.error ? add.details : 'ok');

  const list = await daRequest(
    'CMD_API_DNS_CONTROL',
    'GET',
    { json: 'yes', action: 'list', domain },
    creds,
  );
  const recs = (list.data?.records as Array<Record<string, string>>) || [];
  const test = recs.find((r) => String(r.value).includes('panel-dns-test'));
  console.log('found', test);

  if (test?.combined) {
    const typeKey = 'txtrecs0';
    const del = await daRequest(
      'CMD_API_DNS_CONTROL',
      'POST',
      { json: 'yes', action: 'select', domain, [typeKey]: test.combined },
      creds,
    );
    console.log('del txtrecs0', del.error ? del.details : 'ok');
  }
}

main().catch((e) => console.error(e.message));
