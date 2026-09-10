import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { resolveRoleForAuthUser } from '@/lib/server-auth-role'
import { decryptStoredPassword } from '@/lib/panel-access-credentials'

const adminEmails = ['admin@your-domain.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

const decrypt = decryptStoredPassword

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { email } = await req.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const { data: conta, error } = await supabaseAdmin
      .from('email_contas')
      .select('email, senha_servidor, cliente_id, tipo_conta')
      .eq('email', email)
      .single();

    if (error || !conta) {
      return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });
    }

    const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
    const effectiveRole = await resolveRoleForAuthUser(supabaseAdmin, session.user);
    const isAdmin = isExplicitAdmin || effectiveRole === 'admin';

    const sessionEmail = (session.user.email || '').toLowerCase();
    const accountEmail = (conta.email || '').toLowerCase();
    const accountDomain = accountEmail.split('@')[1] || '';
    const sameDomain =
      sessionEmail.split('@')[1] &&
      accountEmail.endsWith(`@${sessionEmail.split('@')[1]}`);

    let canAccess =
      isAdmin ||
      conta.cliente_id === session.user.id ||
      accountEmail === sessionEmail ||
      Boolean(sameDomain);

    // Revendedor: só se o domínio da conta pertencer de facto à sua conta DA — nunca um
    // bypass total (evita que qualquer revendedor veja a password de qualquer cliente).
    if (!canAccess && effectiveRole === 'reseller' && accountDomain) {
      const { resolveOwnerDaUsername } = await import('@/lib/da-credential-store');
      const { resolveHostingOwner } = await import('@/lib/hosting-resolver');
      const username = await resolveOwnerDaUsername(session.user.id);
      if (username) {
        const owner = await resolveHostingOwner(accountDomain);
        canAccess = owner === username;
      }
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    
    // Decriptar a senha
    const senha = conta.senha_servidor ? decrypt(conta.senha_servidor) : '';
    
    return NextResponse.json({ 
      success: true, 
      email: conta.email,
      senha: senha 
    });
    
  } catch (error: any) {
    console.error('Erro ao buscar senha:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
