import { NextRequest, NextResponse } from 'next/server';
import { runDaFullSyncDeduped } from '@/lib/da-sync-engine';

/**
 * Cron: espelha DirectAdmin → Supabase a cada 10 min (vercel.json).
 * Header: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const result = await runDaFullSyncDeduped();
    return NextResponse.json({ success: result.ok, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
