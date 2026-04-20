import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const decryptPassword = (text: string) => Buffer.from(text, 'base64').toString('utf8')

const determinarTipo = (path: string) => {
  const p = path.toLowerCase()
  if (p.includes('sent') || p.includes('enviado')) return 'enviado'
  if (p.includes('draft') || p.includes('rascunho')) return 'rascunho'
  if (p.includes('trash') || p.includes('deleted') || p.includes('lixo')) return 'lixo'
  if (p.includes('junk') || p.includes('spam')) return 'spam'
  if (p.includes('archive') || p.includes('arquivo')) return 'arquivo'
  return 'recebido'
}

// Resolve o host e porta IMAP corretos com base no domínio do email
// Suporta Gmail, Outlook, Yahoo, iCloud e domínios CyberPanel genéricos
const resolveImapConfig = (email: string): { host: string; port: number; secure: boolean } => {
  // Se existe variável de ambiente global, usar sempre ela (override)
  if (process.env.IMAP_HOST) {
    return { host: process.env.IMAP_HOST, port: 993, secure: true }
  }

  const domain = email.split('@')[1]?.toLowerCase() || ''

  // Gmail
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { host: 'imap.gmail.com', port: 993, secure: true }
  }
  // Outlook / Hotmail / Live / Microsoft
  if (['outlook.com', 'hotmail.com', 'hotmail.pt', 'hotmail.co.uk',
       'live.com', 'live.pt', 'msn.com', 'microsoft.com'].includes(domain)) {
    return { host: 'outlook.office365.com', port: 993, secure: true }
  }
  // Yahoo
  if (domain === 'yahoo.com' || domain === 'yahoo.co.uk' || domain === 'ymail.com') {
    return { host: 'imap.mail.yahoo.com', port: 993, secure: true }
  }
  // iCloud / Apple
  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') {
    return { host: 'imap.mail.me.com', port: 993, secure: true }
  }
  // Zoho
  if (domain === 'zoho.com' || domain.endsWith('.zoho.com')) {
    return { host: 'imap.zoho.com', port: 993, secure: true }
  }
  // ProtonMail (via bridge local — só funciona com ProtonMail Bridge instalado)
  if (domain === 'protonmail.com' || domain === 'proton.me') {
    return { host: '127.0.0.1', port: 1143, secure: false }
  }

  // Genérico / CyberPanel — deriva mail.{domínio}
  return { host: `mail.${domain}`, port: 993, secure: true }
}

// Função para abrir pasta IMAP com fallback de nomes
// USA client.list() primeiro para descobrir pastas existentes — evita o loop de
// getMailboxLock() que causava "AbortError: Lock broken by another request with the steal option"
const getMailboxWithFallback = async (client: any, folderPath: string, createIfMissing: boolean = true): Promise<{ lock: any; actualPath: string } | null> => {
  console.log(`📧 [read-emails] getMailboxWithFallback chamada para: ${folderPath}`)
  const isInbox = folderPath.toUpperCase() === 'INBOX'

  try {
    // Passo 1: Listar todas as pastas existentes (1 chamada, sem risco de AbortError)
    const mailboxList = await client.list()
    const existingPaths = new Set<string>(mailboxList.map((m: any) => m.path))

    // Passo 2: Construir variações possíveis para o nome da pasta
    const variations: string[] = [folderPath]
    if (folderPath.startsWith('INBOX.')) {
      variations.push(folderPath.replace('INBOX.', ''))
    } else if (!isInbox) {
      variations.push(`INBOX.${folderPath}`)
    }
    if (folderPath.toLowerCase().includes('spam') || folderPath.toLowerCase().includes('junk')) {
      variations.push('Junk', 'INBOX.Junk', 'Spam', 'INBOX.Spam')
    }
    if (folderPath.toLowerCase().includes('trash') || folderPath.toLowerCase().includes('deleted')) {
      variations.push('Trash', 'INBOX.Trash', 'Deleted Items', 'INBOX.Deleted Items')
    }
    if (folderPath.toLowerCase().includes('sent')) {
      variations.push('Sent', 'INBOX.Sent', 'Sent Items', 'INBOX.Sent Items')
    }
    if (folderPath.toLowerCase().includes('draft')) {
      variations.push('Drafts', 'INBOX.Drafts', 'Draft', 'INBOX.Draft')
    }
    if (folderPath.toLowerCase().includes('archive')) {
      variations.push('Archive', 'INBOX.Archive', 'Archived', 'INBOX.Archived')
    }

    // Passo 3: Encontrar a primeira variação que existe no servidor
    const matchedPath = variations.find(v => existingPaths.has(v))

    if (matchedPath) {
      console.log(`📧 [read-emails] Pasta encontrada: ${matchedPath} (pedido: ${folderPath})`)
      // getMailboxLock chamado APENAS UMA VEZ — sem loop, sem risco de AbortError
      const lock = await client.getMailboxLock(matchedPath)
      return { lock, actualPath: matchedPath }
    }

    // Passo 4: Pasta não existe — criar se permitido (exceto INBOX)
    if (createIfMissing && !isInbox) {
      console.log(`📧 [read-emails] Pasta não encontrada, a criar: ${folderPath}`)
      try {
        await client.mailboxCreate(folderPath)
        console.log(`📧 [read-emails] Pasta criada: ${folderPath}`)
        const lock = await client.getMailboxLock(folderPath)
        return { lock, actualPath: folderPath }
      } catch (createErr: any) {
        console.log(`📧 [read-emails] Erro ao criar/abrir pasta: ${createErr.message}`)
        return null
      }
    }

    if (isInbox) {
      console.log(`📧 [read-emails] ERRO CRÍTICO: INBOX não encontrada no servidor IMAP!`)
    } else {
      console.log(`📧 [read-emails] Pasta não encontrada: ${folderPath}`)
    }
    return null

  } catch (e: any) {
    console.log(`📧 [read-emails] getMailboxWithFallback erro inesperado: ${e.message}`)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { 
      email, 
      password, 
      emails: multiEmails, 
      passwords: multiPasswords, 
      allAccounts = false, 
      folder: singleFolder, 
      folders: foldersParam,  // array de pastas enviado pelo frontend
      page = 1, 
      limit = 20,
      search = ''
    } = await req.json()
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const folderTotals: Record<string, number> = {}

    // Preparar lista de pastas para processar
    const pastasParaProcessar = foldersParam && Array.isArray(foldersParam) ? foldersParam : [singleFolder || 'INBOX']
    // Boolean: true apenas quando há MAIS de uma pasta (modo unificado)
    const isMultiFolders = pastasParaProcessar.length > 1

    if (allAccounts && session) {
      console.log(`📧 [read-emails] Modo allAccounts ativo para: ${session.user?.email}`)
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)
      
      // Detectar se é admin
      const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com', 'geral@visualdesigne.com', 'suporte@visualdesigne.com']
      const isAdmin = adminEmails.includes(session.user?.email || '') || session.user?.user_metadata?.role === 'admin'
      console.log(`📧 [read-emails] isAdmin: ${isAdmin}`)
      
      // Se for admin, buscar TODAS as contas ativas. Se não, apenas as do cliente
      // Suporta tanto 'active' quanto 'activo' para compatibilidade
      let query = supabaseAdmin.from('email_contas').select('email, senha_cyberpanel')
      if (!isAdmin) {
        query = query.eq('cliente_id', session.user.id)
      }
      
      const { data: contas, error: contasError } = await query.or('status.eq.active,status.eq.activo')
      
      if (contasError) {
        console.error(`📧 [read-emails] Erro ao buscar contas:`, contasError)
      }
      
      console.log(`📧 [read-emails] Contas encontradas: ${contas?.length || 0}`)
      if (contas && contas.length > 0) {
        console.log(`📧 [read-emails] Emails:`, contas.map(c => c.email))
        const todosEmails: any[] = []

        const promises = contas.flatMap(conta =>
          pastasParaProcessar.map(async (folderPath) => {
            try {
              // Verificar se a conta tem senha
              if (!conta.senha_cyberpanel) {
                console.log(`📧 [read-emails] Conta ${conta.email} sem senha, pulando...`)
                return []
              }
              
              let senhaDescriptada: string
              try {
                senhaDescriptada = decryptPassword(conta.senha_cyberpanel)
              } catch (decryptError) {
                console.error(`📧 [read-emails] Erro ao descriptografar senha de ${conta.email}:`, decryptError)
                return []
              }
              
              console.log(`📧 [read-emails] Conectando a ${conta.email}...`)
              const imapCfg = resolveImapConfig(conta.email)
              console.log(`📧 [read-emails] IMAP host: ${imapCfg.host}:${imapCfg.port}`)
              const client = new ImapFlow({
                host: imapCfg.host,
                port: imapCfg.port,
                secure: imapCfg.secure,
                auth: { user: conta.email, pass: senhaDescriptada },
                tls: { rejectUnauthorized: false },
                logger: false
              })

              await client.connect()
              const mailboxResult = await getMailboxWithFallback(client, folderPath)
              if (!mailboxResult) {
                console.error(`📧 [read-emails] Não foi possível abrir nenhuma pasta para ${folderPath}`)
                await client.logout()
                return []
              }
              const { lock, actualPath } = mailboxResult
              const emailsTemp: any[] = []

              try {
                let uids: number[] = []
                if (search) {
                  const searchResult = await client.search({ or: [{ subject: search }, { body: search }, { from: search }, { to: search }] }, { uid: true })
                  uids = Array.isArray(searchResult) ? searchResult : []
                  uids.reverse()
                }

                const total = client.mailbox && typeof client.mailbox === 'object' ? client.mailbox.exists || 0 : 0
                console.log(`📧 [read-emails] Pasta ${actualPath}: total=${total}`)
                
                if (search) {
                  const pagedUids = uids.slice(0, 10) // Limite menor para busca unificada
                  if (pagedUids.length > 0) {
                    for await (const msg of client.fetch(pagedUids, { envelope: true, flags: true }, { uid: true })) {
                      emailsTemp.push({
                        id: msg.uid,
                        seq: msg.seq,
                        tipo: determinarTipo(actualPath),
                        conta: conta.email,
                        messageId: msg.envelope?.messageId || '',
                        de: msg.envelope?.from?.[0]?.address || '',
                        deNome: msg.envelope?.from?.[0]?.name || '',
                        para: msg.envelope?.to?.[0]?.address || '',
                        assunto: msg.envelope?.subject || '(sem assunto)',
                        data: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString(),
                        lido: msg.flags?.has('\\Seen') || false,
                        preview: ''
                      })
                    }
                  }
                }

                const folderTotal = client.mailbox ? client.mailbox.exists || 0 : 0
                folderTotals[`${conta.email}:${folderPath}`] = folderTotal
                  
                if (!search) {
                  try {
                    // Tentar obter UIDs para listagem multiconta (mais estável)
                    const allUids = await client.search({ all: true }, { uid: true })
                    const uidsArray = (Array.isArray(allUids) ? allUids : []).sort((a: any, b: any) => Number(a) - Number(b))
                    const slicedUids = uidsArray.slice(-itemsToFetch).reverse()
                    
                    if (slicedUids.length > 0) {
                      for await (const msg of client.fetch(slicedUids, { envelope: true, flags: true }, { uid: true })) {
                        emailsTemp.push({
                          id: msg.uid,
                          seq: msg.seq,
                          tipo: determinarTipo(actualPath),
                          conta: conta.email,
                          messageId: msg.envelope?.messageId || '',
                          de: msg.envelope?.from?.[0]?.address || '',
                          deNome: msg.envelope?.from?.[0]?.name || '',
                          para: msg.envelope?.to?.[0]?.address || '',
                          assunto: msg.envelope?.subject || '(sem assunto)',
                          data: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString(),
                          lido: msg.flags?.has('\\Seen') || false,
                          preview: ''
                        })
                      }
                    } else if (total > 0) {
                      // Fallback para Sequence Range se UIDs falharem
                      const start = Math.max(1, total - itemsToFetch + 1)
                      for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true, uid: true })) {
                        emailsTemp.push({
                          id: msg.uid,
                          seq: msg.seq,
                          tipo: determinarTipo(actualPath),
                          conta: conta.email,
                          messageId: msg.envelope?.messageId || '',
                          de: msg.envelope?.from?.[0]?.address || '',
                          deNome: msg.envelope?.from?.[0]?.name || '',
                          para: msg.envelope?.to?.[0]?.address || '',
                          assunto: msg.envelope?.subject || '(sem assunto)',
                          data: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString(),
                          lido: msg.flags?.has('\\Seen') || false,
                          preview: ''
                        })
                      }
                    }
                  } catch (fetchError: any) {
                    console.log(`📧 [read-emails] Erro ao listar emails (multi): ${fetchError.message}`)
                  }
                }
              } finally {
                lock.release()
              }
              await client.logout()
              return emailsTemp
            } catch (e) {
              return []
            }
          })
        )

        const results = await Promise.all(promises)
        results.forEach(emails => todosEmails.push(...emails))

        // Dedupóplicação Inteligente — inclui pasta e conta para não misturar emails de pastas/contas diferentes
        const finalEmails: any[] = []
        const seenKeys = new Set()
        todosEmails.forEach(e => {
          const idKey = e.messageId ? `msgid-${e.messageId}-${e.conta}-${e.tipo}` : null
          const dateMinute = e.data ? e.data.substring(0, 16) : ''
          const fuzzyKey = `fuzzy-${e.assunto}-${e.de}-${dateMinute}-${e.conta}-${e.tipo}`
          if ((idKey && !seenKeys.has(idKey)) || (!idKey && !seenKeys.has(fuzzyKey))) {
            if (idKey) seenKeys.add(idKey)
            seenKeys.add(fuzzyKey)
            finalEmails.push(e)
          }
        })

        finalEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        console.log(`📧 [read-emails] Retornando ${finalEmails.length} emails (limitado a ${limit * 2})`)
        return NextResponse.json({ success: true, emails: finalEmails.slice(0, limit * 2), total: finalEmails.length, folderTotals })
      }
    }

    if (multiEmails && Array.isArray(multiEmails)) {
      const todosEmails: any[] = []
      const promises = multiEmails.flatMap((mEmail, idx) =>
        pastasParaProcessar.map(async (fPath) => {
          try {
            const multiImapCfg = resolveImapConfig(mEmail)
            const client = new ImapFlow({
              host: multiImapCfg.host,
              port: multiImapCfg.port,
              secure: multiImapCfg.secure,
              auth: { user: mEmail, pass: multiPasswords?.[idx] || 'Ad.Vd#2425?*' },
              tls: { rejectUnauthorized: false },
              logger: false
            })
            await client.connect()
            const mailboxResult = await getMailboxWithFallback(client, fPath)
            if (!mailboxResult) {
              console.error(`📧 [read-emails] Não foi possível abrir nenhuma pasta para ${fPath}`)
              await client.logout()
              return []
            }
            const { lock, actualPath } = mailboxResult
            const emailsTemp: any[] = []
            try {
              let uids: number[] = []
              if (search) {
                const searchResult = await client.search({ or: [{ subject: search }, { body: search }, { from: search }, { to: search }] }, { uid: true })
                uids = Array.isArray(searchResult) ? searchResult : []
                uids.reverse()
              }

              const total = client.mailbox ? client.mailbox.exists || 0 : 0
              if (search) {
                const pagedUids = uids.slice(0, 10)
                if (pagedUids.length > 0) {
                  for await (const msg of client.fetch(pagedUids, { envelope: true, flags: true }, { uid: true })) {
                    emailsTemp.push({
                      id: msg.uid,
                      seq: msg.seq,
                      tipo: determinarTipo(actualPath),
                      conta: mEmail,
                      messageId: msg.envelope?.messageId || '',
                      de: msg.envelope?.from?.[0]?.address || '',
                      deNome: msg.envelope?.from?.[0]?.name || '',
                      para: msg.envelope?.to?.[0]?.address || '',
                      assunto: msg.envelope?.subject || '(sem assunto)',
                      data: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString(),
                      lido: msg.flags?.has('\\Seen') || false,
                      preview: ''
                    })
                  }
                }
              } else if (total > 0) {
                const itemsToFetch = isMultiFolders ? 10 : limit
                const start = Math.max(1, total - itemsToFetch + 1)
                for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true, uid: true })) {
                  emailsTemp.push({
                    id: msg.uid,
                    seq: msg.seq,
                    tipo: determinarTipo(actualPath),
                    conta: mEmail,
                    messageId: msg.envelope?.messageId || '',
                    de: msg.envelope?.from?.[0]?.address || '',
                    deNome: msg.envelope?.from?.[0]?.name || '',
                    para: msg.envelope?.to?.[0]?.address || '',
                    assunto: msg.envelope?.subject || '(sem assunto)',
                    data: msg.envelope?.date?.toISOString() || '',
                    lido: msg.flags?.has('\\Seen') || false,
                    preview: ''
                  })
                }
              }
            } finally {
              lock.release()
            }
            await client.logout()
            return emailsTemp
          } catch (e) {
            return []
          }
        })
      )
      const results = await Promise.all(promises)
      results.forEach(emails => todosEmails.push(...emails))

      // Deduplicação Inteligente — inclui pasta e conta para não misturar emails de pastas/contas diferentes
      const uniqueEmails: any[] = []
      const seenKeys = new Set()
      
      todosEmails.forEach(e => {
        const idKey = e.messageId ? `msgid-${e.messageId}-${e.conta}-${e.tipo}` : null
        const dateMinute = e.data ? e.data.substring(0, 16) : ''
        const fuzzyKey = `fuzzy-${e.assunto}-${e.de}-${dateMinute}-${e.conta}-${e.tipo}`
        
        if ((idKey && !seenKeys.has(idKey)) || (!idKey && !seenKeys.has(fuzzyKey))) {
          if (idKey) seenKeys.add(idKey)
          seenKeys.add(fuzzyKey)
          uniqueEmails.push(e)
        }
      })

      uniqueEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      return NextResponse.json({ success: true, emails: uniqueEmails.slice(0, limit * 2), total: uniqueEmails.length })
    }

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email é obrigatório' }, { status: 400 })
    }

    if (!password) {
      // Detectar contas Google/Gmail e sugerir OAuth/app password
      const domain = (email || '').split('@')[1] || ''
      if (domain.toLowerCase().includes('gmail') || domain.toLowerCase().includes('google')) {
        return NextResponse.json({ success: false, error: 'Conta Google detectada - use Autenticação Google (OAuth) ou crie uma senha de app para IMAP', details: 'google-account-no-imap' }, { status: 400 })
      }
      // Sem senha configurada
      return NextResponse.json({ success: false, error: 'Configure a senha IMAP para visualizar emails', details: 'no-imap-password' }, { status: 400 })
    }

    const imapCfg = resolveImapConfig(email)
    console.log(`📧 [read-emails] Conectando ao IMAP: ${imapCfg.host}:${imapCfg.port} (${email})`)
    console.log(`📧 [read-emails] Pastas: ${pastasParaProcessar.join(', ')}`)
    
    const client = new ImapFlow({
      host: imapCfg.host,
      port: imapCfg.port,
      secure: imapCfg.secure,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false
    })

    await client.connect()
    console.log(`📧 [read-emails] Conectado ao IMAP com sucesso`)
    const emails: any[] = []

    for (const fPath of pastasParaProcessar) {
      try {
        const mailboxResult = await getMailboxWithFallback(client, fPath)
        if (!mailboxResult) {
          console.error(`📧 [read-emails] Não foi possível abrir nenhuma pasta para ${fPath}`)
          continue
        }
        const { lock, actualPath } = mailboxResult
        try {
          const total = client.mailbox ? client.mailbox.exists || 0 : 0
          folderTotals[fPath] = total
          console.log(`📧 [read-emails] Pasta ${actualPath}: ${total} emails totais`)
          
          const itemsToFetch = isMultiFolders ? 10 : limit
          let uids: number[] = []
          
          if (search) {
            try {
              const searchResult = await client.search({ or: [{ subject: search }, { body: search }, { from: search }, { to: search }] }, { uid: true })
              uids = Array.isArray(searchResult) ? searchResult : []
              uids.reverse() // Mais recentes primeiro
              
              const startIdx = (page - 1) * limit
              const pagedUids = uids.slice(startIdx, startIdx + limit)
              
              if (pagedUids.length > 0) {
                for await (const msg of client.fetch(pagedUids, { envelope: true, flags: true }, { uid: true })) {
                  emails.push({
                    id: msg.uid,
                    seq: msg.seq,
                    tipo: determinarTipo(actualPath),
                    conta: email,
                    messageId: msg.envelope?.messageId || '',
                    de: msg.envelope?.from?.[0]?.address || '',
                    deNome: msg.envelope?.from?.[0]?.name || '',
                    para: msg.envelope?.to?.[0]?.address || '',
                    assunto: msg.envelope?.subject || '(sem assunto)',
                    data: msg.envelope?.date?.toISOString() || '',
                    lido: msg.flags?.has('\\Seen') || false,
                    preview: ''
                  })
                }
              }
            } catch (searchError: any) {
              console.log(`📧 [read-emails] Erro na procura IMAP: ${searchError.message}`)
            }
          }
          
          if (!search) {
            try {
              // 1. Tentar obter UIDs (mais performante e fiável para paginação)
              const allUids = await client.search({ all: true }, { uid: true })
              const uidsArray = (Array.isArray(allUids) ? allUids : []).sort((a: any, b: any) => Number(a) - Number(b))
              
              const startIdx = Math.max(0, uidsArray.length - (page * itemsToFetch))
              const endIdx = Math.max(0, uidsArray.length - ((page - 1) * itemsToFetch))
              let slicedUids = uidsArray.slice(startIdx, endIdx).reverse()
              
              console.log(`📧 [read-emails] UIDs encontrados: ${uidsArray.length}, a processar slice: ${startIdx}:${endIdx} (página ${page})`)

              // 2. Se a pesquisa de UIDs falhar mas o mailbox disser que tem emails, usar fallback de Sequência
              if (slicedUids.length === 0 && total > 0) {
                console.log(`📧 [read-emails] Fallback para Sequence Range (search regressou vazio para total=${total})`)
                const seqStart = Math.max(1, total - (page * itemsToFetch) + 1)
                const seqEnd = Math.max(1, total - ((page - 1) * itemsToFetch))
                const fetchRange = `${seqStart}:${seqEnd}`
                
                for await (const msg of client.fetch(fetchRange, { envelope: true, flags: true }, { uid: true })) {
                  emails.push({
                    id: msg.uid,
                    seq: msg.seq,
                    tipo: determinarTipo(actualPath),
                    conta: email,
                    messageId: msg.envelope?.messageId || '',
                    de: msg.envelope?.from?.[0]?.address || '',
                    deNome: msg.envelope?.from?.[0]?.name || '',
                    para: msg.envelope?.to?.[0]?.address || '',
                    assunto: msg.envelope?.subject || '(sem assunto)',
                    data: msg.envelope?.date?.toISOString() || new Date().toISOString(),
                    lido: msg.flags?.has('\\Seen') || false,
                    preview: ''
                  })
                }
              } else if (slicedUids.length > 0) {
                // 3. Caso normal: buscar os UIDs paginados
                for await (const msg of client.fetch(slicedUids, { envelope: true, flags: true }, { uid: true })) {
                  emails.push({
                    id: msg.uid,
                    seq: msg.seq,
                    tipo: determinarTipo(actualPath),
                    conta: email,
                    messageId: msg.envelope?.messageId || '',
                    de: msg.envelope?.from?.[0]?.address || '',
                    deNome: msg.envelope?.from?.[0]?.name || '',
                    para: msg.envelope?.to?.[0]?.address || '',
                    assunto: msg.envelope?.subject || '(sem assunto)',
                    data: msg.envelope?.date?.toISOString() || new Date().toISOString(),
                    lido: msg.flags?.has('\\Seen') || false,
                    preview: ''
                  })
                }
              }
            } catch (fetchError: any) {
              console.log(`📧 [read-emails] Erro ao listar emails (single account): ${fetchError.message}`)
            }
          }
            } finally {
              lock.release()
            }
      } catch (e) {
        console.error(`Erro ao ler pasta ${fPath}:`, e)
      }
    }
    try { await client.logout() } catch (logoutErr: any) {
      console.log(`📧 [read-emails] Logout error (ignorado): ${logoutErr.message}`)
    }
    console.log(`📧 [read-emails] Total de emails carregados: ${emails.length}`)

    // Deduplicação final — inclui tipo (pasta) para não misturar emails de pastas diferentes
    const finalEmails: any[] = []
    const finalSeenKeys = new Set()
    
    emails.forEach(e => {
      const idKey = e.messageId ? `msgid-${e.messageId}-${e.conta || email}-${e.tipo}` : null
      const dateMinute = e.data ? e.data.substring(0, 16) : ''
      // Fuzzy key mais robusta incluindo assunto e remetente para evitar colisões erradas
      const assuntoNormalizado = (e.assunto || '').toLowerCase().trim()
      const remetenteNormalizado = (e.de || '').toLowerCase().trim()
      const fuzzyKey = `fuzzy-${assuntoNormalizado}-${remetenteNormalizado}-${dateMinute}-${e.conta || email}-${e.tipo}`
      
      if ((idKey && !finalSeenKeys.has(idKey)) || (!idKey && !finalSeenKeys.has(fuzzyKey))) {
        if (idKey) finalSeenKeys.add(idKey)
        finalSeenKeys.add(fuzzyKey)
        finalEmails.push(e)
      }
    })

    finalEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    console.log(`📧 [read-emails] Retornando ${finalEmails.length} emails únicos`)
    return NextResponse.json({ success: true, emails: finalEmails, total: finalEmails.length, folderTotals })
  } catch (error: any) {
    console.error('Erro ao ler emails:', error, error?.stack)
    // Melhorar mensagem de erro para o cliente
    let errorMessage = 'Erro ao conectar ao servidor de email'

    const msg = (error && (error.message || '')) as string
    if (msg.includes('Authentication failed') || msg.toLowerCase().includes('auth')) {
      errorMessage = 'Autenticação falhou - verifique a senha da conta'
    } else if (msg.toLowerCase().includes('connect') || msg.includes('ECONNREFUSED')) {
      errorMessage = 'Não foi possível conectar ao servidor IMAP - verifique se o email existe'
    } else if (msg.toLowerCase().includes('mailbox') || msg.toLowerCase().includes('mailbox')) {
      errorMessage = 'Pasta de email não encontrada'
    } else if (msg) {
      errorMessage = msg
    }

    return NextResponse.json({ success: false, error: errorMessage, details: msg }, { status: 500 })
  }
}
