
import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

export async function POST(req: NextRequest) {
  try {
    const { email, password, emailId, folder } = await req.json()

    if (!email || !password || !emailId || !folder) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios em falta' }, { status: 400 })
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
    let emailDetail = null

    try {
      const msg = await client.fetchOne(emailId, { source: true }, { uid: true })
      if (msg && msg.source) {
        const parsed = await simpleParser(msg.source)
        emailDetail = {
          corpo: parsed.html || parsed.text || '',
          anexos: parsed.attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size
          }))
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
    return NextResponse.json({ success: true, ...emailDetail })
  } catch (error: any) {
    console.error('Erro ao ler detalhe do email:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
