import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getResellerDaUsername } from '@/lib/directadmin-credentials';
import { loadResellerCredentialsByUserId } from '@/lib/da-credential-store';

export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  if (auth.user.role === 'admin') {
    return NextResponse.json({
      success: true,
      daUsername: process.env.DIRECTADMIN_USER || 'admin',
      daDomain: null,
      provisioned: true,
    });
  }

  const stored = auth.user.id ? await loadResellerCredentialsByUserId(auth.user.id) : null;
  const daUsername = stored?.user || (await getResellerDaUsername(auth.user));

  return NextResponse.json({
    success: true,
    daUsername,
    daDomain: stored?.domain || null,
    provisioned: Boolean(stored?.user),
  });
}
