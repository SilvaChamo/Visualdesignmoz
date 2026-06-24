import {
  defaultManagerMenuPrivileges,
  defaultResellerMenuPrivileges,
  resolveManagerMenuPrivileges,
  resolveResellerMenuPrivileges,
  type ResellerMenuPrivilegesConfig,
} from '@/lib/panel-menu-privileges';

export type PanelMenuPrivilegesRole = 'reseller' | 'manager';

const CACHE_MS = 5 * 60 * 1000;

type Payload = { at: number; privileges: ResellerMenuPrivilegesConfig };

function cacheKey(role: PanelMenuPrivilegesRole): string {
  return `vd_panel_menu_privileges_${role}_v1`;
}

function resolveForRole(
  role: PanelMenuPrivilegesRole,
  raw: ResellerMenuPrivilegesConfig,
): ResellerMenuPrivilegesConfig {
  return role === 'manager'
    ? resolveManagerMenuPrivileges(raw)
    : resolveResellerMenuPrivileges(raw);
}

function defaultsForRole(role: PanelMenuPrivilegesRole): ResellerMenuPrivilegesConfig {
  return role === 'manager' ? defaultManagerMenuPrivileges() : defaultResellerMenuPrivileges();
}

export function readPanelMenuPrivilegesCache(
  role: PanelMenuPrivilegesRole,
  allowStale = true,
): ResellerMenuPrivilegesConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(role));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Payload;
    if (!parsed?.privileges) return null;
    if (!allowStale && Date.now() - parsed.at > CACHE_MS) return null;
    return resolveForRole(role, parsed.privileges);
  } catch {
    return null;
  }
}

export function writePanelMenuPrivilegesCache(
  role: PanelMenuPrivilegesRole,
  privileges: ResellerMenuPrivilegesConfig,
) {
  if (typeof window === 'undefined') return;
  try {
    const merged = resolveForRole(role, privileges);
    sessionStorage.setItem(cacheKey(role), JSON.stringify({ at: Date.now(), privileges: merged }));
  } catch {
    /* quota */
  }
}

export function clearPanelMenuPrivilegesCache(role?: PanelMenuPrivilegesRole) {
  if (typeof window === 'undefined') return;
  try {
    if (role) {
      sessionStorage.removeItem(cacheKey(role));
      return;
    }
    (['reseller', 'manager'] as const).forEach((r) => sessionStorage.removeItem(cacheKey(r)));
  } catch {
    /* quota */
  }
}

export function defaultPanelMenuPrivilegesFromCacheOrDefaults(
  role: PanelMenuPrivilegesRole,
): ResellerMenuPrivilegesConfig {
  return readPanelMenuPrivilegesCache(role) ?? defaultsForRole(role);
}

/** @deprecated usar readPanelMenuPrivilegesCache('reseller') */
export function readResellerPrivilegesCache(allowStale = true): ResellerMenuPrivilegesConfig | null {
  return readPanelMenuPrivilegesCache('reseller', allowStale);
}

/** @deprecated usar writePanelMenuPrivilegesCache('reseller', …) */
export function writeResellerPrivilegesCache(privileges: ResellerMenuPrivilegesConfig) {
  writePanelMenuPrivilegesCache('reseller', privileges);
}

/** @deprecated usar clearPanelMenuPrivilegesCache('reseller') */
export function clearResellerPrivilegesCache() {
  clearPanelMenuPrivilegesCache('reseller');
}

/** @deprecated usar defaultPanelMenuPrivilegesFromCacheOrDefaults('reseller') */
export function defaultResellerPrivilegesFromCacheOrDefaults(): ResellerMenuPrivilegesConfig {
  return defaultPanelMenuPrivilegesFromCacheOrDefaults('reseller');
}
