import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { lerServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';

export const dynamic = 'force-dynamic';

/** GET /api/vhost/dados — dados reais do servidor para o painel VisualHost (só leitura). ?fresco=1 lê já o servidor. */
export async function GET(req: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) {
    const status = auth.error.status === 401 ? 401 : 403;
    return NextResponse.json({ erro: status === 401 ? 'Inicie sessão no site para ver o painel.' : 'Esta conta não tem acesso ao painel.', codigo: status }, { status });
  }
  try {
    const fresco = req.nextUrl.searchParams.get('fresco') === '1' && auth.user.role === 'admin';
    const [srv, reg] = await Promise.all([lerServidor(fresco), lerRegisto()]);
    const dados = montarDados(srv, reg, { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role });
    if (!dados.me || !dados.contas[dados.me])
      return NextResponse.json({ erro: 'A sua conta do site ainda não está ligada a uma conta do servidor.', codigo: 403 }, { status: 403 });
    return NextResponse.json(dados, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[vhost/dados]', e);
    return NextResponse.json({ erro: 'Não foi possível ler o servidor. Tente de novo dentro de momentos.', codigo: 500 }, { status: 500 });
  }
}
