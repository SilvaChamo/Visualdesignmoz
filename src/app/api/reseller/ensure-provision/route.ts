import { NextResponse } from 'next/server';
import { requireAdminResellerOrManager } from '@/lib/panel-api-auth';
import { ensureResellerProvisioned } from '@/lib/reseller-auto-provision';

/** Auto-provisiona revendedor/profissional ao aceder ao painel (idempotente).
 *  "manager" ainda não tem provisionamento próprio aqui — fica sempre skipped,
 *  sem alteração de privilégio. */
export async function POST() {
  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return auth.error;

  if (auth.user.role !== 'reseller' && auth.user.role !== 'profissional') {
    return NextResponse.json({ success: true, skipped: true, reason: auth.user.role });
  }

  try {
    const result = await ensureResellerProvisioned({
      userId: auth.user.id,
      email: auth.user.email || '',
    });

    return NextResponse.json({
      success: true,
      provisioned: !result.alreadyProvisioned,
      alreadyProvisioned: Boolean(result.alreadyProvisioned),
      daUsername: result.daUsername,
      daDomain: result.daDomain,
      generatedPassword: result.generatedPassword,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro no auto-provisionamento';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
