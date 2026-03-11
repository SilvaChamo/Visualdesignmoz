import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

export async function POST(req: NextRequest) {
  try {
    const { email, password, emailId, fromFolder, toFolder = 'Archived' } = await req.json()
    
    // Debug para identificar parâmetros ausentes
    console.log('Archive API - Parâmetros recebidos:', { 
      email: email ? '✓' : '✗', 
      password: password ? '✓' : '✗', 
      emailId: emailId ? '✓' : '✗', 
      fromFolder: fromFolder ? '✓' : '✗',
      valores: { email, password: password ? '[HIDDEN]' : null, emailId, fromFolder, toFolder }
    })
    
    if (!email || !password || !emailId || !fromFolder) {
      return NextResponse.json({ 
        error: 'Parâmetros obrigatórios faltam',
        detalhes: {
          email: email || 'falta',
          password: password || 'falta', 
          emailId: emailId || 'falta',
          fromFolder: fromFolder || 'falta'
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

    // Mover para pasta de arquivo
    const archiveFolder = toFolder // Usar toFolder ou padrão
    const lock = await client.getMailboxLock(fromFolder)
    try {
      await client.messageCopy([emailId], archiveFolder)
      await client.messageDelete([emailId])
    } finally {
      lock.release()
    }

    await client.logout()
    return NextResponse.json({ success: true, message: 'Email arquivado' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
