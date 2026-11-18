import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vhost/traduzir — traduz o texto de um e-mail para português (botão «Traduzir» do VhostMail; Silva, 18/11/2026).
 * { textos: string[], para?: 'pt' }  →  { traducoes: string[], idioma: 'en' }   (idioma = o da mensagem, detectado)
 *
 * Tradutores, por ordem: Google Cloud Translation (se GOOGLE_TRANSLATE_API_KEY estiver definida; fiável e sem limite diário
 * apertado) e, sem chave, o MyMemory (gratuito, detecta a língua; cerca de 5 000 caracteres por dia por servidor). O tradutor
 * público do Google (sem chave) é bloqueado neste servidor. O texto da mensagem sai do servidor para ser traduzido: só se chama
 * quando a pessoa carrega em «Traduzir». Só para quem tem sessão no painel, com limite de tamanho.
 */
import { MAX_TOTAL, traduzir, type Res } from '@/lib/traduzir-texto';

export async function POST(req: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão no painel.' }, { status: auth.error.status });
  let b: { textos?: unknown; para?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  const textos = Array.isArray(b.textos) ? b.textos.map((t) => String(t ?? '')) : [];
  const para = /^[a-z]{2}(-[A-Z]{2})?$/.test(String(b.para || '')) ? String(b.para) : 'pt';
  if (!textos.length || textos.length > 5) return NextResponse.json({ erro: 'Nada para traduzir.' }, { status: 400 });
  const total = textos.reduce((n, t) => n + t.length, 0);
  if (total > MAX_TOTAL && !process.env.GOOGLE_TRANSLATE_API_KEY) return NextResponse.json({ erro: 'A mensagem é comprida de mais para o tradutor gratuito (máximo ' + MAX_TOTAL + ' caracteres).' }, { status: 413 });
  if (total > 30_000) return NextResponse.json({ erro: 'A mensagem é demasiado grande para traduzir.' }, { status: 413 });
  try {
    // o corpo primeiro (é ele que diz a língua); o assunto a seguir
    const res: Res[] = [];
    for (const t of textos) res.push(await traduzir(t, para));
    // a língua da mensagem é a do texto maior (o assunto sozinho engana)
    const idioma = res.map((r, i) => ({ l: r.idioma, n: textos[i].length })).filter((x) => x.l).sort((x, y) => y.n - x.n)[0]?.l || '';
    return NextResponse.json({ traducoes: res.map((r) => r.texto), idioma });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'Não foi possível traduzir.' }, { status: 502 });
  }
}
