import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TABELA = 'vhost_activity_history';
const RETENCAO_MS = 7 * 24 * 60 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIMITE_MAXIMO = 500;

async function administrador() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: auth.error };
  if (auth.user.role !== 'admin') {
    return { erro: NextResponse.json({ erro: 'Só o administrador pode consultar o histórico.' }, { status: 403 }) };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { erro: NextResponse.json({ erro: 'A ligação administrativa à base de dados não está configurada.' }, { status: 503 }) };
  }
  return { supabase };
}

export async function GET(req: NextRequest) {
  const acesso = await administrador();
  if ('erro' in acesso) return acesso.erro;

  const uid = req.nextUrl.searchParams.get('uid') || '';
  const limite = Math.min(LIMITE_MAXIMO, Math.max(1, Number(req.nextUrl.searchParams.get('limite')) || 100));
  const inicio = Math.max(0, Number(req.nextUrl.searchParams.get('inicio')) || 0);
  if (uid && !UUID.test(uid)) return NextResponse.json({ erro: 'Conta seleccionada inválida.' }, { status: 400 });

  const desde = new Date(Date.now() - RETENCAO_MS).toISOString();
  const { error: erroLimpeza } = await acesso.supabase.from(TABELA).delete().lt('created_at', desde);
  if (erroLimpeza) {
    console.error('[vhost/presenca] Não foi possível aplicar a retenção do histórico:', erroLimpeza.message);
    return NextResponse.json({ erro: 'Não foi possível actualizar a retenção do histórico.' }, { status: 500 });
  }

  let consulta = acesso.supabase
    .from(TABELA)
    .select('id,user_id,user_email,user_name,user_role,account_name,viewing_account,event_type,section,action,duration_seconds,created_at')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .range(inicio, inicio + limite - 1);
  if (uid) consulta = consulta.eq('user_id', uid);

  const { data, error } = await consulta;
  if (error) {
    console.error('[vhost/presenca] Não foi possível ler o histórico:', error.message);
    return NextResponse.json({ erro: 'Não foi possível ler o histórico das contas.' }, { status: 500 });
  }

  return NextResponse.json(
    { eventos: data || [], temMais: (data || []).length === limite },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function DELETE(req: NextRequest) {
  const acesso = await administrador();
  if ('erro' in acesso) return acesso.erro;

  const uid = req.nextUrl.searchParams.get('uid') || '';
  if (uid && !UUID.test(uid)) return NextResponse.json({ erro: 'Conta seleccionada inválida.' }, { status: 400 });

  let apagar = acesso.supabase.from(TABELA).delete();
  if (uid) apagar = apagar.eq('user_id', uid);
  const { error } = await apagar;
  if (error) {
    console.error('[vhost/presenca] Não foi possível limpar o histórico:', error.message);
    return NextResponse.json({ erro: 'Não foi possível limpar o histórico.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
