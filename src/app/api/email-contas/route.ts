import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { detectDomainConfig } from '@/lib/email-autoconfig'
import { PANEL_SLUG, inferPanelSiteFromEmail } from '@/lib/panel-tenant'
import { encryptStoredPassword, decryptStoredPassword } from '@/lib/panel-access-credentials'
import { buildPanelAccessConfigText } from '@/lib/panel-access-config-text'
import { getStandardPanelPassword } from '@/lib/stored-panel-password'
import { resolveRoleForAuthUser } from '@/lib/server-auth-role'
import { ADMIN_BOOTSTRAP_EMAILS } from '@/lib/panel-user-registry'
import { readImpersonateDaUsername } from '@/lib/panel-api-context'
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

const encrypt = encryptStoredPassword
const decrypt = decryptStoredPassword

async function userCanAccessMailboxPassword(
  sessionUser: { id: string; email?: string | null },
  account: { email?: string | null; cliente_id?: string | null },
  isAdmin: boolean,
  effectiveRole: string,
): Promise<boolean> {
  if (isAdmin) return true
  if (account.cliente_id && account.cliente_id === sessionUser.id) return true
  const sessionEmail = (sessionUser.email || '').toLowerCase()
  const accountEmail = (account.email || '').toLowerCase()
  if (sessionEmail && accountEmail === sessionEmail) return true
  const sessionDomain = sessionEmail.split('@')[1]
  const accountDomain = accountEmail.split('@')[1]
  if (sessionDomain && accountDomain && sessionDomain === accountDomain) return true
  // Revendedor: só se o domínio da conta pertencer de facto à sua conta DA — nunca um
  // bypass total (evita que qualquer revendedor veja a password de qualquer cliente).
  if (effectiveRole === 'reseller' && accountDomain) {
    const { resolveOwnerDaUsername } = await import('@/lib/da-credential-store')
    const { resolveHostingOwner } = await import('@/lib/hosting-resolver')
    const username = await resolveOwnerDaUsername(sessionUser.id)
    if (username) {
      const owner = await resolveHostingOwner(accountDomain)
      if (owner === username) return true
    }
  }
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
      try {
        password = getStandardPanelPassword();
      } catch {
        /* sem fallback configurado — segue para o erro abaixo */
      }
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

  // Protecção: utilizador só vê o seu próprio ID, a menos que seja admin
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
    const isAdmin = isBootstrap || effectiveRole === 'admin';
    // Admin a impersonar um revendedor deve ver só as contas do revendedor impersonado,
    // nunca as de toda a empresa (mesma lógica de /api/panel/bootstrap).
    const impersonating = isAdmin ? await readImpersonateDaUsername() : null;

    console.log(`� [API] Usuário: ${session.user?.email}, isAdmin: ${isAdmin}, impersonating: ${impersonating || 'não'}`);

    let allEmails: any[] = [];

    // �🚀 ADMIN: Buscar TODAS as contas activas
    if (isAdmin) {
      const { data: allContas, error } = await supabaseAdmin
        .from('email_contas')
        .select('*')
        .or('status.eq.active,status.eq.activo')
        .limit(100);

      if (error) {
        console.error('📧 [API] Erro ao buscar todas as contas:', error);
      } else if (allContas && allContas.length > 0) {
        if (impersonating) {
          const { listHostingDomains } = await import('@/lib/hosting-resolver');
          const sites = await listHostingDomains({ role: 'reseller', daUsername: impersonating });
          const ownedDomains = new Set(sites.map((s) => s.domain.toLowerCase()));
          allEmails = allContas.filter((c: any) => {
            const domain = String(c.email || '').split('@')[1]?.toLowerCase();
            return domain ? ownedDomains.has(domain) : false;
          });
          console.log(`📧 [API] Modo ADMIN (impersonando ${impersonating}) - ${allEmails.length} contas`);
        } else {
          allEmails = allContas;
          console.log(`📧 [API] Modo ADMIN - Encontradas ${allContas.length} contas`);
        }
      }
    }
    // 🚀 CLIENTE / REVENDEDOR: só contas próprias (cliente_id) ou de domínios
    // que realmente lhes pertencem no DirectAdmin — nunca por correspondência
    // de string do domínio do próprio email de login (isso deixava a conta de
    // um tenant aparecer no selector de outro só por partilharem sufixo de domínio).
    else {
      // No Contabo (Hestia), listHostingDomains devolve domínios Hestia directos;
      // no Hetzner, usa mirror. Para clientes, o filtro por userId é feito depois.
      const { listHostingDomains } = await import('@/lib/hosting-resolver');
      const ownedSites = await listHostingDomains();
      const ownedDomains = new Set(ownedSites.map((s) => s.domain.toLowerCase()));

      const { data: activeContas, error } = await supabaseAdmin
        .from('email_contas')
        .select('*')
        .or('status.eq.active,status.eq.activo')
        .limit(200);

      if (error) {
        console.error('📧 [API] Erro ao buscar contas para filtrar por cliente/domínio:', error);
      } else if (activeContas) {
        allEmails = activeContas.filter((c: any) => {
          if (c.cliente_id === clienteId) return true;
          const domain = String(c.email || '').split('@')[1]?.toLowerCase();
          return domain ? ownedDomains.has(domain) : false;
        });
        console.log(`📧 [API] Modo CLIENTE/REVENDEDOR - ${allEmails.length} contas (domínios próprios: ${[...ownedDomains].join(', ') || 'nenhum'})`);
      }
    }

    console.log(`📧 API email-contas: ${allEmails.length} emails`);
    console.log('📧 Emails:', allEmails.map((e: any) => e.email));

    const contas = await Promise.all(allEmails.map(async c => ({
      ...c,
      password_smtp:
        c.senha_servidor && (await userCanAccessMailboxPassword(session.user, c, isAdmin, effectiveRole))
          ? decrypt(c.senha_servidor)
          : '',
    })))

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

    // Protecção: não deixar criar conta para outro cliente ID se não for admin
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

    // A FK de email_contas.cliente_id aponta para a tabela "clientes" (CRM
    // antigo de gestão de clientes), não para auth.users — gravar aqui o ID
    // do login Auth (authUserId) que acabou de ser criado/encontrado rebenta
    // sempre com "violates foreign key constraint email_contas_cliente_id_fkey",
    // porque esse ID nunca existe em "clientes". Só grava cliente_id quando
    // corresponde mesmo a um registo real em "clientes" (ex.: escolhido no
    // selector do admin); caso contrário fica NULL — o resto da app já
    // resolve a posse da conta por email/domínio, não por este campo.
    let dbClienteId: string | null = null
    if (cliente_id) {
      const { data: clienteRow } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('id', cliente_id)
        .maybeSingle()
      if (clienteRow?.id) dbClienteId = clienteRow.id
    }

    // Guarda no Supabase com configurações AUTOMÁTICAS
    const { data, error } = await supabaseAdmin
      .from('email_contas')
      .upsert({
        cliente_id: dbClienteId,
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

// 🆕 PUT: Actualizar/Sincronizar conta existente (para contas criadas directamente no servidor)
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { email, password, nome, cliente_id: providedClienteId } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    const [user, domain] = email.split('@')
    if (!user || !domain) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Testa a ligação IMAP com as credenciais fornecidas antes de gravar —
    // sem isto, uma password errada só aparecia mais tarde ao abrir a caixa,
    // com um erro genérico difícil de associar à causa real.
    const { connectImapClient } = await import('@/lib/imap-panel-shared')
    const imapTestClient = await connectImapClient(email, password)
    if (!imapTestClient) {
      return NextResponse.json({
        error: 'Credenciais inválidas — não foi possível autenticar no servidor de email.',
      }, { status: 400 })
    }
    try { await imapTestClient.logout() } catch (_) {}

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

    // A FK de email_contas.cliente_id aponta para "clientes" (CRM antigo),
    // não para auth.users — gravar aqui o authUserId rebentava sempre com
    // "violates foreign key constraint email_contas_cliente_id_fkey". Só
    // grava cliente_id quando corresponde mesmo a um registo real em
    // "clientes"; caso contrário fica NULL (ver mesma lógica no POST acima).
    let dbClienteId: string | null = null
    if (providedClienteId) {
      const { data: clienteRow } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('id', providedClienteId)
        .maybeSingle()
      if (clienteRow?.id) dbClienteId = clienteRow.id
    }

    // Upsert no Supabase (actualizar ou criar) - usando apenas colunas existentes
    const { data, error } = await supabaseAdmin
      .from('email_contas')
      .upsert({
        cliente_id: dbClienteId,
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

// 🆕 PATCH: Cliente troca a password da própria conta de email (via DirectAdmin,
// usando as credenciais de quem é dono do domínio — admin ou revendedor).
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const sessionUser = await resolveSessionUser(supabase);

  if (!sessionUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { email, newPassword } = await req.json()

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email e nova senha são obrigatórios.' }, { status: 400 });
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase().trim()
    const [username, domain] = normalizedEmail.split('@')
    if (!username || !domain) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
    }

    const { data: conta } = await supabaseAdmin
      .from('email_contas')
      .select('email, cliente_id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!conta) {
      return NextResponse.json({ error: 'Conta de email não encontrada.' }, { status: 404 });
    }

    const roleDb = supabaseAdmin;
    const effectiveRole = await resolveRoleForAuthUser(roleDb, sessionUser);
    const isAdmin = isBootstrapAdmin(sessionUser.email) || effectiveRole === 'admin';

    const allowed = await userCanAccessMailboxPassword(sessionUser, conta, isAdmin, effectiveRole);
    if (!allowed) {
      return NextResponse.json({ error: 'Não tens permissão para alterar a password desta conta.' }, { status: 403 });
    }

    // Despacha para Hestia ou DirectAdmin consoante o dono real do domínio —
    // sem isto, um email já no Hestia (ex.: oshercollective) tentava sempre
    // mudar a password via credenciais DA, que já não existem para essa
    // conta (ver [[project_da-to-hestia-migration]]).
    const { resolveHostingOwner, hostingProvider } = await import('@/lib/hosting-resolver')
    const mailOwner = await resolveHostingOwner(domain)
    const mailProvider = hostingProvider === 'hestia' ? 'hestia' : 'directadmin'

    if (mailProvider === 'hestia') {
      if (!mailOwner) {
        return NextResponse.json({ error: 'Dono do domínio não identificado no Hestia.' }, { status: 404 });
      }
      const hestiaAdapter = await import('@/lib/hestia-adapter')
      const result = await hestiaAdapter.changeMailAccountPassword(mailOwner, domain, username, newPassword)
      if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Erro ao alterar a password no servidor de correio.' }, { status: 500 });
      }
    } else {
      const { daRequest } = await import('@/lib/directadmin')
      const { resolveDirectAdminCredentialsForDomainOwner } = await import('@/lib/directadmin-credentials')
      const creds = await resolveDirectAdminCredentialsForDomainOwner(domain)

      const res = await daRequest(
        'CMD_API_POP',
        'POST',
        { action: 'modify', domain, user: username, passwd: newPassword, passwd2: newPassword },
        creds,
      )

      if (res.error) {
        return NextResponse.json({ error: res.details || res.text || 'Erro ao alterar a password no servidor de correio.' }, { status: 500 });
      }
    }

    // Mantém a cópia usada pelo webmail (IMAP) em sincronia com a password real
    // que acabou de ser definida no servidor de correio. Se isto falhar, a
    // password no servidor já mudou mas o webmail fica com a antiga guardada
    // — por isso é preciso reportar o erro em vez de dizer "sucesso" na mesma,
    // que é exactamente o tipo de desfasamento que causa "Falha na ligação IMAP"
    // mais tarde sem explicação (afecta todos os painéis, pois é o mesmo endpoint).
    const { error: syncError } = await supabaseAdmin
      .from('email_contas')
      .update({ senha_servidor: encrypt(newPassword) })
      .eq('email', normalizedEmail)

    if (syncError) {
      console.error(`⚠️ [email-contas PATCH] Password alterada no servidor para ${normalizedEmail} mas falhou a sincronizar no Supabase:`, syncError)
      return NextResponse.json({
        error: `A password foi alterada no servidor de correio, mas falhou a guardar aqui (o webmail pode continuar a usar a password antiga). Tenta novamente. Detalhe: ${syncError.message}`,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Password de ${normalizedEmail} alterada com sucesso.` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const sessionUser = await resolveSessionUser(supabase);

  if (!sessionUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const session = { user: sessionUser };

  try {
    // Todos os chamadores (HostingSections, EmailDeleteSection, etc.) enviam
    // `?email=` na query string sem body — ler só de req.json() rebentava sempre
    // (JSON vazio) e o apagar era engolido pelo catch, deixando o registo espelho
    // órfão para sempre nesta tabela.
    const email = req.nextUrl.searchParams.get('email') || (await req.json().catch(() => ({})))?.email

    if (!email) {
      return NextResponse.json({ error: 'Email em falta' }, { status: 400 });
    }

    // Primeiro verificar se a conta pertence ao utilizador ou se é admin.
    // Usa o mesmo cálculo de papel do GET (resolveRoleForAuthUser, lê
    // profiles.role) — o antigo `user_metadata?.role === 'admin'` ficava
    // sempre falso para admins cujo papel só está em `profiles` (não
    // espelhado para user_metadata), bloqueando silenciosamente o apagar
    // para qualquer conta sem cliente_id (todas as actuais têm NULL).
    const { data: conta } = await supabaseAdmin.from('email_contas').select('email, cliente_id').eq('email', email).single();

    const effectiveRole = await resolveRoleForAuthUser(supabaseAdmin, sessionUser)
    const isAdmin = isBootstrapAdmin(sessionUser.email) || effectiveRole === 'admin'
    const allowed = conta ? await userCanAccessMailboxPassword(sessionUser, conta, isAdmin, effectiveRole) : isAdmin

    if (!allowed) {
      return NextResponse.json({ error: 'Não tens permissão para eliminar esta conta' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('email_contas').delete().eq('email', email)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
