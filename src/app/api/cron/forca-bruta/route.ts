import { NextRequest, NextResponse } from 'next/server';
import { avisarForcaBruta } from '@/lib/forca-bruta-avisos';

/**
 * Cron: avisos de força bruta nas Mensagens dos administradores (como o DirectAdmin fazia no Hetzner) — lê os IPs
 * bloqueados pelo fail2ban do Hestia e cria uma mensagem com os novos. Ver src/lib/forca-bruta-avisos.ts.
 *
 * Header obrigatório: Authorization: Bearer ${CRON_SECRET}
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado — forca-bruta desactivado por segurança.' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  try {
    const r = await avisarForcaBruta();
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  } catch (error: unknown) {
    console.error('[cron/forca-bruta] GET:', error);
    return NextResponse.json({ ok: false, erro: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 });
  }
}
