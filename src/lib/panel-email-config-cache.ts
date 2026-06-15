import type { EmailConfigBundle } from '@/components/admin/EmailConfigResultModal';

const CACHE_KEY = 'vd_email_config_v1';
const MAX_ENTRIES = 120;

type CacheMap = Record<string, EmailConfigBundle & { cachedAt: number }>;

function readMap(): CacheMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: CacheMap) {
  if (typeof window === 'undefined') return;
  const entries = Object.entries(map).sort((a, b) => b[1].cachedAt - a[1].cachedAt);
  const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
}

export function readEmailConfigCache(email: string): EmailConfigBundle | null {
  const key = email.trim().toLowerCase();
  const row = readMap()[key];
  if (!row) return null;
  const { cachedAt: _c, ...bundle } = row;
  return bundle;
}

export function writeEmailConfigCache(email: string, bundle: EmailConfigBundle) {
  const key = email.trim().toLowerCase();
  const map = readMap();
  map[key] = { ...bundle, cachedAt: Date.now() };
  writeMap(map);
}

export function prefetchEmailConfig(email: string) {
  if (typeof window === 'undefined' || !email.includes('@')) return;
  const key = email.trim().toLowerCase();
  if (readMap()[key]) return;
  void fetch(`/api/email-contas?config_email=${encodeURIComponent(key)}`, { credentials: 'include' })
    .then((res) => res.json())
    .then((data: EmailConfigBundle & { success?: boolean }) => {
      if (!data.success || !data.plainText) return;
      writeEmailConfigCache(key, {
        email: data.email,
        password: data.password,
        plainText: data.plainText,
        outlookFile: data.outlookFile,
        shareText: data.shareText,
      });
    })
    .catch(() => undefined);
}

export function prefetchEmailConfigs(emails: string[]) {
  for (const email of emails.slice(0, 40)) prefetchEmailConfig(email);
}
