import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { runHestiaFullSyncDeduped } from '@/lib/hestia-sync-engine';

/**
 * Sincronização manual Hestia → espelho Supabase.
 * Admin: sync completo. Revendedor: sync completo (espelho global; UI filtra por owner).
 */
export async function POST() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const result = await runHestiaFullSyncDeduped();
    return NextResponse.json({
      success: result.ok,
      message: result.ok
        ? 'Sincronização Hestia concluída.'
        : 'Sincronização concluída com avisos.',
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
