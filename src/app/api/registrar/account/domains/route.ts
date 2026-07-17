import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { spaceshipAPI } from '@/lib/spaceship-adapter';
import { porkbunAPI } from '@/lib/porkbun-adapter';

/** Lista domínios de ambos os registadores (Spaceship + Porkbun), numa vista única. */
export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const [spaceshipResult, porkbunResult] = await Promise.all([
    spaceshipAPI.listAllDomains(),
    porkbunAPI.listAllDomains(),
  ]);

  const domains = [
    ...(spaceshipResult.success ? spaceshipResult.domains.map((d) => ({ ...d, registrar: 'spaceship' as const })) : []),
    ...(porkbunResult.success ? porkbunResult.domains.map((d) => ({ ...d, registrar: 'porkbun' as const })) : []),
  ];

  // Se ambos falharem, devolver erro. Se só um falhar, devolver o que temos
  // com um aviso (não interrompe a visualização dos domínios do outro).
  if (!spaceshipResult.success && !porkbunResult.success) {
    return NextResponse.json(
      { success: false, error: spaceshipResult.error || porkbunResult.error || 'Erro ao listar domínios' },
      { status: 400 },
    );
  }

  const warnings = [
    !spaceshipResult.success ? `Spaceship: ${spaceshipResult.error}` : null,
    !porkbunResult.success ? `Porkbun: ${porkbunResult.error}` : null,
  ].filter(Boolean);

  return NextResponse.json({ success: true, domains, warnings: warnings.length ? warnings : undefined });
}
