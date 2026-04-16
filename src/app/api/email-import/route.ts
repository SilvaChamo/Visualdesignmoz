import { NextRequest, NextResponse } from 'next/server'
import * as ImapFlow from 'imapflow'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gmailUser, gmailAppPassword, destinationEmail, destinationPassword } = body

    // Validação dos parâmetros
    if (!gmailUser || !gmailAppPassword || !destinationEmail || !destinationPassword) {
      return NextResponse.json({ 
        error: 'Todos os campos são obrigatórios: gmailUser, gmailAppPassword, destinationEmail, destinationPassword' 
      }, { status: 400 })
    }

    // Configuração IMAP Gmail
    const gmailConfig = {
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword
      },
      logger: false
    }

    // Configuração IMAP CyberPanel (servidor próprio)
    const cyberpanelConfig = {
      host: '109.199.104.22', // IP do servidor CyberPanel
      port: 993,
      secure: true,
      auth: {
        user: destinationEmail,
        pass: destinationPassword
      },
      logger: false
    }

    // Mapeamento de pastas Gmail → CyberPanel
    const folderMapping: Record<string, string> = {
      'INBOX': 'INBOX',
      '[Gmail]/Sent Mail': 'Sent',
      '[Gmail]/Drafts': 'Drafts',
      '[Gmail]/Spam': 'Junk',
      '[Gmail]/Trash': 'Trash',
      '[Gmail]/All Mail': 'Archive'
    }

    let totalMessages = 0
    let copiedMessages = 0
    let errors = []
    let currentFolder = ''

    try {
      // Conectar ao Gmail
      const gmailClient = new ImapFlow.ImapFlow(gmailConfig as any)
      await gmailClient.connect()

      // Conectar ao CyberPanel
      const cyberpanelClient = new ImapFlow.ImapFlow(cyberpanelConfig as any)
      await cyberpanelClient.connect()

      // Listar pastas do Gmail
      const gmailFolders = await gmailClient.list()
      const foldersToImport = Object.keys(folderMapping).filter(folder => 
        gmailFolders.some((f: any) => f.path === folder)
      )

      // Para cada pasta, copiar mensagens
      for (const gmailFolder of foldersToImport) {
        currentFolder = gmailFolder
        const cyberpanelFolder = folderMapping[gmailFolder]

        try {
          // Selecionar pasta no Gmail
          await gmailClient.mailboxOpen(gmailFolder)
          const messages = await gmailClient.search({ seen: false })
          
          if (Array.isArray(messages)) {
            totalMessages += messages.length

            // Garantir que pasta existe no destino
            try {
              await cyberpanelClient.mailboxCreate(cyberpanelFolder)
            } catch (e) {
              // Pasta pode já existir
            }

            // Selecionar pasta no CyberPanel
            await cyberpanelClient.mailboxOpen(cyberpanelFolder)

            // Copiar cada mensagem
            for (const uid of messages) {
              try {
                const messageData = await gmailClient.fetchOne(uid, { source: true })
                if (messageData && typeof messageData === 'object' && 'source' in messageData) {
                  const source = (messageData as any).source
                  if (source) {
                    await cyberpanelClient.append(source, cyberpanelFolder, ['\\Seen'])
                    copiedMessages++
                  }
                }
              } catch (msgError) {
                errors.push(`Erro ao copiar mensagem ${uid} da pasta ${gmailFolder}: ${msgError}`)
              }
            }
          }
        } catch (folderError) {
          errors.push(`Erro ao processar pasta ${gmailFolder}: ${folderError}`)
        }
      }

      // Fechar conexões
      await gmailClient.logout()
      await cyberpanelClient.logout()

    } catch (connectionError: any) {
      return NextResponse.json({ 
        error: `Erro de conexão: ${connectionError?.message || connectionError}`,
        details: connectionError
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      total: totalMessages,
      copied: copiedMessages,
      errors: errors,
      currentFolder: currentFolder,
      message: `Importação concluída! ${copiedMessages} de ${totalMessages} mensagens copiadas.`
    })

  } catch (error: any) {
    console.error('Email import error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Erro desconhecido durante importação',
      details: error
    }, { status: 500 })
  }
}
