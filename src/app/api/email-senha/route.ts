import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { resolveRoleForAuthUser } from '@/lib/server-auth-role'

const adminEmails = ['admin@your-domain.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

// Decriptação base64
const decrypt = (text: string) => {
  try {
    return Buffer.from(text, 'base64').toString('utf8')
  } catch {
    return text
  }
}

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
    const isAdmin = isExplicitAdmin || effectiveRole === 'admin' || effectiveRole === 'manager';
    const isReseller = effectiveRole === 'reseller';

    const sessionEmail = (session.user.email || '').toLowerCase();
    const accountEmail = (conta.email || '').toLowerCase();
    const sameDomain =
      sessionEmail.split('@')[1] &&
      accountEmail.endsWith(`@${sessionEmail.split('@')[1]}`);

    const canAccess =
      isAdmin ||
      isReseller ||
      conta.cliente_id === session.user.id ||
      accountEmail === sessionEmail ||
      Boolean(sameDomain);

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
