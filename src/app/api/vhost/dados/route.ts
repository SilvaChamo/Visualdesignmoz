import { NextRequest, NextResponse } from 'next/server';
import { lerDadosPainel } from '@/lib/vhost-dados-painel';

export const dynamic = 'force-dynamic';

/** GET /api/vhost/dados — dados reais do servidor para o painel VisualHost (só leitura). ?fresco=1 lê já o servidor. */
export async function GET(req: NextRequest) {
  const leitura = await lerDadosPainel(req.nextUrl.searchParams.get('fresco') === '1');
  if (!leitura.ok) return NextResponse.json({ erro: leitura.erro, codigo: leitura.codigo }, { status: leitura.codigo });
  return NextResponse.json(leitura.dados, { headers: { 'Cache-Control': 'no-store' } });
}
