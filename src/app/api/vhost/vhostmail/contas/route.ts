import { NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { caixasDaSessao } from '@/lib/vhostmail/acesso';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vhost/vhostmail/contas — as caixas de e-mail que a sessão pode abrir no VhostMail (sem senha: a sessão do painel já as vê).
 * Serve o «Adicionar conta» do VhostMail: escolher uma caixa abre-a logo, sem fechar nem entrar de novo (Silva, 18/11/2026).
 */
export async function GET() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão no painel.' }, { status: auth.error.status });
  try {
    const contas = await caixasDaSessao({ userId: auth.user.id, email: auth.user.email || '', role: auth.user.role });
    return NextResponse.json({ contas: contas.map((c) => c.end) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ erro: 'O painel está ocupado. Tente outra vez dentro de instantes.' }, { status: 503 });
  }
}
