import { NextRequest, NextResponse } from 'next/server';
import { lerDadosPainel } from '@/lib/vhost-dados-painel';
import { idadeLeitura } from '@/lib/vhost-servidor';

export const dynamic = 'force-dynamic';

/** GET /api/vhost/dados — dados reais do servidor para o painel VisualHost (só leitura). ?fresco=1 lê já o servidor. */
export async function GET(req: NextRequest) {
  const leitura = await lerDadosPainel(req.nextUrl.searchParams.get('fresco') === '1');
  if (!leitura.ok) return NextResponse.json({ erro: leitura.erro, codigo: leitura.codigo }, { status: leitura.codigo });
  // idadeMs: há quanto tempo o servidor foi lido (contado aqui); o painel volta a pedir quando a leitura é antiga
  return NextResponse.json({ ...leitura.dados, idadeMs: idadeLeitura(leitura.dados) }, { headers: { 'Cache-Control': 'no-store' } });
}
