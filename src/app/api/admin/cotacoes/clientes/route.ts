import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { saveProfileForAuthUser } from '@/lib/profile-db';
import { ENCOMENDAS_ACCOUNT_ORIGIN, isEncomendasAccount } from '@/lib/panel-origin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase Service Role não configurado.');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function requireAdmin() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth;
  if (auth.user.role !== 'admin') {
    return { error: NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 }) };
  }
  return auth;
}

// Lista as contas de clientes das encomendas, agrupadas por user_id — para a
// secção "Encomendas" dentro de Utilizadores, onde o admin pode seleccionar
// contas e enviar mailmarketing/promoções só a elas. Entram as que já
// submeteram pelo menos uma encomenda (quotation_requests) e também as
// criadas no percurso das encomendas que ainda não submeteram nenhuma
// (marca `origem` no user_metadata — ver isEncomendasAccount).
export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('quotation_requests')
      .select('user_id, email, responsavel, empresa, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const byUser = new Map<string, {
      userId: string;
      email: string;
      responsavel: string;
      empresa: string;
      encomendas: number;
      firstCreatedAt: string;
      lastCreatedAt: string;
    }>();

    for (const row of data || []) {
      if (!row.user_id) continue;
      const existing = byUser.get(row.user_id);
      if (!existing) {
        byUser.set(row.user_id, {
          userId: row.user_id,
          email: row.email,
          responsavel: row.responsavel,
          empresa: row.empresa,
          encomendas: 1,
          firstCreatedAt: row.created_at,
          lastCreatedAt: row.created_at,
        });
      } else {
        existing.encomendas += 1;
        existing.lastCreatedAt = row.created_at;
        // A linha mais recente é a que melhor reflecte o nome/empresa actual do cliente.
        existing.email = row.email;
        existing.responsavel = row.responsavel;
        existing.empresa = row.empresa;
      }
    }

    for (let page = 1; page <= 20; page++) {
      const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersError) throw usersError;
      for (const user of usersPage.users) {
        if (byUser.has(user.id) || !isEncomendasAccount(user.user_metadata)) continue;
        const meta = user.user_metadata || {};
        byUser.set(user.id, {
          userId: user.id,
          email: user.email || '',
          responsavel: String(meta.nome || meta.name || user.email?.split('@')[0] || ''),
          empresa: String(meta.empresa || ''),
          encomendas: 0,
          firstCreatedAt: user.created_at,
          lastCreatedAt: user.created_at,
        });
      }
      if (usersPage.users.length < 1000) break;
    }

    const clientes = [...byUser.values()].sort((a, b) => (a.lastCreatedAt < b.lastCreatedAt ? 1 : -1));

    return NextResponse.json({ success: true, clientes });
  } catch (error: any) {
    console.error('[admin/cotacoes/clientes] erro:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}

// Papel fixo — estas contas são especificamente de "Encomendas" (clientes
// que pedem cotações), sem relação com contas de hospedagem/revenda, por
// isso não há selector de papel no formulário. 'guest' como as contas
// criadas pelo próprio cliente em /cotacao: só passa a 'client'/'profissional'
// quando comprar domínio/hospedagem/email (promoteBuyerAfterPurchase) — até
// lá entra no painel /encomendas.
const ENCOMENDAS_ROLE = 'guest';

// Cria uma nova conta de cliente (Auth + profiles) directamente a partir da
// secção "Encomendas" — ainda sem nenhuma quotation_requests, mas com a marca
// `origem` (ENCOMENDAS_ACCOUNT_ORIGIN), por isso continua na lista nos GET
// seguintes mesmo antes do primeiro pedido.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const nome = String(body?.nome || '').trim();
    const apelido = String(body?.apelido || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Email inválido.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password obrigatória (mínimo 6 caracteres).' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const displayName = `${nome} ${apelido}`.trim() || email.split('@')[0];

    // Nunca criar uma segunda conta para o mesmo email — verifica primeiro.
    // Sem isto, uma pessoa que já pediu uma cotação (com conta criada nesse
    // fluxo) fica com duas contas no admin: a mesma pessoa a mostrar
    // "encomendas" divididas entre as duas.
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const existing = existingUsers.users.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      return NextResponse.json({
        success: false,
        error: `Já existe uma conta com este email (${email}). Use "Editar" na conta existente em vez de criar uma nova.`,
      }, { status: 409 });
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: ENCOMENDAS_ROLE,
        name: displayName,
        nome: displayName,
        first_name: nome,
        last_name: apelido,
        origem: ENCOMENDAS_ACCOUNT_ORIGIN,
      },
    });
    if (createError) throw createError;

    const userId = created.user?.id;
    if (!userId) throw new Error('Conta criada sem id devolvido pelo Supabase.');

    await saveProfileForAuthUser(supabase, userId, { email, role: ENCOMENDAS_ROLE, name: displayName });

    return NextResponse.json({
      success: true,
      cliente: {
        userId,
        email,
        responsavel: displayName,
        empresa: '',
        encomendas: 0,
        firstCreatedAt: new Date().toISOString(),
        lastCreatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[admin/cotacoes/clientes] erro ao criar conta:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}

// Edita uma conta de cliente já existente (Auth + profiles). Nome/Empresa
// também são reflectidos em todas as linhas de quotation_requests desse
// user_id — são campos por linha (não há tabela única de "cliente"), mas
// mantê-los sincronizados evita mostrar um nome desactualizado nos pedidos
// antigos depois de uma correcção.
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const userId = String(body?.userId || '').trim();
    const nome = String(body?.nome || '').trim();
    const apelido = String(body?.apelido || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = typeof body?.password === 'string' ? body.password : '';
    const empresa = typeof body?.empresa === 'string' ? body.empresa.trim() : undefined;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId obrigatório.' }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Email inválido.' }, { status: 400 });
    }
    if (password && password.length > 0 && password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const displayName = `${nome} ${apelido}`.trim() || email.split('@')[0];

    const { data: existingUser, error: getUserError } = await supabase.auth.admin.getUserById(userId);
    if (getUserError || !existingUser?.user) {
      return NextResponse.json({ success: false, error: 'Conta não encontrada.' }, { status: 404 });
    }

    const updatePayload: { email?: string; password?: string; user_metadata: Record<string, unknown> } = {
      email,
      user_metadata: {
        ...existingUser.user.user_metadata,
        name: displayName,
        nome: displayName,
        first_name: nome,
        last_name: apelido,
      },
    };
    if (password && password.length >= 6) updatePayload.password = password;

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, updatePayload);
    if (updateError) throw updateError;

    await saveProfileForAuthUser(supabase, userId, { email, name: displayName });

    const { error: rowsError } = await supabase
      .from('quotation_requests')
      .update({ responsavel: displayName, ...(empresa !== undefined ? { empresa } : {}), email })
      .eq('user_id', userId);
    if (rowsError) throw rowsError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/cotacoes/clientes] erro ao editar conta:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}

// Elimina a conta (Auth + profiles). O apagar de auth.users faz cascade em
// quotation_requests (e daí em quotation_layouts) — ou seja, elimina também
// TODAS as encomendas desta conta; o aviso disso fica a cargo do
// confirm() no ecrã, não desta rota. email_contas referencia auth.users sem
// ON DELETE CASCADE, por isso é limpa aqui primeiro para não bloquear o
// deleteUser com uma violação de foreign key.
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId obrigatório.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    await supabase.from('email_contas').delete().eq('cliente_id', userId);

    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle();
    if (profile?.id) {
      await supabase.from('profiles').delete().eq('id', profile.id);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/cotacoes/clientes] erro ao eliminar conta:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
