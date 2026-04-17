import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

// Função para tentar diferentes variações de nomes de pastas IMAP
const getMailboxWithFallback = async (client: any, folderPath: string): Promise<{ lock: any; actualPath: string } | null> => {
  const tentativas = [folderPath]
  
  // Se começa com INBOX., tentar sem o prefixo
  if (folderPath.startsWith('INBOX.')) {
    tentativas.push(folderPath.replace('INBOX.', ''))
  } else if (folderPath !== 'INBOX') {
    // Se não começa com INBOX., tentar com o prefixo
    tentativas.push(`INBOX.${folderPath}`)
  }
  
  for (const tentativa of tentativas) {
    try {
      const lock = await client.getMailboxLock(tentativa)
      console.log(`📧 [delete] Pasta encontrada: ${tentativa}`)
      return { lock, actualPath: tentativa }
    } catch (e: any) {
      console.log(`📧 [delete] Pasta não existe: ${tentativa}`)
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

    const client = new ImapFlow({
      host: process.env.IMAP_HOST || '109.199.104.22',
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false
    })

    await client.connect()

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

    const mailboxResult = await getMailboxWithFallback(client, folder)
    if (!mailboxResult) {
      await client.logout()
      return NextResponse.json({ error: `Pasta ${folder} não encontrada`, success: false }, { status: 400 })
    }
    const { lock, actualPath } = mailboxResult
    console.log(`1. ${actualPath} aberta`)
    try {
      // Pastas de Lixeira a tentar, por ordem de prioridade
      const trashFolders = ['INBOX.Deleted Items', 'INBOX.Trash', 'Trash', 'Deleted Items']

      // Se já estiver na lixeira, apagar permanentemente
      if (trashFolders.includes(actualPath) || trashFolders.includes(folder)) {
        await client.messageDelete([emailId], { uid: true })
        console.log('3. Deletado permanentemente via messageDelete')
        await client.mailboxClose()
      } else {
        // Mover para a Lixeira antes de apagar da pasta de origem
        let movedToTrash = false

        for (const trashFolder of trashFolders) {
          try {
            await client.messageMove([emailId], trashFolder, { uid: true })
            movedToTrash = true
            console.log(`2. Movido para lixeira (${trashFolder})`)
            break
          } catch (moveErr: any) {
            console.warn(`Falha ao mover para ${trashFolder}: ${moveErr.message}`, {
              response: moveErr.response,
              responseText: moveErr.responseText
            })
            continue
          }
        }

        // Se nenhuma pasta existir, tenta criar a primeira e mover
        if (!movedToTrash) {
          try {
            await client.mailboxCreate(trashFolders[0])
            console.log(`Pasta criada: ${trashFolders[0]}`)
            await client.messageMove([emailId], trashFolders[0], { uid: true })
            movedToTrash = true
            console.log(`2. Movido para lixeira (${trashFolders[0]})`)
          } catch (createErr: any) {
             // Fallback final: apagar direto sem lixeira
             console.error(`Falha ao criar Lixeira. Apagando direto...`)
             await client.messageDelete([emailId], { uid: true })
             movedToTrash = true
          }
        }

        if (movedToTrash) {
          await client.mailboxClose()
        } else {
          lock.release()
          await client.logout()
          return NextResponse.json({ 
            error: 'Não foi possível apagar o email.',
            success: false 
          }, { status: 500 })
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
