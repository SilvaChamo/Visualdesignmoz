import { NextRequest, NextResponse } from 'next/server';
import { runDaFullSyncDeduped } from '@/lib/da-sync-engine';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

// Intervalo mínimo entre execuções, independentemente de quantas vezes
// esta rota for chamada. Protege contra chamadas externas repetidas
// (monitorização esquecida, aba de browser presa, etc.) que consumam
// CPU desnecessária no Vercel.
const MIN_INTERVAL_MS = 20 * 60 * 1000; // 20 minutos

/**
 * Cron: espelha DirectAdmin → Supabase a cada 10 min (vercel.json).
 * Header: Authorization: Bearer ${CRON_SECRET}
 *
 * Circuit breaker: se já correu há menos de MIN_INTERVAL_MS, salta a
 * execução em vez de repetir o full sync (que é pesado em CPU).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const admin = getDaSyncAdmin();
    if (admin) {
      const { data: last } = await admin
        .from('panel_sync_log')
        .select('started_at')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (last?.started_at) {
        const elapsedMs = Date.now() - new Date(last.started_at).getTime();
        if (elapsedMs < MIN_INTERVAL_MS) {
          return NextResponse.json({
            success: true,
            skipped: true,
            reason: `Sincronização recente há ${Math.round(elapsedMs / 1000)}s — a saltar (mínimo entre execuções: ${MIN_INTERVAL_MS / 60000} min).`,
          });
        }
      }
    }

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
