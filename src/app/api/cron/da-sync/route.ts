import { NextRequest, NextResponse } from 'next/server';
import { runDaFullSyncDeduped } from '@/lib/da-sync-engine';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

// ─── Protecção de CPU ────────────────────────────────────────────────────────
// Intervalo mínimo entre execuções — evita que monitores externos ou
// abas de browser presas consumam CPU desnecessariamente no Vercel.
// Free tier: 4h/mês → 1 sync/hora = máx ~720 min/mês (safe).
const MIN_INTERVAL_MS = 60 * 60 * 1000; // 60 minutos (era 20)

// Tempo máximo de execução em ms antes de retornar (deixa o sync correr
// em background mas evita que a função Vercel contabilize CPU extra).
const MAX_EXEC_MS = 55_000; // 55 segundos

/**
 * Cron: espelha DirectAdmin → Supabase.
 * Header obrigatório: Authorization: Bearer ${CRON_SECRET}
 *
 * Circuit breaker duplo:
 *  1. CRON_SECRET obrigatório — bloqueia chamadas externas sem token.
 *  2. MIN_INTERVAL_MS — salta execução se o último sync foi recente.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  // CRON_SECRET é agora OBRIGATÓRIO — sem ele ninguém executa o sync.
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado — sync desactivado por segurança.' },
      { status: 503 },
    );
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const admin = getDaSyncAdmin();
    if (admin) {
      const { data: last } = await admin
        .from('panel_sync_log')
        .select('started_at, status')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (last?.started_at) {
        const elapsedMs = Date.now() - new Date(last.started_at).getTime();

        // Saltar se: sync recente OU sync ainda em curso
        if (elapsedMs < MIN_INTERVAL_MS || last.status === 'running') {
          return NextResponse.json({
            success: true,
            skipped: true,
            reason: last.status === 'running'
              ? 'Sync já em curso — a saltar.'
              : `Sync recente há ${Math.round(elapsedMs / 60000)} min — próximo em ${Math.round((MIN_INTERVAL_MS - elapsedMs) / 60000)} min.`,
          });
        }
      }
    }

    // Executar com timeout — retorna resposta rápida, sync continua em bg
    const syncPromise = runDaFullSyncDeduped();
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), MAX_EXEC_MS),
    );

    const winner = await Promise.race([syncPromise, timeoutPromise]);

    if (winner === null) {
      // Timeout atingido — sync ainda a correr em background
      return NextResponse.json({
        success: true,
        running: true,
        note: `Sync iniciado — a correr em background (>${MAX_EXEC_MS / 1000}s).`,
      });
    }

    return NextResponse.json({ success: winner.ok, ...winner });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
