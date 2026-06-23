import type { DbListEntry, DbMetadata, DbUserEntry } from '@/lib/da-database-types';

const STORAGE_KEY = 'vd_db_mgr_v1';
const CACHE_MS = 15 * 60 * 1000;

type DbListCache = { at: number; rows: DbListEntry[]; totalBytes: number; limit: number | null };
type DbMetaCache = { at: number; meta: DbMetadata };
type DbUsersCache = { at: number; rows: DbUserEntry[]; limit: number | null };

type Store = {
  lists?: Record<string, DbListCache>;
  meta?: Record<string, DbMetaCache>;
  users?: Record<string, DbUsersCache>;
};

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
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function fresh(at: number) {
  return Date.now() - at <= CACHE_MS;
}

export function readDbListCache(owner: string): DbListCache | null {
  if (!owner) return null;
  const row = readStore().lists?.[owner];
  if (!row || !fresh(row.at)) return null;
  return row;
}

export function writeDbListCache(owner: string, rows: DbListEntry[], totalBytes: number, limit: number | null) {
  if (!owner) return;
  const store = readStore();
  store.lists = store.lists || {};
  store.lists[owner] = { at: Date.now(), rows, totalBytes, limit };
  writeStore(store);
}

export function readDbMetaCache(database: string): DbMetadata | null {
  if (!database) return null;
  const row = readStore().meta?.[database];
  if (!row || !fresh(row.at)) return null;
  return row.meta;
}

export function writeDbMetaCache(database: string, meta: DbMetadata) {
  if (!database) return;
  const store = readStore();
  store.meta = store.meta || {};
  store.meta[database] = { at: Date.now(), meta };
  writeStore(store);
}

export function readDbUsersCache(owner: string): DbUsersCache | null {
  if (!owner) return null;
  const row = readStore().users?.[owner];
  if (!row || !fresh(row.at)) return null;
  return row;
}

export function writeDbUsersCache(owner: string, rows: DbUserEntry[], limit: number | null) {
  if (!owner) return;
  const store = readStore();
  store.users = store.users || {};
  store.users[owner] = { at: Date.now(), rows, limit };
  writeStore(store);
}

export function invalidateDbCaches(owner?: string, database?: string) {
  if (typeof window === 'undefined') return;
  const store = readStore();
  if (owner && store.lists?.[owner]) delete store.lists[owner];
  if (owner && store.users?.[owner]) delete store.users[owner];
  if (database && store.meta?.[database]) delete store.meta[database];
  writeStore(store);
}

export async function prefetchDbLists(
  owner: string,
  domain: string,
): Promise<void> {
  if (typeof window === 'undefined' || !owner || !domain) return;
  if (readDbListCache(owner)) return;
  try {
    const res = await fetch('/api/db-manager', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listDatabases', domain, owner, noSize: false }),
    });
    const data = await res.json() as {
      success?: boolean;
      data?: { rows: DbListEntry[]; totalBytes: number };
    };
    if (!data.success || !data.data) return;
    writeDbListCache(owner, data.data.rows || [], data.data.totalBytes || 0, null);
  } catch {
    /* opcional */
  }
}
