export type WebmailAccountRow = {
  email: string
  name: string
  domain: string
  password?: string
  tipo: 'webmail' | 'google' | 'hotmail' | 'imported'
}

const STORAGE_KEY = 'panel_webmail_accounts_v1'
const LIST_PREFIX = 'panel_webmail_list_v3'
const BODY_PREFIX = 'panel_webmail_body_v1'
const TOTALS_PREFIX = 'panel_webmail_totals_v1'
const CACHE_MS = 15 * 60 * 1000
const LIST_CACHE_MS = 15 * 60 * 1000
const TOTALS_CACHE_MS = 30 * 60 * 1000
const BODY_CACHE_MS = 60 * 60 * 1000
const PASSWORD_CACHE_MS = 60 * 60 * 1000

export const WEBMAIL_STANDARD_FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Junk', 'Archive'] as const

let memoryCache: { accounts: WebmailAccountRow[]; ts: number } | null = null
const passwordMemoryCache: Record<string, { password: string; ts: number }> = {}

export const SYSTEM_MAIL_DOMAINS = ['visualdesignmoz.com', 'anap.co.mz', 'entrecampos.co.mz']

export function readCachedMailboxPassword(email: string): string | null {
  const row = passwordMemoryCache[email.toLowerCase()]
  if (row && Date.now() - row.ts < PASSWORD_CACHE_MS) return row.password
  return null
}

export function writeCachedMailboxPassword(email: string, password: string) {
  if (!email || !password) return
  passwordMemoryCache[email.toLowerCase()] = { password, ts: Date.now() }
}

export async function fetchMailboxPassword(email: string): Promise<string | null> {
  const cached = readCachedMailboxPassword(email)
  if (cached) return cached
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/api/email-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (data.success && data.senha) {
      writeCachedMailboxPassword(email, data.senha)
      return data.senha
    }
  } catch {
    /* ignore */
  }
  return null
}

function hydrateAccountPasswords(accounts: WebmailAccountRow[]): WebmailAccountRow[] {
  return accounts.map((a) => {
    const pwd = a.password || readCachedMailboxPassword(a.email)
    return pwd ? { ...a, password: pwd } : a
  })
}

export function sortWebmailAccountsForAdmin(accounts: WebmailAccountRow[]): WebmailAccountRow[] {
  return [...accounts].sort((a, b) => {
    const aSys = SYSTEM_MAIL_DOMAINS.includes(a.domain) ? 0 : 1
    const bSys = SYSTEM_MAIL_DOMAINS.includes(b.domain) ? 0 : 1
    if (aSys !== bSys) return aSys - bSys
    if (a.domain !== b.domain) return a.domain.localeCompare(b.domain)
    return a.email.localeCompare(b.email)
  })
}

export function groupWebmailAccountsForSelect(accounts: WebmailAccountRow[]): {
  label: string
  accounts: WebmailAccountRow[]
}[] {
  const sorted = sortWebmailAccountsForAdmin(accounts)
  const system = sorted.filter((a) => SYSTEM_MAIL_DOMAINS.includes(a.domain))
  const other = sorted.filter((a) => !SYSTEM_MAIL_DOMAINS.includes(a.domain))
  const groups: { label: string; accounts: WebmailAccountRow[] }[] = []
  if (system.length) groups.push({ label: 'Contas do sistema', accounts: system })
  if (other.length) groups.push({ label: 'Outras contas', accounts: other })
  if (!groups.length && sorted.length) groups.push({ label: 'Contas', accounts: sorted })
  return groups
}

export function mapEmailContasToWebmailAccounts(contas: any[]): WebmailAccountRow[] {
  return contas.map((c) => {
    const password = c.password_smtp || undefined
    if (password) writeCachedMailboxPassword(c.email, password)
    return {
      email: c.email,
      name: c.nome_conta || c.nome || c.email.split('@')[0],
      domain: c.email.split('@')[1],
      password,
      tipo: (c.tipo_conta || 'webmail') as WebmailAccountRow['tipo'],
    }
  })
}

export function readWebmailAccountsCache(): WebmailAccountRow[] | null {
  if (memoryCache && Date.now() - memoryCache.ts < CACHE_MS && memoryCache.accounts.length > 0) {
    return hydrateAccountPasswords(memoryCache.accounts)
  }
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { accounts, ts } = JSON.parse(raw) as { accounts: WebmailAccountRow[]; ts: number }
    if (!accounts?.length || Date.now() - ts > CACHE_MS) return null
    return hydrateAccountPasswords(accounts)
  } catch {
    return null
  }
}

/** Cache expirado — só para mostrar o selector de imediato enquanto actualiza em background. */
export function readWebmailAccountsCacheStale(): WebmailAccountRow[] | null {
  if (memoryCache?.accounts.length) return hydrateAccountPasswords(memoryCache.accounts)
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { accounts } = JSON.parse(raw) as { accounts: WebmailAccountRow[]; ts: number }
    return accounts?.length ? hydrateAccountPasswords(accounts) : null
  } catch {
    return null
  }
}

export function writeWebmailAccountsCache(accounts: WebmailAccountRow[]) {
  accounts.forEach((a) => {
    if (a.password) writeCachedMailboxPassword(a.email, a.password)
  })
  memoryCache = { accounts: accounts.map((a) => ({ ...a })), ts: Date.now() }
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
  preferredEmail?: string | null,
): string {
  if (preferredEmail) {
    const pref = accounts.find((a) => a.email === preferredEmail)
    if (pref) return pref.email
  }
  const silva = accounts.find((a) => a.email === 'silva.chamo@visualdesignmoz.com')
  const user = userEmail ? accounts.find((a) => a.email === userEmail) : null
  return silva?.email || user?.email || accounts[0]?.email || ''
}

const listCacheKey = (account: string, folder: string) =>
  `${LIST_PREFIX}:${account}:${folder}`

type ListCacheEntry = { emails: any[]; folderTotals?: Record<string, number>; ts: number }
const listMemoryCache: Record<string, ListCacheEntry> = {}
const totalsMemoryCache: Record<string, { totals: Record<string, number>; ts: number }> = {}
const bodyMemoryCache: Record<string, { corpo: string; anexos?: unknown[]; ts: number }> = {}

function isListCacheFresh(entry: ListCacheEntry, allowStale: boolean) {
  return allowStale || Date.now() - entry.ts <= LIST_CACHE_MS
}

export function isWebmailListCacheFresh(account: string, folder: string): boolean {
  const key = listCacheKey(account, folder)
  const mem = listMemoryCache[key]
  if (mem) return Date.now() - mem.ts <= LIST_CACHE_MS
  if (typeof window === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return false
    const parsed = JSON.parse(raw) as ListCacheEntry
    return Date.now() - parsed.ts <= LIST_CACHE_MS
  } catch {
    return false
  }
}

export function readWebmailFolderTotalsCache(
  account: string,
  allowStale = false,
): Record<string, number> | null {
  const key = account.toLowerCase()
  const mem = totalsMemoryCache[key]
  if (mem && (allowStale || Date.now() - mem.ts <= TOTALS_CACHE_MS)) return mem.totals
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${TOTALS_PREFIX}:${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { totals: Record<string, number>; ts: number }
    if (!allowStale && Date.now() - parsed.ts > TOTALS_CACHE_MS) return null
    totalsMemoryCache[key] = parsed
    return parsed.totals
  } catch {
    return null
  }
}

export function writeWebmailFolderTotalsCache(account: string, totals: Record<string, number>) {
  if (!account || !totals || !Object.keys(totals).length) return
  const key = account.toLowerCase()
  const entry = { totals, ts: Date.now() }
  totalsMemoryCache[key] = entry
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`${TOTALS_PREFIX}:${key}`, JSON.stringify(entry))
  } catch {
    /* quota */
  }
}

export function readWebmailListCache(
  account: string,
  folder: string,
  allowStale = false,
): { emails: any[]; folderTotals?: Record<string, number> } | null {
  const key = listCacheKey(account, folder)
  const mem = listMemoryCache[key]
  if (mem && isListCacheFresh(mem, allowStale)) {
    return { emails: mem.emails, folderTotals: mem.folderTotals }
  }
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ListCacheEntry
    if (!isListCacheFresh(parsed, allowStale)) return null
    listMemoryCache[key] = parsed
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
  const key = listCacheKey(account, folder)
  const entry: ListCacheEntry = { emails, folderTotals, ts: Date.now() }
  listMemoryCache[key] = entry
  if (folderTotals && Object.keys(folderTotals).length > 0) {
    writeWebmailFolderTotalsCache(account, folderTotals)
  }
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key, JSON.stringify(entry))
  } catch {
    /* quota */
  }
}

export function getWebmailMessageId(email: {
  id?: unknown
  uid?: unknown
  seq?: unknown
}): string | null {
  const raw =
    typeof email.uid === 'number'
      ? email.uid
      : typeof email.id === 'number'
        ? email.id
        : typeof email.seq === 'number'
          ? email.seq
          : null
  if (raw === null) return null
  return String(raw)
}

export function isSameWebmailMessage(
  a: { id?: unknown; uid?: unknown; seq?: unknown },
  b: { id?: unknown; uid?: unknown; seq?: unknown },
): boolean {
  const idA = getWebmailMessageId(a)
  const idB = getWebmailMessageId(b)
  return idA !== null && idB !== null && idA === idB
}

export function decrementWebmailFolderUnread(
  account: string,
  folder: string,
): Record<string, number> {
  const existing = readWebmailFolderTotalsCache(account, true) || {}
  const next = {
    ...existing,
    [folder]: Math.max(0, (existing[folder] || 0) - 1),
  }
  writeWebmailFolderTotalsCache(account, next)
  return next
}

export function markEmailReadInListCache(
  account: string,
  folder: string,
  emailId: string | number,
): Record<string, number> | null {
  if (emailId === undefined || emailId === null || emailId === '') return null
  const targetId = String(emailId)
  if (targetId === 'undefined' || targetId === 'null') return null

  const cached = readWebmailListCache(account, folder, true)
  if (!cached?.emails?.length) return null
  let changed = false
  const updated = cached.emails.map((e) => {
    if (getWebmailMessageId(e) !== targetId) return e
    if (e.lido) return e
    changed = true
    return { ...e, lido: true }
  })
  if (!changed) return null
  const nextTotals = decrementWebmailFolderUnread(account, folder)
  writeWebmailListCache(account, folder, updated, nextTotals)
  return nextTotals
}

const bodyPrefetchInFlight = new Set<string>()

export function prefetchWebmailBody(
  account: string,
  folder: string,
  email: { uid?: number; id?: number; seq?: number; bySeq?: boolean },
): void {
  if (typeof window === 'undefined') return
  const msgId = getWebmailMessageId(email)
  if (!msgId) return
  const key = `${account}:${folder}:${msgId}`
  if (bodyPrefetchInFlight.has(key)) return
  if (readWebmailBodyCache(account, folder, msgId)?.corpo) return

  bodyPrefetchInFlight.add(key)
  void fetch('/api/read-email-detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email: account,
      emailId: Number(msgId),
      folder,
      bySeq: Boolean(email.bySeq),
      markRead: false,
    }),
  })
    .then((r) => r.json())
    .then((data: { success?: boolean; corpo?: string; anexos?: unknown[] }) => {
      if (data.success) {
        writeWebmailBodyCache(account, folder, msgId, data.corpo || '', data.anexos)
      }
    })
    .catch(() => undefined)
    .finally(() => {
      bodyPrefetchInFlight.delete(key)
    })
}

export function prefetchWebmailBodies(
  account: string,
  folder: string,
  emails: { uid?: number; id?: number; seq?: number; bySeq?: boolean }[],
  limit = 6,
): void {
  for (const email of emails.slice(0, limit)) {
    prefetchWebmailBody(account, folder, email)
  }
}

export function markWebmailEmailReadOnServer(
  account: string,
  folder: string,
  emailId: string | number,
  bySeq?: boolean,
): void {
  if (typeof window === 'undefined') return
  void fetch('/api/read-email-detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email: account,
      emailId: Number(emailId),
      folder,
      bySeq: Boolean(bySeq),
      markReadOnly: true,
      markRead: true,
    }),
  }).catch(() => undefined)
}

export function removeEmailFromListCache(
  account: string,
  folder: string,
  emailId: string | number,
) {
  const cached = readWebmailListCache(account, folder, true)
  if (!cached?.emails?.length) return
  const targetId = String(emailId)
  const filtered = cached.emails.filter((e) => getWebmailMessageId(e) !== targetId)
  writeWebmailListCache(account, folder, filtered, cached.folderTotals)
}

export function clearWebmailListCache(account: string, folder?: string) {
  if (folder) {
    delete listMemoryCache[listCacheKey(account, folder)]
  } else {
    const prefix = `${LIST_PREFIX}:${account}:`
    for (const key of Object.keys(listMemoryCache)) {
      if (key.startsWith(prefix)) delete listMemoryCache[key]
    }
  }
  if (typeof window === 'undefined') return
  try {
    if (folder) {
      sessionStorage.removeItem(listCacheKey(account, folder))
      return
    }
    const prefix = `${LIST_PREFIX}:${account}:`
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}

const bodyCacheKey = (account: string, folder: string, uid: string | number) =>
  `${BODY_PREFIX}:${account}:${folder}:${uid}`

export function readWebmailBodyCache(
  account: string,
  folder: string,
  uid: string | number,
): { corpo: string; anexos?: unknown[] } | null {
  const key = bodyCacheKey(account, folder, uid)
  const mem = bodyMemoryCache[key]
  if (mem && Date.now() - mem.ts <= BODY_CACHE_MS) {
    return { corpo: mem.corpo, anexos: mem.anexos }
  }
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { corpo: string; anexos?: unknown[]; ts: number }
    if (Date.now() - parsed.ts > BODY_CACHE_MS) return null
    bodyMemoryCache[key] = parsed
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
  const key = bodyCacheKey(account, folder, uid)
  const entry = { corpo, anexos, ts: Date.now() }
  bodyMemoryCache[key] = entry
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key, JSON.stringify(entry))
  } catch {
    /* quota */
  }
}
