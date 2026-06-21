import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { detectDomainConfig } from '@/lib/email-autoconfig'
import { PANEL_SLUG, inferPanelSiteFromEmail } from '@/lib/panel-tenant'
import { decryptStoredPassword, buildPanelAccessConfigText } from '@/lib/panel-access-credentials'
import { STANDARD_PANEL_PASSWORD } from '@/lib/stored-panel-password'
import { resolveRoleForAuthUser } from '@/lib/server-auth-role'
import { ADMIN_BOOTSTRAP_EMAILS } from '@/lib/panel-user-registry'
import type { User } from '@supabase/supabase-js'

async function resolveSessionUser(supabase: Awaited<ReturnType<typeof createClient>>): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) return session.user
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!error && user) return user
  return null
}

function isBootstrapAdmin(email?: string | null): boolean {
  return ADMIN_BOOTSTRAP_EMAILS.has((email || '').toLowerCase())
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Cliente com privilégios de admin para operações na BD
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

// Encriptação simples base64 (para produção usar crypto)
const encrypt = (text: string) => Buffer.from(text).toString('base64')
const decrypt = (text: string) => Buffer.from(text, 'base64').toString('utf8')

function userCanAccessMailboxPassword(
  sessionUser: { id: string; email?: string | null },
  account: { email?: string | null; cliente_id?: string | null },
  isAdmin: boolean,
  effectiveRole: string,
): boolean {
  if (isAdmin || effectiveRole === 'manager') return true
  if (effectiveRole === 'reseller') return true
  if (account.cliente_id && account.cliente_id === sessionUser.id) return true
  const sessionEmail = (sessionUser.email || '').toLowerCase()
  const accountEmail = (account.email || '').toLowerCase()
  if (sessionEmail && accountEmail === sessionEmail) return true
  const sessionDomain = sessionEmail.split('@')[1]
  const accountDomain = accountEmail.split('@')[1]
  if (sessionDomain && accountDomain && sessionDomain === accountDomain) return true
  return false
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const sessionUser = await resolveSessionUser(supabase);

  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const session = { user: sessionUser };

  const { searchParams } = new URL(req.url)
  const configEmail = searchParams.get('config_email')?.trim().toLowerCase()

  if (configEmail) {
    const roleDb = supabaseAdmin;
    const effectiveRole = session.user
      ? await resolveRoleForAuthUser(roleDb, session.user)
      : 'guest';
    const isAdmin = isBootstrapAdmin(session.user?.email) || effectiveRole === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
    }

    const { data: row } = await supabaseAdmin
      .from('email_contas')
      .select('email, senha_servidor, quota_mb, tipo_conta')
      .eq('email', configEmail)
      .maybeSingle();

    let password = row?.senha_servidor ? decryptStoredPassword(row.senha_servidor as string) : '';

    if (!password) {
      const std = STANDARD_PANEL_PASSWORD;
      if (std) password = std;
    }

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Credenciais não encontradas para esta conta.' },
        { status: 404 },
      );
    }

    if (row?.tipo_conta === 'panel') {
      const { getProfileForAuthUser } = await import('@/lib/profile-db');
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      let authUser = authList.users.find((u) => u.email?.toLowerCase() === configEmail);
      if (!authUser) {
        for (let page = 2; page <= 20 && !authUser; page++) {
          const { data: nextPage } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
          authUser = nextPage.users.find((u) => u.email?.toLowerCase() === configEmail);
          if (!nextPage.users?.length || nextPage.users.length < 1000) break;
        }
      }
      const profile = authUser ? await getProfileForAuthUser(supabaseAdmin, authUser.id) : null;
      const panelBundle = buildPanelAccessConfigText({
        email: configEmail,
        password,
        panelRole: String(profile?.role || authUser?.user_metadata?.role || 'client'),
        name: profile?.name,
      });
      return NextResponse.json({
        success: true,
        email: configEmail,
        password,
        ...panelBundle,
      });
    }

    const { buildEmailConfigBundle } = await import('@/lib/email-client-config-export');
    const bundle = buildEmailConfigBundle(configEmail, password, row?.quota_mb as number | undefined);
    return NextResponse.json({ success: true, email: configEmail, password, ...bundle });
  }

  const clienteId = searchParams.get('cliente_id') || session.user.id

  // Proteção: utilizador só vê o seu próprio ID, a menos que seja admin
  const isBootstrap = isBootstrapAdmin(session.user?.email);
  if (clienteId !== session.user.id && session.user?.user_metadata?.role !== 'admin' && !isBootstrap) {
    return NextResponse.json({ error: 'Acesso proibido a dados de terceiros' }, { status: 403 });
  }

  try {
    // Detectar perfil (admin, revendedor, cliente)
    const roleDb = supabaseAdmin;
    const effectiveRole = session.user
      ? await resolveRoleForAuthUser(roleDb, session.user)
      : 'guest';
    const isAdmin = isBootstrap || effectiveRole === 'admin' || effectiveRole === 'manager';
    
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
      password_smtp:
        c.senha_servidor && userCanAccessMailboxPassword(session.user, c, isAdmin, effectiveRole)
          ? decrypt(c.senha_servidor)
          : '',
    }))

    return NextResponse.json({ success: true, contas, debug: { totalReturned: allEmails.length } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const sessionUser = await resolveSessionUser(supabase);

  if (!sessionUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const session = { user: sessionUser };

  try {
    const { cliente_id = session.user.id, email, password, nome, tipo = 'webmail' } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }

    // Proteção: não deixar criar conta para outro cliente ID se não for admin
    const isAdmin = isBootstrapAdmin(session.user?.email) || session.user?.user_metadata?.role === 'admin';
    if (cliente_id !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: 'Operação não autorizada' }, { status: 403 });
    }

    // 🚀 VERIFICAÇÃO: Só permite criar emails se o usuário tiver domínio gerenciado
    // ou se for admin. Usuários com Gmail/Yahoo/etc não podem criar contas de email
    if (!isAdmin) {
      const userEmailDomain = session.user.email?.split('@')[1]?.toLowerCase() || '';
      const managedDomains = ['visualdesignmoz.com', 'visualdesignmoz.com', 'visualdesigne.pt', 'aamihe.com', 'anap.co.mz', 'entrecampos.co.mz'];
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
            role: 'client',
            domain: domain,
            site: inferPanelSiteFromEmail(email) || PANEL_SLUG,
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
        senha_servidor: encrypt(password),
        tipo_conta: tipo,
        status: 'active'
      }, { onConflict: 'email' })
      .select()
      .single()

    if (error) throw error

    // Envio automático das configurações IMAP/SMTP em texto simples
    try {
      const { sendPlainEmailConfigToMailbox } = await import('@/lib/email-config-send-server');
      await sendPlainEmailConfigToMailbox(email, password, 1024);
      console.log(`Configurações enviadas para ${email}`);
    } catch (mailErr) {
      console.error('Erro ao enviar configurações por e-mail:', mailErr);
    }

    const configBundle = (await import('@/lib/email-client-config-export')).buildEmailConfigBundle(
      email,
      password,
      1024,
    );

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
        password,
        servidor_entrada: domainConfig.imap,
        porta_imap: domainConfig.ports.imap,
        servidor_saida: domainConfig.smtp,
        porta_smtp: domainConfig.ports.smtp,
        ssl: domainConfig.ssl,
        utilizador: email,
        webmail: domainConfig.webmail
      },
      plainText: configBundle.plainText,
      outlookFile: configBundle.outlookFile,
      shareText: configBundle.shareText,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 🆕 PUT: Atualizar/Sincronizar conta existente (para contas criadas directamente no servidor)
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
      webmail: `https://webmail.${domain}`
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
        senha_servidor: encrypt(password),
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
  const sessionUser = await resolveSessionUser(supabase);

  if (!sessionUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const session = { user: sessionUser };

  try {
    const { email } = await req.json()

    // Primeiro verificar se a conta pertence ao utilizador ou se é admin
    const { data: conta } = await supabaseAdmin.from('email_contas').select('cliente_id').eq('email', email).single();

    if (conta?.cliente_id !== session.user.id && session.user?.user_metadata?.role !== 'admin' && !isBootstrapAdmin(session.user?.email)) {
      return NextResponse.json({ error: 'Não tens permissão para eliminar esta conta' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('email_contas').delete().eq('email', email)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
