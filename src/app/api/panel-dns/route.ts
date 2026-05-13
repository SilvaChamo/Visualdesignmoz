import { NextResponse } from 'next/server';

/** DNS sem painel de hospedagem externo — resposta vazia até API interna existir. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  return NextResponse.json({
    success: true,
    domain,
    records: [],
    message: 'Configure registos DNS no fluxo interno do painel.',
  });
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Operação DNS interna ainda não disponível neste endpoint.' },
    { status: 501 }
  );
}
