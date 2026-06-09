import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

// Domínios hospedados no servidor
const HOSTED_MAIL_DOMAINS = ['visualdesignmoz.com', 'visualdesignmoz.com', 'visualdesigne.pt', 'anap.co.mz', 'entrecampos.co.mz', 'aamihe.com']

const resolveImapHost = (email: string): string => {
  if (process.env.IMAP_HOST) return process.env.IMAP_HOST
  const domain = email.split('@')[1]?.toLowerCase() || ''
  if (HOSTED_MAIL_DOMAINS.includes(domain) || HOSTED_MAIL_DOMAINS.some(d => domain.endsWith('.' + d))) {
    return getServerHost() // IP directo — evita falhas DNS
  }
  return `mail.${domain}`
}

// Mapeamento de pastas (igual ao read-emails/route.ts)
// Baseado em auditoria real do Maildir: Lixo='Deleted Items', Spam='Junk', Enviado='Sent'
const FOLDER_VARIATIONS: Record<string, string[]> = {
  'sent':    ['Sent', 'Sent Items', 'Enviados', 'INBOX.Sent'],
  'trash':   ['Deleted Items', 'Trash', 'Bin', 'Lixo', 'INBOX.Deleted Items', 'INBOX.Trash'],
  'junk':    ['Junk', 'Junk E-mail', 'Spam', 'INBOX.Junk', 'INBOX.Spam'],
  'drafts':  ['Drafts', 'Draft', 'Rascunhos', 'INBOX.Drafts'],
  'archive': ['Archive', 'Arquivados', 'Arquivo', 'INBOX.Archive'],
}

const resolveRealFolder = (folderPath: string, folderList: { path: string }[]): string => {
  const existingPaths = new Set<string>(folderList.map(m => m.path))
  const existingLowers = new Map<string, string>(folderList.map(m => [m.path.toLowerCase(), m.path]))

  const p = folderPath.toLowerCase()
  const variations: string[] = FOLDER_VARIATIONS[p] || [folderPath]
  if (!variations.includes(folderPath)) variations.unshift(folderPath)

  for (const v of variations) {
    if (existingPaths.has(v)) return v
    if (existingLowers.has(v.toLowerCase())) return existingLowers.get(v.toLowerCase())!
  }
  // Se não encontrou, retornar o valor original (melhor erro explícito do que pasta errada)
  return folderPath
}

export async function POST(req: NextRequest) {
  let client: ImapFlow | null = null
  try {
    const { email, password, emailId, folder } = await req.json()

    if (!email || !password || !emailId || !folder) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios em falta' }, { status: 400 })
    }

    const host = resolveImapHost(email)

    client = new ImapFlow({
      host,
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false,
      emitLogs: false,
      socketTimeout: 15000,
      greetingTimeout: 10000
    })

    await client.connect()

    // Resolver pasta real a partir da lista do servidor
    const folderList = await client.list()
    const realFolder = resolveRealFolder(folder, folderList)
    console.log(`📧 [read-email-detail] Pasta solicitada: ${folder} → Real: ${realFolder}`)

    const lock = await client.getMailboxLock(realFolder)
    let emailDetail = null

    try {
      const msg = await client.fetchOne(emailId, { source: true }, { uid: true })
      if (msg && msg.source) {
        const parsed = await simpleParser(msg.source)
        emailDetail = {
          corpo: parsed.html || parsed.text || '',
          anexos: parsed.attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size
          }))
        }
      }
    } finally {
      lock.release()
    }

    return NextResponse.json({ success: true, ...emailDetail })
  } catch (error: any) {
    console.error('❌ [read-email-detail] Erro:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    if (client) { try { await client.logout() } catch (_) {} }
  }
}
