import { readFileSync } from 'fs';

async function main() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const { getHostingDomains, checkDomainSyncStatus } = await import('../src/lib/dns-sync');
  const domains = await getHostingDomains();
  console.log('domains', domains.length, domains.slice(0, 5));
  if (domains[0]) {
    const status = await checkDomainSyncStatus(domains[0]);
    console.log('status', {
      domain: status.domain,
      synced: status.synced,
      records: status.records.length,
      sample: status.records.slice(0, 2),
    });
  }
}

main().catch((e) => console.error(e.message));
