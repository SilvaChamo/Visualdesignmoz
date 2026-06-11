import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { spaceshipAPI } from '@/lib/spaceship-adapter';

/** Lista domínios na conta Spaceship (registador). */
export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const result = await spaceshipAPI.listAllDomains();
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || 'Erro ao listar domínios' },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, domains: result.domains });
}
