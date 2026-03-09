import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

export async function POST(req: NextRequest) {
  try {
    const { email, password, emails: multiEmails, passwords: multiPasswords, folder = 'INBOX', page = 1, limit = 20 } = await req.json()

    // Se receber array de emails, agregar de todas as contas
    if (multiEmails && Array.isArray(multiEmails)) {
      const todosEmails: any[] = []
      for (let i = 0; i < multiEmails.length; i++) {
        try {
          const client = new ImapFlow({
            host: process.env.IMAP_HOST || '109.199.104.22',
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
              for await (const msg of client.fetch(`${start}:${total}`, {
                envelope: true, flags: true
              })) {
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
          console.error(`Erro ao ler ${multiEmails[i]}:`, e)
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
    const lock = await client.getMailboxLock(folder)
    const emails: any[] = []

    try {
      const total = client.mailbox ? client.mailbox.exists || 0 : 0
      const start = Math.max(1, total - (page * limit) + 1)
      const end = Math.max(1, total - ((page - 1) * limit))

      if (total > 0) {
        for await (const msg of client.fetch(`${start}:${end}`, {
          envelope: true, flags: true, bodyStructure: true,
          bodyParts: ['1'] 
        })) {
          emails.push({
            id: msg.uid,
            seq: msg.seq,
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
    return NextResponse.json({ success: true, emails: emails.reverse(), total: client.mailbox ? client.mailbox.exists || 0 : 0 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
