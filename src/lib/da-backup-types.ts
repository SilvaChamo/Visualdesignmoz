export type BackupTab = 'full' | 'files' | 'databases' | 'emails' | 'ftp'

export type BackupItemId =
  | 'domain'
  | 'subdomain'
  | 'email'
  | 'forwarder'
  | 'autoresponder'
  | 'vacation'
  | 'list'
  | 'emailsettings'
  | 'ftp'
  | 'ftpsettings'
  | 'database'

export const BACKUP_ITEMS: { id: BackupItemId; label: string }[] = [
  { id: 'domain', label: 'Domínio' },
  { id: 'subdomain', label: 'Subdomínios' },
  { id: 'email', label: 'Contas de email' },
  { id: 'forwarder', label: 'Reencaminhadores' },
  { id: 'autoresponder', label: 'Respostas automáticas' },
  { id: 'vacation', label: 'Férias' },
  { id: 'list', label: 'Listas de email' },
  { id: 'emailsettings', label: 'Definições de email' },
  { id: 'ftp', label: 'Contas FTP' },
  { id: 'ftpsettings', label: 'Definições FTP' },
  { id: 'database', label: 'Bases de dados' },
]

export const TAB_BACKUP_ITEMS: Record<BackupTab, BackupItemId[]> = {
  full: BACKUP_ITEMS.map((i) => i.id),
  files: ['domain', 'database'],
  databases: ['database'],
  emails: ['email', 'forwarder', 'autoresponder', 'vacation', 'list', 'emailsettings'],
  ftp: ['ftp', 'ftpsettings'],
}

export const BACKUP_TABS: { id: BackupTab; label: string }[] = [
  { id: 'full', label: 'Conta completa' },
  { id: 'files', label: 'Ficheiros' },
  { id: 'databases', label: 'Bases de dados' },
  { id: 'emails', label: 'Email' },
  { id: 'ftp', label: 'Contas FTP' },
]

export type BackupFileRow = {
  filename: string
  size: string
  sizeBytes: number
  date: string
  path: string
  scope: BackupTab
  source: 'server' | 'bucket'
  domain?: string
  bucketPath?: string
}

/** Determina o tab de backup a partir dos itens incluídos no ficheiro. */
export function inferBackupScope(items: BackupItemId[]): BackupTab {
  if (!items.length) return 'full'
  const set = new Set(items)
  const allFull = BACKUP_ITEMS.every((i) => set.has(i.id))
  if (allFull || items.length >= 9) return 'full'

  const emailOnly = TAB_BACKUP_ITEMS.emails
  const ftpOnly = TAB_BACKUP_ITEMS.ftp
  const dbOnly = TAB_BACKUP_ITEMS.databases
  const filesOnly = TAB_BACKUP_ITEMS.files

  if (items.every((i) => emailOnly.includes(i)) && items.some((i) => emailOnly.includes(i))) return 'emails'
  if (items.every((i) => ftpOnly.includes(i)) && items.some((i) => ftpOnly.includes(i))) return 'ftp'
  if (items.every((i) => dbOnly.includes(i))) return 'databases'
  if (set.has('domain') && set.has('database') && items.every((i) => filesOnly.includes(i))) return 'files'
  if (set.has('database') && !set.has('domain')) return 'databases'
  return 'full'
}
