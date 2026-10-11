import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/mensagens — mensagens do sistema e da equipa para a pessoa com sessão (tabela notifications do site).
 * GET ?filtro=todas|nao-lidas|avisos
 * POST { acao: lidas | apagar, ids?: string[] }   (sem ids: todas)
 */
async function quem() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: 401 }) };
  const sb = getDaSyncAdmin();
  if (!sb) return { erro: NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 }) };
  return { sb, uid: auth.user.id };
}

export async function GET(req: NextRequest) {
  const q = await quem();
  if ('erro' in q) return q.erro;
  const filtro = req.nextUrl.searchParams.get('filtro') || 'todas';
  let pedido = q.sb.from('notifications').select('id, type, title, message, domain, read, category, link, link_text, created_at').eq('user_id', q.uid).order('created_at', { ascending: false }).limit(300);
  if (filtro === 'nao-lidas') pedido = pedido.eq('read', false);
  if (filtro === 'avisos') pedido = pedido.or('category.eq.system,type.eq.warning,type.eq.error');
  const { data, error } = await pedido;
  if (error) return NextResponse.json({ erro: 'Não foi possível ler as mensagens.' }, { status: 500 });
  const { count } = await q.sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', q.uid).eq('read', false);
  return NextResponse.json({ mensagens: data || [], naoLidas: count || 0 }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const q = await quem();
  if ('erro' in q) return q.erro;
  const c = (await req.json().catch(() => ({}))) as { acao?: string; ids?: unknown };
  const ids = Array.isArray(c.ids) ? c.ids.map(String).filter((x) => /^[0-9a-f-]{8,64}$/i.test(x)).slice(0, 300) : null;
  if (c.acao === 'lidas') {
    let p = q.sb.from('notifications').update({ read: true, read_at: new Date().toISOString() }).eq('user_id', q.uid);
    if (ids) p = p.in('id', ids);
    const { error } = await p;
    return error ? NextResponse.json({ erro: 'Não foi possível marcar.' }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (c.acao === 'apagar') {
    if (!ids?.length) return NextResponse.json({ erro: 'Escolha as mensagens.' }, { status: 400 });
    const { error } = await q.sb.from('notifications').delete().eq('user_id', q.uid).in('id', ids);
    return error ? NextResponse.json({ erro: 'Não foi possível apagar.' }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
}
