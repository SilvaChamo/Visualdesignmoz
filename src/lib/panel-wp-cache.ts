const WP_INSTALLS_CACHE_KEY = 'vd_wp_installs_v1';

type WpInstallsCachePayload = {
  at: number;
  domains: string[];
};

export function readWpInstallsCache(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(WP_INSTALLS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WpInstallsCachePayload;
    return Array.isArray(parsed.domains) ? parsed.domains : [];
  } catch {
    return [];
  }
}

export function writeWpInstallsCache(domains: string[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      WP_INSTALLS_CACHE_KEY,
      JSON.stringify({ at: Date.now(), domains }),
    );
  } catch {
    /* quota */
  }
}
