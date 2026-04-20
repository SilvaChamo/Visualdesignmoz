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
      folders: multiFolders, 
      page = 1, 
      limit = 20,
      search = '' // Novo parâmetro de busca
    } = await req.json()
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    // Preparar lista de pastas para processar
    const pastasParaProcessar = multiFolders && Array.isArray(multiFolders) ? multiFolders : [singleFolder || 'INBOX']

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
              const client = new ImapFlow({
                host: process.env.IMAP_HOST || 'mail.visualdesigne.com',
                port: 993,
                secure: true,
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
                } else if (total > 0 || total === 0) {
                  // Fetch headers only for high performance
                  // Workaround: quando total é 0 (bug CyberPanel), tentar fetch de 1:50
                  const itemsToFetch = total > 0 
                    ? (multiFolders ? 10 : limit)
                    : 50; // fallback: tentar 50 emails quando total reporta 0
                  const start = total > 0 
                    ? Math.max(1, total - itemsToFetch + 1)
                    : 1;
                  const end = total > 0 ? total : itemsToFetch;
                  console.log(`📧 [read-emails] Fetch range: ${start}:${end} (total=${total}, itemsToFetch=${itemsToFetch})`)
                  for await (const msg of client.fetch(`${start}:${end}`, { envelope: true, flags: true, uid: true })) {
                    emailsTemp.push({
                      id: msg.uid,
                      seq: msg.seq,
                      tipo: determinarTipo(folderPath),
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

        // Deduplicação Inteligente
        const finalEmails: any[] = []
        const seenKeys = new Set()
        todosEmails.forEach(e => {
          const idKey = e.messageId ? `msgid-${e.messageId}` : null
          const dateMinute = e.data ? e.data.substring(0, 16) : ''
          const fuzzyKey = `fuzzy-${e.assunto}-${e.de}-${dateMinute}`
          if ((idKey && !seenKeys.has(idKey)) || (!idKey && !seenKeys.has(fuzzyKey))) {
            if (idKey) seenKeys.add(idKey)
            seenKeys.add(fuzzyKey)
            finalEmails.push(e)
          }
        })

        finalEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        console.log(`📧 [read-emails] Retornando ${finalEmails.length} emails (limitado a ${limit * 2})`)
        return NextResponse.json({ success: true, emails: finalEmails.slice(0, limit * 2), total: finalEmails.length })
      }
    }

    if (multiEmails && Array.isArray(multiEmails)) {
      const todosEmails: any[] = []
      const promises = multiEmails.flatMap((mEmail, idx) =>
        pastasParaProcessar.map(async (fPath) => {
          try {
            const client = new ImapFlow({
              host: process.env.IMAP_HOST || 'mail.visualdesigne.com',
              port: 993,
              secure: true,
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
                const itemsToFetch = multiFolders ? 10 : limit
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

      // Deduplicação Inteligente (Message-ID ou Assunto + Data truncada ao minuto)
      const uniqueEmails: any[] = []
      const seenKeys = new Set()
      
      todosEmails.forEach(e => {
        // Chave 1: Message-ID (se existir)
        const idKey = e.messageId ? `msgid-${e.messageId}` : null
        
        // Chave 2: Fuzzy Key (Assunto + Remetente + Data/Minuto)
        const dateMinute = e.data ? e.data.substring(0, 16) : '' // YYYY-MM-DDTHH:mm
        const fuzzyKey = `fuzzy-${e.assunto}-${e.de}-${dateMinute}`
        
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

    console.log(`📧 [read-emails] Conectando ao IMAP: ${process.env.IMAP_HOST || '109.199.104.22'}:${993}`)
    console.log(`📧 [read-emails] Email: ${email}, Pastas: ${pastasParaProcessar.join(', ')}`)
    
    const client = new ImapFlow({
      host: process.env.IMAP_HOST || 'mail.visualdesigne.com',
      port: 993,
      secure: true,
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
          let uids: number[] = []
          if (search) {
            // Busca no servidor — protegido com try/catch para não deixar sessão IMAP inconsistente
            try {
              const searchResult = await client.search({ or: [{ subject: search }, { body: search }, { from: search }, { to: search }] }, { uid: true })
              uids = Array.isArray(searchResult) ? searchResult : []
            } catch (searchError: any) {
              console.log(`📧 [read-emails] Busca IMAP falhou (retornando vazio): ${searchError.message}`)
              uids = []
            }
          }

          const total = client.mailbox ? client.mailbox.exists || 0 : 0
          console.log(`📧 [read-emails] Pasta ${actualPath}: ${total} emails totais`)
          
          // WORKAROUND: CyberPanel às vezes reporta 0 emails mesmo quando existem
          // Sempre tentamos buscar emails, mesmo com total=0
          const itemsToFetch = multiFolders ? 10 : limit
          
          if (search) {
            // Se for busca, ordenamos os UIDs (mais recentes primeiro) e paginamos
            uids.reverse()
            const startIdx = (page - 1) * limit
            const pagedUids = uids.slice(startIdx, startIdx + limit)
            
            if (pagedUids.length > 0) {
              for await (const msg of client.fetch(pagedUids, { envelope: true, flags: true }, { uid: true })) {
                emails.push({
                  id: msg.uid,
                  seq: msg.seq,
                  tipo: determinarTipo(actualPath),
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
          } else {
            // Sempre tentar buscar emails, mesmo com total=0
            const start = Math.max(1, total - (page * itemsToFetch) + 1)
            const end = Math.max(total, itemsToFetch) // Garantir que end >= itemsToFetch quando total=0
            const fetchRange = total > 0 ? `${start}:${end}` : `1:${itemsToFetch}`
            
            console.log(`📧 [read-emails] Fetch range: ${fetchRange} (total=${total}, itemsToFetch=${itemsToFetch})`)
            
            try {
              // Obter UIDs reais primeiro
              const allUids = await client.search({ all: true }, { uid: true })
              const uidsArray = Array.isArray(allUids) ? allUids : []
              const slicedUids = uidsArray.slice(-itemsToFetch)
              if (slicedUids.length > 0) {
              for await (const msg of client.fetch(slicedUids, { envelope: true, flags: true }, { uid: true })) {
                emails.push({
                  id: msg.uid,
                  seq: msg.seq,
                  tipo: determinarTipo(actualPath),
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
            } catch (fetchError: any) {
              // Se der erro no fetch (pasta vazia), apenas logamos
              console.log(`📧 [read-emails] Fetch retornou vazio ou erro: ${fetchError.message} | stack: ${fetchError.stack} | code: ${fetchError.code} | response: ${JSON.stringify(fetchError.response)}`)
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

    // Deduplicação final inteligente
    const finalEmails: any[] = []
    const finalSeenKeys = new Set()
    
    emails.forEach(e => {
      const idKey = e.messageId ? `msgid-${e.messageId}` : null
      const dateMinute = e.data ? e.data.substring(0, 16) : ''
      const fuzzyKey = `fuzzy-${e.assunto}-${e.de}-${dateMinute}`
      
      if ((idKey && !finalSeenKeys.has(idKey)) || (!idKey && !finalSeenKeys.has(fuzzyKey))) {
        if (idKey) finalSeenKeys.add(idKey)
        finalSeenKeys.add(fuzzyKey)
        finalEmails.push(e)
      }
    })

    finalEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    console.log(`📧 [read-emails] Retornando ${finalEmails.length} emails únicos`)
    return NextResponse.json({ success: true, emails: finalEmails, total: finalEmails.length })
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
