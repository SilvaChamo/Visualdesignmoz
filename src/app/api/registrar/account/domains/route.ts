import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { porkbunAPI } from '@/lib/porkbun-adapter';

/** Lista domínios na conta do registrador (uso interno Visual Design). */
export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const result = await porkbunAPI.listAllDomains(0);
  if (result.status !== 'SUCCESS') {
    return NextResponse.json(
      { success: false, error: (result as { message?: string }).message || 'Erro ao listar domínios' },
      { status: 400 }
    );
  }

  const domains = (result as { domains?: unknown[] }).domains || [];
  return NextResponse.json({ success: true, domains });
}
