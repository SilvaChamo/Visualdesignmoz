import { dynadotAPI } from '@/lib/dynadot-adapter';
import { deleteCloudflareZone } from '@/lib/cloudflare-dns';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { getMirrorSiteOwner } from '@/lib/panel-mirror-read';
import { deleteMirrorSite } from '@/lib/panel-mirror-write';
import { deleteHostingWebDomain, getProviderByUsername } from '@/lib/hosting-provider';

/** Domínios criados por testes de API/sandbox — nunca contas reais. */
export function isRegistrarTestDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  return (
    /^vdtsh[a-z0-9]+\./i.test(d) ||
    /^vdtest[-_]/i.test(d) ||
    /^claude-[a-z0-9-]+-\d{10,}\./i.test(d)
  );
}

function alreadyGone(error?: string): boolean {
  const t = (error || '').toLowerCase();
  return (
    t.includes('not found') ||
    t.includes('not exist') ||
    t.includes('doesn\'t exist') ||
    t.includes('no such') ||
    t.includes('unknown domain')
  );
}

export async function purgeRegistrarTestDomains(): Promise<{
  deleted: string[];
  errors: string[];
}> {
  const names = new Set<string>();

  const listed = await dynadotAPI.listAllDomains();
  if (listed.success) {
    for (const row of listed.domains) {
      if (isRegistrarTestDomain(row.domain)) names.add(row.domain.toLowerCase());
    }
  }

  const sb = getDaSyncAdmin();
  if (sb) {
    const [{ data: sites }, { data: renewals }, { data: hosting }] = await Promise.all([
      sb.from('panel_sites').select('domain'),
      sb.from('domain_renewals').select('domain_name'),
      sb.from('hosting_renewals').select('domain_name'),
    ]);
    for (const row of sites || []) {
      const domain = String(row.domain || '').toLowerCase();
      if (isRegistrarTestDomain(domain)) names.add(domain);
    }
    for (const row of renewals || []) {
      const domain = String(row.domain_name || '').toLowerCase();
      if (isRegistrarTestDomain(domain)) names.add(domain);
    }
    for (const row of hosting || []) {
      const domain = String(row.domain_name || '').toLowerCase();
      if (isRegistrarTestDomain(domain)) names.add(domain);
    }
  }

  const deleted: string[] = [];
  const errors: string[] = [];

  for (const domain of [...names].sort()) {
    const registrar = await dynadotAPI.graceDeleteDomain(domain);
    if (!registrar.success && !alreadyGone(registrar.error)) {
      errors.push(`${domain} (registador): ${registrar.error}`);
    }

    const cf = await deleteCloudflareZone(domain);
    if (!cf.ok) errors.push(`${domain} (cloudflare): ${cf.error}`);

    const owner = await getMirrorSiteOwner(domain);
    if (owner) {
      try {
        const provider = await getProviderByUsername(owner);
        const host = await deleteHostingWebDomain(provider, owner, domain);
        if (!host.ok && !alreadyGone(host.error)) {
          errors.push(`${domain} (servidor): ${host.error}`);
        }
      } catch (error) {
        errors.push(`${domain} (servidor): ${error instanceof Error ? error.message : 'falha'}`);
      }
    }

    await deleteMirrorSite(domain);
    if (sb) {
      await sb.from('domain_renewals').delete().eq('domain_name', domain);
      await sb.from('hosting_renewals').delete().eq('domain_name', domain);
    }

    if (registrar.success || alreadyGone(registrar.error)) {
      deleted.push(domain);
    }
  }

  return { deleted, errors };
}
