import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

export async function POST(req: NextRequest) {
  try {
    const { email, password, to, subject, html } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenciais em falta' }, { status: 400 })
    }

    const client = new ImapFlow({
      host: process.env.IMAP_HOST || getServerHost(),
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false
    })

    await client.connect()

    const mensagem = [
      `From: ${email}`,
      `To: ${to || ''}`,
      `Subject: ${subject || '(sem assunto)'}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html || ''
    ].join('\r\n')

    await client.append('Drafts', mensagem, ['\\Draft', '\\Seen'])
    await client.logout()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
