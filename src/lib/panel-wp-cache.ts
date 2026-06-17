import type { PanelBootstrapScope } from '@/lib/panel-data-from-server';

type WpInstallsCachePayload = {
  at: number;
  domains: string[];
};

function cacheKey(scope: PanelBootstrapScope = 'admin'): string {
  return `vd_wp_installs_v2_${scope}`;
}

export function readWpInstallsCache(scope: PanelBootstrapScope = 'admin'): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(cacheKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WpInstallsCachePayload;
    return Array.isArray(parsed.domains) ? parsed.domains : [];
  } catch {
    return [];
  }
}

export function writeWpInstallsCache(domains: string[], scope: PanelBootstrapScope = 'admin') {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      cacheKey(scope),
      JSON.stringify({ at: Date.now(), domains }),
    );
  } catch {
    /* quota */
  }
}

export function clearWpInstallsCache(scope?: PanelBootstrapScope) {
  if (typeof window === 'undefined') return;
  try {
    if (scope) {
      sessionStorage.removeItem(cacheKey(scope));
      return;
    }
    for (const s of ['admin', 'reseller', 'client'] as const) {
      sessionStorage.removeItem(cacheKey(s));
    }
    sessionStorage.removeItem('vd_wp_installs_v1');
  } catch {
    /* quota */
  }
}
