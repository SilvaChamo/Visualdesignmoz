import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { porkbunAPI } from '@/lib/porkbun-adapter';

/** Verifica ligação à API do registrador (ping). */
export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const result = await porkbunAPI.ping();
  if (result.status !== 'SUCCESS') {
    return NextResponse.json(
      { success: false, error: (result as { message?: string }).message || 'API do registrador indisponível' },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: true, data: result });
}
