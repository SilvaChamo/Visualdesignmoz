import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec'
import { detectDomainConfig } from '@/lib/email-autoconfig'
import nodemailer from 'nodemailer'
import { 
  generateWelcomeEmailHTML, 
  generateWelcomeEmailText, 
  generateOutlookConfigFile,
  getWarmupTermsAndConditions
} from '@/lib/email-welcome-service'

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
    // 🚀 BUSCA SIMPLIFICADA: apenas por domínio do utilizador (evita locks)
    let allEmails: any[] = [];
    
    if (session.user?.email) {
      const userDomain = session.user.email.split('@')[1];
      console.log(`📧 Buscando emails do domínio: ${userDomain}`);
      
      if (userDomain) {
        const { data: byDomain, error } = await supabaseAdmin
          .from('email_contas')
          .select('*')
          .ilike('email', `%@${userDomain}`)
          .limit(50); // Limitar para evitar timeouts
        
        if (error) {
          console.error('📧 Erro na query:', error);
        }
        
        if (byDomain && byDomain.length > 0) {
          allEmails = byDomain;
          console.log(`📧 Encontrados ${byDomain.length} emails para ${userDomain}`);
        }
      }
    }
    
    // Se não encontrou nada, tentar por cliente_id como fallback
    if (allEmails.length === 0) {
      const { data: byClient, error } = await supabaseAdmin
        .from('email_contas')
        .select('*')
        .eq('cliente_id', clienteId)
        .limit(50);
      
      if (!error && byClient) {
        allEmails = byClient;
        console.log(`📧 Encontrados ${byClient.length} emails por cliente_id`);
      }
    }

    console.log(`📧 API email-contas: ${allEmails.length} emails`);
    console.log('📧 Emails:', allEmails.map((e: any) => e.email));

    const contas = allEmails.map(c => ({
      ...c,
      password_smtp: '' // nunca devolver password
    }))

    return NextResponse.json({ success: true, contas, debug: { totalReturned: allEmails.length } })
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

    // 🚀 ENVIO DE EMAIL DE BOAS-VINDAS COMPLETO COM CONFIGURAÇÕES
    try {
      // Configurações do servidor para o email
      const serverConfig = {
        ip: process.env.SERVER_IP || '109.199.104.22',
        nameservers: [
          'ns1.mozserver.com',
          'ns2.mozserver.com',
          'ns3.mozserver.com',
          'ns4.mozserver.com'
        ],
        package: `vd_${domain}`
      }

      const accountInfo = {
        email,
        password,
        domain,
        username: user,
        quota: '1 GB',
        contactEmail: 'admin@visualdesigne.com'
      }

      // Gerar conteúdos do email
      const welcomeHtml = generateWelcomeEmailHTML(accountInfo, serverConfig)
      const welcomeText = generateWelcomeEmailText(accountInfo, serverConfig)
      const outlookConfig = generateOutlookConfigFile(accountInfo, serverConfig)
      const termsAndConditions = getWarmupTermsAndConditions()

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || '109.199.104.22',
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: {
          user: process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com',
          pass: process.env.SMTP_MASTER_PASSWORD || ''
        },
        tls: { rejectUnauthorized: false }
      })

      await transporter.sendMail({
        from: `"VisualDesign Email" <admin@visualdesigne.com>`,
        to: email,
        subject: `🎉 Nova Conta de Email Configurada - ${email}`,
        text: welcomeText,
        html: welcomeHtml,
        attachments: [
          {
            filename: `configuracao-outlook-${domain}.txt`,
            content: outlookConfig,
            contentType: 'text/plain'
          },
          {
            filename: 'termos-condicoes-warmup.txt',
            content: termsAndConditions,
            contentType: 'text/plain'
          },
          {
            filename: `dados-conta-${user}.txt`,
            content: `
+===================================+
| New Account Info                  |
+===================================+
| Domain: ${domain}
| IP: ${serverConfig.ip}
| UserName: ${user}
| PassWord: ${password}
| Quota: ${accountInfo.quota}
| NameServer1: ${serverConfig.nameservers[0]}
| NameServer2: ${serverConfig.nameservers[1]}
| NameServer3: ${serverConfig.nameservers[2]}
| NameServer4: ${serverConfig.nameservers[3]}
| Contact Email: ${accountInfo.contactEmail}
| Package: ${serverConfig.package}
+===================================+

CONFIGURAÇÕES OUTLOOK:
- IMAP Server: ${domainConfig.imap}
- IMAP Port: ${domainConfig.ports.imap}
- SMTP Server: ${domainConfig.smtp}
- SMTP Port: ${domainConfig.ports.smtp}
- SSL/TLS: Ativado
- Username: ${email}
- Password: ${password}

⚠️ SISTEMA WARM-UP ATIVO:
Consulte o documento anexo "termos-condicoes-warmup.txt"

VisualDesign - ${new Date().getFullYear()}
            `,
            contentType: 'text/plain'
          }
        ]
      })

      console.log(`✅ Email de boas-vindas enviado para ${email} com configurações completas`)
    } catch (mailErr) {
      console.error('Erro ao enviar email de boas-vindas:', mailErr)
      // Não falha a criação se o email falhar
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
