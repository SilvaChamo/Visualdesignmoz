import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { lerRegisto } from '@/lib/vhost-dados';
import { lerServidor } from '@/lib/vhost-servidor';
import { aparelhoDe, listarPresencas, localDoIp, registarPresenca, removerOutrasPresencas } from '@/lib/vhost-presenca';
import { guardarEventoHistoricoVhost } from '@/lib/vhost-activity-history';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/presenca — Contas ligadas (Admin › Gestão de contas › Contas ligadas, pedido do Silva, 16/10/2026).
 * POST (sessão do painel)  { deviceId, aVer?, pagina? } — actualiza a presença anónima deste aparelho
 * GET  (só admin ou própria pessoa) { ligadas: [...] } — presença global para Admin, própria para Perfil
 * DELETE (própria pessoa)  { deviceId } — limpa a presença dos outros aparelhos após terminar as sessões
 * A pessoa e a sua conta vêm da sessão e do registo do site (nunca do pedido); o plano lê-se do servidor na altura.
 */
const CONTA = /^[a-z0-9_.-]{1,60}$/;

function ipDe(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    ''
  ).slice(0, 64);
}

export async function POST(req: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão.' }, { status: 401 });
  const c = (await req.json().catch(() => ({}))) as {
    deviceId?: unknown;
    aVer?: unknown;
    pagina?: unknown;
    secao?: unknown;
    evento?: { tipo?: unknown; secao?: unknown; acao?: unknown; duracaoSegundos?: unknown };
  };
  const deviceId = typeof c.deviceId === 'string' ? c.deviceId : 'navegador-antigo';
  if (!/^[\da-f-]{36}$/i.test(deviceId) && deviceId !== 'navegador-antigo') {
    return NextResponse.json({ erro: 'Identidade do aparelho inválida.' }, { status: 400 });
  }
  const reg = await lerRegisto().catch(() => null);
  const perfil = reg?.perfis.get(auth.user.id);
  const conta = perfil?.conta || (reg ? [...reg.contas].find(([, r]) => r.authUserId === auth.user.id)?.[0] : '') || '';
  // "entrar como" só conta para quem o pode fazer (administrador ou revendedor)
  const aVerPedido = typeof c.aVer === 'string' ? c.aVer.toLowerCase() : '';
  const aVer = (auth.user.role === 'admin' || auth.user.role === 'reseller') && CONTA.test(aVerPedido) && aVerPedido !== conta ? aVerPedido : '';
  const secao = typeof c.secao === 'string' ? c.secao.trim().slice(0, 100) : '';
  const secaoEvento = typeof c.evento?.secao === 'string' ? c.evento.secao.trim().slice(0, 100) : secao;
  const temEvento = c.evento !== undefined;
  const tipoEvento = c.evento?.tipo === 'click' || c.evento?.tipo === 'section' ? c.evento.tipo : null;
  const acao = typeof c.evento?.acao === 'string'
    ? c.evento.acao.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
    : '';
  const duracaoRaw = c.evento?.duracaoSegundos;
  const duracaoSegundos = typeof duracaoRaw === 'number' && Number.isFinite(duracaoRaw)
    ? Math.max(0, Math.min(86_400, Math.floor(duracaoRaw)))
    : null;
  if (temEvento && (!tipoEvento || !/^(admin|revenda|utilizador)\/[a-z0-9_-]{1,80}$/i.test(secao) || !/^(admin|revenda|utilizador)\/[a-z0-9_-]{1,80}$/i.test(secaoEvento) || !acao)) {
    return NextResponse.json({ erro: 'Acção de actividade inválida.' }, { status: 400 });
  }
  if (temEvento && duracaoRaw !== undefined && duracaoSegundos === null) {
    return NextResponse.json({ erro: 'Duração da actividade inválida.' }, { status: 400 });
  }
  const ip = ipDe(req);
  const pais = req.headers.get('cf-ipcountry') || '';
  const p = registarPresenca({
    uid: auth.user.id,
    deviceId,
    email: auth.user.email || perfil?.email || '',
    nome: (perfil?.name || '').trim(),
    papel: auth.user.role,
    conta,
    aVer,
    ip,
    aparelho: aparelhoDe(req.headers.get('user-agent') || ''),
    pagina: typeof c.pagina === 'string' ? c.pagina.slice(0, 120) : '',
    secao,
    acao: temEvento ? acao : undefined,
    ultimo: Date.now(),
  });
  // a localização chega depois (sem atrasar a resposta); fica para os avisos seguintes
  if (!p.local) void localDoIp(ip).then((local) => (p.local = local || pais));
  if (temEvento && tipoEvento) {
    const erroHistorico = await guardarEventoHistoricoVhost({
      user_id: auth.user.id,
      user_email: auth.user.email || perfil?.email || '',
      user_name: (perfil?.name || '').trim(),
      user_role: auth.user.role,
      account_name: conta,
      viewing_account: aVer,
      event_type: tipoEvento,
      section: secaoEvento,
      action: acao,
      duration_seconds: duracaoSegundos,
    });
    if (erroHistorico) return NextResponse.json({ erro: erroHistorico }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão.' }, { status: 401 });
  const proprias = req.nextUrl.searchParams.get('proprias') === '1';
  if (auth.user.role !== 'admin' && !proprias) return NextResponse.json({ erro: 'Só o administrador vê as contas ligadas.' }, { status: 403 });
  const srv = proprias ? null : await lerServidor().catch(() => null);
  const plano = (u: string) => (u && srv?.users[u]?.PACKAGE) || '';
  const presencas = listarPresencas().filter((p) => (!proprias && auth.user.role === 'admin') || p.uid === auth.user.id);
  const ligadas = presencas.map((p) => ({ ...p, plano: plano(p.conta), planoAVer: plano(p.aVer) }));
  return NextResponse.json({ ligadas, agora: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão.' }, { status: 401 });
  const corpo = (await req.json().catch(() => ({}))) as { deviceId?: unknown };
  const deviceId = corpo.deviceId;
  if (typeof deviceId !== 'string' || !/^[\da-f-]{36}$/i.test(deviceId)) {
    return NextResponse.json({ erro: 'Identidade do aparelho inválida.' }, { status: 400 });
  }
  removerOutrasPresencas(auth.user.id, deviceId);
  return NextResponse.json({ ok: true });
}
