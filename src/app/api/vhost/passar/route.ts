import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { esquecerLeitura, lerServidor } from '@/lib/vhost-servidor';
import { esquecerRegisto } from '@/lib/vhost-dados';
import { CONTA_OK, DOMINIO_OK, passarDominio, preverPassagem, type Passagem } from '@/lib/vhost-passar';

export const dynamic = 'force-dynamic';

/**
 * Passar um domínio para outra conta (plano VisualHost/07-plano-passar-dominios-entre-contas.md).
 * GET  ?dominio=      o que vai passar (visto agora no servidor) e para que contas esta sessão o pode passar
 * POST { dominio, para, bases }   começa a passagem em segundo plano (com cópia e desfazer automático; ver
 *                                 src/lib/vhost-passar.ts) e devolve { trabalho }
 * GET  ?trabalho=     como vai a passagem e, no fim, o resultado (bases grandes podem demorar mais que o nginx espera)
 * Administrador: entre quaisquer contas (menos as do sistema). Revendedor: entre a sua conta e as dos seus clientes.
 * Proteção combinada com o Silva (como em /api/vhost/acoes): sem VHOST_ACOES_TODAS=1, só domínios e contas de teste.
 */
const ADMIN_CONTA = () => (process.env.HESTIA_USER || 'vdadmin').trim();
const SISTEMA = new Set(['admin', 'root']);
const todasLiberadas = () => process.env.VHOST_ACOES_TODAS === '1';
type Trabalho = { dono: string; dominio: string; para: string; inicio: number; resultado?: Passagem & { de: string; para: string } };
const trabalhos = new Map<string, Trabalho>();

async function contexto() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Sem permissão para passar domínios.' }, { status: auth.error.status }) };
  const admin = auth.user.role === 'admin';
  const srv = await lerServidor();
  // contas que esta sessão pode usar: administrador todas; revendedor a sua e as dos seus clientes
  let podem = new Set(Object.keys(srv.users).filter((u) => !SISTEMA.has(u)));
  if (!admin) {
    const sb = getDaSyncAdmin();
    if (!sb) return { erro: NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 }) };
    const [{ data: perfil }, { data: registo }] = await Promise.all([
      sb.from('profiles').select('da_username').eq('user_id', auth.user.id).maybeSingle(),
      sb.from('panel_users').select('username, parent_username, auth_user_id'),
    ]);
    const eu = String(perfil?.da_username || (registo || []).find((r) => r.auth_user_id === auth.user.id)?.username || '').toLowerCase();
    if (!eu) return { erro: NextResponse.json({ erro: 'A sua conta do site ainda não está ligada a uma conta do servidor.' }, { status: 403 }) };
    // do registo do site (sempre atual): uma conta acabada de criar já conta; o servidor confirma que existe ao passar
    podem = new Set([eu, ...(registo || []).filter((r) => String(r.parent_username || '').toLowerCase() === eu).map((r) => String(r.username).toLowerCase())].filter((u) => !SISTEMA.has(u)));
  }
  return { auth, admin, srv, podem };
}

/** Sem a proteção desligada, só domínios e contas de teste (o destino pode ser a conta do administrador, para voltar) */
const protegido = (d: string, para: string) =>
  !todasLiberadas() && (!d.startsWith('teste') || !(para.startsWith('teste') || para === ADMIN_CONTA()))
    ? 'Por agora só se passam domínios de teste para contas de teste (nomes a começar por "teste").'
    : null;

export async function GET(req: NextRequest) {
  const c = await contexto();
  if ('erro' in c) return c.erro;
  const id = req.nextUrl.searchParams.get('trabalho');
  if (id) {
    const tb = trabalhos.get(id);
    if (!tb || tb.dono !== c.auth.user.id) return NextResponse.json({ erro: 'Passagem desconhecida.' }, { status: 404 });
    return NextResponse.json({ feito: !!tb.resultado, segundos: Math.round((Date.now() - tb.inicio) / 1000), resultado: tb.resultado || null }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const d = (req.nextUrl.searchParams.get('dominio') || '').trim().toLowerCase();
  if (!DOMINIO_OK.test(d)) return NextResponse.json({ erro: 'Domínio inválido.' }, { status: 400 });
  const p = await preverPassagem(d);
  if ('erro' in p) return NextResponse.json(p, { status: 400 });
  // um domínio noutra conta que esta sessão não vê: só se diz que existe noutra conta (sem o nome nem o resto)
  if (p.dono && !c.podem.has(p.dono)) return NextResponse.json({ previsao: { dominio: d, dono: '' }, existeNoutraConta: true, destinos: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const destinos = [...c.podem].filter((u) => u !== p.dono).sort();
  return NextResponse.json({ previsao: p, existeNoutraConta: false, contaAdmin: ADMIN_CONTA(), destinos }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const c = await contexto();
  if ('erro' in c) return c.erro;
  const corpo = (await req.json().catch(() => ({}))) as { dominio?: string; para?: string; bases?: unknown };
  const d = String(corpo.dominio || '').trim().toLowerCase();
  const para = String(corpo.para || '').trim().toLowerCase();
  const bases = Array.isArray(corpo.bases) ? corpo.bases.map((b) => String(b)) : [];
  if (!DOMINIO_OK.test(d)) return NextResponse.json({ erro: 'Domínio inválido.' }, { status: 400 });
  // administrador: qualquer conta (a lida há pouco pode ainda não ter uma conta acabada de criar; o servidor confirma)
  if (!CONTA_OK.test(para) || SISTEMA.has(para) || (!c.admin && !c.podem.has(para))) return NextResponse.json({ erro: 'Não pode passar domínios para essa conta.' }, { status: 403 });
  const prot = protegido(d, para);
  if (prot) return NextResponse.json({ erro: prot }, { status: 403 });
  const p = await preverPassagem(d);
  if ('erro' in p) return NextResponse.json(p, { status: 400 });
  if (!p.dono) return NextResponse.json({ erro: 'Este domínio não existe no servidor.' }, { status: 404 });
  if (SISTEMA.has(p.dono) || (!c.admin && !c.podem.has(p.dono))) return NextResponse.json({ erro: 'Este domínio está numa conta fora do seu painel.' }, { status: 403 });

  // um domínio de cada vez
  for (const tb of trabalhos.values()) if (tb.dominio === d && !tb.resultado) return NextResponse.json({ erro: 'Este domínio já está a passar.' }, { status: 409 });
  for (const [k, tb] of trabalhos) if (tb.resultado && Date.now() - tb.inicio > 6 * 3600_000) trabalhos.delete(k);
  const id = crypto.randomUUID();
  const tb: Trabalho = { dono: c.auth.user.id, dominio: d, para, inicio: Date.now() };
  trabalhos.set(id, tb);
  const de = p.dono;
  void passarDominio(d, para, bases, c.auth.user.email || c.auth.user.id)
    .then(async (r) => {
      if (r.ok) {
        // registo do site: o domínio principal da conta nova (se ainda não tinha) e a antiga deixa de o ter
        const sb = getDaSyncAdmin();
        if (sb) {
          await sb.from('panel_users').update({ da_domain: d }).eq('username', para).is('da_domain', null);
          await sb.from('panel_users').update({ da_domain: null }).eq('username', de).eq('da_domain', d);
        }
        esquecerLeitura();
        esquecerRegisto();
      }
      tb.resultado = { ...r, de, para };
    })
    .catch((e) => {
      tb.resultado = { ok: false, erro: 'A passagem parou: ' + (e instanceof Error ? e.message : 'erro'), passos: [], avisos: [], bases: [], de, para };
    });
  return NextResponse.json({ trabalho: id, de, para }, { status: 202 });
}
