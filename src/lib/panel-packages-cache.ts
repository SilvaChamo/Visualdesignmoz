import type { DirectAdminPackage } from '@/lib/directadmin-api';

const CACHE_KEY = 'vd_panel_packages_v1';
const CACHE_MS = 5 * 60 * 1000;

type Payload = { at: number; packages: DirectAdminPackage[] };

export function readPackagesCache(allowStale = true): DirectAdminPackage[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Payload;
    if (!allowStale && Date.now() - parsed.at > CACHE_MS) return null;
    return Array.isArray(parsed.packages) ? parsed.packages : null;
  } catch {
    return null;
  }
}

export function writePackagesCache(packages: DirectAdminPackage[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), packages }));
  } catch {
    /* quota */
  }
}
