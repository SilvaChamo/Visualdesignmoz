/** Cache persistente (sessionStorage) para secções WordPress do painel. */

export type WpInstallCacheRow = {
  domain: string;
  wpVersion?: string;
  path?: string;
};

export type WpPluginCacheRow = {
  name: string;
  title?: string;
  status: string;
  version: string;
  update: string | null;
  update_version?: string;
};

type InstallsCache = { at: number; installs: WpInstallCacheRow[] };
type PluginsCache = {
  at: number;
  plugins: WpPluginCacheRow[];
  wpVersion: string | null;
};

const INSTALLS_KEY = 'vd_wp_installs_v1';
const PLUGINS_KEY_PREFIX = 'vd_wp_plugins_v2:';
const INSTALLS_TTL_MS = 5 * 60 * 1000;
const PLUGINS_TTL_MS = 10 * 60 * 1000;

function pluginsKey(domain: string) {
  return `${PLUGINS_KEY_PREFIX}${domain.toLowerCase()}`;
}

export function readWpInstallsCache(): WpInstallCacheRow[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(INSTALLS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InstallsCache;
    if (Date.now() - parsed.at > INSTALLS_TTL_MS) return null;
    return parsed.installs;
  } catch {
    return null;
  }
}

export function writeWpInstallsCache(installs: WpInstallCacheRow[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      INSTALLS_KEY,
      JSON.stringify({ at: Date.now(), installs }),
    );
  } catch {
    /* quota */
  }
}

export function readWpPluginsCache(domain: string): PluginsCache | null {
  if (typeof window === 'undefined' || !domain) return null;
  try {
    const raw = sessionStorage.getItem(pluginsKey(domain));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PluginsCache;
    if (Date.now() - parsed.at > PLUGINS_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWpPluginsCache(
  domain: string,
  plugins: WpPluginCacheRow[],
  wpVersion: string | null,
) {
  if (typeof window === 'undefined' || !domain) return;
  try {
    sessionStorage.setItem(
      pluginsKey(domain),
      JSON.stringify({ at: Date.now(), plugins, wpVersion }),
    );
  } catch {
    /* quota */
  }
}

export function invalidateWpPluginsCache(domain?: string) {
  if (typeof window === 'undefined') return;
  try {
    if (domain) {
      sessionStorage.removeItem(pluginsKey(domain));
      return;
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PLUGINS_KEY_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function clearWpPanelCache() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(INSTALLS_KEY);
    invalidateWpPluginsCache();
  } catch {
    /* ignore */
  }
}
