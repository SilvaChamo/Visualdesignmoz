import { readFileSync } from 'fs';

async function main() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const { getAdminDirectAdminAPI } = await import('../src/lib/directadmin-adapter');
  const { daRequest } = await import('../src/lib/directadmin');
  const { resolveDirectAdminCredentials } = await import('../src/lib/directadmin-credentials');

  const da = await getAdminDirectAdminAPI();
  const sites = await da.listWebsites();
  console.log('sites:', sites.map((s) => ({ domain: s.domain, owner: s.owner })));

  const creds = await resolveDirectAdminCredentials('admin');
  console.log('admin user:', creds.user, 'role:', creds.role);
  for (const domain of ['visualdesignmoz.com', 'msdnmoz.org']) {
    try {
      const emails = await da.listEmails(domain);
      console.log(domain, 'emails', emails.length);
    } catch (e) {
      console.log(domain, 'err', e instanceof Error ? e.message : e);
    }
  }
}

main().catch(console.error);
