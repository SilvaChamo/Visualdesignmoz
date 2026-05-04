import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

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

// Domínios hospedados no servidor CyberPanel
const CYBERPANEL_DOMAINS = [
  'visualdesigne.com', 'visualdesigne.pt',
  'anap.co.mz', 'entrecampos.co.mz',
  'aamihe.com', 'entrecampos.co.mz',
  'miv.co.mz', 'moz-servicos.com'
]

const resolveImapConfig = (email: string): { host: string; port: number; secure: boolean } => {
  if (process.env.IMAP_HOST) return { host: process.env.IMAP_HOST, port: 993, secure: true }
  const domain = email.split('@')[1]?.toLowerCase() || ''

  if (domain === 'gmail.com' || domain === 'googlemail.com') return { host: 'imap.gmail.com', port: 993, secure: true }
  if (['outlook.com', 'hotmail.com', 'hotmail.pt', 'hotmail.co.uk', 'live.com', 'live.pt', 'msn.com', 'microsoft.com'].includes(domain)) return { host: 'outlook.office365.com', port: 993, secure: true }
  if (domain === 'yahoo.com' || domain === 'yahoo.co.uk' || domain === 'ymail.com') return { host: 'imap.mail.yahoo.com', port: 993, secure: true }
  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') return { host: 'imap.mail.me.com', port: 993, secure: true }

  // Domínios no CyberPanel — usar IP directo (evita falhas DNS e instabilidade de SSL no mail.*)
  const isCyberPanel = CYBERPANEL_DOMAINS.includes(domain) || 
                      CYBERPANEL_DOMAINS.some(d => domain.endsWith('.' + d)) ||
                      domain.endsWith('.co.mz') || 
                      domain.endsWith('.mz') || domain.endsWith('.co.mz')

  if (isCyberPanel) {
    return { host: getServerHost(), port: 993, secure: true }
  }

  return { host: `mail.${domain}`, port: 993, secure: true }
}

// Cria uma conexão IMAP fresca (não persistente) por pedido
// NOTA: Pool de conexões persistentes foi removido pois contaminava o estado
// entre pedidos (ex: ler Deleted Items deixava a conexão nessa pasta;
// pedido seguinte para INBOX recebia dados do Deleted Items via fallback)
const createFreshClient = async (email: string, pass: string, cfg: any): Promise<ImapFlow | null> => {
  const client = new ImapFlow({
    host: cfg.host, port: 993, secure: true,
    auth: { user: email, pass },
    tls: { rejectUnauthorized: false },
    logger: false,
    emitLogs: false,
    socketTimeout: 15000,
    greetingTimeout: 10000
  })

  try {
    await client.connect()
    return client
  } catch (err: any) {
    console.error(`📧 [read-emails] Falha ao ligar ${email}:`, err.message)
    return null
  }
}

// Mapeamento de nomes de pastas baseado em auditoria real do Maildir do servidor:
//   Lixo    → 'Deleted Items'  (NÃO 'Trash')
//   Spam    → 'Junk' (pasta activa)
//   Enviado → 'Sent' (sem prefixo INBOX)
const FOLDER_VARIATIONS: Record<string, string[]> = {
  'sent':    ['Sent', 'Sent Items', 'Enviados', 'Enviadas', 'INBOX.Sent'],
  'trash':   ['Deleted Items', 'Trash', 'Bin', 'Lixo', 'INBOX.Deleted Items', 'INBOX.Trash'],
  'junk':    ['Junk', 'Junk E-mail', 'Spam', 'Correspondência Indesejada', 'INBOX.Junk', 'INBOX.Spam'],
  'drafts':  ['Drafts', 'Draft', 'Rascunhos', 'INBOX.Drafts'],
  'archive': ['Archive', 'Arquivados', 'Arquivo', 'INBOX.Archive'],
}

// Resolve a pasta real no servidor dado um nome standard, usando a lista já obtida
const resolveFolder = (folderPath: string, folderList: { path: string }[]): string | null => {
  const existingPaths = new Set<string>(folderList.map(m => m.path))
  const existingLowers = new Map<string, string>(folderList.map(m => [m.path.toLowerCase(), m.path]))

  const p = folderPath.toLowerCase()
  const variations: string[] = FOLDER_VARIATIONS[p] || [folderPath]

  // Adicionar o próprio folderPath como variação inicial se não estiver na lista
  if (!variations.includes(folderPath)) variations.unshift(folderPath)

  for (const v of variations) {
    if (existingPaths.has(v)) return v
    if (existingLowers.has(v.toLowerCase())) return existingLowers.get(v.toLowerCase())!
  }
  return null
}

const STANDARD_FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Junk', 'Archive']

export async function POST(req: NextRequest) {
  let client: ImapFlow | null = null

  try {
    const {
      email, password, emails: multiEmails, passwords: multiPasswords,
      allAccounts = false, folder: singleFolder, folders: foldersParam,
      page = 1, limit = 20, search = '', includeTotals = false
    } = await req.json()

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const folderTotals: Record<string, number> = {}
    const pastasParaProcessar = foldersParam && Array.isArray(foldersParam) ? foldersParam : [singleFolder || 'INBOX']

    // --- CAMINHO 1: ALL ACCOUNTS ---
    if (allAccounts && session) {
      const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '')
      const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@visualdesigne.com', 'silva.chamo@gmail.com', 'geral@visualdesigne.com']
      const isAdmin = adminEmails.includes(session.user?.email || '')
      let query = supabaseAdmin.from('email_contas').select('email, senha_cyberpanel')
      if (!isAdmin) query = query.eq('cliente_id', session.user.id)
      const { data: contas } = await query.or('status.eq.active,status.eq.activo')

      if (contas && contas.length > 0) {
        const todosEmails: any[] = []
        // Processar contas sequencialmente para evitar race conditions
        for (const conta of contas) {
          for (const folderPath of pastasParaProcessar) {
            let contaClient: ImapFlow | null = null
            try {
              if (!conta.senha_cyberpanel) continue
              const pass = decryptPassword(conta.senha_cyberpanel)
              contaClient = await createFreshClient(conta.email, pass, resolveImapConfig(conta.email))
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
          mClient = await createFreshClient(mEmail, pass, resolveImapConfig(mEmail))
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
    if (!email || !password) return NextResponse.json({ success: true, emails: [] })

    // Conexão fresca — elimina contaminação de estado entre pedidos
    client = await createFreshClient(email, password, resolveImapConfig(email))
    if (!client) {
      return NextResponse.json({
        success: false,
        error: 'Falha na ligação IMAP. Verifique as credenciais.',
        details: 'connection-failed'
      })
    }

    // Obter lista de pastas UMA VEZ e reutilizar (evita múltiplos LIST calls)
    const folderList = await client.list()
    console.log('📁 [API] Pastas no servidor:', folderList.map(m => m.path))

    const emails: any[] = []

    for (const fPath of pastasParaProcessar) {
      const realPath = resolveFolder(fPath, folderList)
      if (!realPath) {
        console.log(`📊 [API] Pasta não encontrada no servidor: ${fPath}`)
        const standardKey = STANDARD_FOLDERS.find(sf => sf.toLowerCase() === fPath.toLowerCase()) || fPath
        folderTotals[standardKey] = 0
        continue
      }

      const lock = await client.getMailboxLock(realPath)
      try {
        const mailboxInfo = (client.mailbox as any)
        const total = mailboxInfo?.exists || 0
        const itemsToFetch = pastasParaProcessar.length > 1 ? 10 : limit

        console.log(`📊 [API] ${fPath} → ${realPath}: ${total} mensagens no servidor`)

        // Contagem de não lidos para o badge da pasta activa
        try {
          const unreadRes = await client.search({ not: { seen: true } }, { uid: true })
          const unreadUids = Array.isArray(unreadRes) ? unreadRes : []
          const standardKey = STANDARD_FOLDERS.find(sf => sf.toLowerCase() === fPath.toLowerCase()) || fPath
          folderTotals[standardKey] = unreadUids.length
          console.log(`📊 [API] ${standardKey}: ${unreadUids.length} não lidos`)
        } catch (err: any) {
          const standardKey = STANDARD_FOLDERS.find(sf => sf.toLowerCase() === fPath.toLowerCase()) || fPath
          folderTotals[standardKey] = 0
        }

        // Buscar emails
        const searchSpec = search ? { or: [{ subject: search }, { from: search }, { body: search }] } : { all: true }
        let uids: number[] = []
        try {
          const searchRes = await client.search(searchSpec, { uid: true })
          uids = (Array.isArray(searchRes) ? searchRes : []).reverse().slice(0, itemsToFetch)
        } catch (err) {}

        if (uids.length > 0) {
          for await (const msg of client.fetch(uids, { envelope: true, flags: true }, { uid: true })) {
            emails.push({
              id: msg.uid, seq: msg.seq, tipo: determinarTipo(realPath), conta: email,
              assunto: msg.envelope?.subject || '(sem assunto)',
              data: msg.envelope?.date?.toISOString() || new Date().toISOString(),
              de: msg.envelope?.from?.[0]?.address || '', lido: msg.flags?.has('\\Seen') || false,
              messageId: msg.envelope?.messageId || ''
            })
          }
        } else if (total > 0 && page === 1 && !search) {
          // Fallback por sequence number quando search retorna vazio
          const start = Math.max(1, total - itemsToFetch + 1)
          for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true }, { uid: true })) {
            emails.push({
              id: msg.uid, seq: msg.seq, tipo: determinarTipo(realPath), conta: email,
              assunto: msg.envelope?.subject || '(sem assunto)',
              data: msg.envelope?.date?.toISOString() || new Date().toISOString(),
              de: msg.envelope?.from?.[0]?.address || '', lido: msg.flags?.has('\\Seen') || false,
              messageId: msg.envelope?.messageId || ''
            })
          }
        }
      } finally { lock.release() }
    }

    // Contagens das outras pastas (quando includeTotals=true)
    if (includeTotals) {
      for (const spf of STANDARD_FOLDERS) {
        if (folderTotals[spf] !== undefined) continue // já calculado

        const realPath = resolveFolder(spf.toLowerCase(), folderList)
        console.log(`📊 [API] Buscando contagem ${spf} → ${realPath}`)
        if (realPath) {
          try {
            const status = await client.status(realPath, { unseen: true })
            folderTotals[spf] = status.unseen || 0
            console.log(`📊 [API] ${spf}: ${status.unseen} não lidos`)
          } catch (e) {
            console.log(`📊 [API] ${spf}: erro ao buscar status`)
            folderTotals[spf] = 0
          }
        } else {
          folderTotals[spf] = 0
        }
      }
    }

    console.log('📊 [API] folderTotals final:', folderTotals)

    return NextResponse.json({
      success: true,
      emails: emails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
      total: emails.length,
      folderTotals,
      folders: folderList.map(m => m.path)
    })

  } catch (error: any) {
    console.error('❌ [read-emails] Erro:', error)
    return NextResponse.json({ success: true, emails: [], error: 'Erro no processamento IMAP' })
  } finally {
    // Garantir que a conexão é sempre fechada - não mantemos conexões persistentes
    if (client) {
      try { await client.logout() } catch (_) {}
    }
  }
}
