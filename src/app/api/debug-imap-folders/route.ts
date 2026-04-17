import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    
    if (!email || !password) {
      return NextResponse.json({ 
        error: 'Email e senha são obrigatórios' 
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
    
    // Listar todas as pastas
    const mailboxes = await client.list()
    
    const folderList = mailboxes.map(mb => ({
      path: mb.path,
      flags: mb.flags ? Array.from(mb.flags) : [],
      specialUse: mb.specialUse || null
    }))
    
    // Verificar pastas comuns
    const commonFolders = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Archive', 'Spam', 'Junk']
    const folderStatus: Record<string, { exists: boolean; total?: number; error?: string }> = {}
    
    for (const folder of commonFolders) {
      try {
        const lock = await client.getMailboxLock(folder)
        const total = client.mailbox ? client.mailbox.exists || 0 : 0
        folderStatus[folder] = { exists: true, total }
        lock.release()
      } catch (e: any) {
        folderStatus[folder] = { exists: false, error: e.message }
      }
    }
    
    // Também tentar com prefixo INBOX.
    const inboxPrefixed = commonFolders.filter(f => f !== 'INBOX').map(f => `INBOX.${f}`)
    for (const folder of inboxPrefixed) {
      try {
        const lock = await client.getMailboxLock(folder)
        const total = client.mailbox ? client.mailbox.exists || 0 : 0
        folderStatus[folder] = { exists: true, total }
        lock.release()
      } catch (e: any) {
        folderStatus[folder] = { exists: false, error: 'Not found' }
      }
    }
    
    await client.logout()
    
    return NextResponse.json({
      success: true,
      email,
      allFolders: folderList,
      commonFolders: folderStatus
    })
    
  } catch (error: any) {
    console.error('Erro ao listar pastas:', error)
    return NextResponse.json({ 
      error: error.message,
      success: false 
    }, { status: 500 })
  }
}
