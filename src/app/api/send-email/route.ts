import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { resend } from '@/lib/resend'
import fetch from 'node-fetch'
import https from 'https'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { detectDomainConfig } from '@/lib/email-autoconfig'

const decryptPassword = (text: string) => Buffer.from(text, 'base64').toString('utf8')

// CyberPanel API Config
const CYBERPANEL_API_URL = 'https://109.199.104.22:8090/send-email-api.php'
const CYBERPANEL_API_TOKEN = 'vd_api_2024_secure_token'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

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

// 🆕 FUNÇÃO: Enviar via CyberPanel API (mais fiável)
async function sendViaCyberPanelAPI(
  to: string | string[],
  subject: string,
  html: string,
  from: string
) {
  try {
    console.log('🚀 CYBERPANEL API: Enviando email via servidor...')
    
    const toArray = Array.isArray(to) ? to : [to]
    
    const response = await fetch(CYBERPANEL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CYBERPANEL_API_TOKEN}`
      },
      body: JSON.stringify({
        to: toArray,
        subject,
        html,
        from,
        fromName: ''
      }),
      // @ts-ignore
      agent: httpsAgent
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Falha na API CyberPanel')
    }
    
    console.log('✅ CyberPanel API:', result)
    
    return {
      success: true,
      messageId: result.messageId || `cp-${Date.now()}`,
      provider: 'cyberpanel-api',
      details: result.details
    }
    
  } catch (error: any) {
    console.error('❌ CyberPanel API falhou:', error)
    throw error
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

    // 🆕 1. PRIORIDADE: CyberPanel API (mais fiável - usa SMTP local do servidor)
    if (from && to && subject) {
      try {
        console.log('🚀 PRIORIDADE 1: Tentando CyberPanel API...')
        const result = await sendViaCyberPanelAPI(to, subject, html || '', from)
        
        if (result.success) {
          // TAREFA 2: Registar idempotency key
          if (idempotencyKey) {
            processedKeys.set(idempotencyKey, { timestamp: Date.now(), messageId: result.messageId })
          }
          return NextResponse.json({ 
            success: true, 
            messageId: result.messageId, 
            provider: 'cyberpanel-api',
            details: result.details 
          });
        }
      } catch (cpError: any) {
        console.error('CyberPanel API falhou, tentando outros métodos:', cpError.message)
        // Continua para próximo método
      }
    }

    // 2. SEGUNDA OPÇÃO: Resend APENAS para emails transacionais (recuperação de password, etc.)
    const isResendAvailable = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_placeholder';
    const isTransactional = category === 'transactional';
    const isAuthorizedDomain = from?.toLowerCase().endsWith('@visualdesigne.com');

    if (isResendAvailable && isTransactional && isAuthorizedDomain) {
      console.log('📧 PRIORIDADE 2: Usando Resend para transactional...');
      try {
        const senderEmail = from || 'noreply@visualdesigne.com';
        
        console.log('📧 RESEND - Enviando email:', {
          from: senderEmail,
          to: Array.isArray(to) ? to[0] : to,
          subject: subject?.substring(0, 50)
        });
        
        const { data, error } = await resend.emails.send({
          from: senderEmail,
          to, cc, bcc, subject,
          html: html || '',
          replyTo: replyTo || senderEmail
        });

        if (!error) {
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

    // 3. FALLBACK FINAL: Nodemailer (SMTP Direto) - só se tudo falhar
    if (!from || !to || !subject) {
      return NextResponse.json({
        error: 'Campos obrigatórios em falta (from, to, subject) para envio via SMTP.'
      }, { status: 400 })
    }

    // Detectar configuração do domínio dinamicamente
    const domainConfig = detectDomainConfig(from)
    
    // Se não tem password, usar conta SMTP master para autenticar
    const smtpUser = fromPassword ? from : (process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com')
    const smtpPass = fromPassword || process.env.SMTP_MASTER_PASSWORD || 'EmailAdmin#2425'

    console.log('Using Nodemailer dynamic delivery...');
    console.log('SMTP DEBUG - user:', smtpUser, '| host:', domainConfig.smtp, '| from:', from);
    
    const transporter = nodemailer.createTransport({
      host: domainConfig.smtp,
      port: domainConfig.ports.smtp,
      secure: domainConfig.ports.smtp === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
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
            host: domainConfig.imap,
            port: domainConfig.ports.imap,
            secure: domainConfig.ports.imap === 993,
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
