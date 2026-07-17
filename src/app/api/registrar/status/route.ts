import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { spaceshipAPI } from '@/lib/spaceship-adapter';
import { porkbunAPI } from '@/lib/porkbun-adapter';

/** Verifica ligação às APIs dos dois registadores (ping / listagem). */
export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const [spaceshipResult, porkbunResult] = await Promise.all([
    spaceshipAPI.listAllDomains(),
    porkbunAPI.listAllDomains(),
  ]);

  if (!spaceshipResult.success && !porkbunResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Spaceship: ${spaceshipResult.error} | Porkbun: ${porkbunResult.error}`,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Serviço de registo operacional',
    spaceship: spaceshipResult.success ? 'ok' : `erro: ${spaceshipResult.error}`,
    porkbun: porkbunResult.success ? 'ok' : `erro: ${porkbunResult.error}`,
  });
}
