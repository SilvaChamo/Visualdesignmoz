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
const PASSWORD_CACHE_MS = 60 * 60 * 1000

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

export function removeEmailFromListCache(
  account: string,
  folder: string,
  emailId: string | number,
) {
  const cached = readWebmailListCache(account, folder, true)
  if (!cached?.emails?.length) return
  const id = String(emailId)
  const filtered = cached.emails.filter(
    (e) => String(e.id) !== id && String(e.uid) !== id,
  )
  writeWebmailListCache(account, folder, filtered, cached.folderTotals)
}

export function clearWebmailListCache(account: string, folder?: string) {
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
