import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { email, password, emailId, forwardTo, folder } = await req.json()
    if (!email || !password || !emailId || !forwardTo || !folder) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios faltam' }, { status: 400 })
    }

    // Ler email original
    const imapClient = new ImapFlow({
      host: process.env.IMAP_HOST || '109.199.104.22',
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false
    })

    await imapClient.connect()
    console.log(`IMAP Connected for forward. Folder: ${folder}, emailId: ${emailId}`);
    const lock = await imapClient.getMailboxLock(folder)
    let emailContent = ''
    console.log(`Mailbox locked. Fetching ${emailId}...`);

    try {
      // Tentar buscar por UID primeiro, se falhar tenta por sequência
      for await (const msg of imapClient.fetch(emailId.toString(), { source: true }, { uid: true })) {
        emailContent = msg.source?.toString() || ''
      }
    } catch (e) {
      console.log('Fetch by UID failed, trying by sequence...');
      for await (const msg of imapClient.fetch(emailId.toString(), { source: true })) {
        emailContent = msg.source?.toString() || ''
      }
    } finally {
      lock.release()
    }

    await imapClient.logout()

    // Encaminhar email
    const smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || '109.199.104.22',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false }
    })

    // Extrair assunto de forma mais robusta
    const subjectMatch = emailContent.match(/^Subject:\s*(.*)$/im)
    const originalSubject = subjectMatch ? subjectMatch[1].trim() : 'Email'

    await smtpTransporter.sendMail({
      from: email,
      to: forwardTo,
      subject: `Fwd: ${originalSubject}`,
      text: `---------- Email Reenviado ----------\n\n${emailContent}`
    })

    return NextResponse.json({ success: true, message: 'Email reenviado' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
