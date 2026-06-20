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
  uid?: number
  seq?: number
  bySeq?: boolean
  tipo: string
  conta: string
  assunto: string
  data: string
  de: string
  para?: string
  lido: boolean
  messageId?: string
}

function mapFetchedMessage(msg: any, realPath: string, email: string): EmailRow | null {
  const uid = typeof msg.uid === 'number' ? msg.uid : undefined
  const seq = typeof msg.seq === 'number' ? msg.seq : undefined
  const messageKey = uid != null ? uid : seq
  if (messageKey == null) return null
  return {
    id: messageKey,
    uid,
    seq,
    bySeq: uid == null && seq != null,
    tipo: determinarTipo(realPath),
    conta: email,
    assunto: msg.envelope?.subject || '(sem assunto)',
    data: msg.envelope?.date?.toISOString() || new Date().toISOString(),
    de: msg.envelope?.from?.[0]?.address || '',
    para: msg.envelope?.to?.[0]?.address || '',
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

  if (total === 0) return emails

  if (!search) {
    const fetchChunk = Math.max(limit * 3, 20)
    const start = Math.max(1, total - fetchChunk + 1)
    try {
      for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true, uid: true })) {
        if (!msg.flags?.has('\\Deleted')) {
          const row = mapFetchedMessage(msg, realPath, email)
          if (row) emails.push(row)
        }
      }
      return emails.reverse().slice(0, limit)
    } catch (err) {
      console.error(`Erro ao fazer fetch na pasta ${realPath}:`, err)
      return []
    }
  }

  // Se houver pesquisa, usamos o search
  const searchSpec: any = { and: [{ deleted: false }, { or: [{ subject: search }, { from: search }, { body: search }] }] }
  
  let uids: number[] = []
  try {
    const searchRes = await client.search(searchSpec, { uid: true })
    uids = (Array.isArray(searchRes) ? searchRes : []).reverse().slice(0, limit)
  } catch (err) {
    console.error(`Erro ao pesquisar na pasta ${realPath}:`, err)
    uids = []
  }

  if (uids.length > 0) {
    for await (const msg of client.fetch(uids, { envelope: true, flags: true }, { uid: true })) {
      const row = mapFetchedMessage(msg, realPath, email)
      if (row) emails.push(row)
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
        // PARALELIZAÇÃO CONTROLADA: Carregar as contas em blocos de 3 para não afogar o servidor
        const processarConta = async (conta: any) => {
          if (!conta.senha_servidor) return []
          let contaClient: ImapFlow | null = null
          const contaEmails: any[] = []
          try {
            const pass = decryptPassword(conta.senha_servidor)
            contaClient = await connectImapClient(conta.email, pass)
            if (!contaClient) return []

            const folderList = await contaClient.list()
            for (const folderPath of pastasParaProcessar) {
              const realPath = resolveFolder(folderPath, folderList)
              if (!realPath) continue

              const lock = await contaClient.getMailboxLock(realPath)
              try {
                // Usa a mesma função filtrada de deleted
                const result = await readMessagesInOpenMailbox(contaClient, realPath, conta.email, limit, search, page)
                contaEmails.push(...result)
              } finally {
                lock.release()
              }
            }
          } catch (e) {
            console.error(`📧 [allAccounts] Erro em ${conta.email}:`, e)
          } finally {
            if (contaClient) { try { await contaClient.logout() } catch (_) {} }
          }
          return contaEmails
        }

        const resultados: PromiseSettledResult<any[]>[] = []
        for (let i = 0; i < contas.length; i += 3) {
          const chunk = contas.slice(i, i + 3)
          resultados.push(...(await Promise.allSettled(chunk.map(processarConta))))
        }

        const todosEmails = resultados
          .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
          .map(r => r.value)
          .flat()

        return NextResponse.json({
          success: true,
          emails: todosEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, limit * 2),
          folderTotals
        })
      }
    }

    // --- CAMINHO 2: MULTI EMAILS ---
    if (multiEmails && Array.isArray(multiEmails)) {
      // PARALELIZAÇÃO CONTROLADA: Carregar as contas em blocos de 3
      const processarContaMulti = async (mEmail: string, idx: number) => {
        let mClient: ImapFlow | null = null
        const mEmails: any[] = []
        try {
          const pass = multiPasswords?.[idx]
          if (!pass) return []
          mClient = await connectImapClient(mEmail, pass)
          if (!mClient) return []

          const folderList = await mClient.list()
          for (const folderPath of pastasParaProcessar) {
            const realPath = resolveFolder(folderPath, folderList)
            if (!realPath) continue
            
            const lock = await mClient.getMailboxLock(realPath)
            try {
              const result = await readMessagesInOpenMailbox(mClient, realPath, mEmail, limit, search, page)
              mEmails.push(...result)
            } finally {
              lock.release()
            }
          }
        } catch (e) {
          console.error(`📧 [multi] Erro em ${mEmail}:`, e)
        } finally {
          if (mClient) { try { await mClient.logout() } catch (_) {} }
        }
        return mEmails
      }

      const resultados: PromiseSettledResult<any[]>[] = []
      for (let i = 0; i < multiEmails.length; i += 3) {
        const chunk = multiEmails.slice(i, i + 3)
        resultados.push(...(await Promise.allSettled(chunk.map((mEmail, localIdx) => processarContaMulti(mEmail, i + localIdx)))))
      }

      const todosEmails = resultados
        .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
        .map(r => r.value)
        .flat()

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
