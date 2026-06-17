import type { DirectAdminPackage } from '@/lib/directadmin-api';
import type { PanelBootstrapScope } from '@/lib/panel-data-from-server';

const CACHE_MS = 5 * 60 * 1000;

type Payload = { at: number; packages: DirectAdminPackage[] };

function cacheKey(scope: PanelBootstrapScope = 'admin'): string {
  return `vd_panel_packages_v2_${scope}`;
}

export function readPackagesCache(
  scope: PanelBootstrapScope = 'admin',
  allowStale = true,
): DirectAdminPackage[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Payload;
    if (!allowStale && Date.now() - parsed.at > CACHE_MS) return null;
    return Array.isArray(parsed.packages) ? parsed.packages : null;
  } catch {
    return null;
  }
}

export function writePackagesCache(packages: DirectAdminPackage[], scope: PanelBootstrapScope = 'admin') {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(cacheKey(scope), JSON.stringify({ at: Date.now(), packages }));
  } catch {
    /* quota */
  }
}

export function clearPackagesCache(scope?: PanelBootstrapScope) {
  if (typeof window === 'undefined') return;
  try {
    if (scope) {
      sessionStorage.removeItem(cacheKey(scope));
      return;
    }
    for (const s of ['admin', 'reseller', 'client'] as const) {
      sessionStorage.removeItem(cacheKey(s));
    }
    sessionStorage.removeItem('vd_panel_packages_v2');
    sessionStorage.removeItem('vd_panel_packages_v1');
  } catch {
    /* quota */
  }
}
