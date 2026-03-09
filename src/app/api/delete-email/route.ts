import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

export async function POST(req: NextRequest) {
  try {
    const { email, password, emailId, folder } = await req.json()
    if (!email || !password || !emailId || !folder) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios faltam' }, { status: 400 })
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

    try {
      await client.messageDelete([emailId])
    } finally {
      lock.release()
    }

    await client.logout()
    return NextResponse.json({ success: true, message: 'Email deletado' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
