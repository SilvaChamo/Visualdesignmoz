import { NextRequest, NextResponse } from 'next/server'
import { connectImapClient, FOLDER_VARIATIONS } from '@/lib/imap-panel-shared'

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
        console.log(`📧 [delete] Pasta encontrada: ${v}`)
        return { lock, actualPath: v }
      } catch (e) {}
    }
    const lower = v.toLowerCase()
    if (existingLowers.has(lower)) {
      const realPath = existingLowers.get(lower)!
      try {
        const lock = await client.getMailboxLock(realPath)
        console.log(`📧 [delete] Pasta encontrada (case): ${realPath}`)
        return { lock, actualPath: realPath }
      } catch (e) {}
    }
  }
  return null
}

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

    const client = await connectImapClient(email, password)
    if (!client) {
      return NextResponse.json({ error: 'Falha na autenticação IMAP', success: false }, { status: 401 })
    }

    // --- TAREFA 2 DO USER: Listar todas as pastas e encontrar a real Trash ---
    try {
      const mailboxesList = await client.list()
      const debugPastas = mailboxesList.map(mb => ({
        path: mb.path,
        flags: mb.flags ? Array.from(mb.flags) : [],
        specialUse: mb.specialUse || 'none'
      }))
      console.log('Pastas IMAP disponíveis no servidor:', JSON.stringify(debugPastas, null, 2))
      
      const realTrash = mailboxesList.find(mb => mb.specialUse === '\\Trash')
      console.log('Pasta Lixeira REAL identificada (via specialUse):', realTrash ? realTrash.path : 'NENHUMA')
    } catch (listErr) {
      console.warn('Erro ao listar pastas:', listErr)
    }
    // -------------------------------------------------------------------------

    const mailboxesList = await client.list()
    const realTrash = mailboxesList.find((mb: any) => mb.specialUse === '\\Trash')

    const mailboxResult = await getMailboxWithFallback(client, folder)
    if (!mailboxResult) {
      await client.logout()
      return NextResponse.json({ error: `Pasta ${folder} não encontrada`, success: false }, { status: 400 })
    }
    const { lock, actualPath } = mailboxResult
    console.log(`1. ${actualPath} aberta`)

    try {
      const trashFolders = realTrash ? [realTrash.path] : ['Deleted Items', 'INBOX.Deleted Items', 'Trash', 'INBOX.Trash']

      if (trashFolders.includes(actualPath) || trashFolders.includes(folder)) {
        await client.messageFlagsAdd([emailId], ['\\Deleted'], { uid: true })
        // Tentar expunge explícito se a biblioteca suportar, senão fechar a caixa
        try { await (client as { expunge?: () => Promise<void> }).expunge?.() } catch (e) {}
        console.log('3. Deletado permanentemente da lixeira')
      } else {
        let movedToTrash = false

        for (const trashFolder of trashFolders) {
          try {
            await client.messageMove([emailId], trashFolder, { uid: true })
            movedToTrash = true
            console.log(`2. Movido para lixeira (${trashFolder})`)
            break
          } catch (moveErr: any) {
            continue
          }
        }

        if (!movedToTrash && !realTrash) {
          try {
            await client.mailboxCreate(trashFolders[0])
            await client.messageMove([emailId], trashFolders[0], { uid: true })
            movedToTrash = true
          } catch (createErr: any) {}
        }

        // MARCAR COMO APAGADO E FORÇAR A ELIMINAÇÃO FÍSICA PARA NÃO VOLTAR
        try { await client.messageFlagsAdd([emailId], ['\\Deleted'], { uid: true }) } catch (e) {}
        try { await (client as { expunge?: () => Promise<void> }).expunge?.() } catch (e) {}
        
        if (!movedToTrash) {
          lock.release()
          await client.logout()
          return NextResponse.json({ error: 'Não foi possível apagar o email.', success: false }, { status: 500 })
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
    return NextResponse.json({ success: true, message: 'Email deletado' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 })
  }
}
