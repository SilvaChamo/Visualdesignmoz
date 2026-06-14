const DNS_CACHE_PREFIX = 'vd_panel_dns_v1:';

export type CachedDnsRow = {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
};

type DnsCachePayload = {
  at: number;
  records: CachedDnsRow[];
};

export function readDnsCache(domain: string, allowStale = true): CachedDnsRow[] {
  if (typeof window === 'undefined' || !domain) return [];
  try {
    const raw = sessionStorage.getItem(`${DNS_CACHE_PREFIX}${domain.toLowerCase()}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DnsCachePayload;
    if (!Array.isArray(parsed.records)) return [];
    return parsed.records;
  } catch {
    return [];
  }
}

export function writeDnsCache(domain: string, records: CachedDnsRow[]) {
  if (typeof window === 'undefined' || !domain) return;
  try {
    sessionStorage.setItem(
      `${DNS_CACHE_PREFIX}${domain.toLowerCase()}`,
      JSON.stringify({ at: Date.now(), records }),
    );
  } catch {
    /* quota */
  }
}
