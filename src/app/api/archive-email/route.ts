import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

export async function POST(req: NextRequest) {
  try {
    const { email, password, emailId, fromFolder, toFolder = 'INBOX.Archive' } = await req.json()
    
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
    console.log(`1. ${fromFolder} aberta para arquivar`)
    try {
      const archiveFolders = [archiveFolder, 'INBOX.Archive', 'Archive']
      let movedToArchive = false

      for (const tFolder of archiveFolders) {
        try {
          await client.messageMove([emailId], tFolder, { uid: true })
          movedToArchive = true
          console.log(`2. Movido para arquivo (${tFolder})`)
          break
        } catch (err: any) {
          console.warn(`Falha ao mover para ${tFolder}: ${err.message}`)
        }
      }

      if (!movedToArchive) {
        try {
          await client.mailboxCreate(archiveFolders[0])
          console.log(`Pasta criada: ${archiveFolders[0]}`)
          await client.messageMove([emailId], archiveFolders[0], { uid: true })
          movedToArchive = true
          console.log(`2. Movido para arquivo (${archiveFolders[0]})`)
        } catch (createErr: any) {
          console.error(`Falha ao criar pasta de Arquivo: ${createErr.message}`)
        }
      }

      if (movedToArchive) {
        await client.mailboxClose()
      } else {
        lock.release()
        await client.logout()
        return NextResponse.json({ 
          error: 'Não foi possível mover o email para o Arquivo.',
          success: false 
        }, { status: 500 })
      }
    } finally {
      if (typeof lock.release === 'function') lock.release() // Garante safety se o close já eliminou o lock em certos engines
    }

    await client.logout()
    return NextResponse.json({ success: true, message: 'Email arquivado' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
