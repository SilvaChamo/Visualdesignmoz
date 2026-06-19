import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  connectImapClient,
  resolveFolder,
  getCachedFolderList,
  resolveMailboxPassword,
} from '@/lib/imap-panel-shared'

const decryptPassword = (text: string) => Buffer.from(text, 'base64').toString('utf8')

// --- HELPERS ---
const determinarTipo = (path: string) => {
  const p = path.toLowerCase()
  if (p.includes('sent') || p.includes('enviado') || p.includes('enviada')) return 'enviado'
  if (p.includes('draft') || p.includes('rascunho')) return 'rascunho'
  if (p.includes('trash') || p.includes('delete') || p.includes('lixo') || p.includes('eliminado')) return 'lixo'
  if (p.includes('junk') || p.includes('spam') || p.includes('indesejada')) return 'spam'
  if (p.includes('archive') || p.includes('arquivo') || p.includes('arquivado')) return 'arquivo'
  return 'recebido'
}

const STANDARD_FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Junk', 'Archive']

type EmailRow = {
  id: number
  seq: number
  tipo: string
  conta: string
  assunto: string
  data: string
  de: string
  lido: boolean
  messageId?: string
}

function mapFetchedMessage(msg: any, realPath: string, email: string): EmailRow {
  return {
    id: msg.uid,
    seq: msg.seq,
    tipo: determinarTipo(realPath),
    conta: email,
    assunto: msg.envelope?.subject || '(sem assunto)',
    data: msg.envelope?.date?.toISOString() || new Date().toISOString(),
    de: msg.envelope?.from?.[0]?.address || '',
    lido: msg.flags?.has('\\Seen') || false,
    messageId: msg.envelope?.messageId || '',
  }
}

async function readMessagesInOpenMailbox(
  client: ImapFlow,
  realPath: string,
  email: string,
  limit: number,
  search: string,
  page: number,
): Promise<EmailRow[]> {
  const emails: EmailRow[] = []
  const mailboxInfo = client.mailbox as { exists?: number } | false
  const total = mailboxInfo && typeof mailboxInfo === 'object' ? mailboxInfo.exists || 0 : 0

  if (!search && total > 0) {
    const start = Math.max(1, total - limit + 1)
    for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true }, { uid: true })) {
      emails.push(mapFetchedMessage(msg, realPath, email))
    }
    return emails
  }

  const searchSpec = search
    ? { or: [{ subject: search }, { from: search }, { body: search }] }
    : { all: true }
  let uids: number[] = []
  try {
    const searchRes = await client.search(searchSpec, { uid: true })
    uids = (Array.isArray(searchRes) ? searchRes : []).reverse().slice(0, limit)
  } catch {
    uids = []
  }

  if (uids.length > 0) {
    for await (const msg of client.fetch(uids, { envelope: true, flags: true }, { uid: true })) {
      emails.push(mapFetchedMessage(msg, realPath, email))
    }
  } else if (total > 0 && page === 1 && !search) {
    const start = Math.max(1, total - limit + 1)
    for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true }, { uid: true })) {
      emails.push(mapFetchedMessage(msg, realPath, email))
    }
  }
  return emails
}

export async function POST(req: NextRequest) {
  let client: ImapFlow | null = null

  try {
    const {
      email, password, emails: multiEmails, passwords: multiPasswords,
      allAccounts = false, folder: singleFolder, folders: foldersParam,
      page = 1, limit = 20, search = '', includeTotals = false, countsOnly = false
    } = await req.json()

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const folderTotals: Record<string, number> = {}
    const pastasParaProcessar = foldersParam && Array.isArray(foldersParam) ? foldersParam : [singleFolder || 'INBOX']

    // --- CAMINHO 1: ALL ACCOUNTS ---
    if (allAccounts && session) {
      const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '')
      const adminEmails = ['admin@visualdesignmoz.com', 'silva.chamo@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com']
      const isAdmin = adminEmails.includes(session.user?.email || '')
      let query = supabaseAdmin.from('email_contas').select('email, senha_servidor')
      if (!isAdmin) query = query.eq('cliente_id', session.user.id)
      const { data: contas } = await query.or('status.eq.active,status.eq.activo')

      if (contas && contas.length > 0) {
        const todosEmails: any[] = []
        // Processar contas sequencialmente para evitar race conditions
        for (const conta of contas) {
          for (const folderPath of pastasParaProcessar) {
            let contaClient: ImapFlow | null = null
            try {
              if (!conta.senha_servidor) continue
              const pass = decryptPassword(conta.senha_servidor)
              contaClient = await connectImapClient(conta.email, pass)
              if (!contaClient) continue

              const folderList = await contaClient.list()
              const realPath = resolveFolder(folderPath, folderList)
              if (!realPath) continue

              const lock = await contaClient.getMailboxLock(realPath)
              try {
                const searchSpec = search ? { or: [{ subject: search }, { from: search }] } : { all: true }
                const searchRes = await contaClient.search(searchSpec, { uid: true })
                const uids = (Array.isArray(searchRes) ? searchRes : []).reverse().slice(0, 10)
                for await (const msg of contaClient.fetch(uids, { envelope: true, flags: true }, { uid: true })) {
                  todosEmails.push({
                    id: msg.uid, seq: msg.seq, tipo: determinarTipo(realPath),
                    conta: conta.email, assunto: msg.envelope?.subject || '(sem assunto)',
                    data: msg.envelope?.date?.toISOString() || new Date().toISOString(),
                    de: msg.envelope?.from?.[0]?.address || '', lido: msg.flags?.has('\\Seen') || false
                  })
                }
              } finally { lock.release() }
            } catch (e) {
              console.error(`📧 [allAccounts] Erro em ${conta.email}/${folderPath}:`, e)
            } finally {
              if (contaClient) { try { await contaClient.logout() } catch (_) {} }
            }
          }
        }
        return NextResponse.json({
          success: true,
          emails: todosEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, limit * 2),
          folderTotals
        })
      }
    }

    // --- CAMINHO 2: MULTI EMAILS ---
    if (multiEmails && Array.isArray(multiEmails)) {
      const todosEmails: any[] = []
      for (const [idx, mEmail] of multiEmails.entries()) {
        let mClient: ImapFlow | null = null
        try {
          const pass = multiPasswords?.[idx]
          if (!pass) continue
          mClient = await connectImapClient(mEmail, pass)
          if (!mClient) continue

          const folderList = await mClient.list()
          const realPath = resolveFolder('INBOX', folderList)
          if (!realPath) continue

          const lock = await mClient.getMailboxLock(realPath)
          try {
            const mailboxInfo = (mClient.mailbox as any)
            const total = mailboxInfo?.exists || 0
            const start = Math.max(1, total - 10 + 1)
            if (total > 0) {
              for await (const msg of mClient.fetch(`${start}:${total}`, { envelope: true, flags: true }, { uid: true })) {
                todosEmails.push({
                  id: msg.uid, seq: msg.seq, tipo: 'entrada', conta: mEmail,
                  assunto: msg.envelope?.subject || '(sem assunto)',
                  data: msg.envelope?.date?.toISOString() || new Date().toISOString(),
                  de: msg.envelope?.from?.[0]?.address || '', lido: msg.flags?.has('\\Seen') || false
                })
              }
            }
          } finally { lock.release() }
        } catch (e) {
          console.error(`📧 [multi] Erro em ${mEmail}:`, e)
        } finally {
          if (mClient) { try { await mClient.logout() } catch (_) {} }
        }
      }
      return NextResponse.json({ success: true, emails: todosEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()) })
    }

    // --- CAMINHO 3: SINGLE ACCOUNT ---
    const resolvedPassword = await resolveMailboxPassword(email, password, session)
    if (!email || !resolvedPassword) {
      return NextResponse.json({
        success: false,
        error: email ? 'Credenciais não disponíveis para esta conta.' : 'Email em falta.',
        emails: [],
      })
    }

    client = await connectImapClient(email, resolvedPassword)
    if (!client) {
      return NextResponse.json({
        success: false,
        error: 'Falha na ligação IMAP. Verifique as credenciais.',
        details: 'connection-failed'
      })
    }

    if (countsOnly && includeTotals) {
      const folderList = await getCachedFolderList(client, email)
      for (const spf of STANDARD_FOLDERS) {
        const realPath = resolveFolder(spf.toLowerCase(), folderList)
        if (realPath) {
          try {
            const status = await client.status(realPath, { unseen: true })
            folderTotals[spf] = status.unseen || 0
          } catch {
            folderTotals[spf] = 0
          }
        } else {
          folderTotals[spf] = 0
        }
      }
      return NextResponse.json({ success: true, emails: [], folderTotals })
    }

    const folderList = await getCachedFolderList(client, email)
    const emails: EmailRow[] = []

    for (const fPath of pastasParaProcessar) {
      const realPath = resolveFolder(fPath, folderList)
      if (!realPath) {
        const standardKey = STANDARD_FOLDERS.find(sf => sf.toLowerCase() === fPath.toLowerCase()) || fPath
        folderTotals[standardKey] = 0
        continue
      }

      const itemsToFetch = pastasParaProcessar.length > 1 ? 10 : limit
      const lock = await client.getMailboxLock(realPath)
      try {
        if (includeTotals) {
          const standardKey = STANDARD_FOLDERS.find(sf => sf.toLowerCase() === fPath.toLowerCase()) || fPath
          try {
            const status = await client.status(realPath, { unseen: true })
            folderTotals[standardKey] = status.unseen || 0
          } catch {
            folderTotals[standardKey] = 0
          }
        }

        const fetched = await readMessagesInOpenMailbox(client, realPath, email, itemsToFetch, search, page)
        emails.push(...fetched)
      } finally {
        lock.release()
      }
    }

    if (includeTotals) {
      for (const spf of STANDARD_FOLDERS) {
        if (folderTotals[spf] !== undefined) continue
        const realPath = resolveFolder(spf.toLowerCase(), folderList)
        if (realPath) {
          try {
            const status = await client.status(realPath, { unseen: true })
            folderTotals[spf] = status.unseen || 0
          } catch {
            folderTotals[spf] = 0
          }
        } else {
          folderTotals[spf] = 0
        }
      }
    }

    return NextResponse.json({
      success: true,
      emails: emails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
      total: emails.length,
      folderTotals,
      folders: folderList.map(m => m.path)
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro no processamento IMAP'
    console.error('❌ [read-emails] Erro:', message)
    return NextResponse.json({ success: false, emails: [], error: message })
  } finally {
    // Garantir que a conexão é sempre fechada - não mantemos conexões persistentes
    if (client) {
      try { await client.logout() } catch (_) {}
    }
  }
}
