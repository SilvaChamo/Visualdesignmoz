import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec'
import { detectDomainConfig } from '@/lib/email-autoconfig'
import nodemailer from 'nodemailer'

const adminEmails = ['admin@your-domain.com', 'silva.chamo@gmail.com', 'geral@your-domain.com', 'suporte@visualdesigne.com'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Cliente com privilégios de admin para operações na BD
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

// Encriptação simples base64 (para produção usar crypto)
const encrypt = (text: string) => Buffer.from(text).toString('base64')
const decrypt = (text: string) => Buffer.from(text, 'base64').toString('utf8')

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url)
  const clienteId = searchParams.get('cliente_id') || session.user.id

  // Proteção: utilizador só vê o seu próprio ID, a menos que seja admin
  const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
  if (clienteId !== session.user.id && session.user?.user_metadata?.role !== 'admin' && !isExplicitAdmin) {
    return NextResponse.json({ error: 'Acesso proibido a dados de terceiros' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('email_contas')
      .select('*')
      .eq('cliente_id', clienteId)

    if (error) throw error

    const contas = (data || []).map(c => ({
      ...c,
      password_smtp: '' // nunca devolver password
    }))

    return NextResponse.json({ success: true, contas })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { cliente_id = session.user.id, email, password, nome, tipo = 'webmail' } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }

    // Proteção: não deixar criar conta para outro cliente ID se não for admin
    const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
    if (cliente_id !== session.user.id && session.user?.user_metadata?.role !== 'admin' && !isExplicitAdmin) {
      return NextResponse.json({ error: 'Operação não autorizada' }, { status: 403 });
    }

    // Detectar configurações ideais
    const domainConfig = detectDomainConfig(email)
    const domain = email.split('@')[1]
    const user = email.split('@')[0]

    // Criar conta no CyberPanel
    let cpSuccess = false
    try {
      const output = await executeCyberPanelCommand(`cyberpanel createEmail --domainName ${domain} --userName ${user} --password '${password}'`);
      if (output.includes('successfully') || output.includes('"success": 1')) {
        cpSuccess = true
      }
    } catch (cpError) {
      console.error('Erro ao criar no CyberPanel:', cpError);
    }

    // Guarda no Supabase com configurações AUTOMÁTICAS
    const { data, error } = await supabaseAdmin
      .from('email_contas')
      .upsert({
        cliente_id,
        email,
        nome_conta: nome || user,
        servidor_imap: domainConfig.imap,
        porta_imap: domainConfig.ports.imap,
        servidor_smtp: domainConfig.smtp,
        porta_smtp: domainConfig.ports.smtp,
        ssl_imap: domainConfig.ssl,
        ssl_smtp: domainConfig.ssl,
        tipo_conta: tipo,
        password_smtp: encrypt(password),
        activo: true
      }, { onConflict: 'email' })
      .select()
      .single()

    if (error) throw error

    // ENVIO DE EMAIL DE BOAS-VINDAS COM CONFIGURAÇÕES
    try {
      const transporter = nodemailer.createTransport({
        host: domainConfig.smtp,
        port: domainConfig.ports.smtp,
        secure: domainConfig.ports.smtp === 465,
        auth: {
          user: process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com',
          pass: process.env.SMTP_MASTER_PASSWORD || 'EmailAdmin#2425'
        },
        tls: { rejectUnauthorized: false }
      })

      const welcomeHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #eee; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">E-mail Configurado!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Bem-vindo à sua nova caixa de correio profissional.</p>
          </div>
          
          <div style="padding: 30px; background: white;">
            <p style="font-size: 16px; line-height: 1.6;">Olá <strong>${nome || user}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #666;">A sua conta <strong>${email}</strong> foi criada com sucesso. Abaixo os dados para configurar o seu e-mail no telemóvel ou PC.</p>
            
            <div style="margin: 25px 0; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
              <h3 style="margin: 0 0 15px 0; font-size: 15px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">⚙️ Dados de Configuração</h3>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #71717a;">Utilizador:</td><td style="padding: 8px 0; font-weight: 600;">${email}</td></tr>
                <tr><td style="padding: 8px 0; color: #71717a;">Servidor IMAP/SMTP:</td><td style="padding: 8px 0; font-weight: 600;">${domainConfig.imap}</td></tr>
                <tr><td style="padding: 8px 0; color: #71717a;">Porta IMAP:</td><td style="padding: 8px 0; font-weight: 600;">${domainConfig.ports.imap} (SSL)</td></tr>
                <tr><td style="padding: 8px 0; color: #71717a;">Porta SMTP:</td><td style="padding: 8px 0; font-weight: 600;">${domainConfig.ports.smtp} (SSL)</td></tr>
              </table>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${domainConfig.webmail}" style="background: #111827; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Aceder ao Webmail</a>
            </div>
          </div>
        </div>
      `

      await transporter.sendMail({
        from: `"Suporte VisualDesigne" <suporte@visualdesigne.com>`,
        to: email,
        subject: `[Configuração] A sua nova conta de e-mail: ${email}`,
        html: welcomeHtml
      })
    } catch (mailErr) {
      console.error('Erro ao enviar email de boas-vindas:', mailErr)
    }

    return NextResponse.json({
      success: true,
      conta: data,
      credenciais: {
        email,
        servidor_entrada: domainConfig.imap,
        porta_imap: domainConfig.ports.imap,
        servidor_saida: domainConfig.smtp,
        porta_smtp: domainConfig.ports.smtp,
        ssl: domainConfig.ssl,
        utilizador: email,
        webmail: domainConfig.webmail
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { email } = await req.json()

    // Primeiro verificar se a conta pertence ao utilizador ou se é admin
    const { data: conta } = await supabaseAdmin.from('email_contas').select('cliente_id').eq('email', email).single();

    const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
    if (conta?.cliente_id !== session.user.id && session.user?.user_metadata?.role !== 'admin' && !isExplicitAdmin) {
      return NextResponse.json({ error: 'Não tens permissão para eliminar esta conta' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('email_contas').delete().eq('email', email)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
