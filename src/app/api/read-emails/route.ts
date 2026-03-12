import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const decryptPassword = (text: string) => Buffer.from(text, 'base64').toString('utf8')

const determinarTipo = (folder: string) => {
  const f = folder.toLowerCase()
  if (f.includes('sent')) return 'enviado'
  if (f.includes('draft')) return 'rascunho'
  if (f.includes('junk') || f.includes('spam')) return 'spam'
  if (f.includes('trash') || f.includes('deleted')) return 'deletado'
  if (f.includes('archive')) return 'arquivo'
  return 'recebido'
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, emails: multiEmails, passwords: multiPasswords, allAccounts = false, folder: singleFolder, folders: multiFolders, page = 1, limit = 20 } = await req.json()
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    // Preparar lista de pastas para processar
    const pastasParaProcessar = multiFolders && Array.isArray(multiFolders) ? multiFolders : [singleFolder || 'INBOX']

    if (allAccounts && session) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)
      const { data: contas } = await supabaseAdmin.from('email_contas').select('email, senha_cyberpanel').eq('cliente_id', session.user.id).eq('status', 'activo')

      if (contas && contas.length > 0) {
        const todosEmails: any[] = []

        const promises = contas.flatMap(conta =>
          pastasParaProcessar.map(async (folderPath) => {
            try {
              const senhaDescriptada = decryptPassword(conta.senha_cyberpanel)
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
                const total = client.mailbox ? client.mailbox.exists || 0 : 0
                if (total > 0) {
                  // Fetch headers only for high performance
                  const itemsToFetch = multiFolders ? 10 : limit
                  const start = Math.max(1, total - itemsToFetch + 1)
                  for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true })) {
                    emailsTemp.push({
                      id: msg.uid,
                      seq: msg.seq,
                      tipo: determinarTipo(folderPath),
                      conta: conta.email,
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
        todosEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        return NextResponse.json({ success: true, emails: todosEmails.slice(0, limit * 2), total: todosEmails.length })
      }
    }

    if (multiEmails && Array.isArray(multiEmails)) {
      const todosEmails: any[] = []
      const promises = multiEmails.flatMap((mEmail, idx) =>
        pastasParaProcessar.map(async (fPath) => {
          try {
            const client = new ImapFlow({
              host: 'za4.mozserver.com',
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
              const total = client.mailbox ? client.mailbox.exists || 0 : 0
              if (total > 0) {
                const itemsToFetch = multiFolders ? 10 : limit
                const start = Math.max(1, total - itemsToFetch + 1)
                for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true })) {
                  emailsTemp.push({
                    id: msg.uid,
                    seq: msg.seq,
                    tipo: determinarTipo(fPath),
                    conta: mEmail,
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
      todosEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      return NextResponse.json({ success: true, emails: todosEmails.slice(0, limit * 2), total: todosEmails.length })
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e password são obrigatórios' }, { status: 400 })
    }

    const client = new ImapFlow({
      host: process.env.IMAP_HOST || '109.199.104.22',
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false
    })

    await client.connect()
    const emails: any[] = []

    for (const fPath of pastasParaProcessar) {
      try {
        const lock = await client.getMailboxLock(fPath)
        try {
          const total = client.mailbox ? client.mailbox.exists || 0 : 0
          if (total > 0) {
            const itemsToFetch = multiFolders ? 10 : limit
            const start = Math.max(1, total - (page * itemsToFetch) + 1)
            const end = total - ((page - 1) * itemsToFetch)

            for await (const msg of client.fetch(`${Math.max(1, start)}:${end}`, { envelope: true, flags: true })) {
              emails.push({
                id: msg.uid,
                seq: msg.seq,
                tipo: determinarTipo(fPath),
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

    emails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    return NextResponse.json({ success: true, emails, total: emails.length })
  } catch (error: any) {
    console.error('Erro ao ler emails:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
