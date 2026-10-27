import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getDefaultFrom, getSupportEmail, sendSmtpMail } from '@/lib/smtp-mail'
import { ipDoPedido, passouOLimite } from '@/lib/limite-pedidos'

// Tudo o que vem do pedido entra em HTML de e-mails (para a equipa e para o cliente): sem isto, quem chamasse a rota
// metia ligações e texto à vontade num e-mail enviado pelo domínio da VisualDesign.
const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(req: NextRequest) {
  try {
    // Rota pública: limite por rede e por endereço (o "captcha" abaixo é enviado pelo próprio cliente e não trava ninguém).
    const ipPedido = ipDoPedido(req)
    if (passouOLimite(`ticket-ip:${ipPedido}`, 5, 60 * 60_000)) {
      return NextResponse.json({ error: 'Demasiados pedidos. Tente novamente daqui a algum tempo.' }, { status: 429 })
    }

    const corpo = await req.json()
    const {
      categoria, prioridade, siteId,
      website_url, // honeypot
      captchaAnswer, captchaResult // anti-spam
    } = corpo
    // texto limpo e com tamanho máximo
    const assunto = String(corpo.assunto ?? '').slice(0, 200)
    const descricao = String(corpo.descricao ?? '').slice(0, 5000)
    const clienteNome = String(corpo.clienteNome ?? '').slice(0, 120)
    const clienteEmail = String(corpo.clienteEmail ?? '').trim().slice(0, 200)
    const anexoUrl = /^https:\/\//i.test(String(corpo.anexoUrl ?? '')) ? String(corpo.anexoUrl).slice(0, 1000) : ''

    // 1. Anti-spam validation
    if (website_url) {
      console.warn('Honeypot triggered!')
      return NextResponse.json({ error: 'Pedido suspeito (spam).' }, { status: 400 })
    }

    if (parseInt(captchaAnswer) !== parseInt(captchaResult)) {
      return NextResponse.json({ error: 'Resposta de segurança incorrecta.' }, { status: 400 })
    }

    if (!assunto || !descricao || !clienteEmail) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta.' }, { status: 400 })
    }
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(clienteEmail)) {
      return NextResponse.json({ error: 'Escreva um e-mail válido.' }, { status: 400 })
    }
    if (passouOLimite(`ticket-email:${clienteEmail.toLowerCase()}`, 3, 60 * 60_000)) {
      return NextResponse.json({ error: 'Demasiados pedidos. Tente novamente daqui a algum tempo.' }, { status: 429 })
    }

    // 2. Guardar ticket no Supabase (se possível)
    let ticketId = null
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      if (supabaseUrl && supabaseKey) {
        const supabase = createAdminClient(supabaseUrl, supabaseKey)
        
        // Find user by email to get client ID
        const { data: userData } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', clienteEmail)
          .single()

        const { data } = await supabase.from('tickets_suporte').insert({
          cliente_id: userData?.id,
          assunto,
          descricao,
          categoria: categoria?.toLowerCase() || 'general',
          prioridade: prioridade?.toLowerCase() || 'normal',
          site_id: siteId || null,
          anexo_url: anexoUrl || null,
          status: 'open'
        }).select('id').single()
        if (data) ticketId = data.id
      }
    } catch (dbErr) {
      console.error('Erro ao guardar ticket no DB:', dbErr)
    }

    const fromAddress = getDefaultFrom()
    const notifyEmail = getSupportEmail()

    const ticketRef = ticketId ? `#${String(ticketId).substring(0, 8)}` : `#${Date.now()}`

    const htmlEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
        <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 20px;">🎫 Novo Ticket de Suporte ${ticketRef}</h2>
        </div>
        <div style="background: white; padding: 25px; border: 1px solid #e5e7eb; border-top: none;">
          <h3 style="margin-top: 0; color: #111827; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px;">Informações do Pedido</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px 0; font-weight: bold; width: 150px;">Cliente:</td>
              <td style="padding: 10px 0; color: #4b5563;">${esc(clienteNome)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold;">Email:</td>
              <td style="padding: 10px 0; color: #4b5563;">${esc(clienteEmail)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold;">Prioridade:</td>
              <td style="padding: 10px 0;"><span style="background: ${prioridade === 'Urgent' ? '#fee2e2' : '#f3f4f6'}; color: ${prioridade === 'Urgent' ? '#991b1b' : '#374151'}; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: bold;">${esc(prioridade || 'Normal')}</span></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold;">Categoria:</td>
              <td style="padding: 10px 0; color: #4b5563;">${esc(categoria || 'Geral')}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold;">Serviço:</td>
              <td style="padding: 10px 0; color: #4b5563;">${esc(siteId || 'Não especificado')}</td>
            </tr>
          </table>

          <h3 style="color: #111827; margin-bottom: 10px;">Descrição do Problema:</h3>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; white-space: pre-wrap; line-height: 1.6;">${esc(descricao)}</div>

          ${anexoUrl ? `
            <div style="margin-top: 25px; padding: 20px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; text-align: center;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">📸 Existe um anexo de imagem:</p>
              <a href="${esc(anexoUrl)}" target="_blank" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver Imagem em Anexo</a>
            </div>
          ` : ''}
        </div>
        <div style="background: #f3f4f6; padding: 15px 25px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">Ticket gerado via Portal VisualDesigne — Sistema de Gestão</p>
        </div>
      </div>
    `

    await sendSmtpMail({
      from: fromAddress,
      to: notifyEmail,
      replyTo: clienteEmail,
      subject: `[Ticket ${ticketRef}] [${String(prioridade || 'Normal').slice(0, 20)}] ${assunto.replace(/[\r\n]+/g, ' ')}`,
      html: htmlEmail
    })

    // 4. Enviar confirmação ao cliente
    const htmlConfirmacao = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
        <div style="background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 20px;">✅ Recebemos o seu Ticket ${ticketRef}</h2>
        </div>
        <div style="background: white; padding: 25px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Olá <strong>${esc(clienteNome)}</strong>,</p>
          <p>Confirmamos que o seu pedido de suporte foi registado com sucesso e a nossa equipa já foi notificada.</p>
          
          <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-left: 4px solid #16a34a;">
            <p style="margin: 0; font-weight: bold;">${esc(assunto)}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">Referência: ${ticketRef} | Prioridade: ${esc(prioridade || 'Normal')}</p>
          </div>

          <p>Iremos analisar o seu caso e responderemos para este endereço de email o mais brevemente possível.</p>
          <p style="margin-top: 30px;">Obrigado pela preferência,<br><strong>Equipa de Suporte VisualDesigne</strong></p>
        </div>
        <div style="text-align: center; padding-top: 20px;">
          <p style="font-size: 11px; color: #9ca3af;">Não responda diretamente a este email automático.</p>
        </div>
      </div>
    `

    try {
      await sendSmtpMail({
        from: fromAddress,
        to: clienteEmail,
        subject: `[Suporte VD] Confirmação de Ticket ${ticketRef}`,
        html: htmlConfirmacao
      })
    } catch (confirmErr) {
      console.error('Erro ao enviar confirmação ao cliente:', confirmErr)
    }

    return NextResponse.json({ 
      success: true, 
      ticketId: ticketRef,
      message: 'Ticket enviado com sucesso!' 
    })

  } catch (error: any) {
    console.error('Ticket API Error:', error)
    return NextResponse.json({ error: error.message || 'Erro ao enviar ticket.' }, { status: 500 })
  }
}
