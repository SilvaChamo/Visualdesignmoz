import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec'
import { detectDomainConfig } from '@/lib/email-autoconfig'
import nodemailer from 'nodemailer'
import { 
  getServerHost, 
  getHestiaUrl 
} from '@/lib/server-config'
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
    // Detectar se é admin
    const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
    const isAdmin = isExplicitAdmin || session.user?.user_metadata?.role === 'admin';
    
    console.log(`� [API] Usuário: ${session.user?.email}, isAdmin: ${isAdmin}`);
    
    let allEmails: any[] = [];
    
    // �🚀 ADMIN: Buscar TODAS as contas ativas
    if (isAdmin) {
      console.log(`📧 [API] Modo ADMIN - Buscando todas as contas`);
      const { data: allContas, error } = await supabaseAdmin
        .from('email_contas')
        .select('*')
        .or('status.eq.active,status.eq.activo')
        .limit(100);
      
      if (error) {
        console.error('📧 [API] Erro ao buscar todas as contas:', error);
      } else if (allContas && allContas.length > 0) {
        allEmails = allContas;
        console.log(`📧 [API] Encontradas ${allContas.length} contas no modo admin`);
      }
    } 
    // 🚀 CLIENTE NORMAL: Busca por domínio ou cliente_id
    else {
      // Busca por domínio do utilizador
      if (session.user?.email) {
        const userDomain = session.user.email.split('@')[1];
        console.log(`📧 [API] Buscando emails do domínio: ${userDomain}`);
        
        if (userDomain) {
          const { data: byDomain, error } = await supabaseAdmin
            .from('email_contas')
            .select('*')
            .ilike('email', `%@${userDomain}`)
            .limit(50);
          
          if (error) {
            console.error('📧 [API] Erro na query por domínio:', error);
          }
          
          if (byDomain && byDomain.length > 0) {
            allEmails = byDomain;
            console.log(`📧 [API] Encontrados ${byDomain.length} emails para ${userDomain}`);
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
          console.log(`📧 [API] Encontrados ${byClient.length} emails por cliente_id`);
        }
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
    const isAdmin = isExplicitAdmin || session.user?.user_metadata?.role === 'admin';
    if (cliente_id !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: 'Operação não autorizada' }, { status: 403 });
    }

    // 🚀 VERIFICAÇÃO: Só permite criar emails se o usuário tiver domínio gerenciado
    // ou se for admin. Usuários com Gmail/Yahoo/etc não podem criar contas de email
    if (!isAdmin) {
      const userEmailDomain = session.user.email?.split('@')[1]?.toLowerCase() || '';
      const managedDomains = ['visualdesigne.com', 'visualdesigne.pt', 'aamihe.com', 'anap.co.mz', 'entrecampos.co.mz'];
      const hasManagedDomain = managedDomains.includes(userEmailDomain);
      
      if (!hasManagedDomain) {
        return NextResponse.json({ 
          error: 'Não é possível criar contas de email', 
          details: 'Apenas clientes com domínios gerenciados podem criar emails. Contas Gmail, Yahoo e similares não têm permissão para criar contas de email adicionais.'
        }, { status: 403 });
      }
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

    // 🚀 CRIAR USUÁRIO NO SUPABASE AUTH (para poder fazer login no sistema)
    let authUserId = cliente_id
    let authUserCreated = false
    try {
      // Verificar se usuário já existe
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
      const userExists = existingUser?.users?.find(u => u.email === email)
      
      if (!userExists) {
        // Criar novo usuário no Supabase Auth
        const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true, // Auto-confirma email
          user_metadata: {
            nome: nome || user,
            role: 'client', // Padrão: cliente
            domain: domain
          }
        })
        
        if (authError) {
          console.error('Erro ao criar usuário Auth:', authError)
        } else if (newAuthUser?.user) {
          authUserId = newAuthUser.user.id
          authUserCreated = true
          console.log(`✅ Usuário Auth criado: ${email} (ID: ${authUserId})`)
        }
      } else {
        // Usuário já existe, usar ID existente
        authUserId = userExists.id
        console.log(`ℹ️ Usuário Auth já existe: ${email} (ID: ${authUserId})`)
      }
    } catch (authError: any) {
      console.error('Erro na criação do usuário Auth:', authError)
      // Continuar mesmo se falhar - a conta de email ainda é criada
    }

    // Guarda no Supabase com configurações AUTOMÁTICAS
    // Usa authUserId para vincular ao usuário do sistema
    const { data, error } = await supabaseAdmin
      .from('email_contas')
      .upsert({
        cliente_id: authUserId, // Vincula ao usuário Auth criado
        email,
        senha_cyberpanel: encrypt(password),
        tipo_conta: tipo,
        status: 'active'
      }, { onConflict: 'email' })
      .select()
      .single()

    if (error) throw error

    // 🚀 ENVIO DE EMAIL DE BOAS-VINDAS COMPLETO COM CONFIGURAÇÕES
    try {
      // Configurações do servidor para o email
      const serverConfig = {
        ip: process.env.SERVER_IP || getServerHost(),
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
        quota_mb: 1024,
        quota: '1 GB',
        contactEmail: 'admin@visualdesigne.com'
      }

      // Gerar conteúdos do email
      const welcomeHtml = generateWelcomeEmailHTML(accountInfo, serverConfig)
      const welcomeText = generateWelcomeEmailText(accountInfo, serverConfig)
      const outlookConfig = generateOutlookConfigFile(accountInfo, serverConfig)
      const termsAndConditions = getWarmupTermsAndConditions()

      // Porta 587 fixa - STARTTLS (nunca 465)
      const transporter = nodemailer.createTransport({
        host: 'mail.visualdesigne.com',
        port: 587,
        secure: false, // 587 = STARTTLS
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
      authUser: {
        created: authUserCreated,
        userId: authUserId,
        canLogin: true
      },
      credenciais: {
        email,
        password, // Incluir senha para mostrar no modal de confirmação
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

// 🆕 PUT: Atualizar/Sincronizar conta existente (para contas criadas diretamente no CyberPanel)
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { email, password, nome } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    const [user, domain] = email.split('@')
    if (!user || !domain) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Configuração padrão
    const domainConfig = {
      imap: `mail.${domain}`,
      smtp: `mail.${domain}`,
      ports: { imap: 993, smtp: 587 },
      ssl: true,
      webmail: `https://mail.${domain}`
    }

    // 🚀 CRIAR USUÁRIO NO SUPABASE AUTH (para poder fazer login no sistema)
    let authUserId = session.user.id
    let authUserCreated = false
    try {
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
      const userExists = existingUser?.users?.find(u => u.email === email)
      
      if (!userExists) {
        const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            nome: nome || user,
            role: 'client',
            domain: domain
          }
        })
        
        if (!authError && newAuthUser?.user) {
          authUserId = newAuthUser.user.id
          authUserCreated = true
          console.log(`✅ Usuário Auth criado via PUT: ${email}`)
        }
      } else {
        authUserId = userExists.id
      }
    } catch (authError: any) {
      console.error('Erro na criação do usuário Auth (PUT):', authError)
    }

    // Upsert no Supabase (atualizar ou criar) - usando apenas colunas existentes
    const { data, error } = await supabaseAdmin
      .from('email_contas')
      .upsert({
        cliente_id: authUserId, // Vincula ao usuário Auth
        email,
        tipo_conta: 'webmail',
        senha_cyberpanel: encrypt(password),
        status: 'active'
      }, { onConflict: 'email' })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Conta sincronizada com sucesso',
      conta: data,
      authUser: {
        created: authUserCreated,
        userId: authUserId,
        canLogin: true
      }
    })

  } catch (error: any) {
    console.error('Erro ao sincronizar conta:', error)
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
