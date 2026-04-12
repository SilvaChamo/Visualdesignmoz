import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const decryptPassword = (text: string) => Buffer.from(text, 'base64').toString('utf8')

// Configuração SMTP do CyberPanel
const SMTP_HOST = 'mail.visualdesigne.com'
const SMTP_PORT = 465
const SMTP_SECURE = true

// TAREFA: Idempotency — Map em memória para keys já processadas
const processedKeys = new Map<string, { timestamp: number; messageId: string }>()

function cleanExpiredKeys() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  for (const [key, value] of processedKeys) {
    if (value.timestamp < fiveMinutesAgo) {
      processedKeys.delete(key)
    }
  }
}

// 🆕 FUNÇÃO: Enviar via SMTP direto do CyberPanel
async function sendViaSMTP(
  to: string | string[],
  cc: string | string[],
  bcc: string | string[],
  subject: string,
  html: string,
  from: string,
  fromPassword: string
): Promise<{ success: boolean; messageId?: string }> {
  console.log('� SMTP: Enviando email via CyberPanel...')
  
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: from,
      pass: fromPassword
    },
    tls: {
      rejectUnauthorized: false
    }
  })

  const info = await transporter.sendMail({
    from,
    to,
    cc,
    bcc,
    subject,
    html
  })

  console.log('✅ Email enviado:', info.messageId)
  return { success: true, messageId: info.messageId }
}

export async function POST(req: NextRequest) {
  try {
    let { from, fromPassword, to, cc, bcc, subject, html, replyTo, category, idempotencyKey } = await req.json()

    // TAREFA 2: Verificar idempotency key
    cleanExpiredKeys()
    if (idempotencyKey && processedKeys.has(idempotencyKey)) {
      const cached = processedKeys.get(idempotencyKey)!
      console.log(`Idempotency hit: key=${idempotencyKey}, original messageId=${cached.messageId}`)
      return NextResponse.json({ success: true, messageId: cached.messageId, duplicate: true, provider: 'cached' })
    }

    // Automatic Password Recovery if not provided
    if (from && !fromPassword) {
      try {
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
          const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

          const { data: conta } = await supabaseAdmin
            .from('email_contas')
            .select('password_smtp')
            .eq('email', from)
            .eq('cliente_id', session.user.id)
            .single()

          if (conta?.password_smtp) {
            fromPassword = decryptPassword(conta.password_smtp)
            console.log('Password recovered from database for:', from)
          }
        }
      } catch (recoveryErr) {
        console.error('Failed to recover password:', recoveryErr)
      }
    }

    // 🆕 1. PRIORIDADE: SMTP direto do CyberPanel (mais fiável)
    if (from && fromPassword && to && subject) {
      try {
        console.log('� PRIORIDADE 1: Enviando via SMTP CyberPanel...')
        const result = await sendViaSMTP(to, cc || [], bcc || [], subject, html || '', from, fromPassword)
        
        if (result.success) {
          // TAREFA 2: Registar idempotency key
          const finalMessageId = result.messageId || `smtp-${Date.now()}`
          if (idempotencyKey) {
            processedKeys.set(idempotencyKey, { timestamp: Date.now(), messageId: finalMessageId })
          }
          return NextResponse.json({ 
            success: true, 
            messageId: finalMessageId, 
            provider: 'smtp-cyberpanel'
          });
        }
      } catch (smtpError: any) {
        console.error('SMTP falhou:', smtpError.message)
        return NextResponse.json({ success: false, error: smtpError.message }, { status: 500 })
      }
    }

    // Se não tiver password, não pode enviar
    if (!fromPassword) {
      return NextResponse.json({
        error: 'Senha do email não fornecida. Configure a senha SMTP da conta.'
      }, { status: 400 })
    }

    // FALLBACK: SMTP direto com configuração dinâmica
    if (!from || !to || !subject) {
      return NextResponse.json({
        error: 'Campos obrigatórios em falta (from, to, subject) para envio via SMTP.'
      }, { status: 400 })
    }

    // Usar SMTP do CyberPanel
    console.log('Using CyberPanel SMTP...');
    console.log('SMTP DEBUG - user:', from, '| host:', SMTP_HOST);
    
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: from,
        pass: fromPassword
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      socketTimeout: 15000,
    })

    const info = await transporter.sendMail({
      from, to, cc, bcc, subject,
      html: html || '',
      replyTo: replyTo || from
    })

    // TAREFA 2: Registar idempotency key após envio bem-sucedido
    if (idempotencyKey) {
      processedKeys.set(idempotencyKey, { timestamp: Date.now(), messageId: info.messageId })
    }

    // TAREFA 1: Retornar sucesso IMEDIATAMENTE após sendMail()
    // O IMAP append corre em background (fire-and-forget) para não bloquear a resposta
    const response = NextResponse.json({ success: true, messageId: info.messageId, provider: 'nodemailer' })

    // 3. Fire-and-forget: Guardar na pasta 'Enviados' via IMAP (background)
    if (fromPassword && info.messageId) {
      // Não fazemos await — a resposta HTTP já foi preparada
      (async () => {
        try {
          const { ImapFlow } = await import('imapflow')
          const imapClient = new ImapFlow({
            host: 'mail.visualdesigne.com',
            port: 993,
            secure: true,
            auth: { user: from, pass: fromPassword },
            tls: { rejectUnauthorized: false },
            logger: false
          })

          await imapClient.connect()
          const foldersToTry = ['INBOX.Sent', 'Sent', '.Sent', 'Enviados']
          const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@your-domain.com>`
          const dateStr = new Date().toUTCString()
          const fullMessage = `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMessage-ID: ${messageId}\r\nDate: ${dateStr}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html || ''}`

          let saved = false
          for (const folder of foldersToTry) {
            try {
              await imapClient.append(folder, fullMessage, ['\\Seen'])
              saved = true
              console.log(`Email guardado na pasta IMAP: ${folder}`)
              break
            } catch (e) {
              continue
            }
          }

          if (!saved) console.warn('Não foi possível guardar em nenhuma pasta de Enviados conhecida.')
          await imapClient.logout()
        } catch (imapErr) {
          console.error('IMAP append failed (background):', imapErr)
        }
      })().catch(err => console.error('IMAP fire-and-forget error:', err))
    }

    return response
  } catch (error: any) {
    console.error('Email API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
