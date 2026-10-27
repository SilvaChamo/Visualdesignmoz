import { NextRequest, NextResponse } from 'next/server';
import { runHestiaFullSyncDeduped } from '@/lib/hestia-sync-engine';

/**
 * Cron: sincroniza o estado real do servidor Hestia (Contabo) de volta para
 * o espelho Supabase (panel_users/panel_sites) — o equivalente Hestia do
 * /api/cron/da-sync. Sem isto, alterações feitas directamente no painel
 * Hestia (suspensão, novo domínio, mudança de quota) nunca se reflectiam no
 * painel VisualDesign nem na Contabilidade/Gestão de Clientes.
 *
 * Header obrigatório: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado — hestia-sync desactivado por segurança.' },
      { status: 503 },
    );
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 });
  }

  try {
    const result = await runHestiaFullSyncDeduped();
    return NextResponse.json({ success: result.ok, ...result });
  } catch (error: unknown) {
    console.error('[cron/hestia-sync] GET:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
