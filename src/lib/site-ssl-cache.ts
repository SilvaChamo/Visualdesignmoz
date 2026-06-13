const SSL_CACHE_KEY = 'vd_site_ssl_v1';
const SSL_CACHE_TTL_MS = 30 * 60 * 1000;

type SslCachePayload = {
  at: number;
  ssl: Record<string, boolean>;
};

export function readSiteSslCache(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(SSL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SslCachePayload;
    if (Date.now() - parsed.at > SSL_CACHE_TTL_MS) return {};
    return parsed.ssl || {};
  } catch {
    return {};
  }
}

export function writeSiteSslCache(ssl: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  try {
    const existing = readSiteSslCache();
    sessionStorage.setItem(
      SSL_CACHE_KEY,
      JSON.stringify({ at: Date.now(), ssl: { ...existing, ...ssl } }),
    );
  } catch {
    /* quota */
  }
}

export function getCachedSiteSsl(domain: string): boolean | undefined {
  const ssl = readSiteSslCache();
  return ssl[domain];
}
