import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

export async function POST(req: NextRequest) {
  try {
    const { email, password, emailId, folder } = await req.json()
    
    // Debug para identificar parâmetros ausentes
    console.log('Delete API - Parâmetros recebidos:', { 
      email: email ? '✓' : '✗', 
      password: password ? '✓' : '✗', 
      emailId: emailId ? '✓' : '✗', 
      folder: folder ? '✓' : '✗',
      valores: { email, password: password ? '[HIDDEN]' : null, emailId, folder }
    })
    
    if (!email || !password || !emailId || !folder) {
      return NextResponse.json({ 
        error: 'Parâmetros obrigatórios faltam',
        detalhes: {
          email: email || 'falta',
          password: password || 'falta', 
          emailId: emailId || 'falta',
          folder: folder || 'falta'
        }
      }, { status: 400 })
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
