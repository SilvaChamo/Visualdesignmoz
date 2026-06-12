const DOMAIN_LIST_CACHE_KEY = 'vd_domain_mgr_list_v1';
const DOMAIN_LIST_CACHE_TTL_MS = 5 * 60 * 1000;

export type CachedDomainRow = {
  domain: string;
  adminEmail?: string;
  package?: string;
  state?: string;
  status?: string;
  owner?: string;
};

type DomainListCachePayload = {
  at: number;
  domains: CachedDomainRow[];
};

export function readDomainListCache(): CachedDomainRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(DOMAIN_LIST_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DomainListCachePayload;
    if (Date.now() - parsed.at > DOMAIN_LIST_CACHE_TTL_MS) return [];
    return Array.isArray(parsed.domains) ? parsed.domains : [];
  } catch {
    return [];
  }
}

export function writeDomainListCache(domains: CachedDomainRow[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      DOMAIN_LIST_CACHE_KEY,
      JSON.stringify({ at: Date.now(), domains }),
    );
  } catch {
    /* quota */
  }
}
