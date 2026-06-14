export type PanelUsersCachePayload = {
  users: Array<{
    id: string;
    email: string;
    userName: string;
    panelRole: string;
    panelPath: string;
    state?: string;
    lastSignIn?: string | null;
    nome?: string | null;
  }>;
  counts: Record<string, number>;
};

const CACHE_KEY = 'vd_panel_users_v1';
const CACHE_MS = 300_000;

export function readPanelUsersCache(): PanelUsersCachePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: PanelUsersCachePayload };
    if (Date.now() - parsed.at > CACHE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writePanelUsersCache(data: PanelUsersCachePayload) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota */
  }
}

export function clearPanelUsersCache() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

async function waitForAuthSession(maxMs = 4000): Promise<void> {
  if (typeof window === 'undefined') return;
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const { supabase } = await import('@/lib/supabase-client');
      const { data } = await supabase.auth.getSession();
      if (data.session) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

async function fetchPanelUsersNetwork(): Promise<PanelUsersCachePayload> {
  await waitForAuthSession();

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch('/api/admin/panel-users', {
      credentials: 'include',
      signal: controller.signal,
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Falha ao carregar utilizadores');
    }
    const data: PanelUsersCachePayload = {
      users: json.users || [],
      counts: json.counts || {},
    };
    writePanelUsersCache(data);
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Cache primeiro; `fresh` ignora cache e força rede. */
export async function fetchPanelUsers(options?: { fresh?: boolean }): Promise<PanelUsersCachePayload> {
  if (!options?.fresh) {
    const cached = readPanelUsersCache();
    if (cached) return cached;
  }
  return fetchPanelUsersNetwork();
}

/** Mostra cache de imediato e actualiza em background. */
export async function fetchPanelUsersStaleWhileRevalidate(
  onUpdate: (data: PanelUsersCachePayload) => void,
): Promise<PanelUsersCachePayload | null> {
  const cached = readPanelUsersCache();
  if (cached) {
    onUpdate(cached);
    void fetchPanelUsersNetwork()
      .then(onUpdate)
      .catch(() => {});
    return cached;
  }
  try {
    const fresh = await fetchPanelUsersNetwork();
    onUpdate(fresh);
    return fresh;
  } catch {
    return cached ?? null;
  }
}
