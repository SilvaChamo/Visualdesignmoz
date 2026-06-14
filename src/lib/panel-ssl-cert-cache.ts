const SSL_CERT_CACHE_PREFIX = 'vd_ssl_cert_v1:';
const SSL_HOSTS_CACHE_PREFIX = 'vd_ssl_hosts_v1:';
const SSL_PANEL_CACHE_TTL_MS = 5 * 60 * 1000;

export type CachedSslCert = {
  subject?: string;
  issuer?: string;
  dates?: string;
  serial?: string;
  keyType?: string;
  dnsNames?: string;
  certificate?: string;
  privateKey?: string;
};

type CertPayload = {
  at: number;
  cert: CachedSslCert;
};

type HostsPayload = {
  at: number;
  hostSsl: Record<string, boolean>;
  renewalDate?: string;
};

export function readSslCertCache(hostname: string, allowStale = true): CachedSslCert | null {
  if (typeof window === 'undefined' || !hostname) return null;
  try {
    const raw = sessionStorage.getItem(`${SSL_CERT_CACHE_PREFIX}${hostname.toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CertPayload;
    if (!allowStale && Date.now() - parsed.at > SSL_PANEL_CACHE_TTL_MS) return null;
    return parsed.cert || null;
  } catch {
    return null;
  }
}

export function writeSslCertCache(hostname: string, cert: CachedSslCert) {
  if (typeof window === 'undefined' || !hostname) return;
  try {
    sessionStorage.setItem(
      `${SSL_CERT_CACHE_PREFIX}${hostname.toLowerCase()}`,
      JSON.stringify({ at: Date.now(), cert }),
    );
  } catch {
    /* quota */
  }
}

export function readSslHostsCache(domain: string, allowStale = true): HostsPayload | null {
  if (typeof window === 'undefined' || !domain) return null;
  try {
    const raw = sessionStorage.getItem(`${SSL_HOSTS_CACHE_PREFIX}${domain.toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HostsPayload;
    if (!allowStale && Date.now() - parsed.at > SSL_PANEL_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSslHostsCache(domain: string, payload: Omit<HostsPayload, 'at'>) {
  if (typeof window === 'undefined' || !domain) return;
  try {
    sessionStorage.setItem(
      `${SSL_HOSTS_CACHE_PREFIX}${domain.toLowerCase()}`,
      JSON.stringify({ at: Date.now(), ...payload }),
    );
  } catch {
    /* quota */
  }
}
