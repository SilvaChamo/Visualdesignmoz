// Shared localStorage store — ALL panel data
// Works without Supabase tables — persists across page refreshes in same browser

export const LS_SITES_KEY  = 'cp_sites_v1'
export const LS_USERS_KEY  = 'cp_users_v1'
export const LS_PKGS_KEY   = 'cp_packages_v1'
export const LS_CONTAS_KEY = 'cp_contas_v1'
export const LS_EMAILS_KEY = 'cp_emails_v1'
export const LS_SUBS_KEY   = 'cp_subdomains_v1'
export const LS_DBS_KEY    = 'cp_databases_v1'
export const LS_FTP_KEY    = 'cp_ftp_v1'
export const LS_DNS_KEY    = 'cp_dns_v1'

function lsGet<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function lsSet(key: string, data: any[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

// ── Sites ──────────────────────────────────────────────────────────────────────
export function cpGetSites() { return lsGet<any>(LS_SITES_KEY) }
export function cpSaveSite(domain: string, extra: Record<string, any> = {}) {
  const list = cpGetSites()
  const idx = list.findIndex((s: any) => s.domain === domain)
  const entry = { domain, adminEmail: '', package: 'Default', owner: 'admin', status: 'Active', diskUsage: '', bandwidthUsage: '', ...extra }
  if (idx >= 0) list[idx] = entry; else list.push(entry)
  lsSet(LS_SITES_KEY, list)
}
export function cpRemoveSite(domain: string) {
  lsSet(LS_SITES_KEY, cpGetSites().filter((s: any) => s.domain !== domain))
}

// ── Users ──────────────────────────────────────────────────────────────────────
export function cpGetUsers() { return lsGet<any>(LS_USERS_KEY) }
export function cpSaveUser(userName: string, extra: Record<string, any> = {}) {
  const list = cpGetUsers()
  const idx = list.findIndex((u: any) => u.userName === userName)
  const entry = { userName, firstName: '', lastName: '', email: '', acl: 'user', websitesLimit: 10, status: 'Active', ...extra }
  if (idx >= 0) list[idx] = entry; else list.push(entry)
  lsSet(LS_USERS_KEY, list)
}
export function cpRemoveUser(userName: string) {
  lsSet(LS_USERS_KEY, cpGetUsers().filter((u: any) => u.userName !== userName))
}

// ── Packages ───────────────────────────────────────────────────────────────────
export function cpGetPackages() { return lsGet<any>(LS_PKGS_KEY) }
export function cpSavePackages(pkgs: any[]) { lsSet(LS_PKGS_KEY, pkgs) }
export function cpSavePackage(packageName: string, extra: Record<string, any> = {}) {
  const list = cpGetPackages()
  const idx = list.findIndex((p: any) => p.packageName === packageName)
  const entry = { packageName, diskSpace: 1000, bandwidth: 10000, emailAccounts: 10, dataBases: 1, ftpAccounts: 1, allowedDomains: 1, ...extra }
  if (idx >= 0) list[idx] = entry; else list.push(entry)
  lsSet(LS_PKGS_KEY, list)
}
export function cpRemovePackage(packageName: string) {
  lsSet(LS_PKGS_KEY, cpGetPackages().filter((p: any) => p.packageName !== packageName))
}

// ── Accounts / Contas ──────────────────────────────────────────────────────────
export function cpGetContas() { return lsGet<any>(LS_CONTAS_KEY) }
export function cpSaveConta(username: string, extra: Record<string, any> = {}) {
  const list = cpGetContas()
  const idx = list.findIndex((c: any) => c.username === username)
  const entry = { username, domain: '', email: '', plan: 'Default', status: 'active', createdAt: new Date().toISOString(), ...extra }
  if (idx >= 0) list[idx] = entry; else list.push(entry)
  lsSet(LS_CONTAS_KEY, list)
}
export function cpRemoveConta(username: string) {
  lsSet(LS_CONTAS_KEY, cpGetContas().filter((c: any) => c.username !== username))
}

// ── Emails ─────────────────────────────────────────────────────────────────────
export function cpGetEmails(domain?: string) {
  const all = lsGet<any>(LS_EMAILS_KEY)
  return domain ? all.filter((e: any) => e.domain === domain) : all
}
export function cpSaveEmail(domain: string, emailUser: string, extra: Record<string, any> = {}) {
  const list = lsGet<any>(LS_EMAILS_KEY)
  const fullEmail = `${emailUser}@${domain}`
  const idx = list.findIndex((e: any) => e.email === fullEmail)
  const entry = { email: fullEmail, domain, emailUser, quota: '1024', usage: '0', ...extra }
  if (idx >= 0) list[idx] = entry; else list.push(entry)
  lsSet(LS_EMAILS_KEY, list)
}
export function cpRemoveEmail(fullEmail: string) {
  lsSet(LS_EMAILS_KEY, lsGet<any>(LS_EMAILS_KEY).filter((e: any) => e.email !== fullEmail))
}

// ── Subdomains ─────────────────────────────────────────────────────────────────
export function cpGetSubdomains(domain?: string) {
  const all = lsGet<any>(LS_SUBS_KEY)
  return domain ? all.filter((s: any) => s.domain === domain) : all
}
export function cpSaveSubdomain(domain: string, subdomain: string, path = '') {
  const list = lsGet<any>(LS_SUBS_KEY)
  const key = `${subdomain}.${domain}`
  const idx = list.findIndex((s: any) => s.subdomain === key)
  const entry = { subdomain: key, domain, path }
  if (idx >= 0) list[idx] = entry; else list.push(entry)
  lsSet(LS_SUBS_KEY, list)
}
export function cpRemoveSubdomain(subdomain: string) {
  lsSet(LS_SUBS_KEY, lsGet<any>(LS_SUBS_KEY).filter((s: any) => s.subdomain !== subdomain))
}

// ── Databases ──────────────────────────────────────────────────────────────────
export function cpGetDatabases(domain?: string) {
  const all = lsGet<any>(LS_DBS_KEY)
  return domain ? all.filter((d: any) => d.domain === domain) : all
}
export function cpSaveDatabase(domain: string, dbName: string, dbUser: string) {
  const list = lsGet<any>(LS_DBS_KEY)
  const idx = list.findIndex((d: any) => d.dbName === dbName && d.domain === domain)
  const entry = { domain, dbName, dbUser }
  if (idx >= 0) list[idx] = entry; else list.push(entry)
  lsSet(LS_DBS_KEY, list)
}
export function cpRemoveDatabase(domain: string, dbName: string) {
  lsSet(LS_DBS_KEY, lsGet<any>(LS_DBS_KEY).filter((d: any) => !(d.domain === domain && d.dbName === dbName)))
}

// ── FTP ────────────────────────────────────────────────────────────────────────
export function cpGetFTP(domain?: string) {
  const all = lsGet<any>(LS_FTP_KEY)
  return domain ? all.filter((f: any) => f.domain === domain) : all
}
export function cpSaveFTP(domain: string, userName: string, path = '') {
  const list = lsGet<any>(LS_FTP_KEY)
  const idx = list.findIndex((f: any) => f.userName === userName && f.domain === domain)
  const entry = { domain, userName, path }
  if (idx >= 0) list[idx] = entry; else list.push(entry)
  lsSet(LS_FTP_KEY, list)
}
export function cpRemoveFTP(domain: string, userName: string) {
  lsSet(LS_FTP_KEY, lsGet<any>(LS_FTP_KEY).filter((f: any) => !(f.domain === domain && f.userName === userName)))
}

// ── DNS Records ────────────────────────────────────────────────────────────────
export function cpGetDNS(domain?: string) {
  const all = lsGet<any>(LS_DNS_KEY)
  return domain ? all.filter((r: any) => r.domain === domain) : all
}
export function cpSaveDNS(domain: string, record: { name: string; type: string; value: string; ttl: string }) {
  const list = lsGet<any>(LS_DNS_KEY)
  list.push({ domain, ...record, id: Date.now().toString() })
  lsSet(LS_DNS_KEY, list)
}
export function cpRemoveDNS(id: string) {
  lsSet(LS_DNS_KEY, lsGet<any>(LS_DNS_KEY).filter((r: any) => r.id !== id))
}

// ── WordPress ──────────────────────────────────────────────────────────────────
export function cpMarkWPInstalled(domain: string, wpTitle = '', wpUser = '') {
  cpSaveSite(domain, { wpInstalled: true, wpTitle, wpUser, wpInstalledAt: new Date().toISOString() })
}
export function cpIsWPInstalled(domain: string): boolean {
  return cpGetSites().some((s: any) => s.domain === domain && s.wpInstalled === true)
}
