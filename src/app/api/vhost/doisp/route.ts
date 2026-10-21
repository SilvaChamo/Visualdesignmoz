import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { acessoConta, perfilDaConta } from '@/lib/vhost-conta-cliente';
import { desligarDoisPassos, guardarHashes, hashCodigo, hashesDe, novosCodigos, temHashesAntigos, temSegredo } from '@/lib/dois-passos-codigos';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/doisp — autenticação em 2 passos (opcional): estado e códigos de recuperação (Silva, 21/10/2026).
 * Ligar e desligar fazem-se no navegador com o Supabase (código QR, código da aplicação); aqui ficam o estado, os códigos
 * de recuperação e o "desligar" do administrador numa conta de cliente que perdeu o telemóvel.
 * GET                              { ligado, desde, codigos } da própria conta (?conta= só o administrador)
 * POST { acao: 'gerar' }           8 códigos de recuperação novos (os antigos deixam de servir); só com os 2 passos ligados
 * POST { acao: 'limpar' }          apaga os códigos (depois de a pessoa desligar os 2 passos)
 * POST { conta, acao: 'desligar' } só o administrador: desliga os 2 passos dessa conta
 */
async function quem(conta?: string) {
  const sb = getDaSyncAdmin();
  if (!sb) return { erro: NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 }) };
  if (conta) {
    const alvo = await acessoConta(conta);
    if ('erro' in alvo) return { erro: alvo.erro };
    if (!alvo.admin) return { erro: NextResponse.json({ erro: 'Só o administrador pode ver ou desligar os 2 passos de outra conta.' }, { status: 403 }) };
    const { uid } = await perfilDaConta(alvo.sb, alvo.conta);
    if (!uid) return { erro: NextResponse.json({ erro: 'Esta conta ainda não tem um perfil do site ligado.' }, { status: 409 }) };
    return { sb, uid, outra: true };
  }
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: auth.error };
  return { sb, uid: auth.user.id, outra: false };
}

async function estado(sb: NonNullable<ReturnType<typeof getDaSyncAdmin>>, uid: string) {
  const [{ data: f }, { data: u }] = await Promise.all([sb.auth.admin.mfa.listFactors({ userId: uid }), sb.auth.admin.getUserById(uid)]);
  const fator = (f?.factors || []).find((x) => x.factor_type === 'totp' && x.status === 'verified');
  // códigos guardados pelo método antigo (hash simples, descobrível offline): apagam-se; a pessoa cria novos
  if (temHashesAntigos(u?.user?.app_metadata)) await guardarHashes(sb, uid, hashesDe(u?.user?.app_metadata));
  return { ligado: !!fator, desde: fator?.created_at || null, codigos: hashesDe(u?.user?.app_metadata).length };
}

export async function GET(req: NextRequest) {
  const q = await quem(req.nextUrl.searchParams.get('conta') || undefined);
  if ('erro' in q) return q.erro;
  return NextResponse.json(await estado(q.sb, q.uid), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const conta = typeof c.conta === 'string' ? c.conta : '';
  const q = await quem(conta || undefined);
  if ('erro' in q) return q.erro;
  if (c.acao === 'desligar') {
    if (!q.outra) return NextResponse.json({ erro: 'A própria conta desliga os 2 passos na sua página.' }, { status: 400 });
    await desligarDoisPassos(q.sb, q.uid);
    console.warn('[vhost/doisp] 2 passos desligados pelo administrador na conta', conta);
    return NextResponse.json({ ok: true });
  }
  if (q.outra) return NextResponse.json({ erro: 'Acção não disponível para outra conta.' }, { status: 403 });
  if (c.acao === 'gerar') {
    if (!(await estado(q.sb, q.uid)).ligado) return NextResponse.json({ erro: 'Ligue primeiro a autenticação em 2 passos.' }, { status: 409 });
    if (!temSegredo()) return NextResponse.json({ erro: 'Códigos de recuperação indisponíveis neste servidor.' }, { status: 503 });
    const codigos = novosCodigos();
    const { error } = await guardarHashes(q.sb, q.uid, codigos.map((x) => hashCodigo(q.uid, x)));
    return error ? NextResponse.json({ erro: 'Não foi possível guardar os códigos.' }, { status: 500 }) : NextResponse.json({ codigos });
  }
  if (c.acao === 'limpar') {
    // só se os 2 passos já estão desligados (não se apagam os códigos de uma conta que ainda os usa)
    if ((await estado(q.sb, q.uid)).ligado) return NextResponse.json({ erro: 'Os 2 passos continuam ligados.' }, { status: 409 });
    await guardarHashes(q.sb, q.uid, []);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ erro: 'Acção desconhecida.' }, { status: 400 });
}
