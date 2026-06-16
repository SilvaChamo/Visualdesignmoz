import { ImapFlow } from 'imapflow'
import type { Session } from '@supabase/supabase-js'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { resolvePanelImapHost } from '@/lib/imap-host'
import { decryptStoredPassword } from '@/lib/panel-access-credentials'
import { resolveRoleForAuthUser } from '@/lib/server-auth-role'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

const ADMIN_EMAILS = [
  'admin@visualdesignmoz.com',
  'silva.chamo@visualdesignmoz.com',
  'silva.chamo@gmail.com',
  'geral@visualdesignmoz.com',
  'suporte@visualdesignmoz.com',
]

const HOSTED_MAIL_DOMAINS = [
  'visualdesignmoz.com',
  'visualdesigne.pt',
  'anap.co.mz',
  'entrecampos.co.mz',
  'aamihe.com',
  'miv.co.mz',
  'moz-servicos.com',
]

export const FOLDER_VARIATIONS: Record<string, string[]> = {
  sent: ['Sent', 'Sent Items', 'Enviados', 'Enviadas', 'INBOX.Sent'],
  trash: ['Deleted Items', 'Trash', 'Bin', 'Lixo', 'INBOX.Deleted Items', 'INBOX.Trash'],
  junk: ['Junk', 'Junk E-mail', 'Spam', 'Correspondência Indesejada', 'INBOX.Junk', 'INBOX.Spam'],
  drafts: ['Drafts', 'Draft', 'Rascunhos', 'INBOX.Drafts'],
  archive: ['Archive', 'Arquivados', 'Arquivo', 'INBOX.Archive'],
}

const folderListCache = new Map<string, { list: { path: string }[]; ts: number }>()
const FOLDER_LIST_CACHE_MS = 10 * 60 * 1000

export function resolveImapConfig(email: string): { host: string; port: number; secure: boolean } {
  const host = resolvePanelImapHost()
  const domain = email.split('@')[1]?.toLowerCase() || ''

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { host: 'imap.gmail.com', port: 993, secure: true }
  }
  if (
    ['outlook.com', 'hotmail.com', 'hotmail.pt', 'live.com', 'live.pt', 'msn.com'].includes(domain)
  ) {
    return { host: 'outlook.office365.com', port: 993, secure: true }
  }
  if (domain === 'yahoo.com' || domain === 'ymail.com') {
    return { host: 'imap.mail.yahoo.com', port: 993, secure: true }
  }
  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') {
    return { host: 'imap.mail.me.com', port: 993, secure: true }
  }

  const isHosted =
    HOSTED_MAIL_DOMAINS.includes(domain) ||
    HOSTED_MAIL_DOMAINS.some((d) => domain.endsWith('.' + d)) ||
    domain.endsWith('.co.mz') ||
    domain.endsWith('.mz')

  if (isHosted) return { host, port: 993, secure: true }
  return { host: `mail.${domain}`, port: 993, secure: true }
}

export async function connectImapClient(email: string, password: string): Promise<ImapFlow | null> {
  const cfg = resolveImapConfig(email)
  const client = new ImapFlow({
    host: cfg.host,
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false },
    logger: false,
    emitLogs: false,
    socketTimeout: 12000,
    greetingTimeout: 8000,
  })
  try {
    await client.connect()
    return client
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`📧 [imap] Falha ao ligar ${email}:`, message)
    return null
  }
}

export function resolveFolder(folderPath: string, folderList: { path: string }[]): string | null {
  const existingPaths = new Set(folderList.map((m) => m.path))
  const existingLowers = new Map(folderList.map((m) => [m.path.toLowerCase(), m.path]))
  const p = folderPath.toLowerCase()
  const variations: string[] = FOLDER_VARIATIONS[p] || [folderPath]
  if (!variations.includes(folderPath)) variations.unshift(folderPath)
  for (const v of variations) {
    if (existingPaths.has(v)) return v
    if (existingLowers.has(v.toLowerCase())) return existingLowers.get(v.toLowerCase())!
  }
  return null
}

export async function getCachedFolderList(client: ImapFlow, email: string) {
  const cached = folderListCache.get(email.toLowerCase())
  if (cached && Date.now() - cached.ts < FOLDER_LIST_CACHE_MS) return cached.list
  const list = await client.list()
  folderListCache.set(email.toLowerCase(), { list, ts: Date.now() })
  return list
}

export async function resolveMailboxPassword(
  email: string,
  passwordFromClient: string | undefined,
  session: Session | null,
): Promise<string | null> {
  if (passwordFromClient) return passwordFromClient
  if (!session?.user?.email) return null

  const { data: conta } = await supabaseAdmin
    .from('email_contas')
    .select('email, senha_servidor, cliente_id')
    .eq('email', email)
    .maybeSingle()

  if (!conta?.senha_servidor) return null

  const effectiveRole = await resolveRoleForAuthUser(supabaseAdmin, session.user)
  const isAdmin =
    ADMIN_EMAILS.includes(session.user.email || '') ||
    effectiveRole === 'admin' ||
    effectiveRole === 'manager'
  const sessionEmail = session.user.email.toLowerCase()
  const accountEmail = (conta.email || '').toLowerCase()
  const sameDomain =
    sessionEmail.split('@')[1] && accountEmail.endsWith(`@${sessionEmail.split('@')[1]}`)

  const canAccess =
    isAdmin ||
    effectiveRole === 'reseller' ||
    conta.cliente_id === session.user.id ||
    accountEmail === sessionEmail ||
    Boolean(sameDomain)

  if (!canAccess) return null
  return decryptStoredPassword(conta.senha_servidor)
}

function directFolderTries(folder: string): string[] {
  const p = folder.toLowerCase()
  if (p === 'inbox') return ['INBOX']
  return FOLDER_VARIATIONS[p] ? [...FOLDER_VARIATIONS[p]] : [folder]
}

/** Abre pasta com tentativas directas (sem LIST) e fallback ao cache. */
export async function withResolvedMailbox<T>(
  client: ImapFlow,
  folder: string,
  email: string,
  run: () => Promise<T>,
): Promise<T> {
  const tries = directFolderTries(folder)
  for (const path of tries) {
    try {
      const lock = await client.getMailboxLock(path)
      try {
        return await run()
      } finally {
        lock.release()
      }
    } catch {
      /* próxima variação */
    }
  }

  const list = await getCachedFolderList(client, email)
  const real = resolveFolder(folder, list)
  if (!real) throw new Error(`Pasta não encontrada: ${folder}`)
  const lock = await client.getMailboxLock(real)
  try {
    return await run()
  } finally {
    lock.release()
  }
}
