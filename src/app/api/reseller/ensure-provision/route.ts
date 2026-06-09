import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { ensureResellerProvisioned } from '@/lib/reseller-auto-provision';

/** Auto-provisiona revendedor ao aceder ao painel (idempotente). */
export async function POST() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  if (auth.user.role !== 'reseller') {
    return NextResponse.json({ success: true, skipped: true, reason: 'admin' });
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
