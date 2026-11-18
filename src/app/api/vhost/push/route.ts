import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { EMAIL_RE, podeVer } from '@/lib/vhostmail/acesso';
import { avisar, chavePublica, guardarSubscricao, removerSubscricao } from '@/lib/vhost-push';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/push — avisos de e-mail novo com o VhostMail fechado (Web Push).
 * GET                                         → { chave }  (chave pública VAPID, para o navegador subscrever)
 * POST   { end, sub: { endpoint, keys: { p256dh, auth } }, teste? } → guarda o aparelho para esta caixa (e, com teste, envia já um aviso)
 * DELETE { end, endpoint }                    → tira o aparelho
 * Só para quem tem sessão no painel e vê a caixa (a mesma regra do VhostMail).
 */
const HTTPS = /^https:\/\/[^\s]{8,600}$/;
const B64U = /^[A-Za-z0-9_-]{16,200}$/;

async function sessao() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no painel.' }, { status: auth.error.status }) };
  return { s: { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role } };
}

export async function GET() {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  try {
    return NextResponse.json({ chave: await chavePublica() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ erro: 'Não foi possível preparar os avisos.' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  let b: { end?: unknown; sub?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; teste?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  const end = String(b.end || '').trim().toLowerCase();
  const endpoint = String(b.sub?.endpoint || '');
  const p256dh = String(b.sub?.keys?.p256dh || '');
  const auth = String(b.sub?.keys?.auth || '');
  if (!EMAIL_RE.test(end) || !HTTPS.test(endpoint) || !B64U.test(p256dh) || !B64U.test(auth)) return NextResponse.json({ erro: 'Subscrição inválida.' }, { status: 400 });
  try {
    if (!(await podeVer(r.s, end))) return NextResponse.json({ erro: 'Essa caixa não é desta conta.' }, { status: 403 });
    await guardarSubscricao(end, { endpoint, p256dh, auth }, req.headers.get('user-agent') || '');
    if (b.teste === true) await avisar(end, { title: 'VhostMail', body: 'Vai receber os e-mails novos mesmo com o VhostMail fechado.', url: '/api/vhost/vhostmail?app=1&conta=' + encodeURIComponent(end), tag: 'vhostmail-teste', forcar: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erro: 'O servidor está ocupado. Tente outra vez dentro de instantes.' }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  let b: { end?: unknown; endpoint?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  const end = String(b.end || '').trim().toLowerCase();
  const endpoint = String(b.endpoint || '');
  if (!EMAIL_RE.test(end) || !HTTPS.test(endpoint)) return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  try {
    if (!(await podeVer(r.s, end))) return NextResponse.json({ erro: 'Essa caixa não é desta conta.' }, { status: 403 });
    await removerSubscricao(end, endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erro: 'O servidor está ocupado. Tente outra vez dentro de instantes.' }, { status: 503 });
  }
}
