import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/perfil — dados pessoais e preferências de avisos da pessoa com sessão (painel → Perfil).
 * GET                       dados do perfil (profiles) + datas da conta + avisos escolhidos
 * POST { acao: 'dados', … } nome, telefone, empresa, morada, cidade, site, NUIT
 * POST { acao: 'avisos', limite, seguranca }
 * A palavra-passe, as sessões e o e-mail de entrada mudam-se no navegador (Supabase Auth, com a sessão da pessoa).
 */
const CAMPOS = ['name', 'telefone', 'empresa', 'morada', 'cidade', 'site', 'nuit'] as const;

async function quem() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: 401 }) };
  const sb = getDaSyncAdmin();
  if (!sb) return { erro: NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 }) };
  return { sb, uid: auth.user.id, email: auth.user.email };
}

export async function GET() {
  const q = await quem();
  if ('erro' in q) return q.erro;
  const [{ data: p }, { data: u }] = await Promise.all([
    q.sb.from('profiles').select('name, email, telefone, empresa, morada, cidade, site, nuit, logo_url').eq('user_id', q.uid).maybeSingle(),
    q.sb.auth.admin.getUserById(q.uid),
  ]);
  const meta = (u?.user?.user_metadata || {}) as { vh_avisos?: { limite?: boolean; seguranca?: boolean } };
  return NextResponse.json(
    {
      perfil: p || {},
      email: u?.user?.email || q.email,
      criada: u?.user?.created_at || null,
      ultimaEntrada: u?.user?.last_sign_in_at || null,
      avisos: { limite: meta.vh_avisos?.limite !== false, seguranca: meta.vh_avisos?.seguranca !== false },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const q = await quem();
  if ('erro' in q) return q.erro;
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (c.acao === 'dados') {
    const novo: Record<string, string> = {};
    for (const k of CAMPOS) if (k in c) novo[k] = String(c[k] ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, k === 'morada' ? 240 : 120);
    if ('name' in novo && novo.name.length < 2) return NextResponse.json({ erro: 'Escreva o nome.' }, { status: 400 });
    if (novo.site && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(novo.site)) return NextResponse.json({ erro: 'Site inválido.' }, { status: 400 });
    const { error } = await q.sb.from('profiles').update({ ...novo, updated_at: new Date().toISOString() }).eq('user_id', q.uid);
    return error ? NextResponse.json({ erro: 'Não foi possível guardar.' }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (c.acao === 'avisos') {
    const { data: u } = await q.sb.auth.admin.getUserById(q.uid);
    const meta = { ...(u?.user?.user_metadata || {}), vh_avisos: { limite: !!c.limite, seguranca: !!c.seguranca } };
    const { error } = await q.sb.auth.admin.updateUserById(q.uid, { user_metadata: meta });
    return error ? NextResponse.json({ erro: 'Não foi possível guardar.' }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
}
