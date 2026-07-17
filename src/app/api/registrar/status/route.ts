import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { spaceshipAPI } from '@/lib/spaceship-adapter';

/** Verifica ligação à API do registrador (ping / listagem). */
export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const result = await spaceshipAPI.listAllDomains();
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || 'Serviço de registo indisponível' },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: true, message: 'Serviço de registo operacional' });
}
