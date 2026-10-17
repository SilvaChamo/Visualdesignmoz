import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { getDefaultFrom, sendSmtpMail } from '@/lib/smtp-mail';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/suporte-admin — os pedidos de suporte de todos os clientes (painel VisualHost → Admin → Tickets), só o
 * administrador. As mesmas tabelas do Suporte do cliente (/api/vhost/suporte): tickets_suporte e ticket_respostas.
 * GET                 todos os pedidos, com o nome e o e-mail do cliente
 * GET ?id=            um pedido com as respostas
 * GET ?clientes=1     os clientes (para abrir um pedido em nome de um)
 * POST { acao: 'responder', id, texto }           resposta da equipa (fica "À espera do cliente" e vai por e-mail)
 * POST { acao: 'estado', ids, estado }            open | in_progress | waiting_client | closed
 * POST { acao: 'apagar', ids }
 * POST { acao: 'criar', cliente, assunto, descricao, categoria, prioridade }
 */
const ESTADOS = ['open', 'in_progress', 'waiting_client', 'closed'];
const CATEGORIAS = ['geral', 'tecnico', 'dominios', 'email', 'faturacao'];
const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const linha = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const ids = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map(String).filter((x) => UUID.test(x)))].slice(0, 200);

async function soAdmin() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: 401 }) };
  if (auth.user.role !== 'admin') return { erro: NextResponse.json({ erro: 'Só o administrador do servidor vê esta página.' }, { status: 403 }) };
  const sb = getDaSyncAdmin();
  if (!sb) return { erro: NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 }) };
  return { sb, auth };
}

type Perfil = { id: string; name: string | null; email: string | null };
async function perfis(sb: NonNullable<ReturnType<typeof getDaSyncAdmin>>, lista: string[]): Promise<Record<string, Perfil>> {
  if (!lista.length) return {};
  const { data } = await sb.from('profiles').select('id, name, email').in('id', [...new Set(lista)]);
  return Object.fromEntries(((data || []) as Perfil[]).map((p) => [p.id, p]));
}

export async function GET(req: NextRequest) {
  const q = await soAdmin();
  if ('erro' in q) return q.erro;
  const sp = req.nextUrl.searchParams;
  const sem = { headers: { 'Cache-Control': 'no-store' } };
  if (sp.get('clientes')) {
    const { data } = await q.sb.from('profiles').select('id, name, email').order('name', { ascending: true }).limit(1000);
    return NextResponse.json({ clientes: data || [] }, sem);
  }
  const id = sp.get('id') || '';
  if (id) {
    if (!UUID.test(id)) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 });
    const { data: t } = await q.sb.from('tickets_suporte').select('id, cliente_id, assunto, descricao, categoria, prioridade, status, created_at, updated_at').eq('id', id).maybeSingle();
    if (!t) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 });
    const { data: r } = await q.sb.from('ticket_respostas').select('id, resposta, respondente, created_at').eq('ticket_id', id).order('created_at', { ascending: true });
    const p = (await perfis(q.sb, [t.cliente_id]))[t.cliente_id];
    return NextResponse.json({ pedido: { ...t, cliente: p?.name || '', email: p?.email || '' }, respostas: r || [] }, sem);
  }
  const { data } = await q.sb.from('tickets_suporte').select('id, cliente_id, assunto, categoria, prioridade, status, created_at, updated_at').order('updated_at', { ascending: false }).limit(1000);
  const lista = (data || []) as { cliente_id: string }[];
  const ps = await perfis(q.sb, lista.map((t) => t.cliente_id).filter(Boolean));
  return NextResponse.json({ pedidos: lista.map((t) => ({ ...t, cliente: ps[t.cliente_id]?.name || '', email: ps[t.cliente_id]?.email || '' })) }, sem);
}

export async function POST(req: NextRequest) {
  const q = await soAdmin();
  if ('erro' in q) return q.erro;
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const recusa = (erro: string, status = 400) => NextResponse.json({ erro }, { status });
  const agora = new Date().toISOString();
  switch (String(c.acao || '')) {
    case 'responder': {
      const id = String(c.id || '');
      const resposta = texto(c.texto, 8000);
      if (!UUID.test(id)) return recusa('Pedido não encontrado.', 404);
      if (resposta.length < 2) return recusa('Escreva a resposta.');
      const { data: t } = await q.sb.from('tickets_suporte').select('id, assunto, cliente_id').eq('id', id).maybeSingle();
      if (!t) return recusa('Pedido não encontrado.', 404);
      const { error } = await q.sb.from('ticket_respostas').insert({ ticket_id: id, resposta, respondente: 'suporte', criado_por: q.auth.user.id, cliente_id: t.cliente_id });
      if (error) return recusa('Não foi possível enviar a resposta.', 500);
      await q.sb.from('tickets_suporte').update({ status: 'waiting_client', updated_at: agora }).eq('id', id);
      const p = (await perfis(q.sb, [t.cliente_id]))[t.cliente_id];
      let email = false;
      if (p?.email) {
        try {
          await sendSmtpMail({
            from: getDefaultFrom(),
            to: p.email,
            subject: '[Suporte] ' + t.assunto,
            html: `<p>${esc(p.name ? 'Olá ' + p.name + ',' : 'Olá,')}</p><pre style="white-space:pre-wrap;font-family:inherit">${esc(resposta)}</pre><p>Pode responder no painel, em Suporte e ajuda → Suporte.</p>`,
          });
          email = true;
        } catch (e) {
          console.error('[vhost/suporte-admin] e-mail ao cliente', e);
        }
      }
      return NextResponse.json({ ok: true, email });
    }
    case 'estado': {
      const lista = ids(c.ids);
      const estado = String(c.estado || '');
      if (!lista.length || !ESTADOS.includes(estado)) return recusa('Escolha os pedidos.');
      const { error } = await q.sb.from('tickets_suporte').update({ status: estado, updated_at: agora }).in('id', lista);
      return error ? recusa('Não foi possível mudar o estado.', 500) : NextResponse.json({ ok: true });
    }
    case 'apagar': {
      const lista = ids(c.ids);
      if (!lista.length) return recusa('Escolha os pedidos.');
      await q.sb.from('ticket_respostas').delete().in('ticket_id', lista);
      const { error } = await q.sb.from('tickets_suporte').delete().in('id', lista);
      return error ? recusa('Não foi possível apagar.', 500) : NextResponse.json({ ok: true });
    }
    case 'criar': {
      const cliente = String(c.cliente || '');
      const assunto = linha(c.assunto, 160);
      const descricao = texto(c.descricao, 8000);
      const categoria = CATEGORIAS.includes(String(c.categoria)) ? String(c.categoria) : 'geral';
      const prioridade = PRIORIDADES.includes(String(c.prioridade)) ? String(c.prioridade) : 'normal';
      if (!UUID.test(cliente)) return recusa('Escolha o cliente.');
      if (assunto.length < 3) return recusa('Escreva o assunto.');
      if (descricao.length < 10) return recusa('Descreva o pedido (pelo menos 10 letras).');
      const { data, error } = await q.sb.from('tickets_suporte').insert({ cliente_id: cliente, assunto, descricao, categoria, prioridade, status: 'open' }).select('id').single();
      if (error || !data) return recusa('Não foi possível criar o pedido.', 500);
      return NextResponse.json({ ok: true, id: data.id });
    }
  }
  return recusa('Ação desconhecida.');
}
