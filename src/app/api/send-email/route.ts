import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { resend } from '@/lib/resend'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const decryptPassword = (text: string) => Buffer.from(text, 'base64').toString('utf8')

// TAREFA 2: Idempotency — Map em memória para keys já processadas
const processedKeys = new Map<string, { timestamp: number; messageId: string }>()

function cleanExpiredKeys() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  for (const [key, value] of processedKeys) {
    if (value.timestamp < fiveMinutesAgo) {
      processedKeys.delete(key)
    }
  }
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

    // 1. Usar Resend APENAS para emails transacionais (recuperação de password, etc.)
    const isResendAvailable = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_placeholder';
    const isTransactional = category === 'transactional';
    const isAuthorizedDomain = from?.toLowerCase().endsWith('@visualdesigne.com');

    if (isResendAvailable && isTransactional && isAuthorizedDomain) {
      console.log('Using Resend for transactional email delivery...');
      try {
        const { data, error } = await resend.emails.send({
          from: from || 'noreply@visualdesigne.com',
          to, cc, bcc, subject,
          html: html || '',
          replyTo: replyTo || from
        });

        if (!error) {
          // TAREFA 2: Registar idempotency key
          if (idempotencyKey) {
            processedKeys.set(idempotencyKey, { timestamp: Date.now(), messageId: data?.id || '' })
          }
          return NextResponse.json({ success: true, messageId: data?.id, provider: 'resend' });
        }
        console.error('Resend error:', error);
      } catch (resendErr) {
        console.error('Resend exception:', resendErr);
      }
    }

    // 2. Fallback para Nodemailer (SMTP Local) para tudo o resto
    if (!from || !to || !subject) {
      return NextResponse.json({
        error: 'Campos obrigatórios em falta (from, to, subject) para envio via SMTP.'
      }, { status: 400 })
    }
    // Se não tem password, usar conta SMTP master para autenticar
    // O campo From: continua a mostrar o email do utilizador
    const smtpUser = fromPassword ? from : (process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com')
    const smtpPass = fromPassword || process.env.SMTP_MASTER_PASSWORD || 'AdvD2425'

    console.log('Using Nodemailer fallback...');
    console.log('SMTP DEBUG - user:', smtpUser, '| pass:', smtpPass ? smtpPass.substring(0,4)+'***' : 'VAZIO', '| host:', process.env.SMTP_HOST || '109.199.104.22', '| from:', from);
    const transporter = nodemailer.createTransport({
      host: '109.199.104.22',
      port: 465,
      secure: true,
      auth: {
        user: 'admin@visualdesigne.com',
        pass: 'Ad.Vd#2425?*'
      },
      tls: { rejectUnauthorized: false },
      // TAREFA 3: Timeout explícito para evitar bloqueio >60s
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
            host: '109.199.104.22',
            port: 993,
            secure: true,
            auth: { user: from, pass: fromPassword },
            tls: { rejectUnauthorized: false },
            logger: false
          })

          await imapClient.connect()
          const foldersToTry = ['INBOX.Sent', 'Sent', '.Sent', 'Enviados']
          const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@visualdesigne.com>`
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
