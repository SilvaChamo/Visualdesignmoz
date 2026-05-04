import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

// Mapeamento de pastas baseado em auditoria do Maildir do servidor
const FOLDER_VARIATIONS: Record<string, string[]> = {
  'sent':    ['Sent', 'Sent Items', 'Enviados', 'INBOX.Sent'],
  'trash':   ['Deleted Items', 'Trash', 'Bin', 'Lixo', 'INBOX.Deleted Items', 'INBOX.Trash'],
  'junk':    ['Junk', 'Junk E-mail', 'Spam', 'INBOX.Junk', 'INBOX.Spam'],
  'drafts':  ['Drafts', 'Draft', 'Rascunhos', 'INBOX.Drafts'],
  'archive': ['Archive', 'Arquivados', 'Arquivo', 'INBOX.Archive'],
}

const getMailboxWithFallback = async (client: any, folderPath: string): Promise<{ lock: any; actualPath: string } | null> => {
  const folderList = await client.list()
  const existingPaths = new Set<string>(folderList.map((m: any) => m.path))
  const existingLowers = new Map<string, string>(folderList.map((m: any) => [m.path.toLowerCase(), m.path]))

  const p = folderPath.toLowerCase()
  const variations: string[] = FOLDER_VARIATIONS[p] || [folderPath]
  if (!variations.includes(folderPath)) variations.unshift(folderPath)

  for (const v of variations) {
    if (existingPaths.has(v)) {
      try {
        const lock = await client.getMailboxLock(v)
        console.log(`📧 [archive] Pasta encontrada: ${v}`)
        return { lock, actualPath: v }
      } catch (e) {}
    }
    const lower = v.toLowerCase()
    if (existingLowers.has(lower)) {
      const realPath = existingLowers.get(lower)!
      try {
        const lock = await client.getMailboxLock(realPath)
        return { lock, actualPath: realPath }
      } catch (e) {}
    }
  }
  return null
}

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
      host: process.env.IMAP_HOST || getServerHost(),
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false
    })

    await client.connect()

    // Mover para pasta de arquivo
    const archiveFolder = toFolder // Usar toFolder ou padrão
    const mailboxResult = await getMailboxWithFallback(client, fromFolder)
    if (!mailboxResult) {
      await client.logout()
      return NextResponse.json({ error: `Pasta ${fromFolder} não encontrada`, success: false }, { status: 400 })
    }
    const { lock, actualPath } = mailboxResult
    console.log(`1. ${actualPath} aberta para arquivar`)
    try {
      // Pastas de Arquivo — ordem baseada em auditoria real do servidor
      const archiveFolders = ['Archive', 'INBOX.Archive', 'Arquivados', archiveFolder]
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
