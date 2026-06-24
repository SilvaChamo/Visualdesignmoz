import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';

/** Lê os registos DNS da zona no registrador (mockado para Spaceship). */
export async function POST(req: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  return NextResponse.json({ success: true, records: [] });
}
