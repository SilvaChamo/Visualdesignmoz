import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const decryptPassword = (text: string) => Buffer.from(text, 'base64').toString('utf8')

// --- SISTEMA DE PERSISTÊNCIA GLOBAL ---
// Nota: Em ambiente Next.js local/persistent, global permite manter instâncias em memória
const globalAny: any = global
globalAny.imapClients = globalAny.imapClients || new Map<string, { client: ImapFlow, lastUsed: number }>()

const getPersistentClient = async (email: string, pass: string, cfg: any): Promise<ImapFlow | null> => {
  const cacheKey = `${email}:${pass}` // Inclui senha para forçar nova se mudar
  const cached = globalAny.imapClients.get(cacheKey)

  if (cached) {
    if (cached.client.usable) {
      cached.lastUsed = Date.now()
      return cached.client
    } else {
      try { await cached.client.logout() } catch (e) {}
      globalAny.imapClients.delete(cacheKey)
    }
  }

  // Criar nova ligação se não houver cache utilizável
  const client = new ImapFlow({
    host: cfg.host, port: 993, secure: true,
    auth: { user: email, pass },
    tls: { rejectUnauthorized: false },
    logger: false,
    emitLogs: false
  })

  try {
    await client.connect()
    globalAny.imapClients.set(cacheKey, { client, lastUsed: Date.now() })
    return client
  } catch (err: any) {
    const errorPrefix = `📧 [read-emails] Falha ao ligar ${email}: `
    if (err.message.includes('Command failed')) {
      console.error(`${errorPrefix} Servidor rejeitou o login. Possível excesso de conexões ou senha incorreta.`)
    } else {
      console.error(`${errorPrefix}`, err.message)
    }
    return null
  }
}

// Limpeza de conexões inativas (a cada 5min)
if (!globalAny.cleanupInterval) {
  globalAny.cleanupInterval = setInterval(() => {
    const now = Date.now()
    const MAX_IDLE = 10 * 60 * 1000 // 10 minutos
    for (const [key, val] of globalAny.imapClients.entries()) {
      if (now - val.lastUsed > MAX_IDLE) {
        console.log(`📧 [read-emails] Fechando conexão inativa: ${key.split(':')[0]}`)
        val.client.logout().catch(() => {})
        globalAny.imapClients.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

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

const resolveImapConfig = (email: string): { host: string; port: number; secure: boolean } => {
  if (process.env.IMAP_HOST) return { host: process.env.IMAP_HOST, port: 993, secure: true }
  const domain = email.split('@')[1]?.toLowerCase() || ''
  if (domain === 'gmail.com' || domain === 'googlemail.com') return { host: 'imap.gmail.com', port: 993, secure: true }
  if (['outlook.com', 'hotmail.com', 'hotmail.pt', 'hotmail.co.uk', 'live.com', 'live.pt', 'msn.com', 'microsoft.com'].includes(domain)) return { host: 'outlook.office365.com', port: 993, secure: true }
  if (domain === 'yahoo.com' || domain === 'yahoo.co.uk' || domain === 'ymail.com') return { host: 'imap.mail.yahoo.com', port: 993, secure: true }
  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') return { host: 'imap.mail.me.com', port: 993, secure: true }
  return { host: `mail.${domain}`, port: 993, secure: true }
}

const STANDARD_FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Junk', 'Archive']

const getMailboxWithFallback = async (client: any, folderPath: string): Promise<{ lock: any; actualPath: string } | null> => {
  try {
    const mailboxList = await client.list()
    const existingPaths = new Set<string>(mailboxList.map((m: any) => m.path))
    const existingLowers = new Map<string, string>(mailboxList.map((m: any) => [m.path.toLowerCase(), m.path]))
    
    const variations: string[] = [folderPath]
    const p = folderPath.toLowerCase()

    if (p === 'sent') variations.push('Sent Items', 'Enviados', 'Enviadas', 'Itens Enviados', 'INBOX.Sent')
    else if (p === 'trash') variations.push('Trash', 'Bin', 'Deleted Items', 'Lixo', 'Itens Eliminados', 'Eliminados', 'INBOX.Trash')
    else if (p === 'spam') variations.push('Junk', 'Spam', 'Correspondência Indesejada', 'Indesejado', 'INBOX.Spam')
    else if (p === 'drafts') variations.push('Draft', 'Rascunhos', 'INBOX.Drafts')
    else if (p === 'archive') variations.push('Archive', 'Arquivados', 'Arquivo', 'INBOX.Archive')

    for (const v of variations) {
      if (existingPaths.has(v)) {
        const lock = await client.getMailboxLock(v)
        return { lock, actualPath: v }
      }
      const withInbox = `INBOX.${v}`
      if (existingPaths.has(withInbox)) {
        const lock = await client.getMailboxLock(withInbox)
        return { lock, actualPath: withInbox }
      }
      const lowerV = v.toLowerCase()
      if (existingLowers.has(lowerV)) {
        const realPath = existingLowers.get(lowerV)!
        const lock = await client.getMailboxLock(realPath)
        return { lock, actualPath: realPath }
      }
    }
    return null
  } catch (e) { return null }
}

export async function POST(req: NextRequest) {
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
        const promises = contas.flatMap(conta =>
          pastasParaProcessar.map(async (folderPath) => {
            try {
              if (!conta.senha_cyberpanel) return
              const pass = decryptPassword(conta.senha_cyberpanel)
              const client = await getPersistentClient(conta.email, pass, resolveImapConfig(conta.email))
              if (client) {
                const mailbox = await getMailboxWithFallback(client, folderPath)
                if (mailbox) {
                  const { lock, actualPath } = mailbox
                  try {
                    const mailboxExists = (client.mailbox as any)?.exists || 0
                    folderTotals[`${conta.email}:${folderPath}`] = mailboxExists
                    const searchSpec = search ? { or: [{ subject: search }, { from: search }] } : { all: true }
                    const searchRes = await client.search(searchSpec, { uid: true })
                    const uids = (Array.isArray(searchRes) ? searchRes : []).reverse().slice(0, 10)
                    for await (const msg of client.fetch(uids, { envelope: true, flags: true }, { uid: true })) {
                      todosEmails.push({ id: msg.uid, seq: msg.seq, tipo: determinarTipo(actualPath), conta: conta.email, assunto: msg.envelope?.subject || '(sem assunto)', data: msg.envelope?.date?.toISOString() || new Date().toISOString(), de: msg.envelope?.from?.[0]?.address || '', lido: msg.flags?.has('\\Seen') || false })
                    }
                  } finally { lock.release() }
                }
              }
            } catch (e) {}
          })
        )
        await Promise.all(promises)
        return NextResponse.json({ success: true, emails: todosEmails.sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, limit*2), folderTotals })
      }
    }

    // --- CAMINHO 2: MULTI EMAILS ---
    if (multiEmails && Array.isArray(multiEmails)) {
      const todosEmails: any[] = []
      const promises = multiEmails.map(async (mEmail, idx) => {
        try {
          const pass = multiPasswords?.[idx]; if (!pass) return
          const client = await getPersistentClient(mEmail, pass, resolveImapConfig(mEmail))
          if (client) {
            const mailbox = await getMailboxWithFallback(client, 'INBOX')
            if (mailbox) {
              const { lock } = mailbox
              try {
                const mailboxExists = (client.mailbox as any)?.exists || 0
                const total = mailboxExists
                const start = Math.max(1, total - 10 + 1)
                for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true }, { uid: true })) {
                  todosEmails.push({ id: msg.uid, seq: msg.seq, tipo: 'entrada', conta: mEmail, assunto: msg.envelope?.subject || '(sem assunto)', data: msg.envelope?.date?.toISOString() || new Date().toISOString(), de: msg.envelope?.from?.[0]?.address || '', lido: msg.flags?.has('\\Seen') || false })
                }
              } finally { lock.release() }
            }
          }
        } catch (e) {}
      })
      await Promise.all(promises)
      return NextResponse.json({ success: true, emails: todosEmails.sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime()) })
    }

    // --- CAMINHO 3: SINGLE ACCOUNT ---
    if (!email || !password) return NextResponse.json({ success: true, emails: [] })
    const client = await getPersistentClient(email, password, resolveImapConfig(email))

    if (!client || !client.usable) {
       return NextResponse.json({ 
         success: false, 
         error: 'Falha na ligação IMAP. O servidor pode estar ocupado ou a senha é inválida.', 
         details: 'persistent-connection-failed' 
       })
    }

    const emails: any[] = []
    try {
      for (const fPath of pastasParaProcessar) {
        const mailbox = await getMailboxWithFallback(client, fPath)
        if (!mailbox) continue
        const { lock, actualPath } = mailbox
        try {
          const mailboxExists = (client.mailbox as any)?.exists || 0
          const total = mailboxExists
          const itemsToFetch = pastasParaProcessar.length > 1 ? 10 : limit
          
          // 🔴 Buscar apenas NÃO LIDOS para contagem precisa
          let unreadUids: number[] = []
          try {
            // Sintaxe IMAP: not { seen: true } = mensagens não lidas
            const unreadRes = await client.search({ not: { seen: true } }, { uid: true })
            unreadUids = Array.isArray(unreadRes) ? unreadRes : []
            // Guardar com chave STANDARD correta (ex: 'Trash' em vez de 'INBOX.Trash')
            const standardKey = STANDARD_FOLDERS.find(sf => sf.toLowerCase() === fPath.toLowerCase()) || fPath
            folderTotals[standardKey] = unreadUids.length
            console.log(`📊 [API] Processando ${fPath} (actual: ${actualPath}) → ${standardKey}: ${unreadUids.length} não lidos`)
          } catch (err) {
            const standardKey = STANDARD_FOLDERS.find(sf => sf.toLowerCase() === fPath.toLowerCase()) || fPath
            folderTotals[standardKey] = 0
            console.log(`📊 [API] Processando ${fPath} → ${standardKey}: erro ou 0 não lidos`)
          }
          
          const searchSpec = search ? { or: [{ subject: search }, { from: search }, { body: search }] } : { all: true }
          let uids: number[] = []
          try {
            const searchRes = await client.search(searchSpec, { uid: true })
            uids = (Array.isArray(searchRes) ? searchRes : []).reverse().slice(0, itemsToFetch)
          } catch (err) {}

          if (uids.length > 0) {
            for await (const msg of client.fetch(uids, { envelope: true, flags: true }, { uid: true })) {
              emails.push({ id: msg.uid, seq: msg.seq, tipo: determinarTipo(actualPath), conta: email, assunto: msg.envelope?.subject || '(sem assunto)', data: msg.envelope?.date?.toISOString() || new Date().toISOString(), de: msg.envelope?.from?.[0]?.address || '', lido: msg.flags?.has('\\Seen') || false, messageId: msg.envelope?.messageId || '' })
            }
          } else if (total > 0 && page === 1) {
            const start = Math.max(1, total - itemsToFetch + 1)
            for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true }, { uid: true })) {
              emails.push({ id: msg.uid, seq: msg.seq, tipo: determinarTipo(actualPath), conta: email, assunto: msg.envelope?.subject || '(sem assunto)', data: msg.envelope?.date?.toISOString() || new Date().toISOString(), de: msg.envelope?.from?.[0]?.address || '', lido: msg.flags?.has('\\Seen') || false, messageId: msg.envelope?.messageId || '' })
            }
          }
        } finally { lock.release() }
      }

      if (includeTotals) {
        const mList = await client.list()
        // Criar mapa case-insensitive que reconhece variações de nomes
        const pathMap = new Map<string, string>() // lowercase → original
        const inboxPathMap = new Map<string, string>() // inbox.{lowercase} → original
        mList.forEach((m: any) => {
          const lower = m.path.toLowerCase()
          pathMap.set(lower, m.path)
          // Guardar também sem prefixo INBOX
          if (lower.startsWith('inbox.')) {
            inboxPathMap.set(lower.substring(6), m.path) // Remover 'inbox.'
          }
        })
        
        console.log('📊 [API] Pastas no servidor:', mList.map((m: any) => m.path))
        console.log('📊 [API] folderTotals antes do loop:', folderTotals)
        
        for (const spf of STANDARD_FOLDERS) {
          if (folderTotals[spf] === undefined) {
             const v = spf.toLowerCase()
             // Procurar em várias variações de nome
             let p: string | null = null
             
             // Mapeamento especial para pastas com nomes alternativos
             const nameMappings: Record<string, string[]> = {
               'Trash': ['trash', 'deleted items', 'bin', 'lixo'],
               'Junk': ['junk', 'spam', 'indesejada'],
               'Sent': ['sent', 'sent items', 'enviados'],
               'Drafts': ['drafts', 'rascunhos']
             }
             
             const variations = nameMappings[spf] || [v]
             
             for (const variation of variations) {
               // Procurar diretamente
               if (pathMap.has(variation)) {
                 p = pathMap.get(variation)!
                 break
               }
               // Procurar com prefixo INBOX
               if (pathMap.has(`inbox.${variation}`)) {
                 p = pathMap.get(`inbox.${variation}`)!
                 break
               }
             }
             
             console.log(`📊 [API] Buscando ${spf}: caminho=${p}`)
             if (p) {
               try {
                 const status = await client.status(p, { unseen: true })
                 folderTotals[spf] = status.unseen || 0
                 console.log(`📊 [API] ${spf}: ${status.unseen} não lidos`)
               } catch (e) {
                 console.log(`📊 [API] ${spf}: erro ao buscar status`, e)
               }
             } else {
               console.log(`📊 [API] ${spf}: pasta não encontrada no servidor`)
               folderTotals[spf] = 0
             }
          }
        }
        console.log('📊 [API] folderTotals final:', folderTotals)
      }
    } catch (e) {
      console.error('Erro na sessão persistente:', e)
    }

    return NextResponse.json({ success: true, emails: emails.sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime()), total: emails.length, folderTotals })
  } catch (error: any) {
    return NextResponse.json({ success: true, emails: [], error: 'Erro no processamento IMAP' })
  }
}
