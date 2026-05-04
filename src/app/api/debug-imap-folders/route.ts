import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({
        error: 'Email e senha são obrigatórios'
      }, { status: 400 })
    }

    const host = process.env.IMAP_HOST || getServerHost()

    console.log(`📧 [debug-imap-folders] Conectando a ${host} com usuário ${email}`)

    const client = new ImapFlow({
      host,
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false
    })

    try {
      await client.connect()
      console.log(`📧 [debug-imap-folders] Conexão estabelecida com sucesso`)
    } catch (connectError: any) {
      console.error(`📧 [debug-imap-folders] Erro de conexão:`, connectError.message)
      return NextResponse.json({
        success: false,
        error: 'Falha na autenticação IMAP',
        details: connectError.message,
        suggestion: 'Verifique se a senha está correta e se o servidor IMAP está acessível'
      }, { status: 401 })
    }

    // Listar todas as pastas
    const mailboxes = await client.list()

    const folderList = mailboxes.map(mb => ({
      path: mb.path,
      flags: mb.flags ? Array.from(mb.flags) : [],
      specialUse: mb.specialUse || null
    }))

    console.log(`📧 [debug-imap-folders] Pastas encontradas:`, folderList.map(f => f.path))

    // Verificar pastas comuns (padrão SnappyMail)
    const standardFolders = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Junk', 'Archive']
    const folderStatus: Record<string, { exists: boolean; total?: number; actualPath?: string; error?: string }> = {}

    for (const folder of standardFolders) {
      try {
        const lock = await client.getMailboxLock(folder)
        const total = client.mailbox ? client.mailbox.exists || 0 : 0
        folderStatus[folder] = { exists: true, total, actualPath: folder }
        lock.release()
      } catch (e: any) {
        // Tentar variações de nome
        const variations = getFolderVariations(folder)
        let found = false
        for (const variation of variations) {
          try {
            const lock = await client.getMailboxLock(variation)
            const total = client.mailbox ? client.mailbox.exists || 0 : 0
            folderStatus[folder] = { exists: true, total, actualPath: variation }
            lock.release()
            found = true
            break
          } catch {}
        }
        if (!found) {
          folderStatus[folder] = { exists: false, error: 'Pasta não encontrada' }
        }
      }
    }

    await client.logout()

    return NextResponse.json({
      success: true,
      email,
      host,
      allFolders: folderList,
      standardFolders: folderStatus,
      summary: {
        totalFolders: folderList.length,
        standardFoldersCount: Object.values(folderStatus).filter(f => f.exists).length,
        recommendedMapping: getRecommendedMapping(folderList)
      }
    })

  } catch (error: any) {
    console.error('Erro ao listar pastas:', error)
    return NextResponse.json({
      error: error.message,
      success: false
    }, { status: 500 })
  }
}

// Helper para obter variações de nomes de pastas
function getFolderVariations(folder: string): string[] {
  const variations: string[] = []
  const lower = folder.toLowerCase()

  if (folder === 'INBOX') {
    variations.push('INBOX')
  } else if (folder === 'Sent') {
    variations.push('Sent', 'Sent Items', 'Enviados', 'Enviadas', 'INBOX.Sent', 'INBOX.Sent Items')
  } else if (folder === 'Drafts') {
    variations.push('Drafts', 'Draft', 'Rascunhos', 'INBOX.Drafts', 'INBOX.Draft')
  } else if (folder === 'Trash') {
    variations.push('Trash', 'Bin', 'Deleted Items', 'Lixo', 'Itens Eliminados', 'Eliminados', 'INBOX.Trash', 'INBOX.Deleted')
  } else if (folder === 'Junk') {
    variations.push('Junk', 'Spam', 'Correspondência Indesejada', 'Indesejado', 'INBOX.Junk', 'INBOX.Spam')
  } else if (folder === 'Archive') {
    variations.push('Archive', 'Arquivo', 'Arquivados', 'INBOX.Archive', 'INBOX.Archive')
  }

  return variations
}

// Helper para sugerir mapeamento correto
function getRecommendedMapping(folderList: any[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const paths = folderList.map(f => f.path.toLowerCase())

  const findFolder = (...names: string[]): string | undefined => {
    for (const name of names) {
      if (paths.includes(name.toLowerCase())) {
        return folderList.find(f => f.path.toLowerCase() === name.toLowerCase())?.path
      }
    }
    return undefined
  }

  mapping.INBOX = findFolder('INBOX') || 'INBOX'
  mapping.Sent = findFolder('Sent', 'Sent Items', 'Enviados') || 'Sent'
  mapping.Drafts = findFolder('Drafts', 'Draft', 'Rascunhos') || 'Drafts'
  mapping.Trash = findFolder('Trash', 'Bin', 'Deleted Items', 'Lixo') || 'Trash'
  mapping.Junk = findFolder('Junk', 'Spam') || 'Junk'
  mapping.Archive = findFolder('Archive', 'Arquivo') || 'Archive'

  return mapping
}
