import { writeDnsCache, type CachedDnsRow } from '@/lib/panel-dns-cache';
import { writeRegistrarDomainListCache } from '@/lib/panel-domain-list-cache';

export function prefetchRegistrarDomains() {
  if (typeof window === 'undefined') return;
  void fetch('/api/registrar/account/domains', { credentials: 'include' })
    .then((res) => res.json())
    .then((data: { success?: boolean; domains?: { domain: string; status?: string; expireDate?: string }[] }) => {
      if (!data.success || !Array.isArray(data.domains)) return;
      writeRegistrarDomainListCache(
        data.domains.map((d) => ({
          domain: d.domain,
          state: d.status || 'Active',
          status: d.status,
          expireDate: d.expireDate,
        })),
      );
    })
    .catch(() => undefined);
}

export function prefetchDnsForDomain(domain: string) {
  if (typeof window === 'undefined' || !domain.trim()) return;
  void fetch(`/api/panel-dns?domain=${encodeURIComponent(domain.trim())}`, { credentials: 'include' })
    .then((res) => res.json())
    .then((data: { success?: boolean; records?: { id?: string; name?: string; type?: string; content?: string; ttl?: number }[] }) => {
      if (!data.success || !Array.isArray(data.records)) return;
      const rows: CachedDnsRow[] = data.records.map((r) => ({
        id: String(r.id || `${r.name}-${r.type}-${r.content}`),
        name: String(r.name || ''),
        type: String(r.type || '').toUpperCase(),
        content: String(r.content || ''),
        ttl: Number(r.ttl) || 0,
      }));
      writeDnsCache(domain.trim(), rows);
    })
    .catch(() => undefined);
}
