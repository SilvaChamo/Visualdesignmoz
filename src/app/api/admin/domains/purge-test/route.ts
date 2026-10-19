import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { purgeRegistrarTestDomains } from '@/lib/purge-test-domains';

/** Apaga de vez os domínios de teste (registador + servidor + DNS + base). */
export async function POST() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const result = await purgeRegistrarTestDomains();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao apagar domínios de teste';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
