import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { resend } from '@/lib/resend'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const decryptPassword = (text: string) => Buffer.from(text, 'base64').toString('utf8')

export async function POST(req: NextRequest) {
  try {
    let { from, fromPassword, to, cc, bcc, subject, html, replyTo, category } = await req.json()

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
      tls: { rejectUnauthorized: false }
    })

    const info = await transporter.sendMail({
      from, to, cc, bcc, subject,
      html: html || '',
      replyTo: replyTo || from
    })

    return NextResponse.json({ success: true, messageId: info.messageId, provider: 'nodemailer' })
  } catch (error: any) {
    console.error('Email API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
