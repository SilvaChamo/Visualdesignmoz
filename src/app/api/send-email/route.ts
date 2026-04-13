import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Criar cliente admin do Supabase
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const decryptPassword = (text: string) => Buffer.from(text, 'base64').toString('utf8')

// Configuração SMTP do CyberPanel - DEFINITIVA: sempre usar porta 587
// Porta 587 = STARTTLS (mais compatível e funciona em todos os servidores)
// IGNORAR qualquer variável SMTP_PORT definida no .env para evitar erros com porta 465
const SMTP_HOST = 'mail.visualdesigne.com'  // Host fixo do servidor
const SMTP_PORT = 587  // Porta fixa - nunca muda
const SMTP_SECURE = false  // 587 usa STARTTLS, não SSL direto

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

// 🆕 FUNÇÃO: Buscar senha do Supabase para qualquer email
async function getEmailPasswordFromSupabase(email: string): Promise<string | null> {
  try {
    console.log('🔍 [DEBUG] Buscando senha no Supabase para:', email)
    
    const { data, error } = await supabaseAdmin
      .from('email_contas')
      .select('senha_cyberpanel')
      .eq('email', email)
      .single()
    
    if (error) {
      console.log('❌ [DEBUG] Erro Supabase:', error.message)
      return null
    }
    
    if (!data?.senha_cyberpanel) {
      console.log('❌ [DEBUG] Sem senha_cyberpanel para:', email)
      return null
    }
    
    console.log('✅ [DEBUG] Senha encontrada (criptografada):', data.senha_cyberpanel.substring(0, 20) + '...')
    
    // Decrypt base64 password
    const decrypted = Buffer.from(data.senha_cyberpanel, 'base64').toString('utf8')
    console.log('✅ [DEBUG] Senha descriptografada, tamanho:', decrypted.length)
    
    return decrypted
  } catch (err: any) {
    console.log('❌ [DEBUG] Erro ao buscar senha:', err.message)
    return null
  }
}

// 🆕 FUNÇÃO: Enviar via SMTP direto do CyberPanel
// Qualquer conta funciona - busca senha automaticamente do Supabase
async function sendViaSMTP(
  to: string | string[],
  cc: string | string[],
  bcc: string | string[],
  subject: string,
  html: string,
  from: string,
  fromPassword: string | null
): Promise<{ success: boolean; messageId?: string; usedFallback?: boolean }> {
  console.log('📧 SMTP: Enviando email via CyberPanel...')
  
  // Se não temos senha, buscar do Supabase
  let password = fromPassword
  let usedFallback = false
  
  if (!password) {
    console.log('🔍 Buscando senha do Supabase para:', from)
    password = await getEmailPasswordFromSupabase(from)
    
    if (!password) {
      console.log('⚠️ Senha não encontrada no Supabase para:', from)
      throw new Error(`Senha não encontrada para ${from}. Crie o email primeiro no painel.`)
    }
    
    usedFallback = true
    console.log('✅ Senha recuperada do Supabase')
  }
  
  // Criar transporter com as credenciais
  console.log('🔌 [DEBUG] Criando transporter SMTP:', { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE, user: from })
  console.log('🔑 [DEBUG] Usando senha:', usedFallback ? '(do Supabase)' : '(fornecida)', 'tamanho:', password?.length)
  
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: from, pass: password },
    tls: { rejectUnauthorized: false },
    debug: true, // Ativar debug do Nodemailer
    logger: true  // Ativar logs do Nodemailer
  })
  
  const info = await transporter.sendMail({ from, to, cc, bcc, subject, html })
  console.log('✅ Email enviado:', info.messageId, usedFallback ? '(senha do Supabase)' : '(senha fornecida)')
  
  return { success: true, messageId: info.messageId, usedFallback }
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

    // 🔄 ORDEM CORRETA: 1) Credenciais padrão (hardcoded - mais fiáveis)
    // 2) Supabase (pode ter senhas desatualizadas)
    const CREDENCIAIS_PADRAO: Record<string, string> = {
      'silva.chamo@visualdesigne.com': 'Meckito#1977?*',
      'geral@visualdesigne.com': 'Ge.Vd#2425?*',
      'admin@visualdesigne.com': 'EmailAdmin#2425',
      'info@visualdesigne.com': 'Informação!#2020?*',
      'suporte@visualdesigne.com': 'SupaEmail#2026?*',
      'noreply@visualdesigne.com': 'VisualDesign#2026',
      'eventos@oshercollective.com': 'xqqh[bLr5!&9jMv{',
      'oshercollective@gmail.com': 'gce7G)S-1FfUX)-b',
      'osher@oshercollective.com': 'gce7G)S-1FfUX)-b',
      'dance@oshercollective.com': 'N5bw)QWv9pVvU}dM',
      'academic@oshercollective.com': 'eS3J)tCCCoVhtHTt',
    }
    
    // PRIORIDADE 1: Usar credenciais padrão se existirem
    if (from && !fromPassword && CREDENCIAIS_PADRAO[from]) {
      fromPassword = CREDENCIAIS_PADRAO[from]
      console.log('✅ Usando credencial padrão hardcoded para:', from)
    }
    
    // PRIORIDADE 2: Buscar no Supabase se não tiver credencial padrão
    if (from && !fromPassword) {
      try {
        console.log('🔍 Buscando senha no Supabase para:', from)
        const password = await getEmailPasswordFromSupabase(from)
        if (password) {
          fromPassword = password
          console.log('✅ Senha recuperada do Supabase para:', from)
        }
      } catch (e) {
        console.log('⚠️ Não foi possível buscar do Supabase:', from)
      }
    }

    // 🆕 1. PRIORIDADE: SMTP direto do CyberPanel (mais fiável)
    if (from && fromPassword && to && subject) {
      try {
        console.log('📧 PRIORIDADE 1: Enviando via SMTP CyberPanel...')
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
