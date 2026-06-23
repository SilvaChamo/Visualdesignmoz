export type FmDirCacheRow = {
  name: string;
  isDir?: boolean;
  isLink?: boolean;
  size?: number;
  permissions?: string;
  date?: string;
};

const STORAGE_KEY = 'vd_fm_dirs_v1';
const MAX_ENTRIES = 64;
const CACHE_MS = 20 * 60 * 1000;

type Store = Record<string, { at: number; files: FmDirCacheRow[] }>;

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(store).sort((a, b) => b[1].at - a[1].at);
    const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota */
  }
}

export function readFmDirCache(path: string, allowStale = true): FmDirCacheRow[] | null {
  if (!path || typeof window === 'undefined') return null;
  try {
    const store = readStore();
    const row = store[path];
    if (!row || !Array.isArray(row.files)) return null;
    if (!allowStale && Date.now() - row.at > CACHE_MS) return null;
    return row.files;
  } catch {
    return null;
  }
}

export function writeFmDirCache(path: string, files: FmDirCacheRow[]) {
  if (!path || typeof window === 'undefined') return;
  try {
    const store = readStore();
    store[path] = { at: Date.now(), files };
    writeStore(store);
  } catch {
    /* quota */
  }
}

export function invalidateFmDirCache(path: string) {
  if (!path || typeof window === 'undefined') return;
  try {
    const store = readStore();
    if (!store[path]) return;
    delete store[path];
    writeStore(store);
  } catch {
    /* quota */
  }
}

export function invalidateFmDirCaches(paths: string[]) {
  if (typeof window === 'undefined') return;
  try {
    const store = readStore();
    let changed = false;
    for (const p of paths) {
      if (p && store[p]) {
        delete store[p];
        changed = true;
      }
    }
    if (changed) writeStore(store);
  } catch {
    /* quota */
  }
}

export function prefetchFmDir(path: string): void {
  if (!path || typeof window === 'undefined') return;
  if (readFmDirCache(path)) return;
  void fetch('/api/server-exec', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'listDirectory', params: { path } }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data?.success && Array.isArray(data.data?.files)) {
        writeFmDirCache(path, data.data.files);
      }
    })
    .catch(() => undefined);
}
