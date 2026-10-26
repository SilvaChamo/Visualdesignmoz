import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { lerRegisto } from '@/lib/vhost-dados';
import { detalheSessao, listarSessoes, registarLimpeza } from '@/lib/vhost-historico-sessoes';

export const dynamic = 'force-dynamic';

const TABELA = 'vhost_activity_history';
const RETENCAO_MS = 7 * 24 * 60 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTA = /^[a-z0-9_.-]{1,60}$/;
/** Chave de uma sessão: `p|<id do login>|<início em ms>` (painel) ou `w|<domínio>|<ip>|<aparelho>|<início em ms>` (WordPress) */
const SESSAO = /^[pw]\|[A-Za-z0-9_.:|-]{1,200}$/;

/**
 * /api/vhost/presenca/historico — Contas ligadas › Histórico (só administrador).
 * GET ?filtro=<id do login | conta:nome>   lista de sessões (painel e WordPress) e as pessoas para o selector
 * GET ?sessao=<chave>                      uma sessão por dentro: acção, hora e resultado de cada passo
 * DELETE [?uid=… | ?conta=…]               limpa o histórico (de uma pessoa, de uma conta ou de todas)
 */
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

  const sessao = req.nextUrl.searchParams.get('sessao') || '';
  const filtro = req.nextUrl.searchParams.get('filtro') || '';
  if (sessao && !SESSAO.test(sessao)) return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 400 });
  if (filtro && !UUID.test(filtro) && !(filtro.startsWith('conta:') && CONTA.test(filtro.slice(6)))) {
    return NextResponse.json({ erro: 'Conta seleccionada inválida.' }, { status: 400 });
  }

  const desde = new Date(Date.now() - RETENCAO_MS).toISOString();
  const { error: erroRetencao } = await acesso.supabase.from(TABELA).delete().lt('created_at', desde);
  if (erroRetencao) {
    console.error('[vhost/presenca] Não foi possível aplicar a retenção do histórico:', erroRetencao.message);
    return NextResponse.json({ erro: 'Não foi possível actualizar a retenção do histórico.' }, { status: 500 });
  }

  try {
    if (sessao) {
      const detalhe = await detalheSessao(acesso.supabase, sessao);
      if (!detalhe) return NextResponse.json({ erro: 'Esta sessão já não está no histórico.' }, { status: 404 });
      return NextResponse.json(detalhe, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(await listarSessoes(acesso.supabase, filtro), { headers: { 'Cache-Control': 'no-store' } });
  } catch (erro) {
    console.error('[vhost/presenca] Não foi possível ler o histórico:', erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ erro: 'Não foi possível ler o histórico das contas.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const acesso = await administrador();
  if ('erro' in acesso) return acesso.erro;

  const uid = req.nextUrl.searchParams.get('uid') || '';
  const conta = req.nextUrl.searchParams.get('conta') || '';
  if (uid && !UUID.test(uid)) return NextResponse.json({ erro: 'Conta seleccionada inválida.' }, { status: 400 });
  if (conta && !CONTA.test(conta)) return NextResponse.json({ erro: 'Conta seleccionada inválida.' }, { status: 400 });

  // O Supabase recusa um DELETE sem filtro (extensão safeupdate do PostgREST): "todas as contas" filtra por uma data que todas cumprem
  let apagar = acesso.supabase.from(TABELA).delete();
  apagar = uid ? apagar.eq('user_id', uid) : conta ? apagar.eq('account_name', conta) : apagar.gte('created_at', '1970-01-01T00:00:00Z');
  const { error } = await apagar;
  if (error) {
    console.error('[vhost/presenca] Não foi possível limpar o histórico:', error.message);
    return NextResponse.json({ erro: 'Não foi possível limpar o histórico.' }, { status: 500 });
  }

  // o que vem dos registos do servidor (WordPress) não se apaga: esconde-se tudo o que for anterior a esta marca
  let escopo: 'todas' | `conta:${string}` = 'todas';
  if (conta) escopo = `conta:${conta}`;
  else if (uid) {
    const perfil = await lerRegisto().then((r) => r.perfis.get(uid)).catch(() => undefined);
    if (perfil?.conta) escopo = `conta:${perfil.conta}`;
  }
  await registarLimpeza(acesso.supabase, escopo);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
