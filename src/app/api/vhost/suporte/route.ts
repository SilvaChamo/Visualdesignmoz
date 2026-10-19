import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { donoDaConta } from '@/lib/vhost-conta-cliente';
import { getDefaultFrom, getSupportEmail, sendSmtpMail } from '@/lib/smtp-mail';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/suporte — pedidos de suporte da pessoa com sessão (painel VisualHost → Suporte e ajuda → Suporte).
 * Usa as tabelas do site: tickets_suporte (cliente_id = profiles.id) e ticket_respostas.
 * GET            lista dos pedidos
 * GET ?id=       um pedido com as respostas
 * GET ?conta=    ao "entrar como" uma conta: os pedidos do cliente dono dela (administrador, ou o revendedor dela), só
 *                para ler — criar, responder e fechar ficam para o próprio cliente
 * POST { acao: criar | responder | fechar, … }
 */
const CATEGORIAS = ['geral', 'tecnico', 'dominios', 'email', 'faturacao'];
const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente'];
const linha = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

async function quem() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: 401 }) };
  const sb = getDaSyncAdmin();
  if (!sb) return { erro: NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 }) };
  const { data: perfil } = await sb.from('profiles').select('id, name, email').eq('user_id', auth.user.id).maybeSingle();
  if (!perfil?.id) return { erro: NextResponse.json({ erro: 'A sua conta do site não tem perfil.' }, { status: 403 }) };
  return { sb, auth, perfil: perfil as { id: string; name: string | null; email: string | null } };
}

async function avisarSuporte(assunto: string, corpo: string, de: { name: string | null; email: string | null }) {
  try {
    await sendSmtpMail({
      from: getDefaultFrom(),
      to: getSupportEmail(),
      replyTo: de.email || undefined,
      subject: '[Suporte] ' + assunto,
      html: `<p><b>${esc(de.name || de.email || 'Cliente')}</b> (${esc(de.email || '')})</p><pre style="white-space:pre-wrap;font-family:inherit">${esc(corpo)}</pre>`,
    });
  } catch (e) {
    console.error('[vhost/suporte] e-mail ao suporte', e);
  }
}

/** a pessoa cujos pedidos se lêem: quem tem a sessão ou, com ?conta=, o cliente dono da conta aberta com "entrar como" */
async function quemSeVe(conta: string | null) {
  if (!conta) return quem();
  const d = await donoDaConta(conta);
  if ('erro' in d) return d;
  return { sb: d.sb, perfil: d.perfil?.id ? { id: String(d.perfil.id) } : null };
}

export async function GET(req: NextRequest) {
  const q = await quemSeVe(req.nextUrl.searchParams.get('conta'));
  if ('erro' in q) return q.erro;
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!q.perfil) return NextResponse.json(id ? { erro: 'Pedido não encontrado.' } : { pedidos: [], semPerfil: true }, { status: id ? 404 : 200, headers: { 'Cache-Control': 'no-store' } });
  if (id) {
    const { data: t } = await q.sb.from('tickets_suporte').select('id, assunto, descricao, categoria, prioridade, status, created_at, updated_at').eq('id', id).eq('cliente_id', q.perfil.id).maybeSingle();
    if (!t) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 });
    const { data: r } = await q.sb.from('ticket_respostas').select('id, resposta, respondente, created_at').eq('ticket_id', id).order('created_at', { ascending: true });
    return NextResponse.json({ pedido: t, respostas: r || [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const { data } = await q.sb.from('tickets_suporte').select('id, assunto, categoria, prioridade, status, created_at, updated_at').eq('cliente_id', q.perfil.id).order('created_at', { ascending: false }).limit(200);
  return NextResponse.json({ pedidos: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const q = await quem();
  if ('erro' in q) return q.erro;
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const recusa = (erro: string, status = 400) => NextResponse.json({ erro }, { status });
  switch (String(c.acao || '')) {
    case 'criar': {
      const assunto = linha(c.assunto, 160);
      const descricao = texto(c.descricao, 8000);
      const categoria = CATEGORIAS.includes(String(c.categoria)) ? String(c.categoria) : 'geral';
      const prioridade = PRIORIDADES.includes(String(c.prioridade)) ? String(c.prioridade) : 'normal';
      const dominio = linha(c.dominio, 120);
      if (assunto.length < 3) return recusa('Escreva o assunto.');
      if (descricao.length < 10) return recusa('Descreva o pedido (pelo menos 10 letras).');
      const corpo = (dominio ? 'Domínio: ' + dominio + '\n\n' : '') + descricao;
      const { data, error } = await q.sb.from('tickets_suporte').insert({ cliente_id: q.perfil.id, assunto, descricao: corpo, categoria, prioridade, status: 'open' }).select('id').single();
      if (error || !data) return recusa('Não foi possível criar o pedido.', 500);
      await avisarSuporte(assunto, corpo, q.perfil);
      return NextResponse.json({ ok: true, id: data.id });
    }
    case 'responder': {
      const id = linha(c.id, 64);
      const resposta = texto(c.texto, 8000);
      if (resposta.length < 2) return recusa('Escreva a resposta.');
      const { data: t } = await q.sb.from('tickets_suporte').select('id, assunto').eq('id', id).eq('cliente_id', q.perfil.id).maybeSingle();
      if (!t) return recusa('Pedido não encontrado.', 404);
      const { error } = await q.sb.from('ticket_respostas').insert({ ticket_id: id, resposta, respondente: 'cliente', criado_por: q.auth.user.id, cliente_id: q.perfil.id });
      if (error) return recusa('Não foi possível enviar a resposta.', 500);
      await q.sb.from('tickets_suporte').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', id);
      await avisarSuporte('Resposta: ' + t.assunto, resposta, q.perfil);
      return NextResponse.json({ ok: true });
    }
    case 'fechar': {
      const id = linha(c.id, 64);
      const { data, error } = await q.sb.from('tickets_suporte').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', id).eq('cliente_id', q.perfil.id).select('id');
      if (error || !data?.length) return recusa('Pedido não encontrado.', 404);
      return NextResponse.json({ ok: true });
    }
  }
  return recusa('Ação desconhecida.');
}
