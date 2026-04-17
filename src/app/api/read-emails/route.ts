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
                host: process.env.IMAP_HOST || '109.199.104.22',
                port: 993,
                secure: true,
                auth: { user: conta.email, pass: senhaDescriptada },
                tls: { rejectUnauthorized: false },
                logger: false
              })

              await client.connect()
              const lock = await client.getMailboxLock(folderPath)
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
                  const pagedUids = uids.slice(0, 10) // Limite menor para busca unificada
                  if (pagedUids.length > 0) {
                    for await (const msg of client.fetch(pagedUids, { envelope: true, flags: true }, { uid: true })) {
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
                } else if (total > 0) {
                  // Fetch headers only for high performance
                  const itemsToFetch = multiFolders ? 10 : limit
                  const start = Math.max(1, total - itemsToFetch + 1)
                  for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true })) {
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
              host: process.env.IMAP_HOST || '109.199.104.22',
              port: 993,
              secure: true,
              auth: { user: mEmail, pass: multiPasswords?.[idx] || 'Ad.Vd#2425?*' },
              tls: { rejectUnauthorized: false },
              logger: false
            })
            await client.connect()
            const lock = await client.getMailboxLock(fPath)
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
                      tipo: determinarTipo(fPath),
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
                for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true })) {
                  emailsTemp.push({
                    id: msg.uid,
                    seq: msg.seq,
                    tipo: determinarTipo(fPath),
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
      host: process.env.IMAP_HOST || '109.199.104.22',
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
        const lock = await client.getMailboxLock(fPath)
        try {
          let uids: number[] = []
          if (search) {
            // Busca no servidor
            const searchResult = await client.search({ or: [{ subject: search }, { body: search }, { from: search }, { to: search }] }, { uid: true })
            uids = Array.isArray(searchResult) ? searchResult : []
          }

          const total = client.mailbox ? client.mailbox.exists || 0 : 0
          console.log(`📧 [read-emails] Pasta ${fPath}: ${total} emails totais`)
          
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
                  tipo: determinarTipo(fPath),
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
          } else if (total > 0) {
            const itemsToFetch = multiFolders ? 10 : limit
            const start = Math.max(1, total - (page * itemsToFetch) + 1)
            const end = total - ((page - 1) * itemsToFetch)

            for await (const msg of client.fetch(`${Math.max(1, start)}:${end}`, { envelope: true, flags: true })) {
              emails.push({
                id: msg.uid,
                seq: msg.seq,
                tipo: determinarTipo(fPath),
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
      } catch (e) {
        console.error(`Erro ao ler pasta ${fPath}:`, e)
      }
    }
    await client.logout()
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
