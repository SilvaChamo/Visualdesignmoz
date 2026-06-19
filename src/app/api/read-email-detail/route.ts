import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createClient } from '@/utils/supabase/server'
import {
  connectImapClient,
  getCachedFolderList,
  resolveFolder,
  resolveMailboxPassword,
} from '@/lib/imap-panel-shared'

export async function POST(req: NextRequest) {
  let client: ImapFlow | null = null
  try {
    const { email, password, emailId, folder } = await req.json()

    if (!email || !emailId || !folder) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios em falta' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const resolvedPassword = await resolveMailboxPassword(email, password, session)

    if (!resolvedPassword) {
      return NextResponse.json({ error: 'Credenciais não disponíveis para esta conta.' }, { status: 401 })
    }

    client = await connectImapClient(email, resolvedPassword)
    if (!client) {
      return NextResponse.json({ error: 'Falha na ligação IMAP.' }, { status: 502 })
    }

    const folderList = await getCachedFolderList(client, email)
    const realFolder = resolveFolder(folder, folderList) || folder

    const lock = await client.getMailboxLock(realFolder)
    try {
      const msg = await client.fetchOne(emailId, { source: true }, { uid: true })
      if (!msg || !msg.source) {
        return NextResponse.json({ error: 'Mensagem não encontrada nesta pasta.' }, { status: 404 })
      }

      // Marcar como lido (\Seen) no servidor
      try {
        await client.messageFlagsAdd([emailId], ['\\Seen'], { uid: true })
      } catch (e) {
        console.error('Falha ao marcar como lido:', e)
      }

      const parsed = await simpleParser(msg.source)
      return NextResponse.json({
        success: true,
        corpo: parsed.html || parsed.text || '',
        anexos: parsed.attachments.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
        })),
      })
    } finally {
      lock.release()
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao ler mensagem'
    console.error('❌ [read-email-detail]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (client) {
      try {
        await client.logout()
      } catch {
        /* ignore */
      }
    }
  }
}
