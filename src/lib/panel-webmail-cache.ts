export type WebmailAccountRow = {
  email: string
  name: string
  domain: string
  password?: string
  tipo: 'webmail' | 'google' | 'hotmail' | 'imported'
}

const STORAGE_KEY = 'panel_webmail_accounts_v1'
const LIST_PREFIX = 'panel_webmail_list_v1'
const BODY_PREFIX = 'panel_webmail_body_v1'
const CACHE_MS = 5 * 60 * 1000
const LIST_CACHE_MS = 2 * 60 * 1000
const BODY_CACHE_MS = 30 * 60 * 1000

let memoryCache: { accounts: WebmailAccountRow[]; ts: number } | null = null

export function mapEmailContasToWebmailAccounts(contas: any[]): WebmailAccountRow[] {
  return contas.map((c) => ({
    email: c.email,
    name: c.nome_conta || c.nome || c.email.split('@')[0],
    domain: c.email.split('@')[1],
    password: c.password_smtp || undefined,
    tipo: (c.tipo_conta || 'webmail') as WebmailAccountRow['tipo'],
  }))
}

export function readWebmailAccountsCache(): WebmailAccountRow[] | null {
  if (memoryCache && Date.now() - memoryCache.ts < CACHE_MS && memoryCache.accounts.length > 0) {
    return memoryCache.accounts
  }
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { accounts, ts } = JSON.parse(raw) as { accounts: WebmailAccountRow[]; ts: number }
    if (!accounts?.length || Date.now() - ts > CACHE_MS) return null
    return accounts
  } catch {
    return null
  }
}

export function writeWebmailAccountsCache(accounts: WebmailAccountRow[]) {
  memoryCache = { accounts, ts: Date.now() }
  if (typeof window === 'undefined') return
  try {
    const safe = accounts.map(({ email, name, domain, tipo }) => ({ email, name, domain, tipo }))
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts: safe, ts: Date.now() }))
  } catch {
    /* quota */
  }
}

export function pickDefaultWebmailAccount(
  accounts: WebmailAccountRow[],
  userEmail?: string | null,
): string {
  const preferred = accounts.find((a) => a.email === 'silva.chamo@visualdesignmoz.com')
  const user = userEmail ? accounts.find((a) => a.email === userEmail) : null
  return preferred?.email || user?.email || accounts[0]?.email || ''
}

const listCacheKey = (account: string, folder: string) =>
  `${LIST_PREFIX}:${account}:${folder}`

export function readWebmailListCache(
  account: string,
  folder: string,
  allowStale = false,
): { emails: any[]; folderTotals?: Record<string, number> } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(listCacheKey(account, folder))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { emails: any[]; folderTotals?: Record<string, number>; ts: number }
    if (!allowStale && Date.now() - parsed.ts > LIST_CACHE_MS) return null
    return { emails: parsed.emails, folderTotals: parsed.folderTotals }
  } catch {
    return null
  }
}

export function writeWebmailListCache(
  account: string,
  folder: string,
  emails: any[],
  folderTotals?: Record<string, number>,
) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      listCacheKey(account, folder),
      JSON.stringify({ emails, folderTotals, ts: Date.now() }),
    )
  } catch {
    /* quota */
  }
}

const bodyCacheKey = (account: string, folder: string, uid: string | number) =>
  `${BODY_PREFIX}:${account}:${folder}:${uid}`

export function readWebmailBodyCache(
  account: string,
  folder: string,
  uid: string | number,
): { corpo: string; anexos?: unknown[] } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(bodyCacheKey(account, folder, uid))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { corpo: string; anexos?: unknown[]; ts: number }
    if (Date.now() - parsed.ts > BODY_CACHE_MS) return null
    return { corpo: parsed.corpo, anexos: parsed.anexos }
  } catch {
    return null
  }
}

export function writeWebmailBodyCache(
  account: string,
  folder: string,
  uid: string | number,
  corpo: string,
  anexos?: unknown[],
) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      bodyCacheKey(account, folder, uid),
      JSON.stringify({ corpo, anexos, ts: Date.now() }),
    )
  } catch {
    /* quota */
  }
}
