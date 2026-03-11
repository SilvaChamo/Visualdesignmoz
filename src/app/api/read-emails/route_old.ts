import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const decryptPassword = (text: string) => Buffer.from(text, 'base64').toString('utf8')

export async function POST(req: NextRequest) {
  try {
    const { email, password, emails: multiEmails, passwords: multiPasswords, allAccounts = false, folder = 'INBOX', page = 1, limit = 20 } = await req.json()
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (allAccounts && session) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)
      const { data: contas } = await supabaseAdmin.from('email_contas').select('email, senha_cyberpanel').eq('cliente_id', session.user.id).eq('status', 'activo')

      if (contas && contas.length > 0) {
        const todosEmails: any[] = []
        
        const promises = contas.map(async (conta) => {
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
            const lock = await client.getMailboxLock(folder)
            const emailsTemp: any[] = []

            try {
              const total = client.mailbox ? client.mailbox.exists || 0 : 0
              if (total > 0) {
                const start = Math.max(1, total - limit + 1)
                for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true })) {
                  emailsTemp.push({
                    id: msg.uid,
                    seq: msg.seq,
                    conta: conta.email,
                    de: msg.envelope?.from?.[0]?.address || '',
                    deNome: msg.envelope?.from?.[0]?.name || '',
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
            console.error(`Erro ao ler ${conta.email} na pasta ${folder}:`, e)
            return []
          }
        })

        const resultados = await Promise.all(promises)
        resultados.forEach(emails => todosEmails.push(...emails))

        todosEmails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        
        return NextResponse.json({
          success: true,
          emails: todosEmails.slice(0, limit * 2),
          total: todosEmails.length,
          modo: 'todas-contas',
          folder: folder
        })
      }
    }

    if (multiEmails && Array.isArray(multiEmails)) {
      const todosEmails: any[] = []
      for (let i = 0; i < multiEmails.length; i++) {
        try {
          // Tentar conectar ao MozServer primeiro
          const client = new ImapFlow({
            host: 'za4.mozserver.com',  // MozServer em vez de Contabo
            port: 993,
            secure: true,
            auth: { user: multiEmails[i], pass: multiPasswords?.[i] || 'Ad.Vd#2425?*' },
            tls: { rejectUnauthorized: false },
            logger: false
          })
          await client.connect()
          const lock = await client.getMailboxLock('INBOX')
          try {
            const total = client.mailbox ? client.mailbox.exists || 0 : 0
            if (total > 0) {
              const start = Math.max(1, total - limit + 1)
              for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true })) {
                todosEmails.push({
                  id: msg.uid,
                  seq: msg.seq,
                  conta: multiEmails[i],
                  de: msg.envelope?.from?.[0]?.address || '',
                  deNome: msg.envelope?.from?.[0]?.name || '',
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
        } catch (e) {
          console.error(`Erro ao ler ${multiEmails[i]} no MozServer:`, e)
          // Tentar fallback para Contabo se MozServer falhar
          try {
            const fallbackClient = new ImapFlow({
              host: process.env.IMAP_HOST || '109.199.104.22',
              port: 993,
              secure: true,
              auth: { user: multiEmails[i], pass: multiPasswords?.[i] || 'Ad.Vd#2425?*' },
              tls: { rejectUnauthorized: false },
              logger: false
            })
            await fallbackClient.connect()
            const fallbackLock = await fallbackClient.getMailboxLock('INBOX')
            try {
              const total = fallbackClient.mailbox ? fallbackClient.mailbox.exists || 0 : 0
              if (total > 0) {
                const start = Math.max(1, total - limit + 1)
                for await (const msg of fallbackClient.fetch(`${start}:${total}`, { envelope: true, flags: true })) {
                  todosEmails.push({
                    id: msg.uid,
                    seq: msg.seq,
                    conta: multiEmails[i],
                    de: msg.envelope?.from?.[0]?.address || '',
                    deNome: msg.envelope?.from?.[0]?.name || '',
                    assunto: msg.envelope?.subject || '(sem assunto)',
                    data: msg.envelope?.date?.toISOString() || '',
                    lido: msg.flags?.has('\\Seen') || false,
                    preview: ''
                  })
                }
              }
            } finally {
              fallbackLock.release()
            }
            await fallbackClient.logout()
          } catch (fallbackError) {
            console.error(`Erro ao ler ${multiEmails[i]} no Contabo fallback:`, fallbackError)
          }
        }
      }
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

    if (folder === 'LIST') {
      try {
        const mailboxes = await client.list()
        const pastas = mailboxes.map(box => ({
          nome: box.name,
          separador: box.delimiter,
          caminhoCompleto: box.path,
          temSubpastas: box.flags?.has('\\HasChildren') || false,
          selecionavel: !box.flags?.has('\\Noselect')
        }))
        await client.logout()
        return NextResponse.json({ success: true, pastas })
      } catch (e: any) {
        await client.logout()
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    const lock = await client.getMailboxLock(folder)
    const emails: any[] = []

    try {
      const total = client.mailbox ? client.mailbox.exists || 0 : 0
      const start = Math.max(1, total - limit + 1)
      const end = total

      if (total > 0 && start <= end) {
        for await (const msg of client.fetch(`${start}:${end}`, {
          envelope: true,
          flags: true
        })) {
          emails.push({
            id: msg.uid,
            seq: msg.seq,
            de: msg.envelope?.from?.[0]?.address || '',
            deNome: msg.envelope?.from?.[0]?.name || '',
            assunto: msg.envelope?.subject || '(sem assunto)',
            data: msg.envelope?.date?.toISOString() || '',
            lido: msg.flags?.has('\\Seen') || false,
            preview: msg.envelope?.subject ? msg.envelope.subject.substring(0, 50) + (msg.envelope.subject.length > 50 ? '...' : '') : ''
          })
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
    return NextResponse.json({ success: true, emails: emails.reverse(), total: client.mailbox ? client.mailbox.exists || 0 : 0 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
